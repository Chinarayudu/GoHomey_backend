"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisConnection = exports.ordersQueue = void 0;
const bullmq_1 = require("bullmq");
require("dotenv/config");
const redisConnection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
};
exports.ordersQueue = new bullmq_1.Queue('orders', {
    connection: redisConnection,
});
const getRedisConnection = () => redisConnection;
exports.getRedisConnection = getRedisConnection;
//# sourceMappingURL=queues.js.map