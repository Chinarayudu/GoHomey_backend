import {
  ChefApplicationStatus,
  FuelFulfillmentStatus,
  FuelSubscriptionStatus,
} from '@prisma/client';
import { prisma } from '../prisma/prisma.service';
import { calculateDistance } from '../common/utils/location';
import { notificationsService } from '../notifications/notifications.service';

const FULFILLMENT_LOOKAHEAD_DAYS = 2;

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function inclusiveDayCount(from: Date, to: Date) {
  return (
    Math.floor(
      (startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000,
    ) + 1
  );
}

function parseDate(value: string, field: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error: any = new Error(`${field} must be a valid date`);
    error.status = 400;
    throw error;
  }
  return startOfDay(date);
}

function normalizeTimeSlots(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map(String)
        .map((slot) => slot.trim())
        .filter(Boolean),
    ),
  ];
}

function serializeFuelSlot(slot: any) {
  return {
    id: slot.id,
    chef_id: slot.chef_id,
    plan_id: slot.plan_id,
    time_slot: slot.time_slot,
    created_at: slot.created_at,
    ...(slot.plan ? { plan: slot.plan } : {}),
  };
}

export class FuelService {
  async createPlan(data: any) {
    const price = Number(data.price ?? data.price_to_customer);
    const durationDays = Number(data.duration_days ?? 30);
    const deliveryTimeSlots = normalizeTimeSlots(data.delivery_time_slots);

    if (!Number.isFinite(price) || price <= 0) {
      const error: any = new Error('Fuel plan price must be greater than zero');
      error.status = 400;
      throw error;
    }

    if (!Number.isInteger(durationDays) || durationDays <= 0) {
      const error: any = new Error('duration_days must be a positive integer');
      error.status = 400;
      throw error;
    }

    if (!deliveryTimeSlots.length) {
      const error: any = new Error(
        'delivery_time_slots must include at least one time slot',
      );
      error.status = 400;
      throw error;
    }

    return prisma.fuelPlan.create({
      data: {
        name: data.name || data.title,
        goal: data.goal || data.goal_type,
        description: data.description,
        price,
        duration_days: durationDays,
        price_to_customer: data.price_to_customer ?? price,
        fixed_chef_payout: data.fixed_chef_payout,
        sop_document_url: data.sop_document_url,
        delivery_time_slots: deliveryTimeSlots,
        menu_json: data.menu_json,
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fat: data.fat,
      },
    });
  }

  async listPlans() {
    return prisma.fuelPlan.findMany({
      orderBy: { created_at: 'desc' },
    });
  }

  async listChefPlanCatalog(chefId: string) {
    const plans = await prisma.fuelPlan.findMany({
      include: {
        slots: {
          where: { chef_id: chefId },
          orderBy: { time_slot: 'asc' },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return plans.map((plan) => ({
      ...plan,
      is_enabled_for_chef: plan.slots.length > 0,
      chef_slots: plan.slots.map(serializeFuelSlot),
    }));
  }

  async enableChefPlan(chefId: string, data: { plan_id: string }) {
    const plan = await prisma.fuelPlan.findUnique({
      where: { id: data.plan_id },
    });
    if (!plan) {
      const error: any = new Error('Fuel plan not found');
      error.status = 404;
      throw error;
    }

    if (!plan.delivery_time_slots.length) {
      const error: any = new Error(
        'Fuel plan does not have admin-defined delivery timings',
      );
      error.status = 400;
      throw error;
    }

    const slots: any[] = [];
    for (const timeSlot of plan.delivery_time_slots) {
      const existing = await prisma.fuelSlot.findFirst({
        where: {
          chef_id: chefId,
          plan_id: data.plan_id,
          time_slot: timeSlot,
        },
      });

      if (existing) {
        slots.push(
          await prisma.fuelSlot.findUnique({
            where: { id: existing.id },
            include: { plan: true },
          }),
        );
        continue;
      }

      slots.push(
        await prisma.fuelSlot.create({
          data: {
            chef_id: chefId,
            plan_id: data.plan_id,
            time_slot: timeSlot,
            capacity: 0,
            slots_remaining: 0,
          },
          include: { plan: true },
        }),
      );
    }

    return {
      message: `Enabled Fuel plan for ${slots.length} admin-defined time slot(s)`,
      slots: slots.filter(Boolean).map(serializeFuelSlot),
    };
  }

  async listChefSlots(chefId: string) {
    const slots = await prisma.fuelSlot.findMany({
      where: { chef_id: chefId },
      include: { plan: true },
      orderBy: [{ time_slot: 'asc' }, { created_at: 'desc' }],
    });

    return slots.map(serializeFuelSlot);
  }

  async getPlan(id: string) {
    const plan = await prisma.fuelPlan.findUnique({
      where: { id },
      include: {
        slots: { include: { chef: true } },
      },
    });

    if (!plan) {
      const error: any = new Error('Fuel plan not found');
      error.status = 404;
      throw error;
    }

    return plan;
  }

  async listChefsForPlan(planId: string, deliveryTimeSlot?: string) {
    const plan = await prisma.fuelPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      const error: any = new Error('Fuel plan not found');
      error.status = 404;
      throw error;
    }

    if (
      deliveryTimeSlot &&
      !plan.delivery_time_slots.includes(deliveryTimeSlot)
    ) {
      const error: any = new Error(
        'Selected delivery_time_slot is not available for this Fuel plan',
      );
      error.status = 400;
      throw error;
    }

    const slots = await prisma.fuelSlot.findMany({
      where: {
        plan_id: planId,
        ...(deliveryTimeSlot ? { time_slot: deliveryTimeSlot } : {}),
        chef: {
          application_status: ChefApplicationStatus.APPROVED,
        },
      },
      include: {
        chef: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            bio: true,
            rating: true,
            is_verified: true,
            trust_tier: true,
            primary_cuisine: true,
            kitchen_name: true,
            kitchen_address: true,
            latitude: true,
            longitude: true,
            max_capacity: true,
            max_concurrent_slots_per_hour: true,
            appliances: true,
            kitchen_photo_url: true,
            application_status: true,
          },
        },
      },
      orderBy: [{ time_slot: 'asc' }, { created_at: 'desc' }],
    });

    return slots.map((slot) => ({
      ...slot.chef,
      plan_id: planId,
      delivery_time_slot: slot.time_slot,
    }));
  }

  private async getChefCapacity(chefId: string, timeSlot: string) {
    const chef = await prisma.chef.findUnique({ where: { id: chefId } });
    if (!chef || chef.application_status !== ChefApplicationStatus.APPROVED) {
      const error: any = new Error(
        'Approved chef not found for Fuel fulfillment',
      );
      error.status = 404;
      throw error;
    }

    const capacity =
      chef.max_concurrent_slots_per_hour || chef.max_capacity || 15;
    const activeFuelCount = await prisma.fuelSubscription.count({
      where: {
        assigned_chef_id: chefId,
        delivery_time_slot: timeSlot,
        status: FuelSubscriptionStatus.ACTIVE,
      },
    });

    return {
      chef,
      capacity,
      activeFuelCount,
      remaining: Math.max(capacity - activeFuelCount, 0),
    };
  }

  async createSubscription(userId: string, data: any) {
    const plan = await prisma.fuelPlan.findUnique({
      where: { id: data.plan_id },
    });
    if (!plan) {
      const error: any = new Error('Fuel plan not found');
      error.status = 404;
      throw error;
    }

    if (!plan.delivery_time_slots.includes(data.delivery_time_slot)) {
      const error: any = new Error(
        'Selected delivery_time_slot is not available for this Fuel plan',
      );
      error.status = 400;
      throw error;
    }

    const chefSlot = await prisma.fuelSlot.findFirst({
      where: {
        chef_id: data.assigned_chef_id,
        plan_id: plan.id,
        time_slot: data.delivery_time_slot,
      },
    });

    if (!chefSlot) {
      const error: any = new Error(
        'Selected chef is not available for this Fuel plan and time slot',
      );
      error.status = 409;
      throw error;
    }

    const startDate = parseDate(data.start_date, 'start_date');
    const endDate = addDays(startDate, (plan.duration_days || 30) - 1);
    const capacity = await this.getChefCapacity(
      data.assigned_chef_id,
      data.delivery_time_slot,
    );

    if (capacity.remaining <= 0) {
      const error: any = new Error(
        'Chef is at Fuel capacity for this time slot',
      );
      error.status = 409;
      throw error;
    }

    const subscription = await prisma.$transaction(async (tx) => {
      return tx.fuelSubscription.create({
        data: {
          user_id: userId,
          plan_id: plan.id,
          assigned_chef_id: data.assigned_chef_id,
          start_date: startDate,
          end_date: endDate,
          delivery_time_slot: data.delivery_time_slot,
        },
        include: {
          plan: true,
          assigned_chef: {
            select: {
              id: true,
              name: true,
              kitchen_name: true,
              phone: true,
            },
          },
        },
      });
    });

    await this.generateFulfillments(
      FULFILLMENT_LOOKAHEAD_DAYS,
      subscription.id,
    );

    return subscription;
  }

  async listMySubscriptions(userId: string) {
    return prisma.fuelSubscription.findMany({
      where: { user_id: userId },
      include: {
        plan: true,
        assigned_chef: {
          select: { id: true, name: true, kitchen_name: true, phone: true },
        },
        fulfillments: {
          orderBy: { fulfillment_date: 'asc' },
          take: 14,
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async listChefSubscriptions(chefId: string) {
    return prisma.fuelSubscription.findMany({
      where: { assigned_chef_id: chefId },
      include: {
        plan: true,
        user: {
          select: { id: true, name: true, phone: true },
        },
      },
      orderBy: [{ status: 'asc' }, { delivery_time_slot: 'asc' }],
    });
  }

  async pauseSubscription(userId: string, subscriptionId: string, data: any) {
    const subscription = await prisma.fuelSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription || subscription.user_id !== userId) {
      const error: any = new Error('Fuel subscription not found');
      error.status = 404;
      throw error;
    }

    if (subscription.status !== FuelSubscriptionStatus.ACTIVE) {
      const error: any = new Error(
        'Only active Fuel subscriptions can be paused',
      );
      error.status = 400;
      throw error;
    }

    const pauseFrom = parseDate(data.pause_from, 'pause_from');
    const pauseTo = parseDate(data.pause_to, 'pause_to');
    if (pauseTo < pauseFrom) {
      const error: any = new Error('pause_to must be on or after pause_from');
      error.status = 400;
      throw error;
    }

    const bufferCutoff = new Date(Date.now() + 24 * 60 * 60 * 1000);
    if (pauseFrom.getTime() < bufferCutoff.getTime()) {
      const error: any = new Error(
        'Fuel subscription pauses require at least 24 hours notice',
      );
      error.status = 400;
      throw error;
    }

    const pausedDays = inclusiveDayCount(pauseFrom, pauseTo);
    const newEndDate = addDays(subscription.end_date, pausedDays);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.fuelDailyFulfillment.updateMany({
        where: {
          subscription_id: subscription.id,
          fulfillment_date: {
            gte: pauseFrom,
            lte: pauseTo,
          },
          delivery_status: {
            in: [
              FuelFulfillmentStatus.SCHEDULED,
              FuelFulfillmentStatus.COOKING,
            ],
          },
        },
        data: {
          delivery_status: FuelFulfillmentStatus.PAUSED,
        },
      });

      return tx.fuelSubscription.update({
        where: { id: subscription.id },
        data: { end_date: newEndDate },
        include: {
          plan: true,
          fulfillments: { orderBy: { fulfillment_date: 'asc' } },
        },
      });
    });

    await this.generateFulfillments(
      FULFILLMENT_LOOKAHEAD_DAYS,
      subscription.id,
    );

    return updated;
  }

  async generateFulfillments(
    daysAhead = FULFILLMENT_LOOKAHEAD_DAYS,
    subscriptionId?: string,
  ) {
    const today = startOfDay(new Date());
    const horizon = addDays(today, daysAhead);

    const subscriptions = await prisma.fuelSubscription.findMany({
      where: {
        status: FuelSubscriptionStatus.ACTIVE,
        ...(subscriptionId ? { id: subscriptionId } : {}),
      },
    });

    const created: string[] = [];

    for (const subscription of subscriptions) {
      const from =
        subscription.start_date > today
          ? startOfDay(subscription.start_date)
          : today;
      const to =
        subscription.end_date < horizon
          ? startOfDay(subscription.end_date)
          : horizon;

      for (let date = from; date <= to; date = addDays(date, 1)) {
        const fulfillment = await prisma.fuelDailyFulfillment.upsert({
          where: {
            subscription_id_fulfillment_date: {
              subscription_id: subscription.id,
              fulfillment_date: date,
            },
          },
          update: {},
          create: {
            subscription_id: subscription.id,
            chef_id: subscription.assigned_chef_id,
            fulfillment_date: date,
            delivery_time_slot: subscription.delivery_time_slot,
          },
        });
        created.push(fulfillment.id);
      }
    }

    return {
      message: `Generated or confirmed ${created.length} Fuel fulfillment row(s)`,
      fulfillment_ids: created,
    };
  }

  async listChefFulfillments(chefId: string, date?: string) {
    const targetDate = date ? parseDate(date, 'date') : undefined;
    return prisma.fuelDailyFulfillment.findMany({
      where: {
        chef_id: chefId,
        ...(targetDate ? { fulfillment_date: targetDate } : {}),
      },
      include: {
        subscription: {
          include: {
            user: { select: { id: true, name: true, phone: true } },
            plan: true,
          },
        },
      },
      orderBy: [{ fulfillment_date: 'asc' }, { delivery_time_slot: 'asc' }],
    });
  }

  async updateFulfillmentStatus(
    fulfillmentId: string,
    status: FuelFulfillmentStatus,
  ) {
    return prisma.fuelDailyFulfillment.update({
      where: { id: fulfillmentId },
      data: { delivery_status: status },
    });
  }

  async submitWeighIn(
    fulfillmentId: string,
    chefId: string,
    photoUrl: string,
    grams: number,
  ) {
    if (!Number.isInteger(grams) || grams <= 0) {
      const error: any = new Error(
        'weight_verification_grams must be a positive integer',
      );
      error.status = 400;
      throw error;
    }

    const fulfillment = await prisma.fuelDailyFulfillment.findUnique({
      where: { id: fulfillmentId },
    });

    if (!fulfillment || fulfillment.chef_id !== chefId) {
      const error: any = new Error('Fuel fulfillment not found for this chef');
      error.status = 404;
      throw error;
    }

    return prisma.fuelDailyFulfillment.update({
      where: { id: fulfillmentId },
      data: {
        chef_batch_photo_url: photoUrl,
        weight_verification_grams: grams,
        delivery_status: FuelFulfillmentStatus.READY_FOR_PICKUP,
      },
    });
  }

  async findFuelNowChefs(
    latitude: number,
    longitude: number,
    timeSlot?: string,
  ) {
    const chefs = await prisma.chef.findMany({
      where: {
        application_status: ChefApplicationStatus.APPROVED,
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        name: true,
        kitchen_name: true,
        latitude: true,
        longitude: true,
        max_concurrent_slots_per_hour: true,
        max_capacity: true,
      },
    });

    const slot = timeSlot || `${new Date().getHours()}:00`;
    const withinRange: any[] = [];

    for (const chef of chefs) {
      if (chef.latitude === null || chef.longitude === null) continue;
      const distance = calculateDistance(
        latitude,
        longitude,
        chef.latitude,
        chef.longitude,
      );
      if (distance > 1) continue;

      const activeFuelCount = await prisma.fuelSubscription.count({
        where: {
          assigned_chef_id: chef.id,
          delivery_time_slot: slot,
          status: FuelSubscriptionStatus.ACTIVE,
        },
      });
      const capacity =
        chef.max_concurrent_slots_per_hour || chef.max_capacity || 15;
      if (activeFuelCount >= capacity) continue;

      withinRange.push({
        ...chef,
        distance: Number(distance.toFixed(2)),
        capacity,
        active_fuel_count: activeFuelCount,
        remaining_capacity: capacity - activeFuelCount,
      });
    }

    return withinRange.sort((a, b) => a.distance - b.distance);
  }

  async sendPrepReminders(hoursBefore = 3) {
    const now = new Date();
    const windowStart = new Date(
      now.getTime() + hoursBefore * 60 * 60 * 1000 - 10 * 60 * 1000,
    );
    const windowEnd = new Date(
      now.getTime() + hoursBefore * 60 * 60 * 1000 + 10 * 60 * 1000,
    );

    const fulfillments = await prisma.fuelDailyFulfillment.findMany({
      where: {
        chef_reminder_sent_at: null,
        delivery_status: {
          in: [FuelFulfillmentStatus.SCHEDULED, FuelFulfillmentStatus.COOKING],
        },
        fulfillment_date: {
          gte: startOfDay(windowStart),
          lte: startOfDay(windowEnd),
        },
      },
      include: {
        chef: true,
        subscription: {
          include: {
            plan: true,
            user: { select: { name: true } },
          },
        },
      },
    });

    const notified: string[] = [];

    for (const fulfillment of fulfillments) {
      if (fulfillment.delivery_time_slot) {
        const [hour, minute = '0'] = fulfillment.delivery_time_slot.split(':');
        const slotTime = new Date(fulfillment.fulfillment_date);
        slotTime.setHours(Number(hour), Number(minute), 0, 0);

        if (slotTime < windowStart || slotTime > windowEnd) {
          continue;
        }
      }

      await notificationsService.sendPushNotification(
        fulfillment.chef.user_id || fulfillment.chef_id,
        'Fuel prep reminder',
        `${fulfillment.subscription.plan.name} is due at ${fulfillment.delivery_time_slot}. Start prep and keep weigh-in proof ready.`,
        {
          type: 'FUEL_PREP_REMINDER',
          fulfillment_id: fulfillment.id,
          subscription_id: fulfillment.subscription_id,
        },
      );

      await prisma.fuelDailyFulfillment.update({
        where: { id: fulfillment.id },
        data: { chef_reminder_sent_at: new Date() },
      });
      notified.push(fulfillment.id);
    }

    return {
      message: `Sent ${notified.length} Fuel prep reminder(s)`,
      fulfillment_ids: notified,
    };
  }
}

export const fuelService = new FuelService();
