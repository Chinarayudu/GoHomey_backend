import { Router } from 'express';
import { deliveryService } from './delivery.service';
import { DeliveryStatus } from '@prisma/client';
import { prisma } from '../prisma/prisma.service';
import crypto from 'crypto';

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

  return { coid, status, trackingUrl };
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
  status?: string,
  trackingUrl?: string,
) {
  const internalStatus = status ? mapShadowfaxStatus(status) : null;

  const delivery = await prisma.delivery.findFirst({
    where: {
      OR: [{ order_id: String(coid) }, { external_tracking_id: String(coid) }],
    },
  });

  if (delivery) {
    if (internalStatus && delivery.status !== internalStatus) {
      console.log(
        `[Shadowfax Webhook] Updating Delivery ${delivery.id} status to ${internalStatus}`,
      );
      await deliveryService.updateDeliveryStatus(delivery.id, internalStatus);
    }
    if (trackingUrl && trackingUrl !== delivery.external_tracking_url) {
      await prisma.delivery.update({
        where: { id: delivery.id },
        data: { external_tracking_url: trackingUrl },
      });
    }
  } else {
    console.warn(
      `[Shadowfax Webhook] No matching delivery found for coid: ${coid}`,
    );
  }
}

function handleShadowfaxWebhook(req: any, res: any) {
  const { coid, status, trackingUrl } = extractShadowfaxCallback(req.body);

  if (!coid) {
    return res.status(400).json({
      error: 'Invalid payload: order identifier is required',
    });
  }

  console.log(
    `[Shadowfax Webhook] Received ${status ? `status "${status}"` : 'location update'} for order ID: ${coid}`,
  );

  res.status(200).json({ received: true });

  processShadowfaxWebhook(coid, status, trackingUrl).catch((error) => {
    console.error('Shadowfax webhook processing error:', error);
  });
}

// POST or PUT /api/v1/webhooks/shadowfax
webhooksRouter.post('/shadowfax', handleShadowfaxWebhook);
webhooksRouter.put('/shadowfax', handleShadowfaxWebhook);

/**
 * @openapi
 * /webhooks/borzo:
 *   post:
 *     summary: Receive delivery status updates from Borzo (legacy)
 *     tags: [Webhooks]
 */
// POST /api/v1/webhooks/borzo
webhooksRouter.post('/borzo', async (req, res) => {
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
