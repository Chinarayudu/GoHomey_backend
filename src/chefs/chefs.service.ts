import { prisma } from '../prisma/prisma.service';
import { Chef, Prisma, Role, ChefApplicationStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { isServiceWindowOpen } from '../common/utils/time';
import { calculateDistance } from '../common/utils/location';
import { lookupIfsc } from '../common/services/bank.service';
import { publicChefSelect } from './chef.select';

const privateChefProfileSelect = {
  ...publicChefSelect,
  bank_name: true,
  bank_account_number: true,
  ifsc_code: true,
  government_id_url: true,
};

export class ChefsService {
  private getMealCatalogState(meal: any, startOfToday: Date) {
    if (meal.date < startOfToday) {
      return { is_active: false, inactive_reason: 'PAST_DATE' };
    }

    if (meal.slots_remaining <= 0) {
      return { is_active: false, inactive_reason: 'SOLD_OUT' };
    }

    if (!isServiceWindowOpen(meal)) {
      return { is_active: false, inactive_reason: 'SERVICE_WINDOW_CLOSED' };
    }

    return { is_active: true, inactive_reason: null };
  }

  private getPantryCatalogState(item: any) {
    if (item.inventory <= 0) {
      return { is_active: false, inactive_reason: 'OUT_OF_STOCK' };
    }

    return { is_active: true, inactive_reason: null };
  }

  private getSocialCatalogState(event: any, now: Date) {
    if (event.end_date < now) {
      return { is_active: false, inactive_reason: 'EVENT_ENDED' };
    }

    if (event.slots_remaining <= 0) {
      return { is_active: false, inactive_reason: 'SOLD_OUT' };
    }

    return { is_active: true, inactive_reason: null };
  }

  /**
   * Step 1: Create chef profile with personal info + cuisine
   * Called after OTP verification for Chef.
   */
  async registerStep1(
    idFromToken: string | undefined,
    data: {
      full_name: string;
      email: string;
      mobile_number: string;
      primary_cuisine: string;
    },
  ): Promise<Chef> {
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
      chef = await prisma.chef.findUnique({
        where: { phone: data.mobile_number },
      });
    }

    // 2. Create or Update Chef record
    if (!chef) {
      // Check if a User exists with this phone to link them
      const existingUser = await prisma.user.findUnique({
        where: { phone: data.mobile_number },
      });

      // Create Chef with a random placeholder password for now
      const placeholderPassword = await bcrypt.hash(
        Math.random().toString(36),
        10,
      );
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

    // Update existing Chef. If it isn't linked to a User yet but one exists for
    // this phone, link them and upgrade that User to CHEF — otherwise the chef
    // gets a USER-role token on their next login and 403s on chef routes.
    if (!chef.user_id) {
      const existingUser = await prisma.user.findUnique({
        where: { phone: data.mobile_number },
      });
      if (existingUser) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { role: Role.CHEF },
        });
        return prisma.chef.update({
          where: { id: chef.id },
          data: {
            name: data.full_name,
            email: data.email,
            primary_cuisine: data.primary_cuisine,
            registration_step: Math.max(chef.registration_step, 1),
            user_id: existingUser.id,
          },
        });
      }
    }

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
  async registerStep2(
    chefId: string | undefined,
    data: {
      kitchen_name: string;
      kitchen_address: string;
      latitude: number;
      longitude: number;
      max_capacity: number;
      appliances: string[];
    },
    phoneFallback?: string,
  ): Promise<Chef> {
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
      const error: any = new Error(
        'Chef profile not found. Complete Step 1 first.',
      );
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
  async registerStep3(
    chefId: string | undefined,
    files: {
      government_id_url?: string;
      food_safety_cert_url?: string;
      kitchen_photo_url?: string;
    },
    phoneFallback?: string,
  ): Promise<Chef> {
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
      const error: any = new Error(
        'Chef profile not found. Complete Step 1 first.',
      );
      error.status = 400;
      throw error;
    }

    if (chef.registration_step < 2) {
      const error: any = new Error(
        'Please complete Step 2 (Kitchen Space) first.',
      );
      error.status = 400;
      throw error;
    }

    return prisma.chef.update({
      where: { id: chef.id },
      data: {
        government_id_url: files.government_id_url || chef.government_id_url,
        food_safety_cert_url:
          files.food_safety_cert_url || chef.food_safety_cert_url,
        kitchen_photo_url: files.kitchen_photo_url || chef.kitchen_photo_url,
        registration_step: 3,
        application_status: ChefApplicationStatus.PENDING_REVIEW,
      },
    });
  }

  /**
   * Get registration status for a chef
   */
  async getRegistrationStatus(
    chefId: string | undefined,
    phoneFallback?: string,
  ) {
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

  async findOne(id: string): Promise<any> {
    return prisma.chef.findUnique({
      where: { id },
      select: publicChefSelect,
    });
  }

  async findByPhone(phone: string): Promise<Chef | null> {
    return prisma.chef.findUnique({
      where: { phone },
    });
  }

  async findAll(
    coords?: { latitude: number; longitude: number },
    options: { includeAll?: boolean } = {},
  ) {
    const chefs = await prisma.chef.findMany({
      where: options.includeAll
        ? {}
        : {
            application_status: ChefApplicationStatus.APPROVED,
          },
      select: publicChefSelect,
      orderBy: { created_at: 'desc' },
    });

    if (!coords) return chefs;

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

  async getCatalog(chefId: string) {
    const chef = await prisma.chef.findUnique({
      where: { id: chefId },
      select: publicChefSelect,
    });

    if (!chef) {
      const error: any = new Error('Chef profile not found');
      error.status = 404;
      throw error;
    }

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const [meals, pantryItems, socialEvents, fuelSlots] = await Promise.all([
      prisma.dailyMeal.findMany({
        where: { chef_id: chefId },
        orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
      }),
      prisma.pantryItem.findMany({
        where: { chef_id: chefId },
        orderBy: { created_at: 'desc' },
      }),
      prisma.socialEvent.findMany({
        where: { chef_id: chefId },
        orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
      }),
      prisma.fuelSlot.findMany({
        where: { chef_id: chefId },
        include: { plan: true },
        orderBy: [{ time_slot: 'asc' }, { created_at: 'desc' }],
      }),
    ]);

    const dailyMeals = meals.map((meal) => ({
      ...meal,
      catalog_type: 'DAILY_MEAL',
      ...this.getMealCatalogState(meal, startOfToday),
    }));

    const pantry = pantryItems.map((item) => ({
      ...item,
      catalog_type: 'PANTRY_ITEM',
      ...this.getPantryCatalogState(item),
    }));

    const social = socialEvents.map((event) => ({
      ...event,
      catalog_type: 'SOCIAL_EVENT',
      ...this.getSocialCatalogState(event, now),
    }));

    const fuel = fuelSlots.map((slot) => ({
      ...slot,
      catalog_type: 'FUEL_SLOT',
      is_active: true,
      inactive_reason: null,
    }));

    return {
      status: 'success',
      data: {
        chef,
        summary: {
          daily_meals_count: dailyMeals.length,
          pantry_items_count: pantry.length,
          social_events_count: social.length,
          fuel_slots_count: fuel.length,
          total_count:
            dailyMeals.length + pantry.length + social.length + fuel.length,
        },
        daily_meals: dailyMeals,
        pantry_items: pantry,
        social_events: social,
        fuel_slots: fuel,
      },
    };
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
      .filter(
        (o) =>
          o.status === 'DELIVERED' ||
          o.status === 'OUT_FOR_DELIVERY' ||
          o.status === 'PREPARING',
      ) // In real scenario, only DELIVERED might count for earnings, but Figma shows total revenue today
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
      select: privateChefProfileSelect,
    });
  }

  /**
   * Update chef profile and bank details.
   *
   * Field formats are validated by UpdateChefProfileDto. When an IFSC is
   * supplied we additionally confirm it exists in the bank directory and, if the
   * chef didn't also send a bank_name, fill it in from the directory result. A
   * directory outage does not block the update (the format check already ran).
   */
  async updateProfile(chefId: string, data: any) {
    const update: Prisma.ChefUpdateInput = {
      name: data.name,
      email: data.email,
      bio: data.bio,
      primary_cuisine: data.primary_cuisine,
      kitchen_name: data.kitchen_name,
      kitchen_address: data.kitchen_address,
      latitude: data.latitude,
      longitude: data.longitude,
      max_capacity: data.max_capacity,
      appliances: data.appliances,
      bank_name: data.bank_name,
      bank_account_number: data.bank_account_number,
      ifsc_code: data.ifsc_code,
    };

    if (data.ifsc_code) {
      try {
        const branch = await lookupIfsc(data.ifsc_code);
        if (!branch) {
          const err: any = new Error(
            'Invalid IFSC code: not found in the bank IFSC directory',
          );
          err.status = 400;
          throw err;
        }
        if (!data.bank_name) {
          update.bank_name = branch.bank;
        }
      } catch (err: any) {
        if (err?.status === 400) throw err;
        console.warn(
          '[Bank] IFSC directory unavailable, saving without verification:',
          err?.message,
        );
      }
    }

    return prisma.chef.update({
      where: { id: chefId },
      data: update,
      select: privateChefProfileSelect,
    });
  }
}

export const chefsService = new ChefsService();
