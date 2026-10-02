jest.mock('../prisma/prisma.service', () => {
  const tx = {
    $queryRaw: jest.fn(),
    chef: { findUnique: jest.fn() },
    order: { findMany: jest.fn() },
    withdrawal: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      groupBy: jest.fn(),
    },
    withdrawalEvent: { create: jest.fn() },
  };
  return {
    prisma: { ...tx, $transaction: jest.fn((fn: any) => fn(tx)) },
  };
});

import { prisma } from '../prisma/prisma.service';
import { withdrawalsService, toChefWithdrawal } from './withdrawals.service';

const db = prisma as any;

const approvedChef = {
  id: 'chef-1',
  name: 'Lakshmi',
  phone: '+919800000001',
  kitchen_name: 'Lakshmi Kitchen',
  application_status: 'APPROVED',
  bank_name: 'Canara Bank',
  bank_account_number: '110023459807',
  ifsc_code: 'CNRB0001234',
  bank_holder_name: 'Lakshmi Devi',
};

// 5000 available: one delivered ₹5,020 daily-meal order minus the ₹20 fee.
const deliveredOrders = [
  {
    id: 'o1',
    order_type: 'DAILY_MEAL',
    status: 'DELIVERED',
    total_price: 5020,
    updated_at: new Date('2026-09-01T00:00:00Z'),
    items: [],
    delivery: null,
    chef_payout: null,
  },
];

function happyPath() {
  db.withdrawal.findUnique.mockResolvedValue(null);
  db.chef.findUnique.mockResolvedValue(approvedChef);
  db.withdrawal.findFirst.mockResolvedValue(null);
  db.withdrawal.count.mockResolvedValue(0);
  db.order.findMany.mockResolvedValue(deliveredOrders);
  db.withdrawal.findMany.mockResolvedValue([]);
  db.withdrawal.create.mockImplementation(({ data }: any) =>
    Promise.resolve({
      id: 'wd-1',
      created_at: new Date(),
      reviewed_at: null,
      paid_at: null,
      utr: null,
      rejection_reason: null,
      rejection_details: null,
      ...data,
    }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.HOMEY_PLATFORM_FEE_RUPEES;
  happyPath();
});

describe('WithdrawalsService.create', () => {
  it('creates a PENDING withdrawal with a bank snapshot, under a row lock, and logs it', async () => {
    const { withdrawal, replayed } = await withdrawalsService.create('chef-1', 2000, 'key-1');

    expect(replayed).toBe(false);
    expect(db.$transaction).toHaveBeenCalled();
    expect(db.$queryRaw).toHaveBeenCalled(); // SELECT ... FOR UPDATE
    expect(db.withdrawal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        chef_id: 'chef-1',
        amount: 2000,
        status: 'PENDING',
        account_label: 'Canara Bank •••• 9807',
        bank_holder_name: 'Lakshmi Devi',
        bank_account_number: '110023459807',
        ifsc_code: 'CNRB0001234',
        idempotency_key: 'key-1',
        reference: expect.stringMatching(/^WD-\d{5}-\d{4}$/),
      }),
    });
    expect(db.withdrawalEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ from_status: null, to_status: 'PENDING', actor_role: 'CHEF' }),
    });

    const shaped = toChefWithdrawal(withdrawal);
    expect(Object.keys(shaped).sort()).toEqual(
      [
        'id', 'reference', 'amount', 'status', 'account_label', 'created_at',
        'reviewed_at', 'paid_at', 'utr', 'rejection_reason', 'rejection_details',
      ].sort(),
    );
  });

  it('returns the original withdrawal for a repeated Idempotency-Key', async () => {
    const original = { id: 'wd-original', status: 'PENDING', amount: 2000 };
    db.withdrawal.findUnique.mockResolvedValueOnce(original);

    const result = await withdrawalsService.create('chef-1', 2000, 'key-1');

    expect(result).toEqual({ withdrawal: original, replayed: true });
    expect(db.withdrawal.findUnique).toHaveBeenCalledWith({
      where: { chef_id_idempotency_key: { chef_id: 'chef-1', idempotency_key: 'key-1' } },
    });
    expect(db.withdrawal.create).not.toHaveBeenCalled();
  });

  it.each([
    [999, 'Minimum withdrawal amount is ₹1,000.'],
    [0, 'Minimum withdrawal amount is ₹1,000.'],
    ['abc', 'Please enter a valid amount.'],
    [undefined, 'Please enter a valid amount.'],
    [1000.555, 'Please enter a valid amount.'],
  ])('rejects amount %p with 400', async (amount, message) => {
    await expect(withdrawalsService.create('chef-1', amount)).rejects.toMatchObject({
      status: 400,
      message,
    });
    expect(db.withdrawal.create).not.toHaveBeenCalled();
  });

  it('accepts exactly the ₹1,000 minimum', async () => {
    await expect(withdrawalsService.create('chef-1', 1000)).resolves.toMatchObject({ replayed: false });
  });

  it('rejects an amount above wallet_balance with 400', async () => {
    await expect(withdrawalsService.create('chef-1', 5001)).rejects.toMatchObject({
      status: 400,
      message: 'Amount exceeds your available balance of ₹5,000.',
    });
  });

  it('counts existing held withdrawals against the balance', async () => {
    db.withdrawal.findMany.mockResolvedValue([
      { amount: 2000, status: 'PAID', created_at: new Date('2026-09-02T00:00:00Z'), reviewed_at: null },
    ]);
    await expect(withdrawalsService.create('chef-1', 3001)).rejects.toMatchObject({ status: 400 });
    await expect(withdrawalsService.create('chef-1', 3000)).resolves.toMatchObject({ replayed: false });
  });

  it('returns 409 when a PENDING or APPROVED request is already open', async () => {
    db.withdrawal.findFirst.mockResolvedValue({ reference: 'WD-61001-1234' });
    await expect(withdrawalsService.create('chef-1', 2000)).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('WD-61001-1234'),
    });
    expect(db.withdrawal.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { chef_id: 'chef-1', status: { in: ['PENDING', 'APPROVED'] } },
      }),
    );
  });

  it('allows at most 2 non-rejected requests in a rolling 7 days', async () => {
    db.withdrawal.count.mockResolvedValue(2);
    await expect(withdrawalsService.create('chef-1', 2000)).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('at most 2 withdrawal requests in 7 days'),
    });

    const where = db.withdrawal.count.mock.calls[0][0].where;
    expect(where.status).toEqual({ not: 'REJECTED' });
    const windowMs = Date.now() - where.created_at.gte.getTime();
    expect(Math.abs(windowMs - 7 * 24 * 60 * 60 * 1000)).toBeLessThan(5000);

    db.withdrawal.count.mockResolvedValue(1);
    await expect(withdrawalsService.create('chef-1', 2000)).resolves.toMatchObject({ replayed: false });
  });

  it('requires an APPROVED chef', async () => {
    db.chef.findUnique.mockResolvedValue({ ...approvedChef, application_status: 'PENDING_REVIEW' });
    await expect(withdrawalsService.create('chef-1', 2000)).rejects.toMatchObject({ status: 400 });
  });

  it.each(['bank_account_number', 'ifsc_code', 'bank_holder_name'])(
    'requires %s on file',
    async (field) => {
      db.chef.findUnique.mockResolvedValue({ ...approvedChef, [field]: null });
      await expect(withdrawalsService.create('chef-1', 2000)).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining('bank'),
      });
    },
  );
});

describe('WithdrawalsService.adminUpdateStatus', () => {
  const pending = { id: 'wd-1', chef_id: 'chef-1', status: 'PENDING' };

  beforeEach(() => {
    db.withdrawal.findUnique.mockImplementation(({ include }: any) =>
      Promise.resolve(
        include
          ? { ...pending, chef: approvedChef, events: [], idempotency_key: 'k' }
          : pending,
      ),
    );
    db.withdrawal.updateMany.mockResolvedValue({ count: 1 });
    db.withdrawal.groupBy.mockResolvedValue([]);
  });

  it('approves a PENDING withdrawal and records the audit row', async () => {
    await withdrawalsService.adminUpdateStatus('wd-1', 'admin-1', { status: 'APPROVED' });
    expect(db.withdrawal.updateMany).toHaveBeenCalledWith({
      where: { id: 'wd-1', status: 'PENDING' },
      data: expect.objectContaining({ status: 'APPROVED', reviewed_by: 'admin-1' }),
    });
    expect(db.withdrawalEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        from_status: 'PENDING',
        to_status: 'APPROVED',
        actor_role: 'ADMIN',
        actor_id: 'admin-1',
      }),
    });
  });

  it('marks APPROVED as PAID with the UTR', async () => {
    pending.status = 'APPROVED';
    await withdrawalsService.adminUpdateStatus('wd-1', 'admin-1', { status: 'PAID', utr: ' UTR123 ' });
    expect(db.withdrawal.updateMany.mock.calls[0][0].data).toMatchObject({
      status: 'PAID',
      utr: 'UTR123',
      paid_at: expect.any(Date),
    });
    pending.status = 'PENDING';
  });

  it('rejects with reason and details', async () => {
    await withdrawalsService.adminUpdateStatus('wd-1', 'admin-1', {
      status: 'REJECTED',
      reason: 'Payout name mismatch',
      details: 'Bank account name must match your verified KYC name.',
    });
    expect(db.withdrawal.updateMany.mock.calls[0][0].data).toMatchObject({
      status: 'REJECTED',
      rejection_reason: 'Payout name mismatch',
      rejection_details: 'Bank account name must match your verified KYC name.',
    });
  });

  it('requires utr for PAID and reason for REJECTED (400)', async () => {
    await expect(
      withdrawalsService.adminUpdateStatus('wd-1', 'admin-1', { status: 'PAID' }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      withdrawalsService.adminUpdateStatus('wd-1', 'admin-1', { status: 'REJECTED' }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      withdrawalsService.adminUpdateStatus('wd-1', 'admin-1', { status: 'PENDING' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it.each([
    ['PENDING', { status: 'PAID', utr: 'U1' }],
    ['PAID', { status: 'REJECTED', reason: 'x' }],
    ['PAID', { status: 'APPROVED' }],
    ['REJECTED', { status: 'APPROVED' }],
    ['APPROVED', { status: 'APPROVED' }],
  ])('returns 409 for %s → %p', async (from, body) => {
    pending.status = from;
    await expect(
      withdrawalsService.adminUpdateStatus('wd-1', 'admin-1', body),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.withdrawal.updateMany).not.toHaveBeenCalled();
    pending.status = 'PENDING';
  });

  it('returns 409 when another admin changed it first', async () => {
    db.withdrawal.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      withdrawalsService.adminUpdateStatus('wd-1', 'admin-1', { status: 'APPROVED' }),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.withdrawalEvent.create).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown withdrawal', async () => {
    db.withdrawal.findUnique.mockResolvedValue(null);
    await expect(
      withdrawalsService.adminUpdateStatus('nope', 'admin-1', { status: 'APPROVED' }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
