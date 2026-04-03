export declare class PaymentsService {
    createPayment(orderId: string): Promise<{
        payment_id: string;
        razorpay_order_id: string;
        amount: number;
        currency: string;
    }>;
    verifyPayment(razorpayOrderId: string, razorpayPaymentId: string, signature: string): Promise<{
        success: boolean;
    }>;
}
export declare const paymentsService: PaymentsService;
