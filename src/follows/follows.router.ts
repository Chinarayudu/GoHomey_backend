import { Router } from 'express';
import { followsService } from './follows.service';
import { jwtAuth } from '../common/middleware/auth.middleware';

const followsRouter = Router();

/**
 * @openapi
 * /follows/chef/{chefId}:
 *   post:
 *     summary: Follow a chef
 *     tags: [Follows]
 *     security:
 *       - BearerAuth: []
 */
followsRouter.post('/chef/:chefId', jwtAuth, async (req, res, next) => {
  try {
    const result = await followsService.follow((req.user as any).id, req.params.chefId as string);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /follows/chef/{chefId}:
 *   delete:
 *     summary: Unfollow a chef
 *     tags: [Follows]
 *     security:
 *       - BearerAuth: []
 */
followsRouter.delete('/chef/:chefId', jwtAuth, async (req, res, next) => {
  try {
    await followsService.unfollow((req.user as any).id, req.params.chefId as string);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /follows/following:
 *   get:
 *     summary: Get list of chefs the user follows
 *     tags: [Follows]
 *     security:
 *       - BearerAuth: []
 */
followsRouter.get('/following', jwtAuth, async (req, res, next) => {
  try {
    const result = await followsService.findFollowing((req.user as any).id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default followsRouter;
