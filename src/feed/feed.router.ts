import { Router } from 'express';
import { prisma } from '../prisma/prisma.service';
import { jwtAuth } from '../common/middleware/auth.middleware';

const feedRouter = Router();

/**
 * @openapi
 * /feed:
 *   get:
 *     summary: Get chronological feed of updates from followed chefs
 *     tags: [Feed]
 *     security:
 *       - BearerAuth: []
 */
feedRouter.get('/', jwtAuth, async (req, res, next) => {
  try {
    const userId = (req.user as any).id;

    // 1. Get IDs of followed chefs
    const following = await prisma.follow.findMany({
      where: { user_id: userId },
      select: { chef_id: true },
    });

    const chefIds = following.map((f) => f.chef_id);

    if (chefIds.length === 0) {
      return res.json({ status: 'success', data: [] });
    }

    // 2. Fetch recent meals and social events
    const [meals, socialEvents] = await Promise.all([
      prisma.dailyMeal.findMany({
        where: { chef_id: { in: chefIds } },
        include: { chef: { select: { name: true, kitchen_name: true } } },
        orderBy: { created_at: 'desc' },
        take: 10,
      }),
      prisma.socialEvent.findMany({
        where: { chef_id: { in: chefIds } },
        include: { chef: { select: { name: true, kitchen_name: true } } },
        orderBy: { created_at: 'desc' },
        take: 10,
      }),
    ]);

    // 3. Combine and sort
    const feed = [
      ...meals.map((m) => ({ ...m, feed_type: 'DAILY_MEAL' })),
      ...socialEvents.map((s) => ({ ...s, feed_type: 'SOCIAL_EVENT' })),
    ].sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    res.json({ status: 'success', data: feed });
  } catch (error) {
    next(error);
  }
});

export default feedRouter;
