import express from 'express';
import dotenv from 'dotenv';
import 'reflect-metadata';
import app from './app';
import { connectPrisma } from './prisma/prisma.service';
import { setupOrdersWorker } from './orders/order.processor';
import { setupFuelScheduler } from './fuel/fuel.scheduler';

dotenv.config();

const port = process.env.PORT || 3000;

async function bootstrap() {
  console.log('Starting bootstrap...');
  console.log('DATABASE_URL len:', process.env.DATABASE_URL?.length);
  console.log('DATABASE_URL starts with:', process.env.DATABASE_URL?.substring(0, 20));
  // Connect to Database
  await connectPrisma();
  console.log('Database connected successfully.');

  // Initialize Workers
  setupOrdersWorker();
  setupFuelScheduler();

  // Start Express Server
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/api/v1`);
    console.log(`Health check: http://localhost:${port}/api/v1/health`);
  });
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
