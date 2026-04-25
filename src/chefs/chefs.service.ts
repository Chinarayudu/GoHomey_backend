import { calculateDistance } from '../common/utils/location';
import { prisma } from '../prisma/prisma.service';
import { Chef, Prisma, Role, ChefApplicationStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export class ChefsService {

  /**
   * Step 1: Create chef profile with personal info + cuisine
   * Called after OTP verification for Chef.
   */
  async registerStep1(idFromToken: string | undefined, data: {
    full_name: string;
    email: string;
    mobile_number: string;
    primary_cuisine: string;
  }): Promise<Chef> {
    let chef;

    // 1. Try to find the chef by User ID (if logged in as User) or by Phone
    if (idFromToken) {
      chef = await prisma.chef.findFirst({
        where: {
          OR: [{ id: idFromToken }, { user_id: idFromToken }],
        },
      });
    }

    if (!chef) {
      chef = await prisma.chef.findUnique({ where: { phone: data.mobile_number } });
    }

    // 2. Create or Update Chef record
    if (!chef) {
      // Check if a User exists with this phone to link them
      const existingUser = await prisma.user.findUnique({
        where: { phone: data.mobile_number },
      });

      // Create Chef with a random placeholder password for now
      const placeholderPassword = await bcrypt.hash(Math.random().toString(36), 10);
      const newChef = await prisma.chef.create({
        data: {
          name: data.full_name,
          email: data.email,
          phone: data.mobile_number,
          password: placeholderPassword,
          primary_cuisine: data.primary_cuisine,
          registration_step: 1,
          user_id: existingUser ? existingUser.id : undefined,
        },
      });

      if (existingUser) {
        // Upgrade User role to CHEF
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { role: Role.CHEF },
        });
      }

      return newChef;
    }

    // Update existing Chef
    return prisma.chef.update({
      where: { id: chef.id },
      data: {
        name: data.full_name,
        email: data.email,
        primary_cuisine: data.primary_cuisine,
        registration_step: Math.max(chef.registration_step, 1),
      },
    });
  }

  /**
   * Step 2: Kitchen space details
   */
  async registerStep2(chefId: string | undefined, data: {
    kitchen_name: string;
    kitchen_address: string;
    latitude: number;
    longitude: number;
    max_capacity: number;
    appliances: string[];
  }, phoneFallback?: string): Promise<Chef> {
    let chef;
    
    if (chefId) {
      chef = await prisma.chef.findFirst({
        where: {
          OR: [{ id: chefId }, { user_id: chefId }],
        },
      });
    }

    if (!chef && phoneFallback) {
      chef = await prisma.chef.findUnique({ where: { phone: phoneFallback } });
    }

    if (!chef) {
      const error: any = new Error('Chef profile not found. Complete Step 1 first.');
      error.status = 400;
      throw error;
    }

    return prisma.chef.update({
      where: { id: chef.id },
      data: {
        kitchen_name: data.kitchen_name,
        kitchen_address: data.kitchen_address,
        latitude: data.latitude,
        longitude: data.longitude,
        max_capacity: data.max_capacity,
        appliances: data.appliances,
        registration_step: Math.max(chef.registration_step, 2),
      },
    });
  }

  /**
   * Step 3: Document uploads
   */
  async registerStep3(chefId: string | undefined, files: {
    government_id_url?: string;
    food_safety_cert_url?: string;
    kitchen_photo_url?: string;
  }, phoneFallback?: string): Promise<Chef> {
    let chef;

    if (chefId) {
      chef = await prisma.chef.findFirst({
        where: {
          OR: [{ id: chefId }, { user_id: chefId }],
        },
      });
    }

    if (!chef && phoneFallback) {
      chef = await prisma.chef.findUnique({ where: { phone: phoneFallback } });
    }

    if (!chef) {
      const error: any = new Error('Chef profile not found. Complete Step 1 first.');
      error.status = 400;
      throw error;
    }

    if (chef.registration_step < 2) {
      const error: any = new Error('Please complete Step 2 (Kitchen Space) first.');
      error.status = 400;
      throw error;
    }

    return prisma.chef.update({
      where: { id: chef.id },
      data: {
        government_id_url: files.government_id_url || chef.government_id_url,
        food_safety_cert_url: files.food_safety_cert_url || chef.food_safety_cert_url,
        kitchen_photo_url: files.kitchen_photo_url || chef.kitchen_photo_url,
        registration_step: 3,
        application_status: ChefApplicationStatus.PENDING_REVIEW,
      },
    });
  }

  /**
   * Get registration status for a chef
   */
  async getRegistrationStatus(chefId: string | undefined, phoneFallback?: string) {
    let chef;

    if (chefId) {
      chef = await prisma.chef.findFirst({
        where: {
          OR: [{ id: chefId }, { user_id: chefId }],
        },
      });
    }

    if (!chef && phoneFallback) {
      chef = await prisma.chef.findUnique({ where: { phone: phoneFallback } });
    }

    if (!chef) {
      return {
        registered: false,
        current_step: 0,
        application_status: null,
      };
    }

    return {
      registered: true,
      current_step: chef.registration_step,
      application_status: chef.application_status,
      chef_id: chef.id,
      data: {
        name: chef.name,
        email: chef.email,
        phone: chef.phone,
        primary_cuisine: chef.primary_cuisine,
        kitchen_name: chef.kitchen_name,
        kitchen_address: chef.kitchen_address,
        latitude: chef.latitude,
        longitude: chef.longitude,
        max_capacity: chef.max_capacity,
        appliances: chef.appliances,
        government_id_url: chef.government_id_url,
        food_safety_cert_url: chef.food_safety_cert_url,
        kitchen_photo_url: chef.kitchen_photo_url,
      },
    };
  }

  async findOne(id: string): Promise<Chef | null> {
    return prisma.chef.findUnique({
      where: { id },
    });
  }

  async findByPhone(phone: string): Promise<Chef | null> {
    return prisma.chef.findUnique({
      where: { phone },
    });
  }

  async findAll(coords?: { latitude: number; longitude: number }) {
    const chefs = await prisma.chef.findMany({
      where: {
        application_status: ChefApplicationStatus.APPROVED,
      },
    });

    if (!coords) {
      return chefs;
    }

    return chefs
      .map((chef) => {
        if (chef.latitude && chef.longitude) {
          const distance = calculateDistance(
            coords.latitude,
            coords.longitude,
            chef.latitude,
            chef.longitude
          );
          return { ...chef, distance: parseFloat(distance.toFixed(2)) };
        }
        return { ...chef, distance: Infinity };
      })
      .filter((chef) => chef.distance <= 3)
      .sort((a: any, b: any) => a.distance - b.distance);
  }

  async verifyChef(id: string, isVerified: boolean, trustTier?: number) {
    return prisma.chef.update({
      where: { id },
      data: {
        is_verified: isVerified,
        trust_tier: trustTier !== undefined ? trustTier : undefined,
        application_status: isVerified
          ? ChefApplicationStatus.APPROVED
          : ChefApplicationStatus.REJECTED,
      },
    });
  }

  async updateApplicationStatus(id: string, status: ChefApplicationStatus) {
    return prisma.chef.update({
      where: { id },
      data: { application_status: status },
    });
  }

  async updateChef(id: string, data: Prisma.ChefUpdateInput) {
    return prisma.chef.update({
      where: { id },
      data,
    });
  }

  /**
   * Get dashboard statistics for a chef
   */
  async getDashboardData(chefId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 1. Calculate earnings today (Completed orders)
    const ordersToday = await prisma.order.findMany({
      where: {
        chef_id: chefId,
        created_at: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        payment: true,
      },
    });

    const earningsToday = ordersToday
      .filter((o) => o.status === 'DELIVERED' || o.status === 'OUT_FOR_DELIVERY' || o.status === 'PREPARING') // In real scenario, only DELIVERED might count for earnings, but Figma shows total revenue today
      .reduce((sum, o) => sum + o.total_price, 0);

    // 2. Count active slots
    const activeSlots = await prisma.dailyMeal.findMany({
      where: {
        chef_id: chefId,
        date: {
          gte: today,
        },
        slots_remaining: {
          gt: 0,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    return {
      earnings_today: earningsToday,
      orders_count_today: ordersToday.length,
      active_slots_count: activeSlots.length,
      active_slots: activeSlots.map((slot) => ({
        id: slot.id,
        meal_name: slot.meal_name,
        type: slot.type,
        service_window: slot.service_window,
        image_url: slot.image_url,
        slots_remaining: slot.slots_remaining,
        slots_total: slot.slots_total,
        price: slot.price,
        date: slot.date,
      })),
    };
  }

  /**
   * Get detailed profile including bank info
   */
  async getProfile(chefId: string) {
    return prisma.chef.findUnique({
      where: { id: chefId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        bio: true,
        rating: true,
        is_verified: true,
        primary_cuisine: true,
        kitchen_name: true,
        kitchen_address: true,
        max_capacity: true,
        bank_name: true,
        bank_account_number: true,
        ifsc_code: true,
        kitchen_photo_url: true,
      },
    });
  }

  /**
   * Update chef profile and bank details
   */
  async updateProfile(chefId: string, data: any) {
    return prisma.chef.update({
      where: { id: chefId },
      data: {
        name: data.name,
        email: data.email,
        bio: data.bio,
        kitchen_name: data.kitchen_name,
        kitchen_address: data.kitchen_address,
        bank_name: data.bank_name,
        bank_account_number: data.bank_account_number,
        ifsc_code: data.ifsc_code,
      },
    });
  }
}

export const chefsService = new ChefsService();
