import {
  ShadowfaxClient,
  SHADOWFAX_PRODUCTION_BASE_URL,
  SHADOWFAX_TESTING_BASE_URL,
  resolveShadowfaxApiMode,
  resolveShadowfaxBaseUrl,
  resolveShadowfaxClientCode,
  normalizeShadowfaxApiToken,
  formatShadowfaxAuthorization,
  shouldUseShadowfaxStagingCoordinates,
} from './shadowfax.client';

/**
 * Component tests for the Shadowfax API client. Everything here mocks
 * `fetch` — nothing in this file makes a real network call, so it's safe to
 * run against any environment (including one configured with a real
 * production token, as this repo currently is) without dispatching a real
 * courier or touching Shadowfax's live API.
 */

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.restoreAllMocks();
});

describe('resolveShadowfaxApiMode', () => {
  it('defaults to "testing" when unset', () => {
    delete process.env.SHADOWFAX_API_MODE;
    expect(resolveShadowfaxApiMode()).toBe('testing');
  });

  it('returns "production" only for an exact (case-insensitive) match', () => {
    process.env.SHADOWFAX_API_MODE = 'production';
    expect(resolveShadowfaxApiMode()).toBe('production');

    process.env.SHADOWFAX_API_MODE = 'PRODUCTION';
    expect(resolveShadowfaxApiMode()).toBe('production');

    process.env.SHADOWFAX_API_MODE = 'prod';
    expect(resolveShadowfaxApiMode()).toBe('testing');
  });
});

describe('resolveShadowfaxBaseUrl', () => {
  it('an explicit SHADOWFAX_BASE_URL override always wins, regardless of mode', () => {
    process.env.SHADOWFAX_API_MODE = 'production';
    process.env.SHADOWFAX_BASE_URL = 'https://staging-override.example.com/';
    expect(resolveShadowfaxBaseUrl()).toBe('https://staging-override.example.com');
  });

  it('resolves to the production URL when mode=production and no override is set', () => {
    process.env.SHADOWFAX_API_MODE = 'production';
    delete process.env.SHADOWFAX_BASE_URL;
    expect(resolveShadowfaxBaseUrl()).toBe(SHADOWFAX_PRODUCTION_BASE_URL);
  });

  it('an empty-string SHADOWFAX_BASE_URL is treated as unset, not as an override', () => {
    process.env.SHADOWFAX_API_MODE = 'production';
    process.env.SHADOWFAX_BASE_URL = '';
    expect(resolveShadowfaxBaseUrl()).toBe(SHADOWFAX_PRODUCTION_BASE_URL);
  });

  it('resolves to the testing URL when mode=testing and no override is set', () => {
    process.env.SHADOWFAX_API_MODE = 'testing';
    delete process.env.SHADOWFAX_BASE_URL;
    expect(resolveShadowfaxBaseUrl()).toBe(SHADOWFAX_TESTING_BASE_URL);
  });

  it('falls back to a partner-specific base URL when given and no env override is set', () => {
    process.env.SHADOWFAX_API_MODE = 'testing';
    delete process.env.SHADOWFAX_BASE_URL;
    expect(resolveShadowfaxBaseUrl('https://partner.example.com/')).toBe(
      'https://partner.example.com',
    );
  });
});

describe('resolveShadowfaxClientCode', () => {
  it('returns the trimmed value when set', () => {
    process.env.SHADOWFAX_CLIENT_CODE = '  gohomey_mkt  ';
    expect(resolveShadowfaxClientCode()).toBe('gohomey_mkt');
  });

  it('returns undefined when unset or blank', () => {
    delete process.env.SHADOWFAX_CLIENT_CODE;
    expect(resolveShadowfaxClientCode()).toBeUndefined();

    process.env.SHADOWFAX_CLIENT_CODE = '   ';
    expect(resolveShadowfaxClientCode()).toBeUndefined();
  });
});

describe('normalizeShadowfaxApiToken / formatShadowfaxAuthorization', () => {
  it('passes a bare token through unchanged', () => {
    expect(normalizeShadowfaxApiToken('abc123')).toBe('abc123');
  });

  it('strips an existing "Token "/"Bearer " prefix', () => {
    expect(normalizeShadowfaxApiToken('Token abc123')).toBe('abc123');
    expect(normalizeShadowfaxApiToken('Bearer abc123')).toBe('abc123');
  });

  it('treats empty/whitespace-only/bare-prefix-only input as no token', () => {
    expect(normalizeShadowfaxApiToken(undefined)).toBeUndefined();
    expect(normalizeShadowfaxApiToken('')).toBeUndefined();
    expect(normalizeShadowfaxApiToken('   ')).toBeUndefined();
    expect(normalizeShadowfaxApiToken('Token')).toBeUndefined();
  });

  it('formatShadowfaxAuthorization wraps a valid token as "Token <value>"', () => {
    expect(formatShadowfaxAuthorization('abc123')).toBe('Token abc123');
  });

  it('formatShadowfaxAuthorization throws on an empty token', () => {
    expect(() => formatShadowfaxAuthorization('')).toThrow('Shadowfax API token is empty');
  });
});

describe('shouldUseShadowfaxStagingCoordinates', () => {
  it('is true only in testing mode with the flag not explicitly disabled', () => {
    process.env.SHADOWFAX_API_MODE = 'testing';
    delete process.env.SHADOWFAX_USE_STAGING_SERVICEABLE_COORDS;
    expect(shouldUseShadowfaxStagingCoordinates()).toBe(true);
  });

  it('is false in testing mode when explicitly disabled', () => {
    process.env.SHADOWFAX_API_MODE = 'testing';
    process.env.SHADOWFAX_USE_STAGING_SERVICEABLE_COORDS = 'false';
    expect(shouldUseShadowfaxStagingCoordinates()).toBe(false);
  });

  it('is always false in production mode, regardless of the flag', () => {
    process.env.SHADOWFAX_API_MODE = 'production';
    process.env.SHADOWFAX_USE_STAGING_SERVICEABLE_COORDS = 'true';
    expect(shouldUseShadowfaxStagingCoordinates()).toBe(false);
  });
});

describe('ShadowfaxClient — request construction (mocked fetch, no real network calls)', () => {
  const baseUrl = 'https://example-shadowfax.test';
  const client = new ShadowfaxClient('test-token', baseUrl, 'test-client-code');

  it('createOrder POSTs to /api/v2/orders/ with a Token auth header and JSON body', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ is_order_created: true, flash_order_id: 'sfx-1' }),
    } as any);

    const payload = {
      pickup_details: { contact_number: '9876543210', address: 'A' },
      drop_details: { contact_number: '9876543211', address: 'B' },
      client_code: 'test-client-code',
      order_items: [{ name: 'Meal', price: 100, quantity: 1, id: 'item-1' }],
      order_details: {
        scheduled_time: new Date().toISOString(),
        order_value: 100,
        paid: 'true' as const,
        client_order_id: 'order-1',
      },
    };

    const result = await client.createOrder(payload);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${baseUrl}/api/v2/orders/`);
    expect((options as any).method).toBe('POST');
    expect((options as any).headers.Authorization).toBe('Token test-token');
    expect((options as any).headers['Content-Type']).toBe('application/json');
    expect(JSON.parse((options as any).body)).toEqual(payload);
    expect(result).toEqual({ is_order_created: true, flash_order_id: 'sfx-1' });
  });

  it('trackOrder GETs /order/track/:id/ with no request body', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ order_id: 'order-1', status: 'DELIVERED' }),
    } as any);

    await client.trackOrder('order-1');

    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${baseUrl}/order/track/order-1/`);
    expect((options as any).method).toBe('GET');
    expect((options as any).body).toBeUndefined();
  });

  it('throws with the response status and body when the API returns a non-ok response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Invalid token' }),
    } as any);

    await expect(client.trackOrder('order-1')).rejects.toMatchObject({
      status: 401,
      message: 'Invalid token',
    });
  });

  it('falls back to a generic message when the error body has neither message nor error', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as any);

    await expect(client.cancelOrder('order-1')).rejects.toMatchObject({
      status: 500,
      message: 'Shadowfax API error (500)',
    });
  });

  it('ShadowfaxClient.fromEnv builds a client using the current env resolution', async () => {
    process.env.SHADOWFAX_API_MODE = 'production';
    delete process.env.SHADOWFAX_BASE_URL;
    process.env.SHADOWFAX_CLIENT_CODE = 'env-client-code';

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ order_id: 'order-2', status: 'PENDING' }),
    } as any);

    const envClient = ShadowfaxClient.fromEnv('env-token');
    await envClient.trackOrder('order-2');

    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${SHADOWFAX_PRODUCTION_BASE_URL}/order/track/order-2/`);
    expect((options as any).headers.Authorization).toBe('Token env-token');
  });
});
