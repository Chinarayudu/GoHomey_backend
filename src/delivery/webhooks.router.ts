import { Router } from 'express';
import { deliveryService } from './delivery.service';
import { DeliveryStatus } from '@prisma/client';
import { prisma } from '../prisma/prisma.service';
import crypto from 'crypto';

const webhooksRouter = Router();

/**
 * @openapi
 * /webhooks/borzo:
 *   post:
 *     summary: Receive delivery status updates from Borzo
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               order:
 *                 type: object
 *                 properties:
 *                   order_id:
 *                     type: integer
 *                   status:
 *                     type: string
 *     responses:
 *       200:
 *         description: Webhook received successfully
 */
// POST /api/v1/webhooks/borzo
webhooksRouter.post('/borzo', async (req, res, next) => {
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

      // Use constant-time comparison to prevent timing attacks
      const isVerified = crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(calculatedSignature, 'hex')
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
    const courier = order.courier; // Borzo often provides courier info
    
    console.log(`[Borzo Webhook] Received status "${status}" for Order ID: ${borzo_order_id}`);

    // Map Borzo status to our internal DeliveryStatus
    let internalStatus: DeliveryStatus | null = null;
    
    // Detailed Borzo statuses: 
    // - "available": No courier found yet
    // - "active": Courier picked up
    // - "completed": Delivered
    // - "canceled": Canceled by user/system
    // - "delayed": Courier is late
    
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
      // Find delivery by external tracking ID
      const delivery = await prisma.delivery.findFirst({
        where: { external_tracking_id: borzo_order_id },
      });

      if (delivery) {
        if (delivery.status !== internalStatus) {
          console.log(`[Borzo Webhook] Updating Delivery ${delivery.id} status to ${internalStatus}`);
          await deliveryService.updateDeliveryStatus(delivery.id, internalStatus);
        } else {
          console.log(`[Borzo Webhook] Delivery ${delivery.id} already has status ${internalStatus}. Skipping update.`);
        }
      } else {
        console.warn(`[Borzo Webhook] No matching delivery found for external ID: ${borzo_order_id}`);
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default webhooksRouter;
