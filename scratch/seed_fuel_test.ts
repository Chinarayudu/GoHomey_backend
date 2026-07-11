import 'dotenv/config';
import bcrypt from 'bcrypt';
import { Role, ChefApplicationStatus } from '@prisma/client';
import { prisma, disconnectPrisma } from '../src/prisma/prisma.service';
import { FuelService } from '../src/fuel/fuel.service';

// Seeds a self-contained Fuel test: a TEST chef, a TEST user, a 3-day plan with a
// full daily menu, a chef slot, and an ACTIVE subscription starting today (which
// generates today's fulfillments). Safe to re-run: chef/user are upserted by email,
// and a fresh plan+subscription is created each run.
async function main() {
  const fuelService = new FuelService();

  // 1. TEST chef (APPROVED, with bank details + capacity + location)
  const chefPassword = await bcrypt.hash('TestChef123!', 10);
  const chef = await prisma.chef.upsert({
    where: { email: 'fuelchef.test@gohomeyy.com' },
    update: {
      application_status: ChefApplicationStatus.APPROVED,
      is_verified: true,
      max_concurrent_slots_per_hour: 15,
    },
    create: {
      name: 'TEST Fuel Chef',
      phone: '+919000000010',
      email: 'fuelchef.test@gohomeyy.com',
      password: chefPassword,
      role: Role.CHEF,
      application_status: ChefApplicationStatus.APPROVED,
      is_verified: true,
      kitchen_name: 'Test Fuel Kitchen',
      kitchen_address: 'Bengaluru',
      latitude: 12.9716,
      longitude: 77.5946,
      max_capacity: 20,
      max_concurrent_slots_per_hour: 15,
      bank_name: 'HDFC Bank',
      bank_account_number: '1234567890',
      ifsc_code: 'HDFC0001234',
    },
  });

  // 2. TEST user
  const userPassword = await bcrypt.hash('TestUser123!', 10);
  const user = await prisma.user.upsert({
    where: { email: 'fueluser.test@gohomeyy.com' },
    update: {},
    create: {
      name: 'TEST Fuel User',
      email: 'fueluser.test@gohomeyy.com',
      phone: '+919000000011',
      password: userPassword,
      role: Role.USER,
      gender: 'OTHER',
    },
  });

  // 3. Fuel plan with a real 3-day menu
  const deliveryTimeSlots = ['08:00', '13:00', '19:00'];
  const menu_json = {
    days: [
      { day: 1, meals: {
        breakfast: { name: 'Oats & eggs', time_slot: '08:00' },
        lunch: { name: 'Grilled chicken bowl', time_slot: '13:00' },
        dinner: { name: 'Paneer & quinoa', time_slot: '19:00' } } },
      { day: 2, meals: {
        breakfast: { name: 'Poha', time_slot: '08:00' },
        lunch: { name: 'Fish curry rice', time_slot: '13:00' },
        dinner: { name: 'Dal & roti', time_slot: '19:00' } } },
      { day: 3, meals: {
        breakfast: { name: 'Smoothie bowl', time_slot: '08:00' },
        lunch: { name: 'Rajma rice', time_slot: '13:00' },
        dinner: { name: 'Grilled veg', time_slot: '19:00' } } },
    ],
  };
  const plan = await fuelService.createPlan({
    name: 'TEST Lean 3-Day',
    goal: 'Fat loss',
    description: 'Seeded test Fuel plan',
    price: 999,
    duration_days: 3,
    delivery_time_slots: deliveryTimeSlots,
    menu_json,
    calories: 600,
    protein: 40,
    carbs: 50,
    fat: 20,
  });

  // 4. Chef offers the plan (creates FuelSlot rows for each time slot)
  await fuelService.enableChefPlan(chef.id, { plan_id: plan.id });

  // 5. Subscription starting today -> generates today's fulfillments (13:00 slot)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = today.toISOString().slice(0, 10);
  const subscription = await fuelService.createSubscription(user.id, {
    plan_id: plan.id,
    assigned_chef_id: chef.id,
    start_date: startDate,
    delivery_time_slot: '13:00',
  });

  // 6. Read back the two daily views to confirm resolved dishes
  const chefView = await fuelService.listChefFulfillments(chef.id, startDate);
  const userView = await fuelService.listMyFulfillments(user.id, startDate);

  console.log(JSON.stringify({
    start_date: startDate,
    plan_id: plan.id,
    chef: { id: chef.id, email: chef.email, login_password: 'TestChef123!' },
    user: { id: user.id, email: user.email, login_password: 'TestUser123!' },
    subscription_id: subscription.id,
    chef_today_count: chefView.length,
    user_today_count: userView.length,
    chef_today_sample: chefView[0]
      ? { id: chefView[0].id, delivery_status: chefView[0].delivery_status,
          delivery_time_slot: chefView[0].delivery_time_slot,
          customer: chefView[0].subscription?.user, menu: chefView[0].menu }
      : null,
    user_today_sample: userView[0]
      ? { id: userView[0].id, delivery_status: userView[0].delivery_status,
          chef: userView[0].subscription?.assigned_chef, menu: userView[0].menu }
      : null,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
