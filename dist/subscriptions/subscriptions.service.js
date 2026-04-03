"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionsService = exports.SubscriptionsService = void 0;
const prisma_service_1 = require("../prisma/prisma.service");
class SubscriptionsService {
    async createPlan(data) {
        return prisma_service_1.prisma.fuelPlan.create({
            data,
        });
    }
    async findAllPlans() {
        return prisma_service_1.prisma.fuelPlan.findMany({
            include: {
                slots: {
                    include: {
                        chef: {
                            include: {
                                user: {
                                    select: { name: true },
                                },
                            },
                        },
                    },
                },
            },
        });
    }
    async findOnePlan(id) {
        const plan = await prisma_service_1.prisma.fuelPlan.findUnique({
            where: { id },
            include: {
                slots: {
                    include: {
                        chef: {
                            include: {
                                user: {
                                    select: { name: true },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!plan) {
            const error = new Error('Subscription plan not found');
            error.status = 404;
            throw error;
        }
        return plan;
    }
    async createSlot(chefId, data) {
        const { plan_id, ...slotData } = data;
        return prisma_service_1.prisma.fuelSlot.create({
            data: {
                ...slotData,
                chef: { connect: { id: chefId } },
                plan: { connect: { id: plan_id } },
                slots_remaining: data.capacity,
            },
        });
    }
    async findSlotsByChef(chefId) {
        return prisma_service_1.prisma.fuelSlot.findMany({
            where: { chef_id: chefId },
            include: { plan: true },
        });
    }
}
exports.SubscriptionsService = SubscriptionsService;
exports.subscriptionsService = new SubscriptionsService();
//# sourceMappingURL=subscriptions.service.js.map