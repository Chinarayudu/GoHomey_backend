import { lookupIfsc } from './bank.service';

/**
 * Unit tests for the IFSC directory lookup. `fetch` is mocked throughout — no
 * real network calls are made against the public IFSC API.
 */

afterEach(() => {
  jest.restoreAllMocks();
});

describe('lookupIfsc', () => {
  it('returns branch details for a known IFSC', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        IFSC: 'HDFC0001234',
        BANK: 'HDFC Bank',
        BRANCH: 'Koramangala',
        BANKCODE: 'HDFC',
        CITY: 'BANGALORE',
        STATE: 'KARNATAKA',
        ADDRESS: '80 Feet Road, Koramangala',
      }),
    } as any);

    const result = await lookupIfsc('hdfc0001234');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://ifsc.razorpay.com/HDFC0001234',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
    expect(result).toMatchObject({
      ifsc: 'HDFC0001234',
      bank: 'HDFC Bank',
      branch: 'Koramangala',
    });
  });

  it('returns null when the directory reports the code unknown (404)', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => 'Not Found',
    } as any);

    await expect(lookupIfsc('AAAA0000000')).resolves.toBeNull();
  });

  it('throws (502) on a transient directory failure so callers can fail open', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as any);

    await expect(lookupIfsc('HDFC0001234')).rejects.toMatchObject({
      status: 502,
    });
  });
});
