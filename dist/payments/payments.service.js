"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentsService = exports.PaymentsService = void 0;
const prisma_service_1 = require("../prisma/prisma.service");
class PaymentsService {
    async createPayment(orderId) {
        const order = await prisma_service_1.prisma.order.findUnique({
            where: { id: orderId },
        });
        if (!order) {
            const error = new Error('Order not found');
            error.status = 400;
            throw error;
        }
        const razorpayOrderId = `rzp_test_${Math.random().toString(36).substring(7)}`;
        const payment = await prisma_service_1.prisma.payment.create({
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
    async verifyPayment(razorpayOrderId, razorpayPaymentId, signature) {
        const payment = await prisma_service_1.prisma.payment.findFirst({
            where: { gateway_id: razorpayOrderId },
        });
        if (!payment) {
            const error = new Error('Payment not found');
            error.status = 400;
            throw error;
        }
        return prisma_service_1.prisma.$transaction(async (tx) => {
            await tx.payment.update({
                where: { id: payment.id },
                data: {
                    status: 'COMPLETED',
                    gateway_id: razorpayPaymentId,
                },
            });
            await tx.order.update({
                where: { id: payment.order_id },
                data: { status: 'CONFIRMED' },
            });
            return { success: true };
        });
    }
}
exports.PaymentsService = PaymentsService;
exports.paymentsService = new PaymentsService();
//# sourceMappingURL=payments.service.js.map