import { calculateDistance } from '../common/utils/location';
import { prisma } from '../prisma/prisma.service';
import { DailyMeal, Prisma } from '@prisma/client';
import { isServiceWindowOpen } from '../common/utils/time';

export class MealsService {
  async create(chefId: string, data: any): Promise<any> {
    const chef = await prisma.chef.findUnique({ where: { id: chefId } });
    if (!chef) {
      const error: any = new Error('Chef profile not found');
      error.status = 404;
      throw error;
    }

    // Restriction: Can only create meals 3 days in advance
    const mealDate = new Date(data.date);
    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(now.getDate() + 3);
    threeDaysFromNow.setHours(23, 59, 59, 999);

    if (mealDate > threeDaysFromNow) {
      const error: any = new Error('You can only create meals up to 3 days in advance');
      error.status = 400;
      throw error;
    }

    if (mealDate < new Date(now.setHours(0,0,0,0))) {
      const error: any = new Error('Cannot create meals for past dates');
      error.status = 400;
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
    
    // Default to showing only today and future meals if no date is specified
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const meals = await prisma.dailyMeal.findMany({
      where: {
        chef_id: chefId,
        date: date ? new Date(date) : { gte: startOfToday },
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
        // 1. Time restriction check
        if (!isServiceWindowOpen(meal)) return false;

        // 2. Distance check
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

    return meals.filter(isServiceWindowOpen);
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
