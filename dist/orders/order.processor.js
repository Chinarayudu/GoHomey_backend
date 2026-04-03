"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupOrdersWorker = void 0;
const bullmq_1 = require("bullmq");
const queues_1 = require("../common/queues/queues");
const setupOrdersWorker = () => {
    const worker = new bullmq_1.Worker('orders', async (job) => {
        console.log(`Processing job ${job.id} of type ${job.name}`);
        switch (job.name) {
            case 'send-order-notification':
                return handleSendOrderNotification(job.data);
            case 'trigger-delivery':
                return handleTriggerDelivery(job.data);
            case 'update-analytics':
                return handleUpdateAnalytics(job.data);
            case 'send-order-status-update':
                return handleSendOrderStatusUpdate(job.data);
            default:
                console.warn(`Unknown job type: ${job.name}`);
        }
    }, { connection: (0, queues_1.getRedisConnection)() });
    worker.on('completed', (job) => {
        console.log(`Job ${job.id} completed!`);
    });
    worker.on('failed', (job, err) => {
        console.error(`Job ${job?.id} failed with ${err.message}`);
    });
    return worker;
};
exports.setupOrdersWorker = setupOrdersWorker;
async function handleSendOrderNotification(data) {
    console.log(`Sending notification for order ${data.orderId}`);
    return { success: true };
}
async function handleTriggerDelivery(data) {
    console.log(`Triggering delivery for order ${data.orderId}`);
    return { success: true };
}
async function handleUpdateAnalytics(data) {
    console.log(`Updating analytics for order ${data.orderId}`);
    return { success: true };
}
async function handleSendOrderStatusUpdate(data) {
    console.log(`Notifying user ${data.userId} that order ${data.orderId} is now ${data.status}`);
    return { success: true };
}
//# sourceMappingURL=order.processor.js.map