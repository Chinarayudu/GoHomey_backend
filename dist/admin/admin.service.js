"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminService = exports.AdminService = void 0;
const prisma_service_1 = require("../prisma/prisma.service");
class AdminService {
    async getPlatformStats() {
        const totalUsers = await prisma_service_1.prisma.user.count();
        const totalChefs = await prisma_service_1.prisma.chef.count({
            where: { is_verified: true },
        });
        const pendingChefs = await prisma_service_1.prisma.chef.count({
            where: { is_verified: false },
        });
        const totalOrders = await prisma_service_1.prisma.order.count();
        const revenue = await prisma_service_1.prisma.payment.aggregate({
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
        const topChefs = await prisma_service_1.prisma.order.groupBy({
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
            const chef = await prisma_service_1.prisma.chef.findUnique({
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
        const revenuePerDay = await prisma_service_1.prisma.payment.findMany({
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
}
exports.AdminService = AdminService;
exports.adminService = new AdminService();
//# sourceMappingURL=admin.service.js.map