"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
require("reflect-metadata");
const app_1 = __importDefault(require("./app"));
const prisma_service_1 = require("./prisma/prisma.service");
const order_processor_1 = require("./orders/order.processor");
dotenv_1.default.config();
const port = process.env.PORT || 3000;
async function bootstrap() {
    await (0, prisma_service_1.connectPrisma)();
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