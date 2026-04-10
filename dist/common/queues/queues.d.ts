import { Queue } from 'bullmq';
import 'dotenv/config';
export declare const ordersQueue: Queue<any, any, string, any, any, string>;
export declare const getRedisConnection: () => import("bullmq").RedisOptions;
