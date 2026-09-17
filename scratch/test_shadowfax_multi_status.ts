import 'dotenv/config';
import { prisma } from '../src/prisma/prisma.service';
import { deliveryService } from '../src/delivery/delivery.service';
import {
  resolveShadowfaxApiMode,
  resolveShadowfaxBaseUrl,
} from '../src/delivery/shadowfax.client';

// Walks a single Shadowfax staging delivery through the full sandbox status
// sequence (ALLOT -> ARRIVE_AT_STORE -> COLLECT -> CUSTOMER_DOORSTEP -> DELIVER)
// and prints Delivery.status / Order.status after each step, so you can see
// the multi-status progression the app will show a customer.
//
// Each sandbox action only triggers Shadowfax to *send us a callback*
// (POST /api/v1/webhooks/shadowfax); our DB only updates once that callback
// lands. That means the dev server must be running AND reachable from
// Shadowfax (e.g. via the loca.lt tunnel registered in SHADOWFAX_STAGING_GUIDE.md)
// for the status columns below to actually change between steps.
//
// Usage: npx ts-node scratch/test_shadowfax_multi_status.ts [deliveryId]
// If deliveryId is omitted, the script dispatches the first READY_FOR_PICKUP
// order to Shadowfax and uses the resulting delivery.

const ACTIONS = [
  'ALLOT',
  'ARRIVE_AT_STORE',
  'COLLECT',
  'CUSTOMER_DOORSTEP',
  'DELIVER',
] as const;

const POLL_ATTEMPTS = 6;
const POLL_INTERVAL_MS = 2000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getStatuses(deliveryId: string) {
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: { order: { select: { id: true, status: true } } },
  });
  return {
    deliveryStatus: delivery?.status ?? null,
    orderStatus: delivery?.order?.status ?? null,
  };
}

async function waitForStatusChange(
  deliveryId: string,
  previousDeliveryStatus: string | null,
) {
  for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt++) {
    const { deliveryStatus, orderStatus } = await getStatuses(deliveryId);
    if (deliveryStatus !== previousDeliveryStatus) {
      return { deliveryStatus, orderStatus, changed: true };
    }
    await sleep(POLL_INTERVAL_MS);
  }
  return await getStatuses(deliveryId).then((s) => ({ ...s, changed: false }));
}

async function main() {
  const mode = resolveShadowfaxApiMode();
  console.log('SHADOWFAX_API_MODE:', mode);
  console.log('SHADOWFAX_BASE_URL:', resolveShadowfaxBaseUrl());

  if (mode !== 'testing') {
    console.error(
      '\nRefusing to run: SHADOWFAX_API_MODE must be "testing" for sandbox ' +
        'status updates (the server itself also enforces this). Currently: ' +
        mode +
        '. This guards against accidentally poking the production Shadowfax API.',
    );
    process.exit(1);
  }

  let deliveryId = process.argv[2];

  if (!deliveryId) {
    console.log('\nNo deliveryId passed — dispatching a READY_FOR_PICKUP order to Shadowfax staging...');
    const ready = await prisma.order.findMany({
      where: { status: 'READY_FOR_PICKUP' },
      select: { id: true },
      take: 1,
    });
    if (!ready.length) {
      console.error('No READY_FOR_PICKUP orders found. Pass an existing deliveryId instead.');
      process.exit(1);
    }
    const dispatchResult: any = await deliveryService.dispatchReadyForPickupToShadowfax([
      ready[0].id,
    ]);
    console.log('Dispatch result:', JSON.stringify(dispatchResult, null, 2));
    const dispatched = await prisma.delivery.findFirst({
      where: { order_id: ready[0].id },
      select: { id: true },
    });
    if (!dispatched) {
      console.error('Dispatch did not produce a Delivery record — aborting.');
      process.exit(1);
    }
    deliveryId = dispatched.id;
  }

  console.log('\nUsing deliveryId:', deliveryId);
  const initial = await getStatuses(deliveryId);
  console.log('Initial status -> delivery:', initial.deliveryStatus, '| order:', initial.orderStatus);

  for (const action of ACTIONS) {
    console.log(`\n--- Triggering sandbox action: ${action} ---`);
    const before = await getStatuses(deliveryId);
    try {
      const result = await deliveryService.updateShadowfaxSandboxStatus(
        deliveryId,
        action,
        {},
      );
      console.log('Shadowfax sandbox API response:', JSON.stringify(result, null, 2));
    } catch (err: any) {
      console.error(`Action ${action} failed:`, err.message);
      continue;
    }

    const after = await waitForStatusChange(deliveryId, before.deliveryStatus);
    if (after.changed) {
      console.log(
        `Status updated via webhook -> delivery: ${after.deliveryStatus} | order: ${after.orderStatus}`,
      );
    } else {
      console.log(
        `No status change observed after ${(POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s. ` +
          'Callback may not have reached the server (check tunnel + webhook URL registered with Shadowfax). ' +
          `Still: delivery=${after.deliveryStatus}, order=${after.orderStatus}`,
      );
    }
  }

  const final = await getStatuses(deliveryId);
  console.log('\n=== Final status ===');
  console.log('delivery:', final.deliveryStatus, '| order:', final.orderStatus);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
