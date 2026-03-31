import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(private prisma: PrismaService) {}

  async createDelivery(orderId: string, deliveryPartnerId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.prisma.delivery.create({
      data: {
        order_id: orderId,
        driver_id: deliveryPartnerId || 'PENDING_PARTNER',
        status: 'PENDING',
        pickup_time: new Date(),
      },
    });
  }

  async findActiveDeliveries() {
    return this.prisma.delivery.findMany({
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
    const delivery = await this.prisma.delivery.update({
      where: { id },
      data: { status },
    });

    if (status === 'DELIVERED') {
      await this.prisma.order.update({
        where: { id: delivery.order_id },
        data: { status: 'DELIVERED' },
      });
    }

    return delivery;
  }

  async processBatchedDeliveries() {
    this.logger.log('Processing batched deliveries...');

    // Find orders that are confirmed but don't have a delivery record yet
    const pendingOrders = await this.prisma.order.findMany({
      where: {
        status: 'CONFIRMED',
        delivery: { is: null },
      },
      include: { chef: true },
    });

    if (pendingOrders.length === 0) {
      this.logger.log('No pending orders for batching.');
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
      this.logger.log(
        `Creating batch delivery for Chef ${chefId} with ${orders.length} orders`,
      );

      for (const order of orders) {
        await this.createDelivery(order.id);

        // Update order status to out for delivery
        await this.prisma.order.update({
          where: { id: order.id },
          data: { status: 'OUT_FOR_DELIVERY' },
        });
      }
    }
  }
}
