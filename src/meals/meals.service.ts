import { calculateDistance } from '../common/utils/location';
import { prisma } from '../prisma/prisma.service';
import { DailyMeal, Prisma } from '@prisma/client';

export class MealsService {
  async create(chefId: string, data: any): Promise<any> {
    const chef = await prisma.chef.findUnique({ where: { id: chefId } });
    if (!chef) {
      const error: any = new Error('Chef profile not found');
      error.status = 404;
      throw error;
    }

    return prisma.dailyMeal.create({
      data: {
        ...data,
        chef_id: chefId,
        slots_remaining: data.slots_total,
      },
    });
  }

  async findAll(query: { date?: string; chefId?: string; latitude?: number; longitude?: number }) {
    const { date, chefId, latitude, longitude } = query;
    const meals = await prisma.dailyMeal.findMany({
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

    if (latitude !== undefined && longitude !== undefined) {
      return meals.filter((meal) => {
        if (meal.chef.latitude && meal.chef.longitude) {
          const distance = calculateDistance(
            latitude,
            longitude,
            meal.chef.latitude,
            meal.chef.longitude
          );
          return distance <= 3;
        }
        return false;
      });
    }

    return meals;
  }

  async findOne(id: string): Promise<any> {
    const meal = await prisma.dailyMeal.findUnique({
      where: { id },
      include: { chef: true },
    });
    if (!meal) {
      const error: any = new Error('Meal not found');
      error.status = 404;
      throw error;
    }
    return meal;
  }

  async update(id: string, chefId: string, data: any): Promise<any> {
    const meal = await this.findOne(id);
    if (!meal) {
      const error: any = new Error('Meal not found');
      error.status = 404;
      throw error;
    }
    if (meal.chef_id !== chefId) {
      const error: any = new Error('You can only update your own meals');
      error.status = 403;
      throw error;
    }

    // If slots_total is updated, we might need to adjust slots_remaining
    if (data.slots_total && typeof data.slots_total === 'number') {
      const diff = data.slots_total - meal.slots_total;
      data.slots_remaining = meal.slots_remaining + diff;
    }

    return prisma.dailyMeal.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, chefId: string): Promise<void> {
    const meal = await this.findOne(id);
    if (!meal || meal.chef_id !== chefId) {
      const error: any = new Error('You can only delete your own meals');
      error.status = 403;
      throw error;
    }
    await prisma.dailyMeal.delete({ where: { id } });
  }
}

export const mealsService = new MealsService();
