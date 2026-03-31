"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var OrderProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let OrderProcessor = OrderProcessor_1 = class OrderProcessor extends bullmq_1.WorkerHost {
    prisma;
    logger = new common_1.Logger(OrderProcessor_1.name);
    constructor(prisma) {
        super();
        this.prisma = prisma;
    }
    async process(job) {
        this.logger.log(`Processing job ${job.id} of type ${job.name}`);
        switch (job.name) {
            case 'send-order-notification':
                return this.handleSendOrderNotification(job.data);
            case 'trigger-delivery':
                return this.handleTriggerDelivery(job.data);
            case 'update-analytics':
                return this.handleUpdateAnalytics(job.data);
            default:
                this.logger.warn(`Unknown job type: ${job.name}`);
        }
    }
    async handleSendOrderNotification(data) {
        this.logger.log(`Sending notification for order ${data.orderId}`);
        return { success: true };
    }
    async handleTriggerDelivery(data) {
        this.logger.log(`Triggering delivery for order ${data.orderId}`);
        return { success: true };
    }
    async handleUpdateAnalytics(data) {
        this.logger.log(`Updating analytics for order ${data.orderId}`);
        return { success: true };
    }
};
exports.OrderProcessor = OrderProcessor;
exports.OrderProcessor = OrderProcessor = OrderProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('orders'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OrderProcessor);
//# sourceMappingURL=order.processor.js.map