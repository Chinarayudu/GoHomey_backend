import 'dotenv/config';
import { prisma, disconnectPrisma } from '../src/prisma/prisma.service';

async function main() {
  const deliveredOrders = await prisma.order.findMany({
    where: { status: 'DELIVERED' },
    orderBy: { updated_at: 'desc' },
    take: 10,
    include: {
      payment: { select: { status: true, escrow_status: true, amount: true } },
      chef_payout: { select: { id: true, status: true, amount: true, paid_at: true } },
    },
  });

  console.log('DELIVERED orders (latest 10):', deliveredOrders.length);
  for (const o of deliveredOrders) {
    console.log(JSON.stringify({
      order_id: o.id,
      status: o.status,
      total_price: o.total_price,
      payment_status: o.payment?.status ?? 'NO PAYMENT',
      escrow_status: o.payment?.escrow_status ?? '-',
      chef_payout: o.chef_payout
        ? { status: o.chef_payout.status, amount: o.chef_payout.amount }
        : 'NONE (no payout row created)',
    }));
  }

  const payoutCounts = await prisma.chefPayout.groupBy({
    by: ['status'],
    _count: { _all: true },
  });
  console.log('\nChefPayout rows by status:', JSON.stringify(payoutCounts));
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => disconnectPrisma());
