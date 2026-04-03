import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in the environment variables');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool as any);

export const prisma = new PrismaClient({
  // @ts-ignore
  adapter: adapter,
});

export async function connectPrisma() {
  try {
    await prisma.$connect();
    console.log('Successfully connected to the database via Prisma 7 + PostgreSQL Adapter.');
  } catch (error) {
    console.error('Failed to connect to Prisma:', error);
    process.exit(1);
  }
}

export async function disconnectPrisma() {
  await prisma.$disconnect();
}
