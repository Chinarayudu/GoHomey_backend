import { Router } from 'express';
import { jwtAuth } from '../common/middleware/auth.middleware';
import { notificationsService } from './notifications.service';

const notificationsRouter = Router();

// POST /api/v1/notifications/device-token
notificationsRouter.post('/device-token', jwtAuth, async (req, res, next) => {
  try {
    const { token, platform } = req.body;
    const result = await notificationsService.registerDeviceToken(
      (req.user as any).id,
      token,
      platform,
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

export default notificationsRouter;
