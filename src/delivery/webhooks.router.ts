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
    
    console.log(`[Borzo Webhook] Received status ${status} for ${borzo_order_id}`);

    // Map Borzo status to our internal DeliveryStatus
    let internalStatus: DeliveryStatus | null = null;
    
    // Example Borzo statuses: available, active, completed, canceled, delayed
    if (status === 'active') internalStatus = DeliveryStatus.PICKED_UP;
    if (status === 'completed') internalStatus = DeliveryStatus.DELIVERED;
    if (status === 'canceled' || status === 'failed') internalStatus = DeliveryStatus.FAILED;

    if (internalStatus) {
      // Find delivery by external tracking ID
      const delivery = await prisma.delivery.findFirst({
        where: { external_tracking_id: borzo_order_id },
      });

      if (delivery && delivery.status !== internalStatus) {
        await deliveryService.updateDeliveryStatus(delivery.id, internalStatus);
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default webhooksRouter;
