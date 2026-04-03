import { prisma } from '../prisma/prisma.service';

export class PaymentsService {
  async createPayment(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      const error: any = new Error('Order not found');
      error.status = 400;
      throw error;
    }

    const razorpayOrderId = `rzp_test_${Math.random().toString(36).substring(7)}`;

    const payment = await prisma.payment.create({
      data: {
        order_id: orderId,
        amount: order.total_price,
        status: 'PENDING',
        gateway_id: razorpayOrderId,
        escrow_status: 'HELD',
      },
    });

    return {
      payment_id: payment.id,
      razorpay_order_id: razorpayOrderId,
      amount: order.total_price,
      currency: 'INR',
    };
  }

  async verifyPayment(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    signature: string,
  ) {
    const payment = await prisma.payment.findFirst({
      where: { gateway_id: razorpayOrderId },
    });

    if (!payment) {
      const error: any = new Error('Payment not found');
      error.status = 400;
      throw error;
    }

    return prisma.$transaction(async (tx) => {
      // 1. Update Payment status
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          gateway_id: razorpayPaymentId,
        },
      });

      // 2. Update Order status
      await tx.order.update({
        where: { id: payment.order_id },
        data: { status: 'CONFIRMED' },
      });

      return { success: true };
    });
  }
}

export const paymentsService = new PaymentsService();
