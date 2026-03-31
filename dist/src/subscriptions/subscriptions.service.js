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
exports.SubscriptionsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let SubscriptionsService = class SubscriptionsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createPlan(data) {
        return this.prisma.fuelPlan.create({
            data,
        });
    }
    async findAllPlans() {
        return this.prisma.fuelPlan.findMany({
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
        const plan = await this.prisma.fuelPlan.findUnique({
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
            throw new common_1.NotFoundException('Subscription plan not found');
        }
        return plan;
    }
    async createSlot(chefId, data) {
        const { plan_id, ...slotData } = data;
        return this.prisma.fuelSlot.create({
            data: {
                ...slotData,
                chef: { connect: { id: chefId } },
                plan: { connect: { id: plan_id } },
                slots_remaining: data.capacity,
            },
        });
    }
    async findSlotsByChef(chefId) {
        return this.prisma.fuelSlot.findMany({
            where: { chef_id: chefId },
            include: { plan: true },
        });
    }
};
exports.SubscriptionsService = SubscriptionsService;
exports.SubscriptionsService = SubscriptionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SubscriptionsService);
//# sourceMappingURL=subscriptions.service.js.map