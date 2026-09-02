/**
 * Bank detail verification.
 *
 * IFSC codes are validated against Razorpay's public IFSC directory
 * (https://ifsc.razorpay.com). That endpoint is free, needs no API key and no
 * account/registration, and returns the bank + branch for a valid code or a
 * plain 404 for an unknown one.
 *
 * Full bank-account verification (penny-drop: confirming the account number
 * exists and the holder name matches) has no free / no-registration provider —
 * every option (RazorpayX, Cashfree, Setu, …) requires KYC onboarding — so it is
 * intentionally not implemented here. Account numbers are only format-checked.
 */

export interface IfscDetails {
  ifsc: string;
  bank: string;
  branch: string;
  bank_code?: string;
  address?: string;
  city?: string;
  state?: string;
}

const IFSC_API_BASE = 'https://ifsc.razorpay.com';

/**
 * Looks an IFSC code up in Razorpay's public directory.
 *
 * @returns branch details when the code exists, `null` when Razorpay reports it
 *   unknown (HTTP 404). Throws (with `status: 502`) only on transport / 5xx
 *   errors so callers can choose to fail open when the directory is unreachable.
 */
export async function lookupIfsc(ifsc: string): Promise<IfscDetails | null> {
  const code = ifsc.trim().toUpperCase();

  const response = await fetch(`${IFSC_API_BASE}/${encodeURIComponent(code)}`, {
    headers: { Accept: 'application/json' },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const err: any = new Error(`IFSC directory lookup failed (${response.status})`);
    err.status = 502;
    throw err;
  }

  const data = (await response.json()) as Record<string, string>;

  return {
    ifsc: data.IFSC ?? code,
    bank: data.BANK,
    branch: data.BRANCH,
    bank_code: data.BANKCODE,
    address: data.ADDRESS,
    city: data.CITY,
    state: data.STATE,
  };
}
