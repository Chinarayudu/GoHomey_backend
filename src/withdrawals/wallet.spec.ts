import {
  accountLabel,
  canTransition,
  computeWallet,
  orderEarning,
  resolvePlatformFeeRupees,
  startOfIstMonth,
  WalletOrder,
  WalletWithdrawal,
} from './wallet';

const NOW = new Date('2026-10-15T06:00:00Z');
const t = (iso: string) => new Date(iso);

function order(p: Partial<WalletOrder> & { total_price: number }): WalletOrder {
  return {
    id: Math.random().toString(36),
    order_type: 'DAILY_MEAL',
    status: 'DELIVERED',
    updated_at: t('2026-10-05T10:00:00Z'),
    items: [],
    delivery: null,
    chef_payout: null,
    ...p,
  };
}

function wd(p: Partial<WalletWithdrawal> & { amount: number }): WalletWithdrawal {
  return {
    status: 'PENDING',
    created_at: t('2026-10-06T10:00:00Z'),
    reviewed_at: null,
    ...p,
  };
}

describe('orderEarning', () => {
  it.each(['DAILY_MEAL', 'PANTRY_ITEM', 'SOCIAL_EVENT'] as const)(
    '%s earns price minus the flat fee',
    (order_type) => {
      expect(orderEarning(order({ order_type, total_price: 250 }), 20)).toBe(230);
    },
  );

  it('never goes below 0 when price is under the fee', () => {
    expect(orderEarning(order({ total_price: 15 }), 20)).toBe(0);
  });

  it('Fuel plan earns fixed_chef_payout, not price minus fee', () => {
    const o = order({
      order_type: 'FUEL_PLAN',
      total_price: 6000,
      items: [{ fuel_slot: { plan: { fixed_chef_payout: 4500 } } }],
    });
    expect(orderEarning(o, 20)).toBe(4500);
  });

  it('Fuel plan reads the payout through the subscription when there is no slot', () => {
    const o = order({
      order_type: 'FUEL_PLAN',
      total_price: 6000,
      items: [{ fuel_slot: null, fuel_subscription: { plan: { fixed_chef_payout: 4000 } } }],
    });
    expect(orderEarning(o, 20)).toBe(4000);
  });

  it('Fuel plan without a fixed payout falls back to price minus fee', () => {
    const o = order({
      order_type: 'FUEL_PLAN',
      total_price: 6000,
      items: [{ fuel_slot: { plan: { fixed_chef_payout: null } } }],
    });
    expect(orderEarning(o, 20)).toBe(5980);
  });
});

describe('resolvePlatformFeeRupees', () => {
  const original = process.env.HOMEY_PLATFORM_FEE_RUPEES;
  afterEach(() => {
    process.env.HOMEY_PLATFORM_FEE_RUPEES = original;
  });

  it('reads the fee from config', () => {
    process.env.HOMEY_PLATFORM_FEE_RUPEES = '35';
    expect(resolvePlatformFeeRupees()).toBe(35);
  });

  it('defaults to 20 when unset or invalid', () => {
    delete process.env.HOMEY_PLATFORM_FEE_RUPEES;
    expect(resolvePlatformFeeRupees()).toBe(20);
    process.env.HOMEY_PLATFORM_FEE_RUPEES = '-5';
    expect(resolvePlatformFeeRupees()).toBe(20);
  });
});

describe('computeWallet', () => {
  it('splits delivered (available) from active (pending); cancelled/refunded earn nothing', () => {
    const w = computeWallet(
      [
        order({ total_price: 520 }), // 500 available
        order({ status: 'PREPARING', total_price: 320 }), // 300 pending
        order({ status: 'OUT_FOR_DELIVERY', total_price: 120 }), // 100 pending
        order({ status: 'CANCELLED', total_price: 1000 }),
        order({ status: 'REFUNDED', total_price: 1000 }),
      ],
      [],
      20,
      NOW,
    );
    expect(w).toEqual({
      wallet_balance: 500,
      pending_balance: 400,
      month_earnings: 500,
      platform_fee_flat: 20,
    });
  });

  it('holds PENDING, APPROVED and PAID withdrawals; REJECTED releases the hold', () => {
    const orders = [order({ total_price: 5020 })]; // 5000
    const base = computeWallet(orders, [], 20, NOW).wallet_balance;
    expect(base).toBe(5000);

    for (const status of ['PENDING', 'APPROVED', 'PAID'] as const) {
      expect(computeWallet(orders, [wd({ amount: 2000, status })], 20, NOW).wallet_balance).toBe(3000);
    }
    expect(
      computeWallet(
        orders,
        [wd({ amount: 2000, status: 'REJECTED', reviewed_at: t('2026-10-07T00:00:00Z') })],
        20,
        NOW,
      ).wallet_balance,
    ).toBe(5000);
  });

  it('no clawback: a refund after withdrawal never takes the balance negative', () => {
    const delivered = order({
      total_price: 3020, // 3000
      chef_payout: { released_at: t('2026-10-02T10:00:00Z') },
    });
    const refundedLater = { ...delivered, status: 'REFUNDED' as const, updated_at: t('2026-10-08T00:00:00Z') };

    const w = computeWallet(
      [refundedLater],
      [wd({ amount: 3000, status: 'PAID', created_at: t('2026-10-03T00:00:00Z') })],
      20,
      NOW,
    );
    expect(w.wallet_balance).toBe(0);
  });

  it('no clawback: later earnings are not used to cover an already-withdrawn refund', () => {
    const refunded = order({
      status: 'REFUNDED',
      total_price: 3020, // 3000, delivered on the 2nd, refunded on the 8th
      chef_payout: { released_at: t('2026-10-02T10:00:00Z') },
      updated_at: t('2026-10-08T00:00:00Z'),
    });
    const laterOrder = order({
      total_price: 1020, // 1000, delivered on the 10th
      delivery: { status: 'DELIVERED', delivered_time: t('2026-10-10T00:00:00Z') },
    });
    const w = computeWallet(
      [refunded, laterOrder],
      [wd({ amount: 3000, status: 'PAID', created_at: t('2026-10-03T00:00:00Z') })],
      20,
      NOW,
    );
    expect(w.wallet_balance).toBe(1000);
  });

  it('a refund only removes earnings not yet withdrawn', () => {
    const refunded = order({
      status: 'REFUNDED',
      total_price: 1020, // 1000
      chef_payout: { released_at: t('2026-10-02T10:00:00Z') },
      updated_at: t('2026-10-08T00:00:00Z'),
    });
    const other = order({
      total_price: 2520, // 2500
      delivery: { status: 'DELIVERED', delivered_time: t('2026-10-01T00:00:00Z') },
    });
    // 3500 earned, 3000 withdrawn → 500 left; refund of 1000 can only take that 500.
    const w = computeWallet(
      [refunded, other],
      [wd({ amount: 3000, status: 'PAID', created_at: t('2026-10-03T00:00:00Z') })],
      20,
      NOW,
    );
    expect(w.wallet_balance).toBe(0);
  });

  it('month_earnings counts only delivered earnings in the current IST month', () => {
    const w = computeWallet(
      [
        order({ total_price: 120, delivery: { status: 'DELIVERED', delivered_time: t('2026-10-01T00:00:00Z') } }), // Oct 1 05:30 IST
        order({ total_price: 220, delivery: { status: 'DELIVERED', delivered_time: t('2026-09-30T17:00:00Z') } }), // Sep 30 22:30 IST
        order({ total_price: 320, delivery: { status: 'DELIVERED', delivered_time: t('2026-09-30T19:00:00Z') } }), // Oct 1 00:30 IST
      ],
      [],
      20,
      NOW,
    );
    expect(w.month_earnings).toBe(100 + 300);
    expect(w.wallet_balance).toBe(100 + 200 + 300);
  });
});

describe('startOfIstMonth', () => {
  it('is midnight IST on the 1st, expressed in UTC', () => {
    expect(startOfIstMonth(NOW).toISOString()).toBe('2026-09-30T18:30:00.000Z');
  });
});

describe('canTransition', () => {
  it('allows only PENDING→APPROVED→PAID and PENDING/APPROVED→REJECTED', () => {
    expect(canTransition('PENDING', 'APPROVED')).toBe(true);
    expect(canTransition('APPROVED', 'PAID')).toBe(true);
    expect(canTransition('PENDING', 'REJECTED')).toBe(true);
    expect(canTransition('APPROVED', 'REJECTED')).toBe(true);

    expect(canTransition('PENDING', 'PAID')).toBe(false);
    expect(canTransition('APPROVED', 'APPROVED')).toBe(false);
    expect(canTransition('PAID', 'REJECTED')).toBe(false);
    expect(canTransition('REJECTED', 'APPROVED')).toBe(false);
    expect(canTransition('PAID', 'PENDING')).toBe(false);
  });
});

describe('accountLabel', () => {
  it('masks all but the last 4 digits', () => {
    expect(accountLabel('Canara Bank', '110023459807')).toBe('Canara Bank •••• 9807');
    expect(accountLabel(null, '110023459807')).toBe('Bank •••• 9807');
  });
});
