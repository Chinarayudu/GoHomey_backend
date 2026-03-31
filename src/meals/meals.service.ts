import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DailyMeal, Prisma } from '@prisma/client';

@Injectable()
export class MealsService {
  constructor(private prisma: PrismaService) {}

  async create(chefId: string, data: any): Promise<any> {
    const chef = await this.prisma.chef.findUnique({ where: { id: chefId } });
    if (!chef) {
      throw new NotFoundException('Chef profile not found');
    }

    return this.prisma.dailyMeal.create({
      data: {
        ...data,
        chef_id: chefId,
        slots_remaining: data.slots_total,
      },
    });
  }

  async findAll(query: { date?: string; chefId?: string }) {
    const { date, chefId } = query;
    return this.prisma.dailyMeal.findMany({
      where: {
        chef_id: chefId,
        date: date ? new Date(date) : undefined,
      },
      include: {
        chef: {
          include: {
            user: {
              select: { name: true, email: true },
            },
          },
        },
      },
    });
  }

  async findOne(id: string): Promise<any> {
    const meal = await this.prisma.dailyMeal.findUnique({
      where: { id },
      include: { chef: true },
    });
    if (!meal) {
      throw new NotFoundException('Meal not found');
    }
    return meal;
  }

  async update(id: string, chefId: string, data: any): Promise<any> {
    const meal = await this.findOne(id);
    if (!meal) {
      throw new NotFoundException('Meal not found');
    }
    if (meal.chef_id !== chefId) {
      throw new ForbiddenException('You can only update your own meals');
    }

    // If slots_total is updated, we might need to adjust slots_remaining
    if (data.slots_total && typeof data.slots_total === 'number') {
      const diff = data.slots_total - meal.slots_total;
      data.slots_remaining = meal.slots_remaining + diff;
    }

    return this.prisma.dailyMeal.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, chefId: string): Promise<void> {
    const meal = await this.findOne(id);
    if (!meal || meal.chef_id !== chefId) {
      throw new ForbiddenException('You can only delete your own meals');
    }
    await this.prisma.dailyMeal.delete({ where: { id } });
  }
}
