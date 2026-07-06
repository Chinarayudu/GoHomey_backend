/**
 * Shadowfax Marketplace hyperlocal API client.
 *
 * Shadowfax portal naming:
 * - "Testing Environment" -> Get Testing Token -> SHADOWFAX_API_TOKEN
 * - Marketplace create order -> POST /api/v2/orders/
 * - "Production Environment" -> only when SHADOWFAX_API_MODE=production
 */

export type ShadowfaxApiMode = 'testing' | 'production';

/** Testing API host (pairs with Testing Token from the portal). */
export const SHADOWFAX_TESTING_BASE_URL =
  'https://hlbackend.staging.shadowfax.in';

/** Live production API - do not use for QA. */
export const SHADOWFAX_PRODUCTION_BASE_URL = 'https://flash-api.shadowfax.in';

/** Shadowfax staging is serviceable only around Koramangala. */
export const SHADOWFAX_STAGING_SERVICEABLE_LOCATION = {
  latitude: 12.9379319,
  longitude: 77.6244159,
};

export interface ShadowfaxLocation {
  name?: string;
  contact_number: string;
  address: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  delivery_otp?: string;
}

export interface ShadowfaxCreateOrderPayload {
  has_tip?: boolean;
  tip_amount?: number;
  pickup_details: ShadowfaxLocation;
  drop_details: ShadowfaxLocation;
  client_code: string;
  order_items: Array<{
    name: string;
    price: number;
    quantity: number;
    id: string;
  }>;
  order_details: {
    scheduled_time: string;
    order_value: number;
    paid: 'true' | 'false';
    client_order_id: string;
    pickup_otp?: string;
    return_otp?: string;
    rain_flag?: boolean;
    delivery_instruction?: {
      drop_instruction_text?: string;
      take_drop_off_picture?: boolean;
      drop_off_picture_mandatory?: boolean;
      client_surge?: number;
    };
  };
}

export interface ShadowfaxCreateOrderResponse {
  is_order_created?: boolean;
  message?: string;
  flash_order_id?: string | number;
  sfx_order_id?: string | number;
  order_id?: string | number;
  id?: string | number;
  client_order_id?: string | number;
  awb?: string | number;
  tracking_url?: string;
  data?: {
    id?: string | number;
    order_id?: string | number;
    sfx_order_id?: string | number;
    flash_order_id?: string | number;
    client_order_id?: string | number;
    awb?: string | number;
    tracking_url?: string;
    message?: string;
  };
  pickup_otp?: number;
  drop_otp?: number;
  total_amount?: number;
}

export interface ShadowfaxTrackResponse {
  order_id: string;
  status: string;
  sfx_order_id?: string;
  tracking_url?: string;
  event_time?: string;
  rider_name?: string;
  rider_contact_number?: string;
}

export interface ShadowfaxMarketplaceOrderStatusResponse {
  message?: string;
  data?: {
    client_code?: string;
    status?: string;
    sfx_order_id?: string | number;
    track_url?: string;
    tracking_url?: string;
    rider_details?: {
      rider_name?: string;
      rider_phone?: string;
      rider_contact?: string;
      rider_location?: {
        latitude?: string | number;
        longitude?: string | number;
      };
    };
    order_details?: {
      client_order_id?: string | number;
      pickup_eta?: number;
      drop_eta?: number;
      allot_time?: string | null;
      arrival_time?: string | null;
      dispatch_time?: string | null;
      delivery_time?: string | null;
      vehicle_number?: string | null;
    };
  };
}

export type ShadowfaxSandboxAction =
  | 'ALLOT'
  | 'ARRIVE_AT_STORE'
  | 'COLLECT'
  | 'CUSTOMER_DOORSTEP'
  | 'DELIVER'
  | 'CUSTOMER_RETURN'
  | 'SELLER_RETURN';

export interface ShadowfaxSandboxOptions {
  rider_id?: number;
  only_allot?: 0 | 1;
  time_arrival?: string;
  pickup_lat?: number;
  pickup_lng?: number;
  arrival_lat?: number;
  arrival_lng?: number;
  arrival_accuracy?: number;
  delivery_latitude?: number;
  delivery_longitude?: number;
  is_partial_delivery?: boolean;
  return_reason?: string;
  rts_order_id?: string;
}

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

export function resolveShadowfaxApiMode(): ShadowfaxApiMode {
  const mode = (process.env.SHADOWFAX_API_MODE || 'testing').toLowerCase();
  return mode === 'production' ? 'production' : 'testing';
}

export function resolveShadowfaxBaseUrl(
  partnerBaseUrl?: string | null,
): string {
  const override = process.env.SHADOWFAX_BASE_URL?.trim();
  if (override) return override.replace(/\/$/, '');
  if (partnerBaseUrl?.trim()) return partnerBaseUrl.replace(/\/$/, '');
  return resolveShadowfaxApiMode() === 'production'
    ? SHADOWFAX_PRODUCTION_BASE_URL
    : SHADOWFAX_TESTING_BASE_URL;
}

export function resolveShadowfaxClientCode(): string | undefined {
  return process.env.SHADOWFAX_CLIENT_CODE?.trim() || undefined;
}

export function formatShadowfaxAuthorization(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (/^(Token|Bearer)\s+/i.test(trimmed)) return trimmed;
  return `Token ${trimmed}`;
}

export function shouldUseShadowfaxStagingCoordinates(): boolean {
  return (
    resolveShadowfaxApiMode() === 'testing' &&
    process.env.SHADOWFAX_USE_STAGING_SERVICEABLE_COORDS !== 'false'
  );
}

export class ShadowfaxClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly clientCode?: string;

  constructor(apiKey: string, baseUrl: string, clientCode?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.clientCode = clientCode?.trim() || undefined;
  }

  static fromEnv(
    apiKey: string,
    partnerBaseUrl?: string | null,
  ): ShadowfaxClient {
    return new ShadowfaxClient(
      apiKey,
      resolveShadowfaxBaseUrl(partnerBaseUrl),
      resolveShadowfaxClientCode(),
    );
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
  ): Promise<T> {
    const startedAt = Date.now();
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        Authorization: formatShadowfaxAuthorization(this.apiKey),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json().catch(() => ({}));
    const durationMs = Date.now() - startedAt;

    if (!response.ok) {
      const message =
        (data as { message?: string }).message ||
        (data as { error?: string }).error ||
        `Shadowfax API error (${response.status})`;
      console.error('[Shadowfax API] request failed', {
        method,
        endpoint,
        status: response.status,
        duration_ms: durationMs,
        message,
        response_body: data,
      });
      const err: any = new Error(message);
      err.status = response.status;
      err.body = data;
      throw err;
    }

    console.log('[Shadowfax API] request success', {
      method,
      endpoint,
      status: response.status,
      duration_ms: durationMs,
    });

    return data as T;
  }

  async validateCreditsKey(creditsKey: string, storeBrandId: string) {
    return this.request<{ is_valid?: boolean; message?: string }>(
      'POST',
      '/order/credits/key/validate/',
      { credits_key: creditsKey, store_brand_id: storeBrandId },
    );
  }

  async createOrder(
    payload: ShadowfaxCreateOrderPayload,
  ): Promise<ShadowfaxCreateOrderResponse> {
    return this.request<ShadowfaxCreateOrderResponse>(
      'POST',
      '/api/v2/orders/',
      payload,
    );
  }

  async trackOrder(orderId: string): Promise<ShadowfaxTrackResponse> {
    return this.request<ShadowfaxTrackResponse>(
      'GET',
      `/order/track/${encodeURIComponent(orderId)}/`,
    );
  }

  async getOrderStatus(
    sfxOrderId: string,
  ): Promise<ShadowfaxMarketplaceOrderStatusResponse> {
    return this.request<ShadowfaxMarketplaceOrderStatusResponse>(
      'GET',
      `/api/v2/orders/${encodeURIComponent(sfxOrderId)}/status/`,
    );
  }

  async cancelOrder(orderId: string): Promise<unknown> {
    return this.request('POST', '/order/cancel/', { order_id: orderId });
  }

  async allotSandboxRider(
    sfxOrderId: string,
    riderId = 2052,
    onlyAllot: 0 | 1 = 1,
  ): Promise<unknown> {
    return this.request(
      'PUT',
      `/app/v3/sandbox/clusters/orders/${encodeURIComponent(sfxOrderId)}/allot/`,
      { rider_id: riderId, only_allot: onlyAllot },
    );
  }

  async updateSandboxStoreArrival(
    sfxOrderId: string,
    timeArrival: string,
  ): Promise<unknown> {
    return this.request(
      'POST',
      `/app/v3/sandbox/order/${encodeURIComponent(sfxOrderId)}/update-rider-arrival/`,
      { time_arrival: timeArrival },
    );
  }

  async collectSandboxOrder(
    sfxOrderId: string,
    pickupLat = SHADOWFAX_STAGING_SERVICEABLE_LOCATION.latitude,
    pickupLng = SHADOWFAX_STAGING_SERVICEABLE_LOCATION.longitude,
  ): Promise<unknown> {
    return this.request(
      'PUT',
      `/app/v3/sandbox/order/${encodeURIComponent(sfxOrderId)}/collect/`,
      { status: 'COLLECTED', pickup_lat: pickupLat, pickup_lng: pickupLng },
    );
  }

  async updateSandboxCustomerDoorstepArrival(
    sfxOrderId: string,
    timeArrival: string,
    arrivalLat = SHADOWFAX_STAGING_SERVICEABLE_LOCATION.latitude,
    arrivalLng = SHADOWFAX_STAGING_SERVICEABLE_LOCATION.longitude,
    arrivalAccuracy = 10,
  ): Promise<unknown> {
    return this.request(
      'PUT',
      `/app/v3/sandbox/order/${encodeURIComponent(sfxOrderId)}/customer-doorstep-arrival/`,
      {
        time_arrival: timeArrival,
        arrival_lat: arrivalLat,
        arrival_lng: arrivalLng,
        arrival_accuracy: arrivalAccuracy,
      },
    );
  }

  async deliverSandboxOrder(
    sfxOrderId: string,
    deliveryLatitude = SHADOWFAX_STAGING_SERVICEABLE_LOCATION.latitude,
    deliveryLongitude = SHADOWFAX_STAGING_SERVICEABLE_LOCATION.longitude,
    isPartialDelivery = false,
  ): Promise<unknown> {
    return this.request(
      'PUT',
      `/app/v3/sandbox/order/${encodeURIComponent(sfxOrderId)}/deliver/`,
      {
        status: 'DELIVERED',
        delivery_latitude: deliveryLatitude,
        delivery_longitude: deliveryLongitude,
        is_partial_delivery: isPartialDelivery,
      },
    );
  }

  async customerReturnSandboxOrder(
    sfxOrderId: string,
    returnReason = 'Customer returned order',
  ): Promise<unknown> {
    return this.request(
      'PUT',
      `/app/v3/sandbox/order/${encodeURIComponent(sfxOrderId)}/customer-return/`,
      { return_reason: returnReason },
    );
  }

  async sellerReturnSandboxOrder(
    sfxOrderId: string,
    rtsOrderId: string,
  ): Promise<unknown> {
    return this.request(
      'PUT',
      `/app/v3/sandbox/order/${encodeURIComponent(sfxOrderId)}/seller-return/`,
      { rts_order_id: rtsOrderId },
    );
  }
}

export function normalizeIndianPhone(phone?: string | null): string {
  if (!phone) return '9999999999';
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 12 && digits.startsWith('91')) {
    return digits.slice(-10);
  }
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return '9999999999';
}

export function isValidIndianMobile(phone?: string | null): boolean {
  return INDIAN_MOBILE.test(normalizeIndianPhone(phone));
}

export function formatShadowfaxError(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) {
    const body = (error as { body?: unknown }).body;
    if (body) return `${error.message} - ${JSON.stringify(body)}`;
    return error.message;
  }
  if (error && typeof error === 'object') {
    const o = error as Record<string, unknown>;
    if (typeof o.message === 'string') return o.message;
    try {
      return JSON.stringify(error);
    } catch {
      return 'Shadowfax request failed';
    }
  }
  return 'Shadowfax request failed';
}
