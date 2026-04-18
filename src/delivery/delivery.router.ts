import { Router } from 'express';
import { deliveryService } from './delivery.service';
import { jwtAuth, checkRoles } from '../common/middleware/auth.middleware';
import { Role } from '@prisma/client';

const deliveryRouter = Router();

/**
 * @openapi
 * /delivery/process-batch:
 *   post:
 *     summary: Process all pending deliveries into batches (Admin only)
 *     tags: [Delivery]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Batched deliveries processed successfully
 */
// POST /api/v1/delivery/process-batch
deliveryRouter.post(
  '/process-batch',
  jwtAuth,
  checkRoles(Role.ADMIN),
  async (req, res, next) => {
    try {
      const result = await deliveryService.processBatchedDeliveries();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /delivery/active:
 *   get:
 *     summary: Get all active deliveries
 *     tags: [Delivery]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved active deliveries
 */
// GET /api/v1/delivery/active
deliveryRouter.get('/active', jwtAuth, async (req, res, next) => {
  try {
    const result = await deliveryService.findActiveDeliveries();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /delivery/{id}/status:
 *   patch:
 *     summary: Update delivery status
 *     tags: [Delivery]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, ASSIGNED, PICKED_UP, DELIVERED, FAILED]
 *     responses:
 *       200:
 *         description: Delivery status updated
 */
// PATCH /api/v1/delivery/:id/status
deliveryRouter.patch('/:id/status', jwtAuth, async (req, res, next) => {
  try {
    const result = await deliveryService.updateDeliveryStatus(req.params.id as string, req.body.status);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default deliveryRouter;
