"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClient = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
require("dotenv/config");
exports.redisClient = new ioredis_1.default({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
});
exports.redisClient.on('error', (err) => {
    console.error('Redis Client Error', err);
});
exports.redisClient.on('connect', () => {
    console.log('Redis Cache Client Connected');
});
//# sourceMappingURL=redis.client.js.map