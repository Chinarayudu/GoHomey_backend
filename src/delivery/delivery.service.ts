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
        partner_id: deliveryPartnerId || null,
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

  // --- Delivery Partner Management ---

  async createDeliveryPartner(data: { name: string; phone_number?: string; api_key?: string; base_url?: string }) {
    return prisma.deliveryPartner.create({
      data: {
        name: data.name,
        phone_number: data.phone_number,
        api_key: data.api_key,
        base_url: data.base_url,
      },
    });
  }

  async getDeliveryPartners() {
    return prisma.deliveryPartner.findMany({
      where: { is_active: true },
    });
  }

  async pushToShadowfax(deliveryId: string, partner: any) {
    console.log(`[Shadowfax API Mock] Pushing delivery ${deliveryId} to Shadowfax...`);
    // Mocking an external HTTP POST request to Shadowfax's API endpoint
    // Normally you would use fetch() or axios here, using partner.api_key and partner.base_url
    
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    const fakeOrderId = Math.floor(Math.random() * 100000);

    // Mock response from Shadowfax
    return {
      success: true,
      shadowfax_order_id: `SFX-${fakeOrderId}`,
      shadowfax_tracking_url: `https://track.shadowfax.in/SFX-${fakeOrderId}`,
      status: 'ORDER_ACCEPTED',
    };
  }

  async assignPartnerToDelivery(deliveryId: string, partnerId: string) {
    const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) {
      const err: any = new Error('Delivery not found');
      err.status = 404;
      throw err;
    }

    const partner = await prisma.deliveryPartner.findUnique({ where: { id: partnerId } });
    if (!partner) {
      const err: any = new Error('Partner not found');
      err.status = 404;
      throw err;
    }

    // Attempt to push to the external 3rd party API (Shadowfax)
    const externalResponse = await this.pushToShadowfax(deliveryId, partner);

    if (!externalResponse.success) {
      const err: any = new Error('Failed to push to external delivery partner');
      err.status = 500;
      throw err;
    }

    // Update internal database
    return prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        partner_id: partner.id,
        status: 'ASSIGNED',
        external_tracking_id: externalResponse.shadowfax_order_id,
        external_tracking_url: externalResponse.shadowfax_tracking_url,
      },
    });
  }
}

export const deliveryService = new DeliveryService();
