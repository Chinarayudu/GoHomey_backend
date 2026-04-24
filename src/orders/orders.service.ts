import { prisma } from '../prisma/prisma.service';
import { ordersQueue } from '../common/queues/queues';
import { Prisma } from '@prisma/client';

export class OrdersService {
  async createDailyMealOrder(userId: string, mealId: string, quantity: number) {
    return prisma.$transaction(async (tx) => {
      // 1. Check if meal exists and has capacity
      const meal = await tx.dailyMeal.findUnique({
        where: { id: mealId },
      });

      if (!meal) {
        const error: any = new Error('Meal not found');
        error.status = 404;
        throw error;
      }

      if (meal.slots_remaining < quantity) {
        const error: any = new Error('Not enough slots available');
        error.status = 400;
        throw error;
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
      await ordersQueue.add('send-order-notification', {
        orderId: order.id,
        chefId: meal.chef_id,
        userId: userId,
      });

      return order;
    });
  }

  async createSocialOrder(userId: string, eventId: string, quantity: number) {
    return prisma.$transaction(async (tx) => {
      const event = await tx.socialEvent.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        const error: any = new Error('Social event not found');
        error.status = 404;
        throw error;
      }

      if (event.slots_remaining < quantity) {
        const error: any = new Error('Not enough slots available');
        error.status = 400;
        throw error;
      }

      await tx.socialEvent.update({
        where: { id: eventId },
        data: {
          slots_remaining: {
            decrement: quantity,
          },
        },
      });

      const order = await tx.order.create({
        data: {
          user_id: userId,
          chef_id: event.chef_id,
          order_type: 'SOCIAL_EVENT',
          total_price: event.price * quantity,
          status: 'PENDING',
          items: {
            create: {
              social_event_id: event.id,
              item_id: event.id,
              quantity,
              price: event.price,
            },
          },
        },
        include: {
          items: true,
        },
      });

      await ordersQueue.add('send-order-notification', {
        orderId: order.id,
        chefId: event.chef_id,
        userId: userId,
      });

      return order;
    });
  }

  async createPantryOrder(userId: string, itemId: string, quantity: number, deliveryWindow?: string) {
    if (!deliveryWindow) {
      const error: any = new Error('Pantry items must select a delivery window (piggyback)');
      error.status = 400;
      throw error;
    }

    return prisma.$transaction(async (tx) => {
      const item = await tx.pantryItem.findUnique({
        where: { id: itemId },
      });

      if (!item) {
        const error: any = new Error('Pantry item not found');
        error.status = 404;
        throw error;
      }

      if (item.inventory < quantity) {
        const error: any = new Error('Not enough inventory');
        error.status = 400;
        throw error;
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
          delivery: {
            create: {
              status: 'PENDING',
              // We could store the deliveryWindow in a notes field or specialized field if it existed
              // For now, it represents the intent to piggyback.
            },
          },
        },
        include: {
          items: true,
          delivery: true,
        },
      });

      // 5. Add to queue for async tasks
      await ordersQueue.add('send-order-notification', {
        orderId: order.id,
        chefId: item.chef_id,
        userId: userId,
        deliveryWindow,
      });

      return order;
    });
  }

  async findUserOrders(userId: string) {
    return prisma.order.findMany({
      where: { user_id: userId },
      include: {
        items: true,
        payment: true,
        delivery: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findChefOrders(chefId: string, statusGroup?: 'active' | 'completed') {
    let where: any = { chef_id: chefId };

    if (statusGroup === 'active') {
      where.status = {
        in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'],
      };
    } else if (statusGroup === 'completed') {
      where.status = {
        in: ['DELIVERED', 'CANCELLED', 'REFUNDED'],
      };
    }

    return prisma.order.findMany({
      where,
      include: {
        items: {
          include: {
            daily_meal: true,
            pantry_item: true,
            fuel_slot: true,
            social_event: true,
          },
        },
        payment: true,
        delivery: true,
        user: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async updateOrderStatus(id: string, status: any) {
    const order = await prisma.order.update({
      where: { id },
      data: { status },
    });

    // Notify user of status update
    await ordersQueue.add('send-order-status-update', {
      orderId: order.id,
      userId: order.user_id,
      status,
    });

    return order;
  }
}

export const ordersService = new OrdersService();
