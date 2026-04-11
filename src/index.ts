import dns from 'dns';

// Workaround for local DNS resolution issues with Neon DB
dns.setServers(['8.8.8.8', '8.8.4.4']);

// Force dns.lookup to use resolve4 for the database host 
// because standard dns.lookup ignores dns.setServers on many systems (it uses OS resolver)
const originalLookup = dns.lookup;
// @ts-ignore
dns.lookup = function (hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  if (hostname.endsWith('.neon.tech')) {
    return dns.resolve4(hostname, (err, addresses) => {
      if (err) return callback(err);

      const opts: any = options || {};
      if (opts.all) {
        const results = addresses.map(addr => ({ address: addr, family: 4 }));
        return callback(null, results);
      }
      return callback(null, addresses[0], 4);
    });
  }
  return originalLookup(hostname, options || {}, callback);
};

import express from 'express';
import dotenv from 'dotenv';
import 'reflect-metadata';
import app from './app';
import { connectPrisma } from './prisma/prisma.service';
import { setupOrdersWorker } from './orders/order.processor';

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
