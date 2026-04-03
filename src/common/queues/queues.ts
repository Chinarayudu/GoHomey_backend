import { Queue, ConnectionOptions } from 'bullmq';
import 'dotenv/config';

const redisConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
};

export const ordersQueue = new Queue('orders', {
  connection: redisConnection,
});

export const getRedisConnection = () => redisConnection;
