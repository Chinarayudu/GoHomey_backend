import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async createPayment(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    const razorpayOrderId = `rzp_test_${Math.random().toString(36).substring(7)}`;

    const payment = await this.prisma.payment.create({
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
    const payment = await this.prisma.payment.findFirst({
      where: { gateway_id: razorpayOrderId },
    });

    if (!payment) {
      throw new BadRequestException('Payment not found');
    }

    return (this.prisma as any).$transaction(async (tx: any) => {
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
