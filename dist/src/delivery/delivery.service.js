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
var DeliveryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let DeliveryService = DeliveryService_1 = class DeliveryService {
    prisma;
    logger = new common_1.Logger(DeliveryService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createDelivery(orderId, deliveryPartnerId) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
        });
        if (!order) {
            throw new common_1.NotFoundException('Order not found');
        }
        return this.prisma.delivery.create({
            data: {
                order_id: orderId,
                driver_id: deliveryPartnerId || 'PENDING_PARTNER',
                status: 'PENDING',
                pickup_time: new Date(),
            },
        });
    }
    async findActiveDeliveries() {
        return this.prisma.delivery.findMany({
            where: {
                status: {
                    in: ['PENDING', 'PICKED_UP'],
                },
            },
            include: {
                order: {
                    include: {
                        user: { select: { name: true, phone: true } },
                        chef: { include: { user: { select: { name: true } } } },
                    },
                },
            },
        });
    }
    async updateDeliveryStatus(id, status) {
        const delivery = await this.prisma.delivery.update({
            where: { id },
            data: { status },
        });
        if (status === 'DELIVERED') {
            await this.prisma.order.update({
                where: { id: delivery.order_id },
                data: { status: 'DELIVERED' },
            });
        }
        return delivery;
    }
    async processBatchedDeliveries() {
        this.logger.log('Processing batched deliveries...');
        const pendingOrders = await this.prisma.order.findMany({
            where: {
                status: 'CONFIRMED',
                delivery: { is: null },
            },
            include: { chef: true },
        });
        if (pendingOrders.length === 0) {
            this.logger.log('No pending orders for batching.');
            return;
        }
        const chefGroups = pendingOrders.reduce((acc, order) => {
            if (!acc[order.chef_id])
                acc[order.chef_id] = [];
            acc[order.chef_id].push(order);
            return acc;
        }, {});
        for (const chefId in chefGroups) {
            const orders = chefGroups[chefId];
            this.logger.log(`Creating batch delivery for Chef ${chefId} with ${orders.length} orders`);
            for (const order of orders) {
                await this.createDelivery(order.id);
                await this.prisma.order.update({
                    where: { id: order.id },
                    data: { status: 'OUT_FOR_DELIVERY' },
                });
            }
        }
    }
};
exports.DeliveryService = DeliveryService;
exports.DeliveryService = DeliveryService = DeliveryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DeliveryService);
//# sourceMappingURL=delivery.service.js.map