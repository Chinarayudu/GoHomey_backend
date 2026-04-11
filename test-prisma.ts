import { prisma } from './src/prisma/prisma.service';
import 'dotenv/config';
import * as dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);

async function main() {
  console.log('Testing Prisma connection...');
  try {
    const userCount = await prisma.user.count();
    console.log('User count:', userCount);
  } catch (error) {
    console.error('Prisma query failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
