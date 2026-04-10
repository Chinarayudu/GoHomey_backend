import { Worker, Job } from 'bullmq';
import { prisma } from '../prisma/prisma.service';
import { getRedisConnection } from '../common/queues/queues';

export const setupOrdersWorker = () => {
  const worker = new Worker(
    'orders',
    async (job: Job) => {
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
    },
    { connection: getRedisConnection() }
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed!`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed with ${err.message}`);
  });

  return worker;
};

async function handleSendOrderNotification(data: { orderId: string }) {
  console.log(`Sending notification for order ${data.orderId}`);
  // Here we would call Notification Service logic
  return { success: true };
}

async function handleTriggerDelivery(data: { orderId: string }) {
  console.log(`Triggering delivery for order ${data.orderId}`);
  // Here we would call Delivery Service logic
  return { success: true };
}

async function handleUpdateAnalytics(data: { orderId: string; amount: number }) {
  console.log(`Updating analytics for order ${data.orderId}`);
  // Here we would update some analytics table
  return { success: true };
}

async function handleSendOrderStatusUpdate(data: { orderId: string; userId: string; status: string }) {
  console.log(`Notifying user ${data.userId} that order ${data.orderId} is now ${data.status}`);
  return { success: true };
}
