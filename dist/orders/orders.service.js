"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ordersService = exports.OrdersService = void 0;
const prisma_service_1 = require("../prisma/prisma.service");
const queues_1 = require("../common/queues/queues");
class OrdersService {
    async createDailyMealOrder(userId, mealId, quantity) {
        return prisma_service_1.prisma.$transaction(async (tx) => {
            const meal = await tx.dailyMeal.findUnique({
                where: { id: mealId },
            });
            if (!meal) {
                const error = new Error('Meal not found');
                error.status = 404;
                throw error;
            }
            if (meal.slots_remaining < quantity) {
                const error = new Error('Not enough slots available');
                error.status = 400;
                throw error;
            }
            await tx.dailyMeal.update({
                where: { id: mealId },
                data: {
                    slots_remaining: {
                        decrement: quantity,
                    },
                },
            });
            const order = await tx.order.create({
                data: {
                    user_id: userId,
                    chef_id: meal.chef_id,
                    order_type: 'DAILY_MEAL',
                    total_price: meal.price * quantity,
                    status: 'PENDING',
                    items: {
                        create: {
                            daily_meal_id: meal.id,
                            item_id: meal.id,
                            quantity,
                            price: meal.price,
                        },
                    },
                },
                include: {
                    items: true,
                },
            });
            await queues_1.ordersQueue.add('send-order-notification', {
                orderId: order.id,
                chefId: meal.chef_id,
                userId: userId,
            });
            return order;
        });
    }
    async createPantryOrder(userId, itemId, quantity) {
        return prisma_service_1.prisma.$transaction(async (tx) => {
            const item = await tx.pantryItem.findUnique({
                where: { id: itemId },
            });
            if (!item) {
                const error = new Error('Pantry item not found');
                error.status = 404;
                throw error;
            }
            if (item.inventory < quantity) {
                const error = new Error('Not enough inventory');
                error.status = 400;
                throw error;
            }
            await tx.pantryItem.update({
                where: { id: itemId },
                data: {
                    inventory: {
                        decrement: quantity,
                    },
                },
            });
            const order = await tx.order.create({
                data: {
                    user_id: userId,
                    chef_id: item.chef_id,
                    order_type: 'PANTRY_ITEM',
                    total_price: item.price * quantity,
                    status: 'PENDING',
                    items: {
                        create: {
                            pantry_id: item.id,
                            item_id: item.id,
                            quantity,
                            price: item.price,
                        },
                    },
                },
                include: {
                    items: true,
                },
            });
            await queues_1.ordersQueue.add('send-order-notification', {
                orderId: order.id,
                chefId: item.chef_id,
                userId: userId,
            });
            return order;
        });
    }
    async findUserOrders(userId) {
        return prisma_service_1.prisma.order.findMany({
            where: { user_id: userId },
            include: {
                items: true,
                payment: true,
                delivery: true,
            },
            orderBy: { created_at: 'desc' },
        });
    }
    async findChefOrders(chefId) {
        return prisma_service_1.prisma.order.findMany({
            where: { chef_id: chefId },
            include: {
                items: true,
                payment: true,
                delivery: true,
            },
            orderBy: { created_at: 'desc' },
        });
    }
    async updateOrderStatus(id, status) {
        const order = await prisma_service_1.prisma.order.update({
            where: { id },
            data: { status },
        });
        await queues_1.ordersQueue.add('send-order-status-update', {
            orderId: order.id,
            userId: order.user_id,
            status,
        });
        return order;
    }
}
exports.OrdersService = OrdersService;
exports.ordersService = new OrdersService();
//# sourceMappingURL=orders.service.js.map