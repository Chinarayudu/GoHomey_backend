import { prisma } from '../src/prisma/prisma.service';

const phoneArg = process.argv[2];
const confirm = process.argv.includes('--confirm');
const withChef = process.argv.includes('--with-chef');

const ids = <T extends { id: string }>(rows: T[]) => rows.map((r) => r.id);

async function main() {
  if (!phoneArg) throw new Error('Usage: ts-node scratch/delete_user_by_phone.ts <phone> [--with-chef] [--confirm]');
  const digits = phoneArg.replace(/\D/g, '').slice(-10);

  const users = await prisma.user.findMany({
    where: { phone: { contains: digits } },
    include: { chef: { select: { id: true, name: true } } },
  });
  if (users.length === 0) {
    console.log(`No user found with phone containing ${digits}`);
    return;
  }
  if (users.length > 1) {
    console.log('Multiple users matched, aborting:', users.map((u) => ({ id: u.id, phone: u.phone, name: u.name })));
    return;
  }

  const user = users[0];
  const chefId = withChef ? user.chef?.id : undefined;
  const none = ['__none__'];

  const orderIds = ids(
    await prisma.order.findMany({
      where: { OR: [{ user_id: user.id }, ...(chefId ? [{ chef_id: chefId }] : [])] },
      select: { id: true },
    }),
  );
  const subIds = ids(
    await prisma.fuelSubscription.findMany({
      where: { OR: [{ user_id: user.id }, ...(chefId ? [{ assigned_chef_id: chefId }] : [])] },
      select: { id: true },
    }),
  );
  const mealIds = chefId ? ids(await prisma.dailyMeal.findMany({ where: { chef_id: chefId }, select: { id: true } })) : [];
  const pantryIds = chefId ? ids(await prisma.pantryItem.findMany({ where: { chef_id: chefId }, select: { id: true } })) : [];
  const slotIds = chefId ? ids(await prisma.fuelSlot.findMany({ where: { chef_id: chefId }, select: { id: true } })) : [];
  const eventIds = chefId ? ids(await prisma.socialEvent.findMany({ where: { chef_id: chefId }, select: { id: true } })) : [];
  const paymentIds = ids(await prisma.payment.findMany({ where: { order_id: { in: orderIds } }, select: { id: true } }));

  const orderItemWhere = {
    OR: [
      { order_id: { in: orderIds } },
      { fuel_subscription_id: { in: subIds } },
      { daily_meal_id: { in: mealIds } },
      { pantry_id: { in: pantryIds } },
      { fuel_slot_id: { in: slotIds } },
      { social_event_id: { in: eventIds } },
    ],
  };
  const payoutWhere = {
    OR: [{ order_id: { in: orderIds } }, { payment_id: { in: paymentIds } }, { chef_id: chefId ?? none[0] }],
  };
  const fulfillmentWhere = {
    OR: [{ subscription_id: { in: subIds } }, { chef_id: chefId ?? none[0] }],
  };
  const followWhere = {
    OR: [{ user_id: user.id }, { chef_id: chefId ?? none[0] }],
  };

  // Order items outside our order set that reference the chef's items (would leave other orders item-less)
  const foreignOrderItems = await prisma.orderItem.count({
    where: { AND: [orderItemWhere, { order_id: { notIn: orderIds } }] },
  });

  const counts = {
    orders: orderIds.length,
    ordersOfOtherCustomers: await prisma.order.count({ where: { id: { in: orderIds }, user_id: { not: user.id } } }),
    orderItems: await prisma.orderItem.count({ where: orderItemWhere }),
    orderItemsInOtherOrders: foreignOrderItems,
    payments: paymentIds.length,
    chefPayouts: await prisma.chefPayout.count({ where: payoutWhere }),
    deliveries: await prisma.delivery.count({ where: { order_id: { in: orderIds } } }),
    fuelSubscriptions: subIds.length,
    fuelFulfillments: await prisma.fuelDailyFulfillment.count({ where: fulfillmentWhere }),
    addresses: await prisma.address.count({ where: { user_id: user.id } }),
    follows: await prisma.follow.count({ where: followWhere }),
    pushTokens: await prisma.devicePushToken.count({ where: { user_id: user.id } }),
    ...(chefId && {
      dailyMeals: mealIds.length,
      pantryItems: pantryIds.length,
      fuelSlots: slotIds.length,
      socialEvents: eventIds.length,
    }),
  };

  console.log('User:', { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role, linkedChef: user.chef });
  console.log(`Mode: ${chefId ? 'user + chef profile' : 'user only (chef profile unlinked)'}`);
  console.log('Rows to delete:', counts);

  if (!confirm) {
    console.log('\nDry run. Re-run with --confirm to delete.');
    return;
  }

  await prisma.$transaction([
    prisma.chefPayout.deleteMany({ where: payoutWhere }),
    prisma.payment.deleteMany({ where: { id: { in: paymentIds } } }),
    prisma.delivery.deleteMany({ where: { order_id: { in: orderIds } } }),
    prisma.orderItem.deleteMany({ where: orderItemWhere }),
    prisma.order.deleteMany({ where: { id: { in: orderIds } } }),
    prisma.fuelDailyFulfillment.deleteMany({ where: fulfillmentWhere }),
    prisma.fuelSubscription.deleteMany({ where: { id: { in: subIds } } }),
    prisma.address.deleteMany({ where: { user_id: user.id } }),
    prisma.follow.deleteMany({ where: followWhere }),
    prisma.devicePushToken.deleteMany({ where: { user_id: user.id } }),
    ...(chefId
      ? [
          prisma.dailyMeal.deleteMany({ where: { id: { in: mealIds } } }),
          prisma.pantryItem.deleteMany({ where: { id: { in: pantryIds } } }),
          prisma.fuelSlot.deleteMany({ where: { id: { in: slotIds } } }),
          prisma.socialEvent.deleteMany({ where: { id: { in: eventIds } } }),
          prisma.chef.delete({ where: { id: chefId } }),
        ]
      : [prisma.chef.updateMany({ where: { user_id: user.id }, data: { user_id: null } })]),
    prisma.user.delete({ where: { id: user.id } }),
  ]);
  console.log(`\nDeleted user ${user.id} (${user.phone})${chefId ? ` and chef ${chefId}` : ''} with related rows.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
