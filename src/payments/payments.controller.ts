import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('create')
  @ApiOperation({ summary: 'Initiate a new payment for an order' })
  createPayment(@Body('orderId') orderId: string) {
    return this.paymentsService.createPayment(orderId);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify payment from gateway (callback/webhook)' })
  verifyPayment(
    @Body('razorpay_order_id') razorpayOrderId: string,
    @Body('razorpay_payment_id') razorpayPaymentId: string,
    @Body('razorpay_signature') signature: string,
  ) {
    return this.paymentsService.verifyPayment(
      razorpayOrderId,
      razorpayPaymentId,
      signature,
    );
  }
}
