import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('orders') private orderQueue: Queue,
  ) {}

  async createDailyMealOrder(userId: string, mealId: string, quantity: number) {
    return (this.prisma as any).$transaction(async (tx: any) => {
      // 1. Check if meal exists and has capacity
      const meal = await tx.dailyMeal.findUnique({
        where: { id: mealId },
      });

      if (!meal) {
        throw new NotFoundException('Meal not found');
      }

      if (meal.slots_remaining < quantity) {
        throw new BadRequestException('Not enough slots available');
      }

      // 2. Decrement slots
      await tx.dailyMeal.update({
        where: { id: mealId },
        data: {
          slots_remaining: {
            decrement: quantity,
          },
        },
      });

      // 3. Create order
      const order = await tx.order.create({
        data: {
          user_id: userId,
          chef_id: meal.chef_id,
          order_type: 'DAILY_MEAL',
          total_price: meal.price * quantity,
          status: 'PENDING',
          items: {
            create: {
              daily_meal_id: meal.id,
              item_id: meal.id,
              quantity,
              price: meal.price,
            },
          },
        },
        include: {
          items: true,
        },
      });

      // 5. Add to queue for async tasks
      await this.orderQueue.add('send-order-notification', {
        orderId: order.id,
        chefId: meal.chef_id,
        userId: userId,
      });

      return order;
    });
  }

  async createPantryOrder(userId: string, itemId: string, quantity: number) {
    return (this.prisma as any).$transaction(async (tx: any) => {
      const item = await tx.pantryItem.findUnique({
        where: { id: itemId },
      });

      if (!item) {
        throw new NotFoundException('Pantry item not found');
      }

      if (item.inventory < quantity) {
        throw new BadRequestException('Not enough inventory');
      }

      await tx.pantryItem.update({
        where: { id: itemId },
        data: {
          inventory: {
            decrement: quantity,
          },
        },
      });

      const order = await tx.order.create({
        data: {
          user_id: userId,
          chef_id: item.chef_id,
          order_type: 'PANTRY_ITEM',
          total_price: item.price * quantity,
          status: 'PENDING',
          items: {
            create: {
              pantry_id: item.id,
              item_id: item.id,
              quantity,
              price: item.price,
            },
          },
        },
        include: {
          items: true,
        },
      });

      // 5. Add to queue for async tasks
      await this.orderQueue.add('send-order-notification', {
        orderId: order.id,
        chefId: item.chef_id,
        userId: userId,
      });

      return order;
    });
  }

  async findUserOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { user_id: userId },
      include: {
        items: true,
        payment: true,
        delivery: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findChefOrders(chefId: string) {
    return this.prisma.order.findMany({
      where: { chef_id: chefId },
      include: {
        items: true,
        payment: true,
        delivery: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async updateOrderStatus(id: string, status: any) {
    const order = await this.prisma.order.update({
      where: { id },
      data: { status },
    });

    // Notify user of status update
    await this.orderQueue.add('send-order-status-update', {
      orderId: order.id,
      userId: order.user_id,
      status,
    });

    return order;
  }
}
