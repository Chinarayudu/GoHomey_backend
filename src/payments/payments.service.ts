import crypto from 'crypto';
import { PaymentStatus } from '@prisma/client';
import { prisma } from '../prisma/prisma.service';

type RazorpayOrderResponse = {
  id: string;
  entity: 'order';
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt?: string;
  status: 'created' | 'attempted' | 'paid';
  attempts: number;
  notes?: Record<string, string>;
  created_at: number;
};

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        status?: string;
        amount?: number;
        currency?: string;
        error_description?: string;
      };
    };
    order?: {
      entity?: {
        id?: string;
        status?: string;
      };
    };
  };
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    const error: any = new Error(`${name} is not configured`);
    error.status = 500;
    throw error;
  }
  return value;
}

function toPaise(amount: number): number {
  return Math.round(amount * 100);
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  return aBuffer.length === bBuffer.length && crypto.timingSafeEqual(aBuffer, bBuffer);
}

export class PaymentsService {
  private get keyId() {
    return requireEnv('RAZORPAY_KEY_ID');
  }

  private get keySecret() {
    return requireEnv('RAZORPAY_KEY_SECRET');
  }

  private get webhookSecret() {
    return process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  }

  private async razorpayRequest<T>(endpoint: string, body: unknown): Promise<T> {
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');

    const response = await fetch(`https://api.razorpay.com/v1${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        (data as { error?: { description?: string } }).error?.description ||
        (data as { message?: string }).message ||
        `Razorpay API error (${response.status})`;
      const error: any = new Error(message);
      error.status = response.status;
      error.details = data;
      throw error;
    }

    return data as T;
  }

  private verifyCheckoutSignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    signature: string,
  ) {
    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    return timingSafeEqual(expectedSignature, signature);
  }

  private verifyWebhookSignature(rawBody: Buffer, signature: string) {
    const secret = this.webhookSecret;
    if (!secret) {
      const error: any = new Error('RAZORPAY_WEBHOOK_SECRET is not configured');
      error.status = 500;
      throw error;
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    return timingSafeEqual(expectedSignature, signature);
  }

  async createPayment(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });

    if (!order) {
      const error: any = new Error('Order not found');
      error.status = 400;
      throw error;
    }

    if (order.payment?.status === PaymentStatus.COMPLETED) {
      const error: any = new Error('Order is already paid');
      error.status = 409;
      throw error;
    }

    if (order.payment?.status === PaymentStatus.PENDING && order.payment.razorpay_order_id) {
      return {
        payment_id: order.payment.id,
        razorpay_order_id: order.payment.razorpay_order_id,
        razorpay_key_id: this.keyId,
        amount: toPaise(order.payment.amount),
        amount_rupees: order.payment.amount,
        currency: order.payment.currency,
        status: order.payment.status,
      };
    }

    const amount = toPaise(order.total_price);
    if (amount <= 0) {
      const error: any = new Error('Order amount must be greater than zero');
      error.status = 400;
      throw error;
    }

    const receipt = `homey_${order.id.replace(/-/g, '').slice(0, 32)}`;
    const razorpayOrder = await this.razorpayRequest<RazorpayOrderResponse>('/orders', {
      amount,
      currency: 'INR',
      receipt,
      notes: {
        homey_order_id: order.id,
        chef_id: order.chef_id,
        user_id: order.user_id,
      },
    });

    const payment = order.payment
      ? await prisma.payment.update({
          where: { id: order.payment.id },
          data: {
            amount: order.total_price,
            currency: razorpayOrder.currency,
            status: PaymentStatus.PENDING,
            gateway_id: razorpayOrder.id,
            razorpay_order_id: razorpayOrder.id,
            razorpay_payment_id: null,
            razorpay_signature: null,
            razorpay_receipt: razorpayOrder.receipt || receipt,
            escrow_status: 'HELD',
          },
        })
      : await prisma.payment.create({
          data: {
            order_id: orderId,
            amount: order.total_price,
            currency: razorpayOrder.currency,
            status: PaymentStatus.PENDING,
            gateway_id: razorpayOrder.id,
            razorpay_order_id: razorpayOrder.id,
            razorpay_receipt: razorpayOrder.receipt || receipt,
            escrow_status: 'HELD',
          },
        });

    return {
      payment_id: payment.id,
      razorpay_order_id: razorpayOrder.id,
      razorpay_key_id: this.keyId,
      amount: razorpayOrder.amount,
      amount_rupees: payment.amount,
      currency: razorpayOrder.currency,
      status: payment.status,
    };
  }

  async verifyPayment(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    signature: string,
  ) {
    if (!razorpayOrderId || !razorpayPaymentId || !signature) {
      const error: any = new Error('razorpay_order_id, razorpay_payment_id and razorpay_signature are required');
      error.status = 400;
      throw error;
    }

    const isValid = this.verifyCheckoutSignature(
      razorpayOrderId,
      razorpayPaymentId,
      signature,
    );

    if (!isValid) {
      const error: any = new Error('Invalid Razorpay payment signature');
      error.status = 400;
      throw error;
    }

    const payment = await prisma.payment.findFirst({
      where: {
        OR: [
          { razorpay_order_id: razorpayOrderId },
          { gateway_id: razorpayOrderId },
        ],
      },
    });

    if (!payment) {
      const error: any = new Error('Payment not found');
      error.status = 400;
      throw error;
    }

    return prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.COMPLETED,
          razorpay_payment_id: razorpayPaymentId,
          razorpay_signature: signature,
          gateway_id: razorpayOrderId,
          escrow_status: 'HELD',
        },
      });

      const updatedOrder = await tx.order.update({
        where: { id: payment.order_id },
        data: { status: 'CONFIRMED' },
      });

      return {
        success: true,
        payment: updatedPayment,
        order: updatedOrder,
      };
    });
  }

  async getPaymentForOrder(orderId: string) {
    const payment = await prisma.payment.findUnique({
      where: { order_id: orderId },
      include: {
        order: {
          select: {
            id: true,
            status: true,
            total_price: true,
          },
        },
      },
    });

    if (!payment) {
      const error: any = new Error('Payment not found for order');
      error.status = 404;
      throw error;
    }

    return payment;
  }

  async handleWebhook(rawBody: Buffer, signature: string | undefined, payload: RazorpayWebhookPayload) {
    if (!signature) {
      const error: any = new Error('Missing X-Razorpay-Signature header');
      error.status = 401;
      throw error;
    }

    if (!this.verifyWebhookSignature(rawBody, signature)) {
      const error: any = new Error('Invalid Razorpay webhook signature');
      error.status = 401;
      throw error;
    }

    const event = payload.event;
    const paymentEntity = payload.payload?.payment?.entity;
    const razorpayOrderId = paymentEntity?.order_id || payload.payload?.order?.entity?.id;

    if (!event || !razorpayOrderId) {
      return { received: true, ignored: true, reason: 'Unsupported Razorpay webhook payload' };
    }

    const payment = await prisma.payment.findFirst({
      where: {
        OR: [
          { razorpay_order_id: razorpayOrderId },
          { gateway_id: razorpayOrderId },
        ],
      },
    });

    if (!payment) {
      return { received: true, ignored: true, reason: 'Payment not found' };
    }

    if (event === 'payment.captured' || event === 'order.paid') {
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.COMPLETED,
            razorpay_payment_id: paymentEntity?.id || payment.razorpay_payment_id,
            gateway_id: razorpayOrderId,
            escrow_status: 'HELD',
          },
        });

        await tx.order.update({
          where: { id: payment.order_id },
          data: { status: 'CONFIRMED' },
        });
      });
    }

    if (event === 'payment.failed') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          razorpay_payment_id: paymentEntity?.id || payment.razorpay_payment_id,
          gateway_id: razorpayOrderId,
        },
      });
    }

    if (event === 'refund.processed') {
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.REFUNDED,
            escrow_status: 'REFUNDED',
          },
        });

        await tx.order.update({
          where: { id: payment.order_id },
          data: { status: 'REFUNDED' },
        });
      });
    }

    return { received: true };
  }
}

export const paymentsService = new PaymentsService();
