import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
export declare class PaymentsService {
    private prisma;
    private configService;
    constructor(prisma: PrismaService, configService: ConfigService);
    createPayment(orderId: string): Promise<{
        payment_id: string;
        razorpay_order_id: string;
        amount: number;
        currency: string;
    }>;
    verifyPayment(razorpayOrderId: string, razorpayPaymentId: string, signature: string): Promise<any>;
}
