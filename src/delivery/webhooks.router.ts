import { Router } from 'express';
import { deliveryService } from './delivery.service';
import { DeliveryStatus } from '@prisma/client';
import { prisma } from '../prisma/prisma.service';

const webhooksRouter = Router();

/**
 * @openapi
 * /webhooks/shadowfax:
 *   post:
 *     summary: Receive delivery status updates from Shadowfax
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               order_id:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Webhook received successfully
 */
// POST /api/v1/webhooks/shadowfax
webhooksRouter.post('/shadowfax', async (req, res, next) => {
  try {
    const { order_id: shadowfax_order_id, status } = req.body;
    
    // In a real integration, you would verify a webhook signature here!

    console.log(`[Shadowfax Webhook] Received status ${status} for ${shadowfax_order_id}`);

    // Map Shadowfax status to our internal DeliveryStatus
    let internalStatus: DeliveryStatus | null = null;
    if (status === 'PICKED_UP') internalStatus = DeliveryStatus.PICKED_UP;
    if (status === 'DELIVERED') internalStatus = DeliveryStatus.DELIVERED;
    if (status === 'CANCELLED' || status === 'FAILED') internalStatus = DeliveryStatus.FAILED;

    if (internalStatus) {
      // Find delivery by external tracking ID
      const delivery = await prisma.delivery.findFirst({
        where: { external_tracking_id: shadowfax_order_id },
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
