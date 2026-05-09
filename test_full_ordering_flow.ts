import { prisma } from './src/prisma/prisma.service';
import { ordersService } from './src/orders/orders.service';
import { adminService } from './src/admin/admin.service';

async function runFlow() {
  console.log('🚀 Starting Full Ordering Flow Test\n');

  try {
    // 1. Get Test Data
    const user = await prisma.user.findFirst({ where: { email: 'maulik1@gmail.com' } });
    const chef = await prisma.chef.findFirst({ where: { email: 'auguste@cuisine.com' } });
    const meal = await prisma.dailyMeal.findFirst({ where: { chef_id: chef?.id } });

    if (!user || !chef || !meal) {
      throw new Error('Required test data not found. Please ensure users and meals exist.');
    }

    console.log(`👤 Customer: ${user.name} (${user.email})`);
    console.log(`👨‍🍳 Chef: ${chef.name} (${chef.email})`);
    console.log(`🍱 Meal: ${meal.meal_name}\n`);

    // --- STEP 1: USER PLACES ORDER ---
    console.log('STEP 1: User placing order...');
    const orderResult = await ordersService.createDailyMealOrder(user.id, meal.id, 1);
    const orderId = orderResult.id;
    console.log(`✅ Order Created! ID: ${orderId}, Status: ${orderResult.status}\n`);

    // --- STEP 2: CHEF ACCEPTS ORDER ---
    console.log('STEP 2: Chef accepting order...');
    await ordersService.updateOrderStatus(orderId, 'CONFIRMED');
    console.log('✅ Order Status: CONFIRMED\n');

    // --- STEP 3: CHEF STARTS PREPARING ---
    console.log('STEP 3: Chef preparing order...');
    await ordersService.updateOrderStatus(orderId, 'PREPARING');
    console.log('✅ Order Status: PREPARING\n');

    // --- STEP 4: CHEF MARKS READY ---
    console.log('STEP 4: Chef marking order ready for pickup...');
    await ordersService.updateOrderStatus(orderId, 'READY_FOR_PICKUP');
    console.log('✅ Order Status: READY_FOR_PICKUP\n');

    // --- STEP 5: ADMIN VERIFICATION ---
    console.log('STEP 5: Admin checking ready orders...');
    const readyOrders = await adminService.getOrdersReadyForDelivery();
    const found = readyOrders.find(o => o.id === orderId);

    if (found) {
      console.log('✅ Success! Admin sees the order in the "Ready for Delivery" list.');
      console.log(`   Customer: ${found.user.name}, Kitchen: ${found.chef.kitchen_name}`);
    } else {
      console.error('❌ Failure! Admin could not find the order in ready list.');
    }

    console.log('\n🏁 Flow Test Completed Successfully!');

  } catch (error) {
    console.error('\n❌ Test Flow Failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runFlow();
