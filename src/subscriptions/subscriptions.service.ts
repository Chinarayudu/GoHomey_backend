import { prisma } from '../prisma/prisma.service';

export class SubscriptionsService {
  async createPlan(data: any): Promise<any> {
    return prisma.fuelPlan.create({
      data,
    });
  }

  async findAllPlans() {
    return prisma.fuelPlan.findMany({
      include: {
        slots: {
          include: {
            chef: {
              include: {
                user: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });
  }

  async findOnePlan(id: string): Promise<any> {
    const plan = await prisma.fuelPlan.findUnique({
      where: { id },
      include: {
        slots: {
          include: {
            chef: {
              include: {
                user: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });
    if (!plan) {
      const error: any = new Error('Subscription plan not found');
      error.status = 404;
      throw error;
    }
    return plan;
  }

  async createSlot(chefId: string, data: any): Promise<any> {
    const { plan_id, ...slotData } = data;
    return prisma.fuelSlot.create({
      data: {
        ...slotData,
        chef: { connect: { id: chefId } },
        plan: { connect: { id: plan_id } },
        slots_remaining: data.capacity,
      },
    });
  }

  async findSlotsByChef(chefId: string) {
    return prisma.fuelSlot.findMany({
      where: { chef_id: chefId },
      include: { plan: true },
    });
  }
}

export const subscriptionsService = new SubscriptionsService();
