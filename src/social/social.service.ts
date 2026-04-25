import { calculateDistance } from '../common/utils/location';
import { prisma } from '../prisma/prisma.service';

export class SocialService {
  async create(chefId: string, data: any): Promise<any> {
    const { date, end_date, ...rest } = data;
    return prisma.socialEvent.create({
      data: {
        ...rest,
        date: new Date(date),
        end_date: new Date(end_date),
        chef_id: chefId,
        slots_remaining: data.slots_total,
      },
    });
  }

  async getDashboardStats(chefId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // 1. Total Bookings This Month
    const bookingsThisMonth = await prisma.orderItem.count({
      where: {
        social_event: { chef_id: chefId },
        order: {
          created_at: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
          status: { not: 'CANCELLED' },
        },
      },
    });

    // 2. Upcoming Events with Ratios
    const upcomingEvents = await prisma.socialEvent.findMany({
      where: {
        chef_id: chefId,
        date: { gte: now },
      },
      include: {
        order_items: {
          include: {
            order: {
              include: {
                user: {
                  select: { gender: true },
                },
              },
            },
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    const eventsWithStats = upcomingEvents.map(event => {
      const maleBookings = event.order_items.reduce((sum, item) => 
        item.order.user.gender === 'MALE' ? sum + item.quantity : sum, 0);
      const femaleBookings = event.order_items.reduce((sum, item) => 
        item.order.user.gender === 'FEMALE' ? sum + item.quantity : sum, 0);
      const totalBooked = event.slots_total - event.slots_remaining;

      return {
        id: event.id,
        title: event.title,
        date: event.date,
        end_date: event.end_date,
        location: event.location,
        image_url: event.image_url,
        slots_total: event.slots_total,
        slots_remaining: event.slots_remaining,
        male_count: maleBookings,
        female_count: femaleBookings,
        social_balance: event.social_balance,
        active_ratio: event.slots_total > 0 ? (totalBooked / event.slots_total) * 100 : 0,
      };
    });

    // 3. Overall Active Ratio
    const totalPossibleSlots = upcomingEvents.reduce((sum, e) => sum + e.slots_total, 0);
    const totalBookedSlots = upcomingEvents.reduce((sum, e) => sum + (e.slots_total - e.slots_remaining), 0);
    const activeRatio = totalPossibleSlots > 0 ? (totalBookedSlots / totalPossibleSlots) * 100 : 0;

    // 4. Growth Strategy Tips
    let strategyTip = "Social dinners with a balanced gender ratio see a 40% higher re-booking rate. Keep up the great work!";
    if (activeRatio < 30) {
      strategyTip = "Consider offering a targeted early-bird discount for your next available slot to boost interest.";
    } else if (eventsWithStats.some(e => e.social_balance && Math.abs(e.male_count - e.female_count) > 2)) {
      strategyTip = "One of your events is trending towards a gender imbalance. Consider targeted marketing for female/male bookings to maintain the atelier vibe.";
    }

    return {
      totalBookingsThisMonth: bookingsThisMonth,
      activeRatio: Math.round(activeRatio),
      upcomingEvents: eventsWithStats,
      strategyTip,
    };
  }

  async findAll(query: { chefId?: string; date?: string; latitude?: number; longitude?: number }) {
    const { chefId, date, latitude, longitude } = query;
    const where: any = {};
    if (chefId) where.chef_id = chefId;
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      where.date = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    const events = await prisma.socialEvent.findMany({
      where,
      include: {
        chef: {
          include: {
            user: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (latitude !== undefined && longitude !== undefined) {
      return events.filter((event) => {
        if (event.chef.latitude && event.chef.longitude) {
          const distance = calculateDistance(
            latitude,
            longitude,
            event.chef.latitude,
            event.chef.longitude
          );
          return distance <= 3;
        }
        return false;
      });
    }

    return events;
  }

  async findOne(id: string): Promise<any> {
    const event = await prisma.socialEvent.findUnique({
      where: { id },
      include: {
        chef: {
          include: {
            user: {
              select: { name: true },
            },
          },
        },
      },
    });
    if (!event) {
      const error: any = new Error('Social event not found');
      error.status = 404;
      throw error;
    }
    return event;
  }

  async update(id: string, chefId: string, data: any): Promise<any> {
    const event = await this.findOne(id);
    if (event.chef_id !== chefId) {
      const error: any = new Error('You can only update your own events');
      error.status = 403;
      throw error;
    }

    // If slots_total is updated, we need to adjust slots_remaining
    if (data.slots_total !== undefined) {
      const diff = data.slots_total - event.slots_total;
      data.slots_remaining = event.slots_remaining + diff;
      if (data.slots_remaining < 0) {
        const error: any = new Error('New slots total cannot be less than already booked slots');
        error.status = 400;
        throw error;
      }
    }

    return prisma.socialEvent.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, chefId: string): Promise<void> {
    const event = await this.findOne(id);
    if (event.chef_id !== chefId) {
      const error: any = new Error('You can only delete your own events');
      error.status = 403;
      throw error;
    }
    await prisma.socialEvent.delete({ where: { id } });
  }
}

export const socialService = new SocialService();
