import 'dotenv/config';
import { prisma, disconnectPrisma } from '../src/prisma/prisma.service';
import { FuelService } from '../src/fuel/fuel.service';

async function main() {
  const fuelService = new FuelService();
  const chefId = '7110dd93-9fad-4529-872e-83f90bbe1bff';
  const userId = 'a9e5fc28-249a-484d-ba30-f2a8232782b0';

  // Raw fulfillment dates as stored, so we can see the actual days
  const raw = await prisma.fuelDailyFulfillment.findMany({
    where: { chef_id: chefId },
    orderBy: { fulfillment_date: 'asc' },
    select: { id: true, fulfillment_date: true, delivery_time_slot: true, delivery_status: true },
  });
  console.log('RAW fulfillment dates:', JSON.stringify(raw, null, 2));

  // Chef view for ALL dates (no filter)
  const chefAll = await fuelService.listChefFulfillments(chefId);
  console.log('\nCHEF view (all dates), count =', chefAll.length);
  console.log(JSON.stringify(chefAll.map((f: any) => ({
    id: f.id, date: f.fulfillment_date, status: f.delivery_status,
    slot: f.delivery_time_slot, customer: f.subscription?.user?.name, menu: f.menu,
  })), null, 2));

  // User view using the DEFAULT "today" (what GET /fuel/deliveries/me returns with no date)
  const userToday = await fuelService.listMyFulfillments(userId);
  console.log('\nUSER view (default today), count =', userToday.length);
  console.log(JSON.stringify(userToday.map((f: any) => ({
    id: f.id, date: f.fulfillment_date, status: f.delivery_status,
    chef: f.subscription?.assigned_chef?.name, menu: f.menu,
  })), null, 2));
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => disconnectPrisma());
