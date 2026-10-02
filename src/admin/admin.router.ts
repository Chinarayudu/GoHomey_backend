import { Router } from 'express';
import { adminService } from './admin.service';
import { deliveryService } from '../delivery/delivery.service';
import { jwtAuth, checkRoles } from '../common/middleware/auth.middleware';
import { Role } from '@prisma/client';
import type { ShadowfaxSandboxAction } from '../delivery/shadowfax.client';
import { adminImageUpload } from '../common/middleware/upload.middleware';
import { cloudinaryService } from '../common/services/cloudinary.service';
import { withdrawalsService } from '../withdrawals/withdrawals.service';

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
 * /admin/payouts:
 *   get:
 *     summary: List chef payouts, optionally filtered by status (Admin only)
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [RELEASED, PAID, FAILED]
 *         description: Filter payouts by status. Omit to return all payouts.
 *     responses:
 *       200:
 *         description: Chef payouts retrieved
 */
// GET /api/v1/admin/payouts?status=RELEASED|PAID|FAILED
adminRouter.get('/payouts', async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    const result = await adminService.getChefPayouts(status);
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

// --- Uploads ---

const DEFAULT_ADMIN_UPLOAD_FOLDER = 'homey/admin';
// Folders must stay under homey/ and use only safe path segments.
const ADMIN_UPLOAD_FOLDER_PATTERN = /^homey(\/[a-z0-9_-]+)+$/i;

/**
 * @openapi
 * /admin/uploads:
 *   post:
 *     summary: Upload an image to Cloudinary and get its URL (Admin only)
 *     description: >-
 *       Generic image upload for the admin portal (e.g. Fuel plan meal images
 *       before the plan is created). Put the returned `url` into the payload
 *       of the follow-up request, such as `menu_json.days[].meals.<period>.image_url`.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: JPEG, PNG or WebP, max 5 MB
 *               folder:
 *                 type: string
 *                 example: homey/fuel-meals
 *                 description: Optional Cloudinary folder under homey/. Defaults to homey/admin.
 *     responses:
 *       201:
 *         description: Image uploaded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url: { type: string }
 *                 public_id: { type: string }
 *       400:
 *         description: Missing/invalid file, file too large, or invalid folder
 */
// POST /api/v1/admin/uploads
adminRouter.post(
  '/uploads',
  (req, res, next) => {
    adminImageUpload.single('image')(req, res, (err: any) => {
      if (err) {
        err.status = 400;
        if (err.code === 'LIMIT_FILE_SIZE') err.message = 'Image must be 5 MB or smaller';
      }
      next(err);
    });
  },
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ status: 'error', message: 'image file is required' });
      }

      const rawFolder =
        typeof req.body?.folder === 'string' ? req.body.folder.trim() : '';
      const folder = rawFolder || DEFAULT_ADMIN_UPLOAD_FOLDER;
      if (!ADMIN_UPLOAD_FOLDER_PATTERN.test(folder)) {
        return res.status(400).json({
          status: 'error',
          message:
            'Invalid folder. Use a path under homey/ with letters, numbers, - or _ (e.g. homey/fuel-meals)',
        });
      }

      const uploaded = await cloudinaryService.uploadFile(req.file, folder);
      res.status(201).json({
        url: uploaded.secure_url,
        public_id: uploaded.public_id,
      });
    } catch (error) {
      next(error);
    }
  },
);

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
 * /admin/deliveries/{id}/cancel-shadowfax:
 *   post:
 *     summary: Cancel a dispatched Shadowfax order (Admin only)
 *     description: >-
 *       Calls Shadowfax `PUT /api/v2/orders/{sfx_order_id}/cancel/`. Allowed only
 *       before the rider collects the shipment. Marks the delivery FAILED and
 *       reverts an OUT_FOR_DELIVERY order to READY_FOR_PICKUP.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Delivery ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string, description: "Free text, max 128 chars" }
 *               user:
 *                 type: string
 *                 enum: [Customer, Seller, Rider]
 *                 default: Seller
 *     responses:
 *       200:
 *         description: Cancellation sent; returns delivery/order/provider status
 *       409:
 *         description: Delivery already picked up or delivered
 */
// POST /api/v1/admin/deliveries/:id/cancel-shadowfax
adminRouter.post(
  '/deliveries/:id/cancel-shadowfax',
  async (req, res, next) => {
    try {
      const allowedUsers = new Set(['Customer', 'Seller', 'Rider']);
      const user = allowedUsers.has(req.body?.user) ? req.body.user : 'Seller';
      const reason =
        typeof req.body?.reason === 'string' && req.body.reason.trim()
          ? req.body.reason.trim()
          : undefined;

      const result = await deliveryService.cancelShadowfaxDelivery(
        req.params.id,
        reason,
        user,
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

// --- Chef Withdrawals ---

/**
 * @openapi
 * /admin/withdrawals:
 *   get:
 *     summary: List chef withdrawal requests (Admin only)
 *     description: >-
 *       Each item carries the full bank snapshot and a `chef` block with the
 *       chef's current wallet_balance and completed (PAID) withdrawal count.
 *       `counts` gives per-status totals for tabs.
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, APPROVED, PAID, REJECTED, ALL] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: "{ status, data: { items, counts, pagination } }"
 */
adminRouter.get('/withdrawals', async (req, res, next) => {
  try {
    const data = await withdrawalsService.adminList(req.query as any);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /admin/withdrawals/{id}:
 *   get:
 *     summary: Withdrawal detail with audit history (Admin only)
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Withdrawal with `history`
 *       404:
 *         description: Not found
 */
adminRouter.get('/withdrawals/:id', async (req, res, next) => {
  try {
    const data = await withdrawalsService.adminGet(req.params.id);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /admin/withdrawals/{id}/status:
 *   patch:
 *     summary: Approve, mark paid, or reject a withdrawal (Admin only)
 *     description: >-
 *       PENDING → APPROVED → PAID (utr required). PENDING or APPROVED → REJECTED
 *       (reason required; the amount returns to the chef's wallet). Any other
 *       transition returns 409.
 *     tags: [Admin]
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
 *               status: { type: string, enum: [APPROVED, PAID, REJECTED] }
 *               utr: { type: string }
 *               reason: { type: string }
 *               details: { type: string }
 *     responses:
 *       200:
 *         description: Updated withdrawal with history
 *       400:
 *         description: Missing status / utr / reason
 *       409:
 *         description: Transition not allowed from the current status
 */
adminRouter.patch('/withdrawals/:id/status', async (req, res, next) => {
  try {
    const data = await withdrawalsService.adminUpdateStatus(
      req.params.id,
      (req.user as any).id,
      req.body,
    );
    res.json({ status: 'success', data });
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
