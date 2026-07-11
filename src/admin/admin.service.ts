import { prisma } from '../prisma/prisma.service';
import { paymentsService } from '../payments/payments.service';

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

  async getPendingChefPayouts() {
    return this.getChefPayouts('RELEASED');
  }

  async getChefPayouts(statusFilter?: string) {
    if (statusFilter && !['RELEASED', 'PAID', 'FAILED'].includes(statusFilter)) {
      const error: any = new Error('Invalid payout status');
      error.status = 400;
      throw error;
    }

    const payouts = await prisma.chefPayout.findMany({
      where: statusFilter ? { status: statusFilter } : {},
      include: {
        chef: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            bank_name: true,
            bank_account_number: true,
            ifsc_code: true,
          },
        },
        order: {
          select: {
            id: true,
            status: true,
            order_type: true,
            total_price: true,
            created_at: true,
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
          },
        },
        payment: {
          select: {
            id: true,
            status: true,
            escrow_status: true,
            amount: true,
            currency: true,
            razorpay_order_id: true,
            razorpay_payment_id: true,
          },
        },
      },
      orderBy: { released_at: 'desc' },
    });

    const totalAmount = payouts.reduce(
      (sum, payout) => sum + Number(payout.amount || 0),
      0,
    );

    return {
      status: 'success',
      summary: {
        count: payouts.length,
        total_amount: Math.round(totalAmount * 100) / 100,
        currency: payouts[0]?.currency || 'INR',
      },
      data: payouts.map((payout) => ({
        id: payout.id,
        status: payout.status,
        amount: payout.amount,
        currency: payout.currency,
        commission: payout.commission,
        platform_fee: payout.platform_fee,
        release_reason: payout.release_reason,
        released_at: payout.released_at,
        paid_at: payout.paid_at,
        chef: {
          id: payout.chef.id,
          name: payout.chef.name,
          phone: payout.chef.phone,
          email: payout.chef.email,
          bank_name: payout.chef.bank_name,
          bank_account_number: payout.chef.bank_account_number,
          ifsc_code: payout.chef.ifsc_code,
          bank_details_available: Boolean(
            payout.chef.bank_name &&
            payout.chef.bank_account_number &&
            payout.chef.ifsc_code,
          ),
        },
        order: payout.order,
        payment: payout.payment,
      })),
    };
  }

  async updateChefPayoutStatus(
    payoutId: string,
    status: 'RELEASED' | 'PAID' | 'FAILED',
  ) {
    if (!['RELEASED', 'PAID', 'FAILED'].includes(status)) {
      const error: any = new Error('Invalid payout status');
      error.status = 400;
      throw error;
    }

    const payout = await prisma.chefPayout.findUnique({
      where: { id: payoutId },
    });

    if (!payout) {
      const error: any = new Error('Chef payout not found');
      error.status = 404;
      throw error;
    }

    return prisma.chefPayout.update({
      where: { id: payoutId },
      data: {
        status,
        paid_at: status === 'PAID' ? new Date() : null,
      },
      include: {
        chef: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            bank_name: true,
            bank_account_number: true,
            ifsc_code: true,
          },
        },
        order: {
          select: {
            id: true,
            status: true,
            total_price: true,
          },
        },
        payment: {
          select: {
            id: true,
            status: true,
            escrow_status: true,
            amount: true,
            currency: true,
          },
        },
      },
    });
  }

  // --- Order Management ---

  async getAllOrders(
    filters: {
      status?: any;
      type?: any;
      chefId?: string;
      userId?: string;
    } = {},
  ) {
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
        delivery_address: true,
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
        chef: {
          select: { name: true, kitchen_name: true, kitchen_address: true },
        },
        delivery: true,
        delivery_address: true,
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
        delivery_address: true,
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
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status },
    });

    if (status === 'DELIVERED') {
      try {
        const payoutResult = await paymentsService.releaseChefPayoutForOrder(
          order.id,
          'ADMIN_ORDER_STATUS_DELIVERED',
        );
        console.log('[Chef Payout] admin status release result', {
          order_id: order.id,
          released: payoutResult.released,
          reason: (payoutResult as any).reason,
          payout_id: (payoutResult as any).payout?.id,
        });
      } catch (error) {
        console.error('[Chef Payout] admin status release failed', {
          order_id: order.id,
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    return order;
  }

  // --- Chef Management ---

  async getChefs(
    filters: { applicationStatus?: any; isVerified?: boolean } = {},
  ) {
    const where: any = {};
    if (
      filters.applicationStatus &&
      String(filters.applicationStatus).toLowerCase() !== 'all'
    ) {
      where.application_status = filters.applicationStatus;
    }
    if (filters.isVerified !== undefined)
      where.is_verified = filters.isVerified;

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
        orders: {
          take: 10,
          orderBy: { created_at: 'desc' },
          include: { payment: true },
        },
      },
    });
  }

  async updateChefApplication(
    chefId: string,
    status: any,
    isVerified?: boolean,
  ) {
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
