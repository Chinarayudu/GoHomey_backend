import { Router } from 'express';
import { paymentsService } from './payments.service';
import { jwtAuth, checkRoles } from '../common/middleware/auth.middleware';
import { Role } from '@prisma/client';
import { prisma } from '../prisma/prisma.service';
import { webhookRateLimiter } from '../common/middleware/rateLimit.middleware';

const paymentsRouter = Router();

/**
 * @openapi
 * /payments/create:
 *   post:
 *     summary: Initiate a payment
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orderId:
 *                 type: string
 *               amount:
 *                 type: integer
 *                 description: Optional frontend consistency check in paise. Backend calculates final amount as order total + platform fee.
 *     responses:
 *       200:
 *         description: Payment initiated
 */
// POST /api/v1/payments/create
paymentsRouter.post('/create', jwtAuth, async (req, res, next) => {
  try {
    const { orderId, amount } = req.body;
    const result = await paymentsService.createPayment(orderId, amount);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /payments/verify:
 *   post:
 *     summary: Verify a payment
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               razorpay_order_id:
 *                 type: string
 *               razorpay_payment_id:
 *                 type: string
 *               razorpay_signature:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment verified
 */
// POST /api/v1/payments/verify
paymentsRouter.post('/verify', async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;
    const result = await paymentsService.verifyPayment(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /payments/orders/{orderId}:
 *   get:
 *     summary: Get payment status for an order
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 */
// GET /api/v1/payments/orders/:orderId
paymentsRouter.get('/orders/:orderId', jwtAuth, async (req, res, next) => {
  try {
    const result = await paymentsService.getPaymentForOrder(
      req.params.orderId as string,
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/payments/chef/payouts
paymentsRouter.get(
  '/chef/payouts',
  jwtAuth,
  checkRoles(Role.CHEF),
  async (req, res, next) => {
    try {
      const user = req.user as any;
      const chef = await prisma.chef.findFirst({
        where: {
          OR: [{ id: user.id }, { user_id: user.id }],
        },
      });

      if (!chef) {
        return res
          .status(403)
          .json({ status: 'error', message: 'Chef profile not found' });
      }

      const result = await paymentsService.listChefPayouts(chef.id);
      res.json({ status: 'success', data: result });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /payments/webhook/razorpay:
 *   post:
 *     summary: Receive Razorpay payment webhooks
 *     tags: [Payments]
 */
// POST /api/v1/payments/webhook/razorpay
paymentsRouter.post('/webhook/razorpay', webhookRateLimiter, async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string | undefined;
    const rawBody = (req as any).rawBody as Buffer | undefined;

    if (!rawBody) {
      return res.status(500).json({ error: 'Raw request body not available' });
    }

    const result = await paymentsService.handleWebhook(
      rawBody,
      signature,
      req.body,
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default paymentsRouter;
