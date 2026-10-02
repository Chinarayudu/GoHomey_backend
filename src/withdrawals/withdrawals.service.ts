import { randomInt } from 'crypto';
import { Prisma, Role, WithdrawalStatus } from '@prisma/client';
import { prisma } from '../prisma/prisma.service';
import {
  accountLabel,
  canTransition,
  computeWallet,
  resolvePlatformFeeRupees,
  roundMoney,
} from './wallet';

export const MIN_WITHDRAWAL_RUPEES = 1000;
export const MAX_REQUESTS_PER_WINDOW = 2;
export const REQUEST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type Db = Prisma.TransactionClient | typeof prisma;

function httpError(message: string, status: number, code?: string) {
  const error: any = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}

const walletOrderInclude = {
  items: {
    select: {
      fuel_slot: { select: { plan: { select: { fixed_chef_payout: true } } } },
      fuel_subscription: {
        select: { plan: { select: { fixed_chef_payout: true } } },
      },
    },
  },
  delivery: { select: { status: true, delivered_time: true } },
  chef_payout: { select: { released_at: true } },
} satisfies Prisma.OrderInclude;

/** Chef-facing shape: no full account number, no internal fields. */
export function toChefWithdrawal(w: any) {
  return {
    id: w.id,
    reference: w.reference,
    amount: w.amount,
    status: w.status,
    account_label: w.account_label,
    created_at: w.created_at,
    reviewed_at: w.reviewed_at,
    paid_at: w.paid_at,
    utr: w.utr,
    rejection_reason: w.rejection_reason,
    rejection_details: w.rejection_details,
  };
}

function generateReference(now: Date = new Date()): string {
  // WD-<yMMdd>-<4 random digits>, e.g. WD-61002-4471 on 2026-10-02.
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const datePart =
    String(ist.getUTCFullYear() % 10) +
    String(ist.getUTCMonth() + 1).padStart(2, '0') +
    String(ist.getUTCDate()).padStart(2, '0');
  return `WD-${datePart}-${String(randomInt(0, 10000)).padStart(4, '0')}`;
}

export class WithdrawalsService {
  async getWallet(chefId: string, db: Db = prisma, now: Date = new Date()) {
    const [orders, withdrawals, adjustments] = await Promise.all([
      db.order.findMany({
        where: { chef_id: chefId },
        include: walletOrderInclude,
      }),
      db.withdrawal.findMany({
        where: { chef_id: chefId },
        select: {
          amount: true,
          status: true,
          created_at: true,
          reviewed_at: true,
        },
      }),
      db.walletAdjustment.findMany({
        where: { chef_id: chefId },
        select: { amount: true, created_at: true },
      }),
    ]);
    return computeWallet(
      orders as any,
      withdrawals,
      resolvePlatformFeeRupees(),
      now,
      adjustments,
    );
  }

  async listForChef(chefId: string) {
    const rows = await prisma.withdrawal.findMany({
      where: { chef_id: chefId },
      orderBy: { created_at: 'desc' },
    });
    return rows.map(toChefWithdrawal);
  }

  /**
   * Creates a PENDING withdrawal, holding the amount. Runs in a transaction
   * that first locks the chef row, so parallel requests from the same chef are
   * serialised and cannot overdraw. Returns { withdrawal, replayed }.
   */
  async create(chefId: string, rawAmount: unknown, idempotencyKey?: string) {
    const key = idempotencyKey?.trim() || null;
    if (key && key.length > 200) {
      throw httpError('Idempotency-Key is too long', 400);
    }

    return prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Chef" WHERE id = ${chefId} FOR UPDATE`;

        if (key) {
          const existing = await tx.withdrawal.findUnique({
            where: { chef_id_idempotency_key: { chef_id: chefId, idempotency_key: key } },
          });
          if (existing) return { withdrawal: existing, replayed: true };
        }

        const amount = Number(rawAmount);
        if (
          rawAmount === null ||
          rawAmount === undefined ||
          rawAmount === '' ||
          !Number.isFinite(amount) ||
          roundMoney(amount) !== amount
        ) {
          throw httpError('Please enter a valid amount.', 400);
        }
        if (amount < MIN_WITHDRAWAL_RUPEES) {
          throw httpError(
            `Minimum withdrawal amount is ₹${MIN_WITHDRAWAL_RUPEES.toLocaleString('en-IN')}.`,
            400,
          );
        }

        const chef = await tx.chef.findUnique({ where: { id: chefId } });
        if (!chef) throw httpError('Chef profile not found', 403);
        if (chef.application_status !== 'APPROVED') {
          throw httpError(
            'Your chef account must be approved before you can withdraw.',
            400,
          );
        }
        if (
          !chef.bank_account_number?.trim() ||
          !chef.ifsc_code?.trim() ||
          !chef.bank_holder_name?.trim()
        ) {
          throw httpError(
            'Please add your bank account number, IFSC and account holder name in your profile before withdrawing.',
            400,
          );
        }

        const open = await tx.withdrawal.findFirst({
          where: { chef_id: chefId, status: { in: ['PENDING', 'APPROVED'] } },
          select: { reference: true },
        });
        if (open) {
          throw httpError(
            `You already have a withdrawal in progress (${open.reference}). You can request another once it is paid or rejected.`,
            409,
            'WITHDRAWAL_IN_PROGRESS',
          );
        }

        const recent = await tx.withdrawal.count({
          where: {
            chef_id: chefId,
            status: { not: 'REJECTED' },
            created_at: { gte: new Date(Date.now() - REQUEST_WINDOW_MS) },
          },
        });
        if (recent >= MAX_REQUESTS_PER_WINDOW) {
          throw httpError(
            `You can make at most ${MAX_REQUESTS_PER_WINDOW} withdrawal requests in 7 days. Please try again later.`,
            400,
          );
        }

        const wallet = await this.getWallet(chefId, tx);
        if (amount > wallet.wallet_balance) {
          throw httpError(
            `Amount exceeds your available balance of ₹${wallet.wallet_balance.toLocaleString('en-IN')}.`,
            400,
          );
        }

        let reference = generateReference();
        for (let i = 0; i < 5; i++) {
          const taken = await tx.withdrawal.findUnique({
            where: { reference },
            select: { id: true },
          });
          if (!taken) break;
          reference = generateReference();
        }

        const accountNumber = chef.bank_account_number.trim();
        const withdrawal = await tx.withdrawal.create({
          data: {
            chef_id: chefId,
            reference,
            amount,
            status: 'PENDING',
            account_label: accountLabel(chef.bank_name, accountNumber),
            bank_holder_name: chef.bank_holder_name.trim(),
            bank_name: chef.bank_name,
            bank_account_number: accountNumber,
            ifsc_code: chef.ifsc_code.trim(),
            idempotency_key: key,
          },
        });
        await tx.withdrawalEvent.create({
          data: {
            withdrawal_id: withdrawal.id,
            from_status: null,
            to_status: 'PENDING',
            actor_role: Role.CHEF,
            actor_id: chefId,
          },
        });
        return { withdrawal, replayed: false };
      },
      { timeout: 15000 },
    );
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  private async adminRows(rows: any[]) {
    const chefIds = [...new Set(rows.map((r) => r.chef_id as string))];
    const [wallets, paidCounts] = await Promise.all([
      Promise.all(chefIds.map((id) => this.getWallet(id))),
      prisma.withdrawal.groupBy({
        by: ['chef_id'],
        where: { chef_id: { in: chefIds }, status: 'PAID' },
        _count: { _all: true },
      }),
    ]);
    const balanceByChef = new Map(
      chefIds.map((id, i) => [id, wallets[i].wallet_balance]),
    );
    const paidByChef = new Map(
      paidCounts.map((p) => [p.chef_id, p._count._all]),
    );

    return rows.map(({ chef, events, idempotency_key, ...w }) => ({
      ...w,
      chef: {
        id: chef.id,
        name: chef.name,
        phone: chef.phone,
        kitchen_name: chef.kitchen_name,
        wallet_balance: balanceByChef.get(chef.id) ?? 0,
        completed_withdrawals: paidByChef.get(chef.id) ?? 0,
      },
      ...(events ? { history: events } : {}),
    }));
  }

  async adminList(query: { status?: string; page?: string; limit?: string }) {
    const page = Math.max(parseInt(query.page || '1', 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit || '20', 10) || 20, 1), 100);
    const status = query.status?.toUpperCase();
    if (status && status !== 'ALL' && !(status in WithdrawalStatus)) {
      throw httpError(
        'status must be one of PENDING, APPROVED, PAID, REJECTED',
        400,
      );
    }
    const where: Prisma.WithdrawalWhereInput =
      status && status !== 'ALL' ? { status: status as WithdrawalStatus } : {};

    const [rows, total, grouped] = await Promise.all([
      prisma.withdrawal.findMany({
        where,
        include: { chef: true },
        // Oldest first for the review queue; newest first once handled.
        orderBy: {
          created_at: status === 'PENDING' || status === 'APPROVED' ? 'asc' : 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.withdrawal.count({ where }),
      prisma.withdrawal.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);

    const counts: Record<string, number> = {
      PENDING: 0,
      APPROVED: 0,
      PAID: 0,
      REJECTED: 0,
    };
    for (const g of grouped) counts[g.status] = g._count._all;

    return {
      items: await this.adminRows(rows),
      counts: { ...counts, ALL: Object.values(counts).reduce((a, b) => a + b, 0) },
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  async adminGet(id: string) {
    const row = await prisma.withdrawal.findUnique({
      where: { id },
      include: { chef: true, events: { orderBy: { created_at: 'asc' } } },
    });
    if (!row) throw httpError('Withdrawal not found', 404);
    const [result] = await this.adminRows([row]);
    return result;
  }

  async adminUpdateStatus(id: string, adminId: string, body: any) {
    const to = String(body?.status || '').toUpperCase();
    if (!['APPROVED', 'PAID', 'REJECTED'].includes(to)) {
      throw httpError('status must be one of APPROVED, PAID, REJECTED', 400);
    }
    const utr = typeof body?.utr === 'string' ? body.utr.trim() : '';
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    const details =
      typeof body?.details === 'string' && body.details.trim()
        ? body.details.trim()
        : null;
    if (to === 'PAID' && !utr) {
      throw httpError('utr is required to mark a withdrawal as PAID', 400);
    }
    if (to === 'REJECTED' && !reason) {
      throw httpError('reason is required to reject a withdrawal', 400);
    }

    await prisma.$transaction(async (tx) => {
      const current = await tx.withdrawal.findUnique({ where: { id } });
      if (!current) throw httpError('Withdrawal not found', 404);
      const target = to as WithdrawalStatus;
      if (!canTransition(current.status, target)) {
        throw httpError(
          `Cannot change a ${current.status} withdrawal to ${target}`,
          409,
          'INVALID_TRANSITION',
        );
      }

      const now = new Date();
      const data: Prisma.WithdrawalUpdateManyMutationInput = {
        status: target,
        reviewed_at: now,
        reviewed_by: adminId,
      };
      if (target === 'PAID') {
        data.paid_at = now;
        data.utr = utr;
      }
      if (target === 'REJECTED') {
        data.rejection_reason = reason;
        data.rejection_details = details;
      }

      // Guarded on the status we read, so two admins acting at once can't both win.
      const { count } = await tx.withdrawal.updateMany({
        where: { id, status: current.status },
        data,
      });
      if (count === 0) {
        throw httpError(
          'This withdrawal was updated by someone else. Refresh and try again.',
          409,
          'INVALID_TRANSITION',
        );
      }
      await tx.withdrawalEvent.create({
        data: {
          withdrawal_id: id,
          from_status: current.status,
          to_status: target,
          actor_role: Role.ADMIN,
          actor_id: adminId,
          note:
            target === 'PAID'
              ? `UTR ${utr}`
              : target === 'REJECTED'
                ? [reason, details].filter(Boolean).join(' — ')
                : null,
        },
      });
    });

    return this.adminGet(id);
  }
}

export const withdrawalsService = new WithdrawalsService();
