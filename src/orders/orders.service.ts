import { prisma } from '../prisma/prisma.service';
import { ordersQueue } from '../common/queues/queues';
import { paymentsService } from '../payments/payments.service';
import {
  ChefApplicationStatus,
  FuelSubscriptionStatus,
  Prisma,
} from '@prisma/client';
import { isServiceWindowOpen } from '../common/utils/time';

type CheckoutItemType =
  | 'DAILY_MEAL'
  | 'MEAL'
  | 'PANTRY_ITEM'
  | 'PANTRY'
  | 'SOCIAL_EVENT'
  | 'SOCIAL'
  | 'FUEL_PLAN'
  | 'FUEL_SUBSCRIPTION';

type NormalizedCheckoutItemType =
  | 'DAILY_MEAL'
  | 'PANTRY_ITEM'
  | 'SOCIAL_EVENT'
  | 'FUEL_PLAN';

function normalizeCheckoutItemType(
  type: CheckoutItemType,
): NormalizedCheckoutItemType {
  switch (type) {
    case 'MEAL':
      return 'DAILY_MEAL';
    case 'PANTRY':
      return 'PANTRY_ITEM';
    case 'SOCIAL':
      return 'SOCIAL_EVENT';
    case 'FUEL_SUBSCRIPTION':
      return 'FUEL_PLAN';
    default:
      return type;
  }
}

function createHttpError(message: string, status: number) {
  const error: any = new Error(message);
  error.status = status;
  return error;
}

function resolvePlatformFeeRupees(): number {
  const configuredFee = process.env.HOMEY_PLATFORM_FEE_RUPEES?.trim() || '20';
  const feeRupees = Number(configuredFee);

  if (!Number.isFinite(feeRupees) || feeRupees < 0) {
    return 20;
  }

  return feeRupees;
}

function addOrderAmountBreakdown<
  T extends { total_price: number; payment?: { amount: number } | null },
>(order: T) {
  const paidAmount = order.payment?.amount;
  const platformFee =
    paidAmount === undefined || paidAmount === null
      ? resolvePlatformFeeRupees()
      : Math.max(Number((paidAmount - order.total_price).toFixed(2)), 0);
  const payableAmount =
    paidAmount ?? Number((order.total_price + platformFee).toFixed(2));

  return {
    ...order,
    order_amount: order.total_price,
    platform_fee: platformFee,
    payable_amount: payableAmount,
  };
}

export class OrdersService {
  private async validateDeliveryAddress(
    tx: Prisma.TransactionClient,
    userId: string,
    deliveryAddressId?: string,
  ) {
    if (!deliveryAddressId) return null;

    const address = await tx.address.findFirst({
      where: {
        id: deliveryAddressId,
        user_id: userId,
      },
    });

    if (!address) {
      throw createHttpError('Delivery address not found for this user', 404);
    }

    return address;
  }

  async createDailyMealOrder(
    userId: string,
    mealId: string,
    quantity: number,
    deliveryAddressId?: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const deliveryAddress = await this.validateDeliveryAddress(
        tx,
        userId,
        deliveryAddressId,
      );

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
          delivery_address_id: deliveryAddress?.id,
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
          delivery_address: true,
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

  async createSocialOrder(
    userId: string,
    eventId: string,
    quantity: number,
    deliveryAddressId?: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const deliveryAddress = await this.validateDeliveryAddress(
        tx,
        userId,
        deliveryAddressId,
      );

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
          delivery_address_id: deliveryAddress?.id,
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
          delivery_address: true,
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

  async createPantryOrder(
    userId: string,
    itemId: string,
    quantity: number,
    deliveryWindow?: string,
    deliveryAddressId?: string,
  ) {
    if (!deliveryWindow) {
      const error: any = new Error(
        'Pantry items must select a delivery window (piggyback)',
      );
      error.status = 400;
      throw error;
    }

    return prisma.$transaction(async (tx) => {
      const deliveryAddress = await this.validateDeliveryAddress(
        tx,
        userId,
        deliveryAddressId,
      );

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
          delivery_address_id: deliveryAddress?.id,
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
          delivery_address: true,
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
    const orders = await prisma.order.findMany({
      where: { user_id: userId },
      include: {
        items: true,
        payment: {
          select: {
            id: true,
            order_id: true,
            amount: true,
            currency: true,
            status: true,
            gateway_id: true,
            razorpay_order_id: true,
            razorpay_payment_id: true,
            razorpay_receipt: true,
            escrow_status: true,
            created_at: true,
            updated_at: true,
          },
        },
        delivery: true,
        delivery_address: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return orders.map(addOrderAmountBreakdown);
  }

  async findChefOrders(chefId: string, statusGroup?: 'active' | 'completed') {
    let where: any = { chef_id: chefId };

    if (statusGroup === 'active') {
      where.status = {
        in: [
          'PENDING',
          'CONFIRMED',
          'PREPARING',
          'READY_FOR_PICKUP',
          'OUT_FOR_DELIVERY',
        ],
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
        delivery_address: true,
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

  async checkout(
    userId: string,
    items: {
      id: string;
      type: CheckoutItemType;
      quantity: number;
      plan_id?: string;
      assigned_chef_id?: string;
      start_date?: string;
      delivery_time_slot?: string;
    }[],
    deliveryAddressId?: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const deliveryAddress = await this.validateDeliveryAddress(
        tx,
        userId,
        deliveryAddressId,
      );

      const orderGroups: Record<
        string,
        { chefId: string; items: any[]; totalPrice: number }
      > = {};

      // 1. Fetch all items and group them by chef
      for (const itemRequest of items) {
        if (
          !Number.isInteger(itemRequest.quantity) ||
          itemRequest.quantity <= 0
        ) {
          throw createHttpError(
            'Item quantity must be a positive integer',
            400,
          );
        }

        const itemType = normalizeCheckoutItemType(itemRequest.type);
        let itemData: any;
        let chefId: string;
        let price: number;
        let updateData: any = null;
        let updateModel: any = null;
        let orderItemId = itemRequest.id;
        let fuelSlotId: string | null = null;
        let fuelSubscriptionStartDate: Date | null = null;
        let fuelSubscriptionDeliveryTimeSlot: string | null = null;

        switch (itemType) {
          case 'DAILY_MEAL':
            itemData = await tx.dailyMeal.findUnique({
              where: { id: itemRequest.id },
            });
            if (!itemData) throw new Error(`Meal ${itemRequest.id} not found`);
            if (!isServiceWindowOpen(itemData))
              throw new Error(`Ordering is closed for ${itemData.meal_name}`);
            if (itemData.slots_remaining < itemRequest.quantity)
              throw new Error(`Not enough slots for ${itemData.meal_name}`);
            chefId = itemData.chef_id;
            price = itemData.price;
            updateModel = tx.dailyMeal;
            updateData = {
              slots_remaining: { decrement: itemRequest.quantity },
            };
            break;

          case 'PANTRY_ITEM':
            itemData = await tx.pantryItem.findUnique({
              where: { id: itemRequest.id },
            });
            if (!itemData)
              throw new Error(`Pantry item ${itemRequest.id} not found`);
            if (itemData.inventory < itemRequest.quantity)
              throw new Error(`Not enough inventory for ${itemData.name}`);
            chefId = itemData.chef_id;
            price = itemData.price;
            updateModel = tx.pantryItem;
            updateData = { inventory: { decrement: itemRequest.quantity } };
            break;

          case 'SOCIAL_EVENT':
            itemData = await tx.socialEvent.findUnique({
              where: { id: itemRequest.id },
            });
            if (!itemData)
              throw new Error(`Social event ${itemRequest.id} not found`);
            if (itemData.slots_remaining < itemRequest.quantity)
              throw new Error(`Not enough slots for ${itemData.title}`);
            chefId = itemData.chef_id;
            price = itemData.price;
            updateModel = tx.socialEvent;
            updateData = {
              slots_remaining: { decrement: itemRequest.quantity },
            };
            break;

          case 'FUEL_PLAN': {
            const planId = itemRequest.plan_id || itemRequest.id;
            const assignedChefId = itemRequest.assigned_chef_id;
            const deliveryTimeSlot = itemRequest.delivery_time_slot;

            if (itemRequest.quantity !== 1) {
              throw createHttpError(
                'Fuel subscription quantity must be 1',
                400,
              );
            }

            if (
              !assignedChefId ||
              !deliveryTimeSlot ||
              !itemRequest.start_date
            ) {
              throw createHttpError(
                'Fuel subscription requires plan_id, assigned_chef_id, start_date and delivery_time_slot',
                400,
              );
            }

            itemData = await tx.fuelPlan.findUnique({
              where: { id: planId },
            });
            if (!itemData) {
              throw createHttpError(`Fuel plan ${planId} not found`, 404);
            }

            if (!itemData.delivery_time_slots.includes(deliveryTimeSlot)) {
              throw createHttpError(
                'Selected delivery_time_slot is not available for this Fuel plan',
                400,
              );
            }

            const chef = await tx.chef.findUnique({
              where: { id: assignedChefId },
            });
            if (
              !chef ||
              chef.application_status !== ChefApplicationStatus.APPROVED
            ) {
              throw createHttpError(
                'Approved chef not found for Fuel subscription',
                404,
              );
            }

            const chefSlot = await tx.fuelSlot.findFirst({
              where: {
                chef_id: assignedChefId,
                plan_id: planId,
                time_slot: deliveryTimeSlot,
              },
            });
            if (!chefSlot) {
              throw createHttpError(
                'Selected chef is not available for this Fuel plan and time slot',
                409,
              );
            }

            const activeFuelCount = await tx.fuelSubscription.count({
              where: {
                assigned_chef_id: assignedChefId,
                delivery_time_slot: deliveryTimeSlot,
                status: FuelSubscriptionStatus.ACTIVE,
              },
            });
            const capacity =
              chef.max_concurrent_slots_per_hour || chef.max_capacity || 15;
            if (activeFuelCount >= capacity) {
              throw createHttpError(
                'Chef is at Fuel capacity for this time slot',
                409,
              );
            }

            chefId = assignedChefId;
            price = Number(itemData.price_to_customer ?? itemData.price);
            orderItemId = planId;
            fuelSlotId = chefSlot.id;
            fuelSubscriptionStartDate = new Date(itemRequest.start_date);
            fuelSubscriptionDeliveryTimeSlot = deliveryTimeSlot;
            break;
          }

          default:
            throw new Error(`Unsupported item type: ${itemRequest.type}`);
        }

        // Initialize group if not exists
        if (!orderGroups[chefId]) {
          orderGroups[chefId] = { chefId, items: [], totalPrice: 0 };
        }

        orderGroups[chefId].items.push({
          item_id: orderItemId,
          type: itemType,
          quantity: itemRequest.quantity,
          price,
          // Map to specific schema fields
          daily_meal_id: itemType === 'DAILY_MEAL' ? itemRequest.id : null,
          pantry_id: itemType === 'PANTRY_ITEM' ? itemRequest.id : null,
          social_event_id: itemType === 'SOCIAL_EVENT' ? itemRequest.id : null,
          fuel_slot_id: itemType === 'FUEL_PLAN' ? fuelSlotId : null,
          fuel_subscription_start_date:
            itemType === 'FUEL_PLAN' ? fuelSubscriptionStartDate : null,
          fuel_subscription_delivery_time_slot:
            itemType === 'FUEL_PLAN' ? fuelSubscriptionDeliveryTimeSlot : null,
        });
        orderGroups[chefId].totalPrice += price * itemRequest.quantity;

        // 2. Decrement inventory
        if (updateModel && updateData) {
          await updateModel.update({
            where: { id: itemRequest.id },
            data: updateData,
          });
        }
      }

      // 3. Create Orders for each chef group
      const createdOrders: any[] = [];
      for (const chefId in orderGroups) {
        const group = orderGroups[chefId];
        const order = await tx.order.create({
          data: {
            user_id: userId,
            chef_id: chefId,
            delivery_address_id: deliveryAddress?.id,
            order_type: group.items[0].type as any,
            total_price: group.totalPrice,
            status: 'PENDING',
            items: {
              create: group.items.map((item: any) => ({
                item_id: item.item_id,
                quantity: item.quantity,
                price: item.price,
                daily_meal_id: item.daily_meal_id,
                pantry_id: item.pantry_id,
                social_event_id: item.social_event_id,
                fuel_slot_id: item.fuel_slot_id,
                fuel_subscription_start_date: item.fuel_subscription_start_date,
                fuel_subscription_delivery_time_slot:
                  item.fuel_subscription_delivery_time_slot,
              })),
            },
          },
          include: {
            items: true,
            delivery_address: true,
          },
        });

        // 4. Notify chef (async)
        await ordersQueue.add('send-order-notification', {
          orderId: order.id,
          chefId: chefId,
          userId: userId,
        });

        createdOrders.push(order);
      }

      return {
        status: 'success',
        message: `${createdOrders.length} order(s) created successfully`,
        orders: createdOrders,
      };
    });
  }

  async updateOrderStatus(id: string, status: any) {
    const order = await prisma.order.update({
      where: { id },
      data: { status },
    });

    if (status === 'DELIVERED') {
      try {
        const payoutResult = await paymentsService.releaseChefPayoutForOrder(
          order.id,
          'ORDER_STATUS_DELIVERED',
        );
        console.log('[Chef Payout] order status release result', {
          order_id: order.id,
          released: payoutResult.released,
          reason: (payoutResult as any).reason,
          payout_id: (payoutResult as any).payout?.id,
        });
      } catch (error) {
        console.error('[Chef Payout] order status release failed', {
          order_id: order.id,
          error: error instanceof Error ? error.message : error,
        });
      }
    }

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
