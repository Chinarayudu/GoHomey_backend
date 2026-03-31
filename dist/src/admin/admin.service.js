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
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let AdminService = class AdminService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getPlatformStats() {
        const totalUsers = await this.prisma.user.count();
        const totalChefs = await this.prisma.chef.count({
            where: { is_verified: true },
        });
        const pendingChefs = await this.prisma.chef.count({
            where: { is_verified: false },
        });
        const totalOrders = await this.prisma.order.count();
        const revenue = await this.prisma.payment.aggregate({
            where: { status: 'COMPLETED' },
            _sum: { amount: true },
        });
        return {
            users: totalUsers,
            chefs: {
                verified: totalChefs,
                pending: pendingChefs,
            },
            orders: totalOrders,
            revenue: revenue?._sum?.amount || 0,
        };
    }
    async getTopChefs() {
        const topChefs = await this.prisma.order.groupBy({
            by: ['chef_id'],
            _count: {
                id: true,
            },
            orderBy: {
                _count: {
                    id: 'desc',
                },
            },
            take: 5,
        });
        const enrichedChefs = await Promise.all(topChefs.map(async (item) => {
            const chef = await this.prisma.chef.findUnique({
                where: { id: item.chef_id },
                include: { user: { select: { name: true } } },
            });
            return {
                ...chef,
                orderCount: item._count.id,
            };
        }));
        return enrichedChefs;
    }
    async getDailyRevenue(days = 7) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const revenuePerDay = await this.prisma.payment.findMany({
            where: {
                status: 'COMPLETED',
                created_at: {
                    gte: startDate,
                },
            },
            select: {
                amount: true,
                created_at: true,
            },
            orderBy: {
                created_at: 'asc',
            },
        });
        return revenuePerDay;
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminService);
//# sourceMappingURL=admin.service.js.map