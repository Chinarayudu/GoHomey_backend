import { Router } from 'express';
import { paymentsService } from './payments.service';
import { jwtAuth } from '../common/middleware/auth.middleware';

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
 *     responses:
 *       200:
 *         description: Payment initiated
 */
// POST /api/v1/payments/create
paymentsRouter.post('/create', jwtAuth, async (req, res, next) => {

  try {
    const { orderId } = req.body;
    const result = await paymentsService.createPayment(orderId);
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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const result = await paymentsService.verifyPayment(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default paymentsRouter;
