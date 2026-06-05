import { prisma } from '../prisma/prisma.service';
import {
  ShadowfaxClient,
  normalizeIndianPhone,
  isValidIndianMobile,
  formatShadowfaxError,
  resolveShadowfaxApiMode,
  resolveShadowfaxBaseUrl,
  type ShadowfaxCreateOrderPayload,
} from './shadowfax.client';

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

  async getShadowfaxPartner() {
    const partner = await prisma.deliveryPartner.findFirst({
      where: {
        is_active: true,
        name: { contains: 'Shadowfax', mode: 'insensitive' },
      },
    });

    if (!partner) {
      const err: any = new Error(
        'Shadowfax delivery partner not found. Run scratch/create_partner.ts or add an active Shadowfax partner.',
      );
      err.status = 404;
      throw err;
    }

    return partner;
  }

  /**
   * One-click admin dispatch: READY_FOR_PICKUP orders → delivery records → Shadowfax.
   * @param orderIds Optional subset of order IDs (from admin multi-select). When omitted, dispatches all eligible ready orders.
   */
  async dispatchReadyForPickupToShadowfax(orderIds?: string[]) {
    const partner = await this.getShadowfaxPartner();

    const readyOrders = await prisma.order.findMany({
      where: {
        status: 'READY_FOR_PICKUP',
        ...(orderIds?.length ? { id: { in: orderIds } } : {}),
        OR: [
          { delivery: { is: null } },
          { delivery: { status: 'PENDING' } },
          { delivery: { status: 'FAILED' } },
        ],
      },
      include: {
        chef: true,
        payment: true,
        delivery: true,
        delivery_address: true,
        user: {
          include: {
            addresses: {
              where: { is_default: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { updated_at: 'asc' },
    });

    if (readyOrders.length === 0) {
      let hint =
        'No orders with status READY_FOR_PICKUP are waiting for dispatch.';
      if (orderIds?.length) {
        const selected = await prisma.order.findMany({
          where: { id: { in: orderIds } },
          select: {
            id: true,
            status: true,
            delivery: { select: { status: true } },
          },
        });
        hint = selected.length
          ? `Selected orders are not eligible: ${selected
              .map(
                (o) =>
                  `${o.id.slice(0, 8)}… status=${o.status} delivery=${o.delivery?.status ?? 'none'}`,
              )
              .join('; ')}`
          : 'None of the selected order IDs were found.';
      }
      return {
        message: 'No orders ready for pickup to dispatch',
        hint,
        total: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        results: [],
      };
    }

    const results: Array<{
      order_id: string;
      delivery_id?: string;
      status: 'success' | 'failed' | 'skipped';
      external_tracking_id?: string;
      external_tracking_url?: string;
      error?: unknown;
    }> = [];

    for (const order of readyOrders) {
      if (order.delivery?.status === 'ASSIGNED') {
        results.push({
          order_id: order.id,
          delivery_id: order.delivery.id,
          status: 'skipped',
          error: 'Already assigned to Shadowfax',
        });
        continue;
      }

      try {
        let delivery = order.delivery;
        if (!delivery) {
          delivery = await this.createDelivery(order.id, partner.id);
        }

        const assigned = await this.assignToShadowfax(delivery.id, partner);

        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'OUT_FOR_DELIVERY' },
        });

        results.push({
          order_id: order.id,
          delivery_id: assigned.id,
          status: 'success',
          external_tracking_id: assigned.external_tracking_id ?? undefined,
          external_tracking_url: assigned.external_tracking_url ?? undefined,
        });
      } catch (error) {
        const details = (error as { details?: unknown })?.details;
        const errorMessage = details
          ? formatShadowfaxError(details)
          : error instanceof Error
            ? error.message
            : String(error);
        console.error(
          `[Shadowfax] Failed to dispatch order ${order.id}:`,
          errorMessage,
          details ?? '',
        );
        results.push({
          order_id: order.id,
          delivery_id: order.delivery?.id,
          status: 'failed',
          error: errorMessage,
        });
      }
    }

    const succeeded = results.filter((r) => r.status === 'success').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;

    return {
      message:
        failed === 0
          ? `Dispatched ${succeeded} order(s) to Shadowfax`
          : `Dispatched ${succeeded} order(s); ${failed} failed, ${skipped} skipped`,
      total: readyOrders.length,
      succeeded,
      failed,
      skipped,
      results,
    };
  }

  async processBatchedDeliveries() {
    console.log('Processing batched deliveries...');

    const pendingOrders = await prisma.order.findMany({
      where: {
        status: 'READY_FOR_PICKUP',
        // @ts-ignore
        delivery: { is: null },
      },
      include: { chef: true },
    });

    if (pendingOrders.length === 0) {
      console.log('No pending orders for batching.');
      return;
    }

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

        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'OUT_FOR_DELIVERY' },
        });
      }
    }

    return createdDeliveryIds;
  }

  /** @deprecated Use dispatchReadyForPickupToShadowfax via POST /admin/deliveries/dispatch-shadowfax */
  async autoDispatchBatchedDeliveries() {
    return this.dispatchReadyForPickupToShadowfax();
  }

  async createDeliveryPartner(data: {
    name: string;
    phone_number?: string;
    api_key?: string;
    base_url?: string;
  }) {
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

  private buildAddressLine(
    addressLine?: string | null,
    city?: string | null,
    state?: string | null,
    zip?: string | null,
    fallback = 'Address not provided',
  ): string {
    if (!addressLine) return fallback;
    return [addressLine, city, state, zip].filter(Boolean).join(', ');
  }

  async pushToShadowfax(
    deliveryId: string,
    partner: { api_key?: string | null; base_url?: string | null },
    order: {
      id: string;
      total_price: number;
      payment?: { status: string } | null;
    },
    chef: {
      name: string;
      phone: string;
      kitchen_address?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    },
    user: { name: string; phone: string },
    userAddress: {
      address_line: string;
      city: string;
      state: string;
      zip_code: string;
      latitude?: number | null;
      longitude?: number | null;
    } | null,
  ) {
    console.log(
      `[Shadowfax API] Pushing delivery ${deliveryId} to Shadowfax...`,
    );

    const apiMode = resolveShadowfaxApiMode();
    const apiBaseUrl = resolveShadowfaxBaseUrl(partner.base_url);
    console.log(`[Shadowfax API] mode=${apiMode} base=${apiBaseUrl}`);

    const apiKey = process.env.SHADOWFAX_API_TOKEN || partner.api_key;
    const creditsKey =
      process.env.SHADOWFAX_CREDITS_KEY ||
      process.env.SHADOWFAX_CLIENT_CODE ||
      apiKey;

    if (!apiKey) {
      return {
        success: false,
        error: 'Shadowfax API token is not configured on the server',
      };
    }
    if (!creditsKey) {
      return {
        success: false,
        error: 'Shadowfax credits key is not configured',
      };
    }
    if (!userAddress?.address_line) {
      return {
        success: false,
        error: 'Customer has no default delivery address',
      };
    }
    if (!chef.kitchen_address?.trim()) {
      return {
        success: false,
        error: 'Chef kitchen_address is missing',
      };
    }
    if (!isValidIndianMobile(chef.phone)) {
      return {
        success: false,
        error: `Chef phone is not a valid Indian mobile: ${chef.phone}`,
      };
    }
    if (!isValidIndianMobile(user.phone)) {
      return {
        success: false,
        error: `Customer phone is not a valid Indian mobile: ${user.phone}`,
      };
    }

    const client = ShadowfaxClient.fromEnv(apiKey, partner.base_url);

    const isPrepaid = order.payment?.status === 'COMPLETED';
    const cashToCollect = isPrepaid ? 0 : order.total_price;

    const payload: ShadowfaxCreateOrderPayload = {
      pickup_details: {
        name: chef.name || 'Chef',
        contact_number: normalizeIndianPhone(chef.phone),
        address: chef.kitchen_address || 'Kitchen address not set',
        latitude: chef.latitude ?? undefined,
        longitude: chef.longitude ?? undefined,
      },
      drop_details: {
        name: user.name || 'Customer',
        contact_number: normalizeIndianPhone(user.phone),
        address: this.buildAddressLine(
          userAddress?.address_line,
          userAddress?.city,
          userAddress?.state,
          userAddress?.zip_code,
          'Customer address not set',
        ),
        latitude: userAddress?.latitude ?? undefined,
        longitude: userAddress?.longitude ?? undefined,
      },
      order_details: {
        order_id: order.id,
        is_prepaid: isPrepaid,
        cash_to_be_collected: cashToCollect,
        delivery_charge_to_be_collected_from_customer: false,
      },
      user_details: {
        contact_number: normalizeIndianPhone(user.phone),
        credits_key: creditsKey,
      },
    };

    try {
      const createResponse = await client.createOrder(payload);

      if (!createResponse.is_order_created) {
        console.error('Shadowfax create-order rejected:', createResponse);
        return {
          success: false,
          error: createResponse.message || createResponse,
        };
      }

      console.log(
        `[Shadowfax API] Order created flash_order_id=${createResponse.flash_order_id} message=${createResponse.message}`,
      );

      let trackingUrl: string | undefined;
      let sfxStatus: string | undefined;
      try {
        const trackResponse = await client.trackOrder(order.id);
        trackingUrl = trackResponse.tracking_url;
        sfxStatus = trackResponse.status;
        console.log(`[Shadowfax API] Track status=${sfxStatus}`);
      } catch (trackError) {
        console.warn(
          '[Shadowfax API] Could not fetch tracking URL:',
          trackError,
        );
      }

      return {
        success: true,
        external_order_id: createResponse.flash_order_id || order.id,
        external_tracking_url: trackingUrl,
        status: 'ASSIGNED',
        shadowfax_status: sfxStatus,
        shadowfax_message: createResponse.message,
      };
    } catch (error) {
      console.error('Failed to call Shadowfax API:', error);
      return { success: false, error };
    }
  }

  async assignToShadowfax(
    deliveryId: string,
    partner?: { id: string; api_key?: string | null; base_url?: string | null },
  ) {
    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: {
        order: {
          include: {
            chef: true,
            payment: true,
            delivery_address: true,
            user: {
              include: {
                addresses: {
                  where: { is_default: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!delivery) {
      const err: any = new Error('Delivery not found');
      err.status = 404;
      throw err;
    }

    const shadowfaxPartner = partner ?? (await this.getShadowfaxPartner());
    const order = delivery.order;
    const userAddress =
      order.delivery_address || order.user.addresses[0] || null;

    const externalResponse = await this.pushToShadowfax(
      deliveryId,
      shadowfaxPartner,
      order,
      order.chef,
      order.user,
      userAddress,
    );

    if (!externalResponse.success) {
      const err: any = new Error(formatShadowfaxError(externalResponse.error));
      err.status = 500;
      err.details = externalResponse.error;
      throw err;
    }

    return prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        partner_id: shadowfaxPartner.id,
        status: 'ASSIGNED',
        external_tracking_id: externalResponse.external_order_id,
        external_tracking_url: externalResponse.external_tracking_url,
      },
    });
  }

  async assignPartnerToDelivery(deliveryId: string) {
    return this.assignToShadowfax(deliveryId);
  }
}

export const deliveryService = new DeliveryService();
