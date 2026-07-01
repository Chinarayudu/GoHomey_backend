import { prisma } from '../prisma/prisma.service';
import { DeliveryStatus } from '@prisma/client';
import {
  ShadowfaxClient,
  normalizeIndianPhone,
  isValidIndianMobile,
  formatShadowfaxError,
  resolveShadowfaxApiMode,
  resolveShadowfaxBaseUrl,
  resolveShadowfaxClientCode,
  shouldUseShadowfaxStagingCoordinates,
  SHADOWFAX_STAGING_SERVICEABLE_LOCATION,
  type ShadowfaxCreateOrderResponse,
  type ShadowfaxCreateOrderPayload,
  type ShadowfaxMarketplaceOrderStatusResponse,
  type ShadowfaxSandboxAction,
  type ShadowfaxSandboxOptions,
} from './shadowfax.client';

export class DeliveryService {
  private formatShadowfaxTimestamp(date = new Date()): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return (
      [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join(
        '-',
      ) +
      ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    );
  }

  private extractShadowfaxOrderId(
    response: ShadowfaxCreateOrderResponse,
    fallbackOrderId: string,
  ): string {
    const externalOrderId =
      response.sfx_order_id ||
      response.order_id ||
      response.id ||
      response.flash_order_id ||
      response.awb ||
      response.data?.sfx_order_id ||
      response.data?.order_id ||
      response.data?.id ||
      response.data?.flash_order_id ||
      response.data?.awb ||
      fallbackOrderId;

    return String(externalOrderId);
  }

  private extractShadowfaxTrackingUrl(
    response: ShadowfaxCreateOrderResponse,
  ): string | undefined {
    return this.normalizeShadowfaxTrackingUrl(
      response.tracking_url || response.data?.tracking_url,
    );
  }

  private normalizeShadowfaxTrackingUrl(
    trackingUrl?: string | null,
  ): string | undefined {
    const trimmed = trackingUrl?.trim();
    if (!trimmed) return undefined;

    const unavailableValues = new Set(['na', 'n/a', 'null', 'none', '-']);
    if (unavailableValues.has(trimmed.toLowerCase())) return undefined;

    const urlMatch = trimmed.match(/https?:\/\/[^\s)\]]+/i);
    return urlMatch?.[0];
  }

  private mapShadowfaxDeliveryStatus(status?: string): DeliveryStatus | null {
    switch (status?.toUpperCase()) {
      case 'CREATED':
      case 'ALLOTTED':
      case 'ALLOTED':
      case 'ACCEPTED':
      case 'ARRIVED':
      case 'ARRIVED_AT_STORE':
        return DeliveryStatus.ASSIGNED;
      case 'COLLECTED':
      case 'DISPATCHED':
      case 'CUSTOMER_DOOR_STEP':
      case 'CUSTOMER_DOORSTEP':
      case 'CUSTOMER_DOORSTEP_ARRIVAL':
      case 'ARRIVAL_CUSTOMER_DOORSTEP':
      case 'ARRIVED_CUSTOMER_DOORSTEP':
        return DeliveryStatus.PICKED_UP;
      case 'DELIVERED':
        return DeliveryStatus.DELIVERED;
      case 'CANCELLED':
      case 'CANCELLED_BY_CUSTOMER':
      case 'CUSTOMER_RETURN':
      case 'RETURNED':
      case 'RETURNED_TO_SELLER':
      case 'SELLER_RETURN':
      case 'RTS_INITIATED':
      case 'RTS_COMPLETED':
        return DeliveryStatus.FAILED;
      default:
        return null;
    }
  }

  private getMarketplaceTrackingUrl(
    response: ShadowfaxMarketplaceOrderStatusResponse,
  ): string | undefined {
    return this.normalizeShadowfaxTrackingUrl(
      response.data?.track_url || response.data?.tracking_url,
    );
  }

  private buildShadowfaxOrderItems(
    items:
      | Array<{
          id?: string | null;
          item_id?: string | null;
          quantity?: number | null;
          price?: number | null;
          daily_meal?: { meal_name?: string | null } | null;
          pantry_item?: { name?: string | null } | null;
          social_event?: { title?: string | null } | null;
          fuel_slot?: { time_slot?: string | null } | null;
        }>
      | undefined,
    orderTotal: number,
  ) {
    if (!items?.length) {
      return [
        {
          name: 'GoHomey order',
          price: Math.max(Number(orderTotal || 0), 1),
          quantity: 1,
          id: 'gohomey-order',
        },
      ];
    }

    return items.map((item, index) => ({
      name:
        item.daily_meal?.meal_name ||
        item.pantry_item?.name ||
        item.social_event?.title ||
        item.fuel_slot?.time_slot ||
        `GoHomey item ${index + 1}`,
      price: Math.max(Number(item.price || 0), 1),
      quantity: Math.max(Number(item.quantity || 1), 1),
      id: item.item_id || item.id || `item-${index + 1}`,
    }));
  }

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
      data: {
        status,
        ...(status === 'DELIVERED' ? { delivered_time: new Date() } : {}),
      },
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
   * One-click admin dispatch: READY_FOR_PICKUP orders -> delivery records -> Shadowfax.
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
                  `${o.id.slice(0, 8)}... status=${o.status} delivery=${o.delivery?.status ?? 'none'}`,
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
      items?: Array<{
        id?: string | null;
        item_id?: string | null;
        quantity?: number | null;
        price?: number | null;
        daily_meal?: { meal_name?: string | null } | null;
        pantry_item?: { name?: string | null } | null;
        social_event?: { title?: string | null } | null;
        fuel_slot?: { time_slot?: string | null } | null;
      }>;
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
    const clientCode =
      resolveShadowfaxClientCode() || process.env.SHADOWFAX_CREDITS_KEY;
    const stagingLocation = shouldUseShadowfaxStagingCoordinates()
      ? SHADOWFAX_STAGING_SERVICEABLE_LOCATION
      : null;
    const chefPhone = isValidIndianMobile(chef.phone)
      ? normalizeIndianPhone(chef.phone)
      : stagingLocation
        ? '9999999999'
        : null;
    const customerPhone = isValidIndianMobile(user.phone)
      ? normalizeIndianPhone(user.phone)
      : stagingLocation
        ? '9999999999'
        : null;

    if (!apiKey) {
      return {
        success: false,
        error: 'Shadowfax API token is not configured on the server',
      };
    }
    if (!clientCode) {
      return {
        success: false,
        error: 'Shadowfax client code is not configured',
      };
    }
    if (!userAddress?.address_line && !stagingLocation) {
      return {
        success: false,
        error: 'Customer has no default delivery address',
      };
    }
    if (!chef.kitchen_address?.trim() && !stagingLocation) {
      return {
        success: false,
        error: 'Chef kitchen_address is missing',
      };
    }
    if (!chefPhone) {
      return {
        success: false,
        error: `Chef phone is not a valid Indian mobile: ${chef.phone}`,
      };
    }
    if (!customerPhone) {
      return {
        success: false,
        error: `Customer phone is not a valid Indian mobile: ${user.phone}`,
      };
    }

    const client = ShadowfaxClient.fromEnv(apiKey, partner.base_url);

    const isPrepaid = order.payment?.status === 'COMPLETED';

    const payload: ShadowfaxCreateOrderPayload = {
      has_tip: false,
      tip_amount: 0,
      client_code: clientCode,
      pickup_details: {
        name: chef.name || 'Chef',
        contact_number: chefPhone,
        city: 'Bengaluru',
        address:
          chef.kitchen_address ||
          'GoHomey staging pickup, Koramangala, Bengaluru',
        latitude: stagingLocation?.latitude ?? chef.latitude ?? undefined,
        longitude: stagingLocation?.longitude ?? chef.longitude ?? undefined,
      },
      drop_details: {
        name: user.name || 'Customer',
        contact_number: customerPhone,
        city: 'Bengaluru',
        address: this.buildAddressLine(
          userAddress?.address_line,
          userAddress?.city,
          userAddress?.state,
          userAddress?.zip_code,
          'GoHomey staging drop, Koramangala, Bengaluru',
        ),
        latitude:
          stagingLocation?.latitude ?? userAddress?.latitude ?? undefined,
        longitude:
          stagingLocation?.longitude ?? userAddress?.longitude ?? undefined,
        delivery_otp: '7412',
      },
      order_items: this.buildShadowfaxOrderItems(
        order.items,
        order.total_price,
      ),
      order_details: {
        scheduled_time: this.formatShadowfaxTimestamp(
          new Date(Date.now() + 15 * 60 * 1000),
        ),
        order_value: Number(order.total_price || 0),
        paid: isPrepaid ? 'true' : 'false',
        client_order_id: order.id,
        pickup_otp: '1232',
        return_otp: '1234',
        rain_flag: false,
        delivery_instruction: {
          drop_instruction_text: 'Please deliver the GoHomey order.',
          take_drop_off_picture: false,
          drop_off_picture_mandatory: false,
          client_surge: 0,
        },
      },
    };

    try {
      const createResponse = await client.createOrder(payload);

      if (createResponse.is_order_created === false) {
        console.error('Shadowfax create-order rejected:', createResponse);
        return {
          success: false,
          error: createResponse.message || createResponse,
        };
      }

      const externalOrderId = this.extractShadowfaxOrderId(
        createResponse,
        order.id,
      );
      const createTrackingUrl =
        this.extractShadowfaxTrackingUrl(createResponse);

      console.log(
        `[Shadowfax API] Marketplace order created external_order_id=${externalOrderId} message=${createResponse.message ?? createResponse.data?.message ?? ''}`,
      );

      const trackingUrl: string | undefined = createTrackingUrl;

      return {
        success: true,
        external_order_id: externalOrderId,
        external_tracking_url: trackingUrl,
        status: 'ASSIGNED',
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
            items: {
              include: {
                daily_meal: true,
                pantry_item: true,
                social_event: true,
                fuel_slot: true,
              },
            },
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

  async updateShadowfaxSandboxStatus(
    deliveryId: string,
    action: ShadowfaxSandboxAction,
    options: ShadowfaxSandboxOptions = {},
  ) {
    if (resolveShadowfaxApiMode() !== 'testing') {
      const err: any = new Error(
        'Shadowfax sandbox status updates are allowed only in testing mode',
      );
      err.status = 400;
      throw err;
    }

    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { partner: true },
    });

    if (!delivery) {
      const err: any = new Error('Delivery not found');
      err.status = 404;
      throw err;
    }

    const sfxOrderId = delivery.external_tracking_id;
    if (!sfxOrderId) {
      const err: any = new Error(
        'Delivery has no Shadowfax order ID. Dispatch it to Shadowfax first.',
      );
      err.status = 400;
      throw err;
    }

    const partner = delivery.partner ?? (await this.getShadowfaxPartner());
    const apiKey = process.env.SHADOWFAX_API_TOKEN || partner.api_key;
    if (!apiKey) {
      const err: any = new Error(
        'Shadowfax API token is not configured on the server',
      );
      err.status = 500;
      throw err;
    }

    const client = ShadowfaxClient.fromEnv(apiKey, partner.base_url);
    const timeArrival =
      options.time_arrival || this.formatShadowfaxTimestamp(new Date());

    let response: unknown;
    switch (action) {
      case 'ALLOT':
        response = await client.allotSandboxRider(
          sfxOrderId,
          options.rider_id,
          options.only_allot,
        );
        break;
      case 'ARRIVE_AT_STORE':
        response = await client.updateSandboxStoreArrival(
          sfxOrderId,
          timeArrival,
        );
        break;
      case 'COLLECT':
        response = await client.collectSandboxOrder(
          sfxOrderId,
          options.pickup_lat,
          options.pickup_lng,
        );
        break;
      case 'CUSTOMER_DOORSTEP':
        response = await client.updateSandboxCustomerDoorstepArrival(
          sfxOrderId,
          timeArrival,
          options.arrival_lat,
          options.arrival_lng,
          options.arrival_accuracy,
        );
        break;
      case 'DELIVER':
        response = await client.deliverSandboxOrder(
          sfxOrderId,
          options.delivery_latitude,
          options.delivery_longitude,
          options.is_partial_delivery,
        );
        break;
      case 'CUSTOMER_RETURN':
        response = await client.customerReturnSandboxOrder(
          sfxOrderId,
          options.return_reason,
        );
        break;
      case 'SELLER_RETURN':
        response = await client.sellerReturnSandboxOrder(
          sfxOrderId,
          options.rts_order_id || sfxOrderId,
        );
        break;
      default: {
        const err: any = new Error(
          `Unsupported Shadowfax sandbox action: ${action}`,
        );
        err.status = 400;
        throw err;
      }
    }

    return {
      message: 'Shadowfax sandbox status update sent',
      delivery_id: delivery.id,
      shadowfax_order_id: sfxOrderId,
      action,
      response,
    };
  }

  async getOrderLiveTracking(
    orderId: string,
    requester: { id: string; role?: string },
  ) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        chef: { select: { id: true, user_id: true } },
        delivery: { include: { partner: true } },
      },
    });

    if (!order) {
      const err: any = new Error('Order not found');
      err.status = 404;
      throw err;
    }

    const canView =
      requester.role === 'ADMIN' ||
      order.user_id === requester.id ||
      order.chef_id === requester.id ||
      order.chef.user_id === requester.id;

    if (!canView) {
      const err: any = new Error(
        'Forbidden: cannot view tracking for this order',
      );
      err.status = 403;
      throw err;
    }

    const delivery = order.delivery;
    if (!delivery) {
      return {
        order_id: order.id,
        order_status: order.status,
        delivery_status: null,
        tracking_url: null,
        tracking_id: null,
        is_live_tracking_available: false,
        message: 'Delivery has not been assigned yet',
      };
    }

    let trackingUrl = this.normalizeShadowfaxTrackingUrl(
      delivery.external_tracking_url,
    );
    let providerStatus: string | undefined;
    let trackingRefreshError: string | undefined;
    let trackingMessage: string | undefined;
    let rider:
      | {
          name?: string;
          phone?: string;
          latitude?: number;
          longitude?: number;
        }
      | undefined;
    let pickupEta: number | undefined;
    let dropEta: number | undefined;
    let statusUpdated = false;

    if (delivery.external_tracking_id) {
      const apiKey =
        process.env.SHADOWFAX_API_TOKEN || delivery.partner?.api_key;

      if (!apiKey) {
        trackingRefreshError =
          'Shadowfax API token is not configured on the server';
      } else {
        try {
          const client = ShadowfaxClient.fromEnv(
            apiKey,
            delivery.partner?.base_url,
          );
          const statusResponse = await client.getOrderStatus(
            delivery.external_tracking_id,
          );
          const statusData = statusResponse.data;

          providerStatus = statusData?.status;
          const marketplaceTrackingUrl =
            this.getMarketplaceTrackingUrl(statusResponse);
          trackingUrl = marketplaceTrackingUrl || trackingUrl;
          pickupEta = statusData?.order_details?.pickup_eta;
          dropEta = statusData?.order_details?.drop_eta;

          const riderLocation = statusData?.rider_details?.rider_location;
          const riderLatitude =
            riderLocation?.latitude !== undefined
              ? Number(riderLocation.latitude)
              : undefined;
          const riderLongitude =
            riderLocation?.longitude !== undefined
              ? Number(riderLocation.longitude)
              : undefined;

          const riderDetails = {
            name: statusData?.rider_details?.rider_name,
            phone:
              statusData?.rider_details?.rider_phone ||
              statusData?.rider_details?.rider_contact,
            latitude: Number.isFinite(riderLatitude)
              ? riderLatitude
              : undefined,
            longitude: Number.isFinite(riderLongitude)
              ? riderLongitude
              : undefined,
          };
          rider = Object.values(riderDetails).some(
            (value) => value !== undefined,
          )
            ? riderDetails
            : undefined;

          const internalStatus =
            this.mapShadowfaxDeliveryStatus(providerStatus);

          if (internalStatus && internalStatus !== delivery.status) {
            await this.updateDeliveryStatus(delivery.id, internalStatus);
            delivery.status = internalStatus;
            statusUpdated = true;
          }

          if (trackingUrl && trackingUrl !== delivery.external_tracking_url) {
            await prisma.delivery.update({
              where: { id: delivery.id },
              data: { external_tracking_url: trackingUrl },
            });
          } else if (!trackingUrl && delivery.external_tracking_url) {
            await prisma.delivery.update({
              where: { id: delivery.id },
              data: { external_tracking_url: null },
            });
          }
        } catch (error) {
          trackingRefreshError = formatShadowfaxError(error);
        }
      }
    }

    if (
      !trackingUrl &&
      delivery.external_tracking_id &&
      !trackingRefreshError
    ) {
      trackingMessage =
        'Shadowfax Marketplace order is assigned, but Shadowfax has not returned a live map URL yet.';
    }

    return {
      order_id: order.id,
      order_status: order.status,
      delivery_id: delivery.id,
      delivery_status: delivery.status,
      tracking_id: delivery.external_tracking_id,
      tracking_url: trackingUrl || null,
      provider_status: providerStatus,
      is_live_tracking_available: Boolean(trackingUrl),
      rider,
      pickup_eta_minutes: pickupEta,
      drop_eta_minutes: dropEta,
      status_updated: statusUpdated,
      tracking_refresh_error: trackingRefreshError,
      tracking_message: trackingMessage,
    };
  }

  async assignPartnerToDelivery(deliveryId: string) {
    return this.assignToShadowfax(deliveryId);
  }
}

export const deliveryService = new DeliveryService();
