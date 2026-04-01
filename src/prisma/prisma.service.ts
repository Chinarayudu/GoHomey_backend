import 'dotenv/config';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not defined in the environment variables');
    }
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    super({
      // @ts-ignore
      adapter: adapter,
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      console.log(
        'Successfully connected to the database via Prisma 7 + PostgreSQL Adapter.',
      );
    } catch (error) {
      console.error('Failed to connect to Prisma:', error);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
