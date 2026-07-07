import { prisma } from '../src/prisma/prisma.service';

const CONFIRM_FLAG = '--confirm-delete-order-data';

async function tableExists(tableName: string) {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = ${tableName}
    ) AS "exists"
  `;

  return Boolean(rows[0]?.exists);
}

async function countRecords() {
  const hasChefPayouts = await tableExists('ChefPayout');
  const [
    orders,
    orderItems,
    payments,
    deliveries,
    fuelSubscriptions,
    fuelFulfillments,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.orderItem.count(),
    prisma.payment.count(),
    prisma.delivery.count(),
    prisma.fuelSubscription.count(),
    prisma.fuelDailyFulfillment.count(),
  ]);

  return {
    orders,
    orderItems,
    payments,
    deliveries,
    chefPayouts: hasChefPayouts
      ? await prisma.chefPayout.count()
      : 'table missing',
    fuelSubscriptions,
    fuelFulfillments,
  };
}

async function resetOrderTestData() {
  const hasChefPayouts = await tableExists('ChefPayout');
  const confirmed =
    process.argv.includes(CONFIRM_FLAG) ||
    process.env.CONFIRM_DELETE_ORDER_DATA === 'YES';

  if (!confirmed) {
    console.log('Refusing to delete order data without confirmation.');
    console.log('');
    console.log('Run one of these commands:');
    console.log(`npm run reset:orders:confirm`);
    console.log(`npx ts-node scratch/reset_order_test_data.ts ${CONFIRM_FLAG}`);
    console.log('set CONFIRM_DELETE_ORDER_DATA=YES && npm run reset:orders');
    console.log('');
    console.log(
      'This deletes order/payment/delivery/payout/Fuel subscription test records.',
    );
    return;
  }

  console.log('Order test data before cleanup:');
  console.table(await countRecords());

  await prisma.$transaction(async (tx) => {
    // Child/dependent records first.
    if (hasChefPayouts) {
      await tx.chefPayout.deleteMany({});
    }
    await tx.delivery.deleteMany({});
    await tx.payment.deleteMany({});
    await tx.orderItem.deleteMany({});

    // Fuel subscriptions and fulfillments are generated from paid Fuel orders.
    await tx.fuelDailyFulfillment.deleteMany({});
    await tx.fuelSubscription.deleteMany({});

    await tx.order.deleteMany({});

    // Slot-style catalog availability is reset below using SQL because each
    // row needs slots_remaining copied from its own capacity column.
  });

  // Prisma updateMany cannot set one column equal to another. Reset these with raw SQL.
  await prisma.$executeRawUnsafe(
    'UPDATE "DailyMeal" SET "slots_remaining" = "slots_total"',
  );
  await prisma.$executeRawUnsafe(
    'UPDATE "SocialEvent" SET "slots_remaining" = "slots_total"',
  );
  await prisma.$executeRawUnsafe(
    'UPDATE "FuelSlot" SET "slots_remaining" = "capacity"',
  );

  console.log('Order test data after cleanup:');
  console.table(await countRecords());
  console.log(
    'Done. Users, chefs, menus, pantry items, addresses, and delivery partners were kept.',
  );
  console.log(
    'Note: pantry inventory is not reset because the schema does not store original inventory separately.',
  );
}

resetOrderTestData()
  .catch((error) => {
    console.error('Failed to reset order test data:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
