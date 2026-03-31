import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

  async createPlan(data: any): Promise<any> {
    return this.prisma.fuelPlan.create({
      data,
    });
  }

  async findAllPlans() {
    return this.prisma.fuelPlan.findMany({
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
    const plan = await this.prisma.fuelPlan.findUnique({
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
      throw new NotFoundException('Subscription plan not found');
    }
    return plan;
  }

  async createSlot(chefId: string, data: any): Promise<any> {
    const { plan_id, ...slotData } = data;
    return this.prisma.fuelSlot.create({
      data: {
        ...slotData,
        chef: { connect: { id: chefId } },
        plan: { connect: { id: plan_id } },
        slots_remaining: data.capacity,
      },
    });
  }

  async findSlotsByChef(chefId: string) {
    return this.prisma.fuelSlot.findMany({
      where: { chef_id: chefId },
      include: { plan: true },
    });
  }
}
