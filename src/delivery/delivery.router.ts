import { Router } from 'express';
import { deliveryService } from './delivery.service';
import { jwtAuth, checkRoles } from '../common/middleware/auth.middleware';
import { Role } from '@prisma/client';

const deliveryRouter = Router();

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

// GET /api/v1/delivery/active
deliveryRouter.get('/active', jwtAuth, async (req, res, next) => {
  try {
    const result = await deliveryService.findActiveDeliveries();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

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
