"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.connectPrisma = connectPrisma;
exports.disconnectPrisma = disconnectPrisma;
require("dotenv/config");
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL is not defined in the environment variables');
}
const pool = new pg_1.Pool({ connectionString });
const adapter = new adapter_pg_1.PrismaPg(pool);
exports.prisma = new client_1.PrismaClient({
    adapter: adapter,
});
async function connectPrisma() {
    try {
        await exports.prisma.$connect();
        console.log('Successfully connected to the database via Prisma 7 + PostgreSQL Adapter.');
    }
    catch (error) {
        console.error('Failed to connect to Prisma:', error);
        process.exit(1);
    }
}
async function disconnectPrisma() {
    await exports.prisma.$disconnect();
}
//# sourceMappingURL=prisma.service.js.map