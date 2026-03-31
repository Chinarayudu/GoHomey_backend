"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const config_1 = require("@nestjs/config");
let PaymentsService = class PaymentsService {
    prisma;
    configService;
    constructor(prisma, configService) {
        this.prisma = prisma;
        this.configService = configService;
    }
    async createPayment(orderId) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
        });
        if (!order) {
            throw new common_1.BadRequestException('Order not found');
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
    async verifyPayment(razorpayOrderId, razorpayPaymentId, signature) {
        const payment = await this.prisma.payment.findFirst({
            where: { gateway_id: razorpayOrderId },
        });
        if (!payment) {
            throw new common_1.BadRequestException('Payment not found');
        }
        return this.prisma.$transaction(async (tx) => {
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
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map