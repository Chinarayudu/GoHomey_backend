import { Router } from 'express';
import { adminService } from './admin.service';
import { jwtAuth, checkRoles } from '../common/middleware/auth.middleware';
import { Role } from '@prisma/client';

const adminRouter = Router();

// Apply admin protection to all routes in this router
adminRouter.use(jwtAuth, checkRoles(Role.ADMIN));

/**
 * @openapi
 * /admin/stats:
 *   get:
 *     summary: Get platform statistics (Admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved
 */
// GET /api/v1/admin/stats
adminRouter.get('/stats', async (req, res, next) => {

  try {
    const result = await adminService.getPlatformStats();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /admin/top-chefs:
 *   get:
 *     summary: Get top chefs (Admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Top chefs retrieved
 */
// GET /api/v1/admin/top-chefs
adminRouter.get('/top-chefs', async (req, res, next) => {

  try {
    const result = await adminService.getTopChefs();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /admin/revenue/daily:
 *   get:
 *     summary: Get daily revenue (Admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Daily revenue retrieved
 */
// GET /api/v1/admin/revenue/daily
adminRouter.get('/revenue/daily', async (req, res, next) => {

  try {
    const result = await adminService.getDailyRevenue();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default adminRouter;
