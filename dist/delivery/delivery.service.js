"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliveryService = exports.DeliveryService = void 0;
const prisma_service_1 = require("../prisma/prisma.service");
class DeliveryService {
    async createDelivery(orderId, deliveryPartnerId) {
        const order = await prisma_service_1.prisma.order.findUnique({
            where: { id: orderId },
        });
        if (!order) {
            const error = new Error('Order not found');
            error.status = 404;
            throw error;
        }
        return prisma_service_1.prisma.delivery.create({
            data: {
                order_id: orderId,
                driver_id: deliveryPartnerId || 'PENDING_PARTNER',
                status: 'PENDING',
                pickup_time: new Date(),
            },
        });
    }
    async findActiveDeliveries() {
        return prisma_service_1.prisma.delivery.findMany({
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
        const delivery = await prisma_service_1.prisma.delivery.update({
            where: { id },
            data: { status },
        });
        if (status === 'DELIVERED') {
            await prisma_service_1.prisma.order.update({
                where: { id: delivery.order_id },
                data: { status: 'DELIVERED' },
            });
        }
        return delivery;
    }
    async processBatchedDeliveries() {
        console.log('Processing batched deliveries...');
        const pendingOrders = await prisma_service_1.prisma.order.findMany({
            where: {
                status: 'CONFIRMED',
                delivery: { is: null },
            },
            include: { chef: true },
        });
        if (pendingOrders.length === 0) {
            console.log('No pending orders for batching.');
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
            console.log(`Creating batch delivery for Chef ${chefId} with ${orders.length} orders`);
            for (const order of orders) {
                await this.createDelivery(order.id);
                await prisma_service_1.prisma.order.update({
                    where: { id: order.id },
                    data: { status: 'OUT_FOR_DELIVERY' },
                });
            }
        }
    }
}
exports.DeliveryService = DeliveryService;
exports.deliveryService = new DeliveryService();
//# sourceMappingURL=delivery.service.js.map