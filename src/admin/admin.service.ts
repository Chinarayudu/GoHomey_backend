import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

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
      revenue: (revenue as any)?._sum?.amount || 0,
    };
  }

  async getTopChefs() {
    // Basic implementation: top 5 chefs by order count
    const topChefs = await (this.prisma as any).order.groupBy({
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
      topChefs.map(async (item) => {
        const chef = await this.prisma.chef.findUnique({
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
}
