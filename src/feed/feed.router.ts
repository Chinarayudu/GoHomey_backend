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
 *     parameters:
 *       - in: query
 *         name: latitude
 *         schema: { type: number }
 *       - in: query
 *         name: longitude
 *         schema: { type: number }
 */
feedRouter.get('/', jwtAuth, async (req, res, next) => {
  try {
    const user = req.user as any;
    const userId = user.id;
    const { latitude, longitude } = req.query as any;
    const userLat = latitude ? parseFloat(latitude as string) : user.latitude;
    const userLon = longitude ? parseFloat(longitude as string) : user.longitude;

    // 1. Get IDs of followed chefs
    const following = await prisma.follow.findMany({
      where: { user_id: userId },
      select: { chef_id: true },
    });

    const chefIds = following.map((f) => f.chef_id);

    if (chefIds.length === 0) {
      return res.json({ status: 'success', data: [] });
    }

    // 2. Fetch recent meals and social events with chef location
    const [meals, socialEvents] = await Promise.all([
      prisma.dailyMeal.findMany({
        where: { chef_id: { in: chefIds } },
        include: {
          chef: {
            select: {
              name: true,
              kitchen_name: true,
              latitude: true,
              longitude: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        take: 20,
      }),
      prisma.socialEvent.findMany({
        where: { chef_id: { in: chefIds } },
        include: {
          chef: {
            select: {
              name: true,
              kitchen_name: true,
              latitude: true,
              longitude: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        take: 20,
      }),
    ]);

    // 3. Filter by radius if coords provided
    let filteredMeals = meals;
    let filteredSocialEvents = socialEvents;

    if (userLat !== undefined && userLon !== undefined) {
      const { calculateDistance } = await import('../common/utils/location');
      filteredMeals = meals.filter((m) => {
        if (m.chef.latitude && m.chef.longitude) {
          return calculateDistance(userLat, userLon, m.chef.latitude, m.chef.longitude) <= 3;
        }
        return false;
      });
      filteredSocialEvents = socialEvents.filter((s) => {
        if (s.chef.latitude && s.chef.longitude) {
          return calculateDistance(userLat, userLon, s.chef.latitude, s.chef.longitude) <= 3;
        }
        return false;
      });
    }

    // 4. Combine and sort
    const feed = [
      ...filteredMeals.map((m) => ({ ...m, feed_type: 'DAILY_MEAL' })),
      ...filteredSocialEvents.map((s) => ({ ...s, feed_type: 'SOCIAL_EVENT' })),
    ].sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    res.json({ status: 'success', data: feed });
  } catch (error) {
    next(error);
  }
});

export default feedRouter;
