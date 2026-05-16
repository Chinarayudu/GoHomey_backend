import { Router } from 'express';
import { deliveryService } from './delivery.service';
import { DeliveryStatus } from '@prisma/client';
import { prisma } from '../prisma/prisma.service';
import crypto from 'crypto';

const webhooksRouter = Router();

function mapShadowfaxStatus(status: string): DeliveryStatus | null {
  switch (status) {
    case 'CREATED':
    case 'ALLOTTED':
    case 'ACCEPTED':
    case 'ARRIVED':
      return DeliveryStatus.ASSIGNED;
    case 'COLLECTED':
    case 'CUSTOMER_DOOR_STEP':
      return DeliveryStatus.PICKED_UP;
    case 'DELIVERED':
      return DeliveryStatus.DELIVERED;
    case 'CANCELLED':
    case 'RTS_INITIATED':
    case 'RTS_COMPLETED':
      return DeliveryStatus.FAILED;
    default:
      return null;
  }
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
// POST /api/v1/webhooks/shadowfax
webhooksRouter.post('/shadowfax', async (req, res) => {
  try {
    const { coid, status } = req.body;

    if (!coid || !status) {
      return res.status(400).json({ error: 'Invalid payload: coid and status required' });
    }

    console.log(`[Shadowfax Webhook] Received status "${status}" for order ID: ${coid}`);

    const internalStatus = mapShadowfaxStatus(status);

    if (internalStatus) {
      const delivery = await prisma.delivery.findFirst({
        where: {
          OR: [
            { order_id: String(coid) },
            { external_tracking_id: String(coid) },
          ],
        },
      });

      if (delivery) {
        if (delivery.status !== internalStatus) {
          console.log(
            `[Shadowfax Webhook] Updating Delivery ${delivery.id} status to ${internalStatus}`,
          );
          await deliveryService.updateDeliveryStatus(delivery.id, internalStatus);
        }
      } else {
        console.warn(`[Shadowfax Webhook] No matching delivery found for coid: ${coid}`);
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Shadowfax webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

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

    console.log(`[Borzo Webhook] Received status "${status}" for Order ID: ${borzo_order_id}`);

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
          await deliveryService.updateDeliveryStatus(delivery.id, internalStatus);
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
