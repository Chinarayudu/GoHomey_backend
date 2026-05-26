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

  // --- Order Management ---

  async getAllOrders(filters: { status?: any; type?: any; chefId?: string; userId?: string } = {}) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.type) where.order_type = filters.type;
    if (filters.chefId) where.chef_id = filters.chefId;
    if (filters.userId) where.user_id = filters.userId;

    return prisma.order.findMany({
      where,
      include: {
        user: { select: { name: true, phone: true } },
        chef: { select: { name: true, kitchen_name: true } },
        payment: true,
        delivery: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async getOrdersReadyForDelivery() {
    return prisma.order.findMany({
      where: {
        status: 'READY_FOR_PICKUP',
      },
      include: {
        user: { select: { name: true, phone: true } },
        chef: { select: { name: true, kitchen_name: true, kitchen_address: true } },
        delivery: true,
        items: true,
      },
      orderBy: { updated_at: 'asc' },
    });
  }

  async getOrderDetails(orderId: string) {
    return prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { include: { addresses: true } },
        chef: true,
        items: {
          include: {
            daily_meal: true,
            pantry_item: true,
            fuel_slot: true,
            social_event: true,
          },
        },
        payment: true,
        delivery: {
          include: {
            partner: true,
          },
        },
      },
    });
  }

  async updateOrderStatus(orderId: string, status: any) {
    return prisma.order.update({
      where: { id: orderId },
      data: { status },
    });
  }

  // --- Chef Management ---

  async getChefs(filters: { applicationStatus?: any; isVerified?: boolean } = {}) {
    const where: any = {};
    if (
      filters.applicationStatus &&
      String(filters.applicationStatus).toLowerCase() !== 'all'
    ) {
      where.application_status = filters.applicationStatus;
    }
    if (filters.isVerified !== undefined) where.is_verified = filters.isVerified;

    return prisma.chef.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, phone: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async getChefDetails(chefId: string) {
    return prisma.chef.findUnique({
      where: { id: chefId },
      include: {
        user: true,
        meals: { take: 5, orderBy: { created_at: 'desc' } },
        orders: { take: 10, orderBy: { created_at: 'desc' }, include: { payment: true } },
      },
    });
  }

  async updateChefApplication(chefId: string, status: any, isVerified?: boolean) {
    const data: any = { application_status: status };
    if (isVerified !== undefined) data.is_verified = isVerified;

    return prisma.chef.update({
      where: { id: chefId },
      data,
    });
  }

  // --- User Management ---

  async getAllUsers() {
    return prisma.user.findMany({
      where: { role: 'USER' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        created_at: true,
        _count: {
          select: { orders: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }
}

export const adminService = new AdminService();
