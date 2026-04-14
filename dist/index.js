"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dns_1 = __importDefault(require("dns"));
dns_1.default.setServers(['8.8.8.8', '8.8.4.4']);
const originalLookup = dns_1.default.lookup;
dns_1.default.lookup = function (hostname, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    if (hostname.endsWith('.neon.tech')) {
        return dns_1.default.resolve4(hostname, (err, addresses) => {
            if (err)
                return callback(err);
            const opts = options || {};
            if (opts.all) {
                const results = addresses.map(addr => ({ address: addr, family: 4 }));
                return callback(null, results);
            }
            return callback(null, addresses[0], 4);
        });
    }
    return originalLookup(hostname, options || {}, callback);
};
const dotenv_1 = __importDefault(require("dotenv"));
require("reflect-metadata");
const app_1 = __importDefault(require("./app"));
const prisma_service_1 = require("./prisma/prisma.service");
const order_processor_1 = require("./orders/order.processor");
dotenv_1.default.config();
const port = process.env.PORT || 3000;
async function bootstrap() {
    console.log('Starting bootstrap...');
    console.log('DATABASE_URL len:', process.env.DATABASE_URL?.length);
    console.log('DATABASE_URL starts with:', process.env.DATABASE_URL?.substring(0, 20));
    await (0, prisma_service_1.connectPrisma)();
    console.log('Database connected successfully.');
    (0, order_processor_1.setupOrdersWorker)();
    app_1.default.listen(port, () => {
        console.log(`Server running on http://localhost:${port}/api/v1`);
        console.log(`Health check: http://localhost:${port}/api/v1/health`);
    });
}
bootstrap().catch((err) => {
    console.error('Bootstrap failed:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map