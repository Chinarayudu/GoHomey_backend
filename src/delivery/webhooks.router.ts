import { Router } from 'express';
import { deliveryService } from './delivery.service';
import { DeliveryStatus } from '@prisma/client';
import { prisma } from '../prisma/prisma.service';
import crypto from 'crypto';
import { webhookRateLimiter } from '../common/middleware/rateLimit.middleware';
import { isForwardDeliveryTransition } from './delivery-status';

const webhooksRouter = Router();

function mapShadowfaxStatus(status: string): DeliveryStatus | null {
  switch (status.toUpperCase()) {
    case 'CREATED':
    case 'ALLOTTED':
    case 'ALLOTED':
    case 'ACCEPTED':
    case 'ARRIVED':
    case 'ARRIVED_AT_STORE':
      return DeliveryStatus.ASSIGNED;
    case 'COLLECTED':
    case 'CUSTOMER_DOOR_STEP':
    case 'CUSTOMER_DOORSTEP':
    case 'CUSTOMER_DOORSTEP_ARRIVAL':
    case 'ARRIVAL_CUSTOMER_DOORSTEP':
    case 'ARRIVED_CUSTOMER_DOORSTEP':
    case 'DISPATCHED':
      return DeliveryStatus.PICKED_UP;
    case 'DELIVERED':
      return DeliveryStatus.DELIVERED;
    case 'CANCELLED':
    case 'CANCELLED_BY_CUSTOMER':
    case 'CUSTOMER_RETURN':
    case 'RETURNED':
    case 'RETURNED_TO_SELLER':
    case 'SELLER_RETURN':
    case 'RTS_INITIATED':
    case 'RTS_COMPLETED':
      return DeliveryStatus.FAILED;
    default:
      return null;
  }
}

/**
 * Shadowfax's callback has no signature scheme of its own, so this is a
 * shared-secret header check we control on both ends. Opt-in via env var
 * presence (same pattern as the Borzo webhook below) so existing sandbox
 * testing keeps working until SHADOWFAX_WEBHOOK_SECRET is actually configured
 * — which also requires setting the same header value in Shadowfax's own
 * webhook/dashboard settings, not just here.
 */
function verifyShadowfaxWebhookSecret(req: any): boolean {
  const secret = process.env.SHADOWFAX_WEBHOOK_SECRET;
  if (!secret) return true;

  const provided = req.headers['x-shadowfax-webhook-secret'];
  if (typeof provided !== 'string' || !provided) return false;

  const providedBuf = Buffer.from(provided);
  const secretBuf = Buffer.from(secret);
  if (providedBuf.length !== secretBuf.length) return false;

  return crypto.timingSafeEqual(providedBuf, secretBuf);
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return undefined;
}

function normalizeShadowfaxTrackingUrl(
  trackingUrl?: string | null,
): string | undefined {
  const trimmed = trackingUrl?.trim();
  if (!trimmed) return undefined;

  const unavailableValues = new Set(['na', 'n/a', 'null', 'none', '-']);
  if (unavailableValues.has(trimmed.toLowerCase())) return undefined;

  const urlMatch = trimmed.match(/https?:\/\/[^\s)\]]+/i);
  return urlMatch?.[0];
}

function extractShadowfaxCallback(body: any) {
  const order = body?.order || body?.data || body?.payload || {};
  const coid = firstString(
    body?.coid,
    body?.order_id,
    body?.client_order_id,
    body?.clientOrderId,
    body?.sfx_order_id,
    body?.flash_order_id,
    order?.coid,
    order?.order_id,
    order?.client_order_id,
    order?.clientOrderId,
    order?.sfx_order_id,
    order?.flash_order_id,
  );
  // Marketplace callbacks carry both our order id (client_order_id) and
  // Shadowfax's own id (sfx_order_id, stored as external_tracking_id).
  const sfxOrderId = firstString(
    body?.sfx_order_id,
    body?.flash_order_id,
    order?.sfx_order_id,
    order?.flash_order_id,
  );
  const status = firstString(
    body?.status,
    body?.order_status,
    body?.event,
    body?.event_type,
    order?.status,
    order?.order_status,
    order?.event,
    order?.event_type,
  )?.toUpperCase();
  const trackingUrl = normalizeShadowfaxTrackingUrl(
    firstString(
      body?.track_url,
      body?.tracking_url,
      body?.track,
      order?.track_url,
      order?.tracking_url,
      order?.track,
    ),
  );

  return { coid, sfxOrderId, status, trackingUrl };
}

/**
 * @openapi
 * /webhooks/shadowfax:
 *   post:
 *     summary: Receive delivery status updates from Shadowfax Flash
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               coid:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Webhook received successfully
 */
async function processShadowfaxWebhook(
  coid: string,
  sfxOrderId?: string,
  status?: string,
  trackingUrl?: string,
) {
  const internalStatus = status ? mapShadowfaxStatus(status) : null;

  const delivery = await prisma.delivery.findFirst({
    where: {
      OR: [
        { order_id: coid },
        { external_tracking_id: coid },
        ...(sfxOrderId && sfxOrderId !== coid
          ? [{ external_tracking_id: sfxOrderId }]
          : []),
      ],
    },
  });

  if (delivery) {
    if (
      internalStatus &&
      isForwardDeliveryTransition(delivery.status, internalStatus)
    ) {
      console.log('[Shadowfax Webhook] updating delivery status', {
        coid,
        delivery_id: delivery.id,
        previous_status: delivery.status,
        next_status: internalStatus,
        provider_status: status,
      });
      await deliveryService.updateDeliveryStatus(delivery.id, internalStatus);
    } else if (internalStatus && delivery.status !== internalStatus) {
      console.log('[Shadowfax Webhook] ignored out-of-order status', {
        coid,
        delivery_id: delivery.id,
        current_status: delivery.status,
        provider_status: status,
      });
    }
    if (trackingUrl && trackingUrl !== delivery.external_tracking_url) {
      await prisma.delivery.update({
        where: { id: delivery.id },
        data: { external_tracking_url: trackingUrl },
      });
      console.log('[Shadowfax Webhook] saved tracking URL', {
        coid,
        delivery_id: delivery.id,
        tracking_url_present: true,
      });
    }
    console.log('[Shadowfax Webhook] processed callback', {
      coid,
      delivery_id: delivery.id,
      provider_status: status,
      internal_status: internalStatus,
      tracking_url_present: Boolean(trackingUrl),
    });
  } else {
    console.warn('[Shadowfax Webhook] no matching delivery found', {
      coid,
      provider_status: status,
      tracking_url_present: Boolean(trackingUrl),
    });
  }
}

function maskPhone(value: unknown): unknown {
  if (typeof value !== 'string' || value.length < 4) return value;
  return `${'*'.repeat(value.length - 4)}${value.slice(-4)}`;
}

/** Raw callback body for the logs, with the rider's phone number masked. */
function sanitizeShadowfaxPayload(body: any) {
  if (!body || typeof body !== 'object') return body;
  const { rider_contact, ...rest } = body;
  return rider_contact === undefined
    ? rest
    : { ...rest, rider_contact: maskPhone(rider_contact) };
}

function handleShadowfaxWebhook(req: any, res: any) {
  const requestMeta = {
    method: req.method,
    ip: req.ip,
    user_agent: req.headers['user-agent'],
  };

  console.log('[Shadowfax Webhook] incoming request', {
    ...requestMeta,
    payload: sanitizeShadowfaxPayload(req.body),
  });

  if (!verifyShadowfaxWebhookSecret(req)) {
    console.error('[Shadowfax Webhook] secret verification failed', {
      ...requestMeta,
      secret_header_present: Boolean(req.headers['x-shadowfax-webhook-secret']),
    });
    return res.status(401).json({ error: 'Invalid or missing webhook secret' });
  }

  const { coid, sfxOrderId, status, trackingUrl } = extractShadowfaxCallback(
    req.body,
  );

  if (!coid) {
    console.warn('[Shadowfax Webhook] rejected callback: no order identifier', {
      ...requestMeta,
      provider_status: status,
      status_code: 400,
    });
    return res.status(400).json({
      error: 'Invalid payload: order identifier is required',
    });
  }

  console.log('[Shadowfax Webhook] received callback', {
    method: req.method,
    coid,
    sfx_order_id: sfxOrderId,
    provider_status: status,
    tracking_url_present: Boolean(trackingUrl),
    has_body: Boolean(req.body),
  });

  res.status(200).json({ received: true });
  console.log('[Shadowfax Webhook] acknowledged callback', {
    coid,
    status_code: 200,
  });

  processShadowfaxWebhook(coid, sfxOrderId, status, trackingUrl).catch((error) => {
    console.error('[Shadowfax Webhook] processing error', {
      coid,
      sfx_order_id: sfxOrderId,
      provider_status: status,
      error: error instanceof Error ? error.stack || error.message : error,
    });
  });
}

// POST or PUT /api/v1/webhooks/shadowfax
webhooksRouter.post('/shadowfax', webhookRateLimiter, handleShadowfaxWebhook);
webhooksRouter.put('/shadowfax', webhookRateLimiter, handleShadowfaxWebhook);

/**
 * @openapi
 * /webhooks/borzo:
 *   post:
 *     summary: Receive delivery status updates from Borzo (legacy)
 *     tags: [Webhooks]
 */
// POST /api/v1/webhooks/borzo
webhooksRouter.post('/borzo', webhookRateLimiter, async (req, res) => {
  try {
    const signature = req.headers['x-dv-signature'] as string;
    const secret = process.env.BORZO_WEBHOOK_SECRET;

    if (secret) {
      if (!signature) {
        return res.status(401).json({ error: 'Missing X-DV-Signature header' });
      }

      const rawBody = (req as any).rawBody;
      if (!rawBody) {
        console.error('Raw body missing, cannot verify signature');
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(rawBody);
      const calculatedSignature = hmac.digest('hex');

      const isVerified = crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(calculatedSignature, 'hex'),
      );

      if (!isVerified) {
        console.error('Webhook signature verification failed!');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const { order } = req.body;

    if (!order || !order.order_id) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const borzo_order_id = order.order_id.toString();
    const status = order.status;

    console.log(
      `[Borzo Webhook] Received status "${status}" for Order ID: ${borzo_order_id}`,
    );

    let internalStatus: DeliveryStatus | null = null;

    switch (status) {
      case 'active':
        internalStatus = DeliveryStatus.PICKED_UP;
        break;
      case 'completed':
        internalStatus = DeliveryStatus.DELIVERED;
        break;
      case 'canceled':
      case 'failed':
        internalStatus = DeliveryStatus.FAILED;
        break;
      case 'available':
        internalStatus = DeliveryStatus.ASSIGNED;
        break;
    }

    if (internalStatus) {
      const delivery = await prisma.delivery.findFirst({
        where: { external_tracking_id: borzo_order_id },
      });

      if (delivery) {
        if (delivery.status !== internalStatus) {
          await deliveryService.updateDeliveryStatus(
            delivery.id,
            internalStatus,
          );
        }
      } else {
        console.warn(
          `[Borzo Webhook] No matching delivery found for external ID: ${borzo_order_id}`,
        );
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default webhooksRouter;
