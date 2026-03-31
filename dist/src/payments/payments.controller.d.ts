import { PaymentsService } from './payments.service';
export declare class PaymentsController {
    private readonly paymentsService;
    constructor(paymentsService: PaymentsService);
    createPayment(orderId: string): Promise<{
        payment_id: string;
        razorpay_order_id: string;
        amount: number;
        currency: string;
    }>;
    verifyPayment(razorpayOrderId: string, razorpayPaymentId: string, signature: string): Promise<any>;
}
