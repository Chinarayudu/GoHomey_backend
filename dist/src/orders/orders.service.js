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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const prisma_service_1 = require("../prisma/prisma.service");
let OrdersService = class OrdersService {
    prisma;
    orderQueue;
    constructor(prisma, orderQueue) {
        this.prisma = prisma;
        this.orderQueue = orderQueue;
    }
    async createDailyMealOrder(userId, mealId, quantity) {
        return this.prisma.$transaction(async (tx) => {
            const meal = await tx.dailyMeal.findUnique({
                where: { id: mealId },
            });
            if (!meal) {
                throw new common_1.NotFoundException('Meal not found');
            }
            if (meal.slots_remaining < quantity) {
                throw new common_1.BadRequestException('Not enough slots available');
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
            await this.orderQueue.add('send-order-notification', {
                orderId: order.id,
                chefId: meal.chef_id,
                userId: userId,
            });
            return order;
        });
    }
    async createPantryOrder(userId, itemId, quantity) {
        return this.prisma.$transaction(async (tx) => {
            const item = await tx.pantryItem.findUnique({
                where: { id: itemId },
            });
            if (!item) {
                throw new common_1.NotFoundException('Pantry item not found');
            }
            if (item.inventory < quantity) {
                throw new common_1.BadRequestException('Not enough inventory');
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
            await this.orderQueue.add('send-order-notification', {
                orderId: order.id,
                chefId: item.chef_id,
                userId: userId,
            });
            return order;
        });
    }
    async findUserOrders(userId) {
        return this.prisma.order.findMany({
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
        return this.prisma.order.findMany({
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
        const order = await this.prisma.order.update({
            where: { id },
            data: { status },
        });
        await this.orderQueue.add('send-order-status-update', {
            orderId: order.id,
            userId: order.user_id,
            status,
        });
        return order;
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, bullmq_1.InjectQueue)('orders')),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        bullmq_2.Queue])
], OrdersService);
//# sourceMappingURL=orders.service.js.map