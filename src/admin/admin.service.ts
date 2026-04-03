import { prisma } from '../prisma/prisma.service';

export class AdminService {
  async getPlatformStats() {
    const totalUsers = await prisma.user.count();
    const totalChefs = await prisma.chef.count({
      where: { is_verified: true },
    });
    const pendingChefs = await prisma.chef.count({
      where: { is_verified: false },
    });
    const totalOrders = await prisma.order.count();

    const revenue = await prisma.payment.aggregate({
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
      revenue: (revenue as any)?._sum?.amount || 0,
    };
  }

  async getTopChefs() {
    // Basic implementation: top 5 chefs by order count
    const topChefs = await (prisma as any).order.groupBy({
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

    // Enrich with chef details
    const enrichedChefs = await Promise.all(
      topChefs.map(async (item: any) => {
        const chef = await prisma.chef.findUnique({
          where: { id: item.chef_id },
          include: { user: { select: { name: true } } } as any,
        });
        return {
          ...chef,
          orderCount: item._count.id,
        };
      }),
    );

    return enrichedChefs;
  }

  async getDailyRevenue(days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const revenuePerDay = await prisma.payment.findMany({
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

export const adminService = new AdminService();
