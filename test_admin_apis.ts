import { adminService } from './src/admin/admin.service';
import { prisma } from './src/prisma/prisma.service';

async function testAdminApis() {
  console.log('--- Testing Admin Service ---');

  try {
    console.log('\n1. Testing getPlatformStats...');
    const stats = await adminService.getPlatformStats();
    console.log('Stats:', stats);

    console.log('\n2. Testing getAllOrders...');
    const orders = await adminService.getAllOrders();
    console.log(`Found ${orders.length} orders.`);
    if (orders.length > 0) {
      console.log('First order status:', orders[0].status);
    }

    console.log('\n3. Testing getOrdersReadyForDelivery...');
    const readyOrders = await adminService.getOrdersReadyForDelivery();
    console.log(`Found ${readyOrders.length} orders ready for delivery.`);

    console.log('\n4. Testing getChefs...');
    const chefs = await adminService.getChefs();
    console.log(`Found ${chefs.length} chefs.`);

    console.log('\n5. Testing getAllUsers...');
    const users = await adminService.getAllUsers();
    console.log(`Found ${users.length} users.`);

    console.log('\n--- Admin Service Tests Completed Successfully ---');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAdminApis();
