import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Processor('orders')
export class OrderProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderProcessor.name);

  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
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

  private async handleSendOrderNotification(data: { orderId: string }) {
    this.logger.log(`Sending notification for order ${data.orderId}`);
    // Here we would call NotificationService / FCM
    return { success: true };
  }

  private async handleTriggerDelivery(data: { orderId: string }) {
    this.logger.log(`Triggering delivery for order ${data.orderId}`);
    // Here we would call DeliveryService / External Delivery API
    return { success: true };
  }

  private async handleUpdateAnalytics(data: {
    orderId: string;
    amount: number;
  }) {
    this.logger.log(`Updating analytics for order ${data.orderId}`);
    // Here we would update some analytics table or external service
    return { success: true };
  }
}
