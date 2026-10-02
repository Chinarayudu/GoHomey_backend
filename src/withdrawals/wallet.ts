import { OrderStatus, OrderType, WithdrawalStatus } from '@prisma/client';

/**
 * Chef wallet maths. Everything here is pure so it can be unit-tested without a
 * database; withdrawals.service.ts loads the rows and feeds them in.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
];

/** Statuses whose amount is held out of (or paid out of) the wallet. */
export const HELD_WITHDRAWAL_STATUSES: WithdrawalStatus[] = [
  'PENDING',
  'APPROVED',
  'PAID',
];

/** Flat platform fee in rupees, read from HOMEY_PLATFORM_FEE_RUPEES (default 20). */
export function resolvePlatformFeeRupees(): number {
  const configured = process.env.HOMEY_PLATFORM_FEE_RUPEES?.trim() || '20';
  const fee = Number(configured);
  return Number.isFinite(fee) && fee >= 0 ? fee : 20;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export type WalletOrder = {
  id: string;
  order_type: OrderType;
  status: OrderStatus;
  total_price: number;
  updated_at: Date;
  items: Array<{
    fuel_slot?: { plan?: { fixed_chef_payout: number | null } | null } | null;
    fuel_subscription?: {
      plan?: { fixed_chef_payout: number | null } | null;
    } | null;
  }>;
  delivery?: { status: string; delivered_time: Date | null } | null;
  chef_payout?: { released_at: Date } | null;
};

export type WalletWithdrawal = {
  amount: number;
  status: WithdrawalStatus;
  created_at: Date;
  reviewed_at: Date | null;
};

/**
 * What the chef earns for one order.
 * - Fuel plans: the plan's fixed_chef_payout (summed over fuel items). If no
 *   plan on the order has a payout set, falls back to the flat-fee rule.
 * - Everything else: order price − flat platform fee, never below 0.
 */
export function orderEarning(order: WalletOrder, platformFee: number): number {
  if (order.order_type === 'FUEL_PLAN') {
    const payouts = order.items
      .map(
        (item) =>
          item.fuel_slot?.plan?.fixed_chef_payout ??
          item.fuel_subscription?.plan?.fixed_chef_payout,
      )
      .filter((v): v is number => typeof v === 'number');
    if (payouts.length > 0) {
      return roundMoney(Math.max(payouts.reduce((a, b) => a + b, 0), 0));
    }
  }
  return roundMoney(Math.max(Number(order.total_price || 0) - platformFee, 0));
}

/** True when the order reached DELIVERED at some point, even if it is no longer. */
function wasDelivered(order: WalletOrder): boolean {
  return (
    order.status === 'DELIVERED' ||
    Boolean(order.chef_payout) ||
    Boolean(order.delivery?.delivered_time) ||
    order.delivery?.status === 'DELIVERED'
  );
}

function deliveredAt(order: WalletOrder): Date {
  return (
    order.delivery?.delivered_time ??
    order.chef_payout?.released_at ??
    order.updated_at
  );
}

/** Start of the current calendar month in IST, as a UTC instant. */
export function startOfIstMonth(now: Date = new Date()): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - IST_OFFSET_MS,
  );
}

export type WalletSummary = {
  wallet_balance: number;
  pending_balance: number;
  month_earnings: number;
  platform_fee_flat: number;
};

/**
 * Replays the chef's money events in time order:
 *   + earning when an order is delivered
 *   − amount when a withdrawal is requested (held)
 *   + amount when that withdrawal is rejected (released)
 *   − earning when a delivered order is later cancelled/refunded, but only up
 *     to the balance not yet withdrawn (no clawback: the balance never goes
 *     negative and withdrawn money is never taken back).
 *
 * With no refunds-after-delivery this equals
 *   delivered earnings − (PENDING + APPROVED + PAID withdrawals).
 */
export function computeWallet(
  orders: WalletOrder[],
  withdrawals: WalletWithdrawal[],
  platformFee: number,
  now: Date = new Date(),
): WalletSummary {
  type Event = { at: number; delta: number; clamp: boolean };
  const events: Event[] = [];
  let pending = 0;
  let month = 0;
  const monthStart = startOfIstMonth(now).getTime();

  for (const order of orders) {
    const earning = orderEarning(order, platformFee);

    if (ACTIVE_ORDER_STATUSES.includes(order.status)) {
      pending += earning;
      continue;
    }
    if (!wasDelivered(order)) continue; // cancelled/refunded before delivery: nothing

    const at = deliveredAt(order).getTime();
    events.push({ at, delta: earning, clamp: false });

    if (order.status === 'DELIVERED') {
      if (at >= monthStart) month += earning;
    } else if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
      // Reversed after delivery. updated_at is when it moved to its final status.
      const reversedAt = Math.max(order.updated_at.getTime(), at);
      events.push({ at: reversedAt, delta: -earning, clamp: true });
    }
  }

  for (const w of withdrawals) {
    events.push({ at: w.created_at.getTime(), delta: -w.amount, clamp: false });
    if (w.status === 'REJECTED') {
      const releasedAt = (w.reviewed_at ?? w.created_at).getTime();
      events.push({ at: releasedAt, delta: w.amount, clamp: false });
    }
  }

  // Credits before debits at the same instant, so ordering ties never strand money.
  events.sort((a, b) => a.at - b.at || b.delta - a.delta);

  let balance = 0;
  for (const e of events) {
    balance += e.delta;
    if (e.clamp && balance < 0) balance = 0;
  }

  return {
    wallet_balance: roundMoney(Math.max(balance, 0)),
    pending_balance: roundMoney(pending),
    month_earnings: roundMoney(month),
    platform_fee_flat: platformFee,
  };
}

/** "Canara Bank •••• 9807" */
export function accountLabel(
  bankName: string | null | undefined,
  accountNumber: string,
): string {
  const last4 = accountNumber.slice(-4);
  return `${bankName?.trim() || 'Bank'} •••• ${last4}`;
}

/**
 * Allowed admin transitions. Anything else is a 409.
 * PENDING → APPROVED → PAID, and PENDING/APPROVED → REJECTED.
 */
export const ALLOWED_TRANSITIONS: Record<WithdrawalStatus, WithdrawalStatus[]> =
  {
    PENDING: ['APPROVED', 'REJECTED'],
    APPROVED: ['PAID', 'REJECTED'],
    PAID: [],
    REJECTED: [],
  };

export function canTransition(
  from: WithdrawalStatus,
  to: WithdrawalStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
