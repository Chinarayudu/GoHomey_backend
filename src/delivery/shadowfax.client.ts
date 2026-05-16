/**
 * Shadowfax Flash (hyperlocal) API client.
 *
 * Shadowfax portal naming:
 * - "Testing Environment" → Get Testing Token  → SHADOWFAX_API_TOKEN
 * - Resources → API Documentation → "Staging URL" → testing API host (NOT production)
 * - "Production Environment" → only when SHADOWFAX_API_MODE=production
 */

export type ShadowfaxApiMode = 'testing' | 'production';

/** Testing API host (pairs with Testing Token from the portal). */
export const SHADOWFAX_TESTING_BASE_URL = 'https://hlbackend.staging.shadowfax.in';

/** Live production Flash API — do not use for QA. */
export const SHADOWFAX_PRODUCTION_BASE_URL = 'https://flash-api.shadowfax.in';

export interface ShadowfaxLocation {
  name?: string;
  contact_number: string;
  address: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
}

export interface ShadowfaxCreateOrderPayload {
  pickup_details: ShadowfaxLocation;
  drop_details: ShadowfaxLocation;
  order_details: {
    order_id: string;
    is_prepaid: boolean;
    cash_to_be_collected: number;
    delivery_charge_to_be_collected_from_customer?: boolean;
  };
  user_details: {
    contact_number: string;
    credits_key: string;
  };
}

export interface ShadowfaxCreateOrderResponse {
  is_order_created?: boolean;
  message?: string;
  flash_order_id?: string;
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

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

export function resolveShadowfaxApiMode(): ShadowfaxApiMode {
  const mode = (process.env.SHADOWFAX_API_MODE || 'testing').toLowerCase();
  return mode === 'production' ? 'production' : 'testing';
}

export function resolveShadowfaxBaseUrl(partnerBaseUrl?: string | null): string {
  const override = process.env.SHADOWFAX_BASE_URL?.trim();
  if (override) return override.replace(/\/$/, '');
  if (partnerBaseUrl?.trim()) return partnerBaseUrl.replace(/\/$/, '');
  return resolveShadowfaxApiMode() === 'production'
    ? SHADOWFAX_PRODUCTION_BASE_URL
    : SHADOWFAX_TESTING_BASE_URL;
}

export class ShadowfaxClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  static fromEnv(apiKey: string, partnerBaseUrl?: string | null): ShadowfaxClient {
    return new ShadowfaxClient(apiKey, resolveShadowfaxBaseUrl(partnerBaseUrl));
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        Authorization: this.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        (data as { message?: string }).message ||
        (data as { error?: string }).error ||
        `Shadowfax API error (${response.status})`;
      const err: any = new Error(message);
      err.status = response.status;
      err.body = data;
      throw err;
    }

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
      '/order/create/',
      payload,
    );
  }

  async trackOrder(orderId: string): Promise<ShadowfaxTrackResponse> {
    return this.request<ShadowfaxTrackResponse>(
      'GET',
      `/order/track/${encodeURIComponent(orderId)}/`,
    );
  }

  async cancelOrder(orderId: string): Promise<unknown> {
    return this.request('POST', '/order/cancel/', { order_id: orderId });
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
    if (body) return `${error.message} — ${JSON.stringify(body)}`;
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
