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

    const createdDeliveryIds: string[] = [];

    for (const chefId in chefGroups) {
      const orders = chefGroups[chefId];
      console.log(
        `Creating batch delivery for Chef ${chefId} with ${orders.length} orders`,
      );

      for (const order of orders) {
        const delivery = await this.createDelivery(order.id);
        createdDeliveryIds.push(delivery.id);

        // Update order status to out for delivery
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'OUT_FOR_DELIVERY' },
        });
      }
    }

    return createdDeliveryIds;
  }

  async autoDispatchBatchedDeliveries(partnerId?: string) {
    const newDeliveryIds = await this.processBatchedDeliveries();
    
    if (!newDeliveryIds || newDeliveryIds.length === 0) {
      return { message: 'No pending orders to dispatch', count: 0, deliveries: [] };
    }

    const assignedDeliveries: any[] = [];
    for (const id of newDeliveryIds) {
      try {
        const result = await this.assignPartnerToDelivery(id, partnerId);
        assignedDeliveries.push(result);
      } catch (e) {
        console.error(`Failed to auto-assign delivery ${id}:`, e);
      }
    }

    return {
      message: 'Successfully batched and assigned deliveries',
      count: assignedDeliveries.length,
      deliveries: assignedDeliveries
    };
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

  async pushToBorzo(deliveryId: string, partner: any, order: any, chef: any, user: any, userAddress: any) {
    console.log(`[Borzo API] Pushing delivery ${deliveryId} to Borzo...`);

    const token = process.env.BORZO_API_TOKEN || partner.api_key;
    const baseUrl = process.env.BORZO_BASE_URL || partner.base_url || 'https://robotapitest-in.borzodelivery.com/api/business/1.6';

    const payload = {
      matter: "Homey Food Delivery",
      points: [
        {
          address: chef.kitchen_address || "Default Kitchen Address",
          contact_person: {
            phone: chef.phone || "9999999999",
            name: chef.name || "Chef"
          }
        },
        {
          address: userAddress?.address_line ? `${userAddress.address_line}, ${userAddress.city}, ${userAddress.state} ${userAddress.zip_code}` : "Default User Address",
          contact_person: {
            phone: user.phone || "9999999999",
            name: user.name || "Customer"
          }
        }
      ]
    };

    try {
      const response = await fetch(`${baseUrl}/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-DV-Auth-Token': token as string,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.is_successful) {
        console.error("Borzo API Error:", data);
        return { success: false, error: data };
      }

      return {
        success: true,
        borzo_order_id: data.order.order_id.toString(),
        borzo_tracking_url: data.order.tracking_url || `https://borzodelivery.com/orders/${data.order.order_id}`,
        status: data.order.status,
      };
    } catch (error) {
      console.error("Failed to call Borzo API:", error);
      return { success: false, error };
    }
  }

  async assignPartnerToDelivery(deliveryId: string, partnerId?: string) {
    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: {
        order: {
          include: {
            chef: true,
            user: {
              include: {
                addresses: {
                  where: { is_default: true },
                  take: 1
                }
              }
            }
          }
        }
      }
    });

    if (!delivery) {
      const err: any = new Error('Delivery not found');
      err.status = 404;
      throw err;
    }

    let partner;
    if (partnerId) {
      partner = await prisma.deliveryPartner.findUnique({ where: { id: partnerId } });
    } else {
      partner = await prisma.deliveryPartner.findFirst({ where: { is_active: true } });
    }

    if (!partner) {
      const err: any = new Error('Delivery partner not found. Please ensure Borzo is added as an active partner.');
      err.status = 404;
      throw err;
    }

    const order = delivery.order;
    const userAddress = order.user.addresses[0] || null;

    // Attempt to push to the external 3rd party API (Borzo)
    const externalResponse = await this.pushToBorzo(deliveryId, partner, order, order.chef, order.user, userAddress);

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
        external_tracking_id: externalResponse.borzo_order_id,
        external_tracking_url: externalResponse.borzo_tracking_url,
      },
    });
  }
}

export const deliveryService = new DeliveryService();
