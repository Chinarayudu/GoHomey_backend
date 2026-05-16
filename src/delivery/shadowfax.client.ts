export type ShadowfaxEnvironment = 'production' | 'staging' | 'staging1';

const BASE_URLS: Record<ShadowfaxEnvironment, string> = {
  production: 'https://flash-api.shadowfax.in',
  staging: 'https://hlbackend.staging.shadowfax.in',
  staging1: 'https://hlbackend2.staging.shadowfax.in',
};

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
}

export class ShadowfaxClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    apiKey: string,
    environment: ShadowfaxEnvironment = 'staging',
    baseUrlOverride?: string,
  ) {
    this.apiKey = apiKey;
    this.baseUrl = (baseUrlOverride || BASE_URLS[environment]).replace(/\/$/, '');
  }

  static resolveEnvironment(): ShadowfaxEnvironment {
    const env = (process.env.SHADOWFAX_ENVIRONMENT || 'staging').toLowerCase();
    if (env === 'production' || env === 'staging' || env === 'staging1') {
      return env;
    }
    return 'staging';
  }

  static resolveBaseUrl(partnerBaseUrl?: string | null): string {
    if (partnerBaseUrl) return partnerBaseUrl.replace(/\/$/, '');
    const env = ShadowfaxClient.resolveEnvironment();
    return BASE_URLS[env];
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
      throw new Error(message);
    }

    return data as T;
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

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

/** Normalize phone to 10-digit Indian mobile (6–9 prefix). */
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

/** Turn Shadowfax / config errors into a readable string for API responses. */
export function formatShadowfaxError(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const o = error as Record<string, unknown>;
    if (typeof o.message === 'string') return o.message;
    if (typeof o.error === 'string') return o.error;
    if (Array.isArray(o.errors)) return o.errors.map(String).join('; ');
    try {
      return JSON.stringify(error);
    } catch {
      return 'Shadowfax request failed';
    }
  }
  return 'Shadowfax request failed';
}
