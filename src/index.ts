import express from 'express';
import dotenv from 'dotenv';
import 'reflect-metadata';
import app from './app';
import { connectPrisma } from './prisma/prisma.service';
import { setupOrdersWorker } from './orders/order.processor';

dotenv.config();

const port = process.env.PORT || 3000;

async function bootstrap() {
  // Connect to Database
  await connectPrisma();
  
  // Initialize Workers
  setupOrdersWorker();
  
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
