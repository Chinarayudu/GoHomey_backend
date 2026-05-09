import { prisma } from './src/prisma/prisma.service';

async function testQuery() {
  try {
    console.log('Testing Prisma query...');
    const userCount = await prisma.user.count();
    console.log('User count:', userCount);
  } catch (error) {
    console.error('Prisma query failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testQuery();
