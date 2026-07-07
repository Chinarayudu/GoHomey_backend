import { Router } from 'express';
import { adminService } from './admin.service';
import { deliveryService } from '../delivery/delivery.service';
import { jwtAuth, checkRoles } from '../common/middleware/auth.middleware';
import { Role } from '@prisma/client';
import type { ShadowfaxSandboxAction } from '../delivery/shadowfax.client';

const adminRouter = Router();
const shadowfaxSandboxActions = new Set<ShadowfaxSandboxAction>([
  'ALLOT',
  'ARRIVE_AT_STORE',
  'COLLECT',
  'CUSTOMER_DOORSTEP',
  'DELIVER',
  'CUSTOMER_RETURN',
  'SELLER_RETURN',
]);

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

/**
 * @openapi
 * /admin/payouts/pending:
 *   get:
 *     summary: List chef payouts pending manual payment (Admin only)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Pending chef payouts retrieved
 */
// GET /api/v1/admin/payouts/pending
adminRouter.get('/payouts/pending', async (req, res, next) => {
  try {
    const result = await adminService.getPendingChefPayouts();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /admin/payouts/{id}/status:
 *   patch:
 *     summary: Update chef payout status after manual payment (Admin only)
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [RELEASED, PAID, FAILED]
 *     responses:
 *       200:
 *         description: Payout status updated
 */
// PATCH /api/v1/admin/payouts/:id/status
adminRouter.patch('/payouts/:id/status', async (req, res, next) => {
  try {
    const result = await adminService.updateChefPayoutStatus(
      req.params.id,
      req.body.status,
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// --- Order Management ---

/**
 * @openapi
 * /admin/orders:
 *   get:
 *     summary: List all orders (Admin only)
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of orders
 */
adminRouter.get('/orders', async (req, res, next) => {
  try {
    const { status, type, chefId, userId } = req.query;
    const result = await adminService.getAllOrders({
      status,
      type,
      chefId: chefId as string,
      userId: userId as string,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /admin/orders/ready:
 *   get:
 *     summary: List orders ready for delivery (Admin only)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: List of ready orders
 */
adminRouter.get('/orders/ready', async (req, res, next) => {
  try {
    const result = await adminService.getOrdersReadyForDelivery();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /admin/deliveries/dispatch-shadowfax:
 *   post:
 *     summary: Dispatch all ready-for-pickup orders to Shadowfax in one click (Admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dispatch summary with per-order results
 */
// POST /api/v1/admin/deliveries/dispatch-shadowfax
adminRouter.post('/deliveries/dispatch-shadowfax', async (req, res, next) => {
  try {
    const orderIds = Array.isArray(req.body?.order_ids)
      ? req.body.order_ids.filter((id: unknown) => typeof id === 'string')
      : undefined;
    const result =
      await deliveryService.dispatchReadyForPickupToShadowfax(orderIds);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /admin/deliveries/{id}/shadowfax-sandbox-status:
 *   post:
 *     summary: Move a Shadowfax staging sandbox delivery through test statuses
 *     tags: [Admin]
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
 *             required: [action]
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [ALLOT, ARRIVE_AT_STORE, COLLECT, CUSTOMER_DOORSTEP, DELIVER, CUSTOMER_RETURN, SELLER_RETURN]
 *     responses:
 *       200:
 *         description: Shadowfax staging status update sent
 */
// POST /api/v1/admin/deliveries/:id/shadowfax-sandbox-status
adminRouter.post(
  '/deliveries/:id/shadowfax-sandbox-status',
  async (req, res, next) => {
    try {
      const action =
        typeof req.body?.action === 'string'
          ? req.body.action.toUpperCase()
          : '';
      if (!shadowfaxSandboxActions.has(action as ShadowfaxSandboxAction)) {
        return res.status(400).json({
          error:
            'Invalid action. Use one of: ALLOT, ARRIVE_AT_STORE, COLLECT, CUSTOMER_DOORSTEP, DELIVER, CUSTOMER_RETURN, SELLER_RETURN',
        });
      }
      const result = await deliveryService.updateShadowfaxSandboxStatus(
        req.params.id,
        action as ShadowfaxSandboxAction,
        req.body,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /admin/orders/{id}:
 *   get:
 *     summary: Get detailed order info (Admin only)
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order details
 */
adminRouter.get('/orders/:id', async (req, res, next) => {
  try {
    const result = await adminService.getOrderDetails(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /admin/orders/{id}/status:
 *   patch:
 *     summary: Update order status (Admin override)
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Order updated
 */
adminRouter.patch('/orders/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const result = await adminService.updateOrderStatus(req.params.id, status);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// --- Chef Management ---

/**
 * @openapi
 * /admin/chefs:
 *   get:
 *     summary: List all chefs (Admin only)
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: applicationStatus
 *         schema:
 *           type: string
 *       - in: query
 *         name: isVerified
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of chefs
 */
adminRouter.get('/chefs', async (req, res, next) => {
  try {
    const { applicationStatus, isVerified } = req.query;
    const normalizedApplicationStatus =
      typeof applicationStatus === 'string' &&
      ['all', 'ALL', 'All', ''].includes(applicationStatus)
        ? undefined
        : applicationStatus;
    const result = await adminService.getChefs({
      applicationStatus: normalizedApplicationStatus,
      isVerified:
        isVerified === 'true'
          ? true
          : isVerified === 'false'
            ? false
            : undefined,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /admin/chefs/{id}:
 *   get:
 *     summary: Get detailed chef info (Admin only)
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chef details
 */
adminRouter.get('/chefs/:id', async (req, res, next) => {
  try {
    const result = await adminService.getChefDetails(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /admin/chefs/{id}/application:
 *   patch:
 *     summary: Update chef application status (Admin only)
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *               isVerified:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Chef application updated
 */
adminRouter.patch('/chefs/:id/application', async (req, res, next) => {
  try {
    const { status, isVerified } = req.body;
    const result = await adminService.updateChefApplication(
      req.params.id,
      status,
      isVerified,
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// --- User Management ---

/**
 * @openapi
 * /admin/users:
 *   get:
 *     summary: List all users (Admin only)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: List of users
 */
adminRouter.get('/users', async (req, res, next) => {
  try {
    const result = await adminService.getAllUsers();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default adminRouter;
