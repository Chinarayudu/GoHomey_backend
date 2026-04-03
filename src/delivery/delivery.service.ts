import { prisma } from '../prisma/prisma.service';

export class DeliveryService {
  async createDelivery(orderId: string, deliveryPartnerId?: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      const error: any = new Error('Order not found');
      error.status = 404;
      throw error;
    }

    return prisma.delivery.create({
      data: {
        order_id: orderId,
        driver_id: deliveryPartnerId || 'PENDING_PARTNER',
        status: 'PENDING',
        pickup_time: new Date(),
      },
    });
  }

  async findActiveDeliveries() {
    return prisma.delivery.findMany({
      where: {
        status: {
          in: ['PENDING', 'PICKED_UP'],
        },
      },
      include: {
        order: {
          include: {
            user: { select: { name: true, phone: true } },
            chef: { include: { user: { select: { name: true } } } },
          },
        },
      },
    });
  }

  async updateDeliveryStatus(id: string, status: any) {
    const delivery = await prisma.delivery.update({
      where: { id },
      data: { status },
    });

    if (status === 'DELIVERED') {
      await prisma.order.update({
        where: { id: delivery.order_id },
        data: { status: 'DELIVERED' },
      });
    }

    return delivery;
  }

  async processBatchedDeliveries() {
    console.log('Processing batched deliveries...');

    // Find orders that are confirmed but don't have a delivery record yet
    const pendingOrders = await prisma.order.findMany({
      where: {
        status: 'CONFIRMED',
        // @ts-ignore
        delivery: { is: null },
      },
      include: { chef: true },
    });

    if (pendingOrders.length === 0) {
      console.log('No pending orders for batching.');
      return;
    }

    // Group by chef_id
    const chefGroups = pendingOrders.reduce(
      (acc, order) => {
        if (!acc[order.chef_id]) acc[order.chef_id] = [];
        acc[order.chef_id].push(order);
        return acc;
      },
      {} as Record<string, any[]>,
    );

    for (const chefId in chefGroups) {
      const orders = chefGroups[chefId];
      console.log(
        `Creating batch delivery for Chef ${chefId} with ${orders.length} orders`,
      );

      for (const order of orders) {
        await this.createDelivery(order.id);

        // Update order status to out for delivery
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'OUT_FOR_DELIVERY' },
        });
      }
    }
  }
}

export const deliveryService = new DeliveryService();
