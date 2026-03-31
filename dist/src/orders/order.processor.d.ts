import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
export declare class OrderProcessor extends WorkerHost {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    process(job: Job<any, any, string>): Promise<any>;
    private handleSendOrderNotification;
    private handleTriggerDelivery;
    private handleUpdateAnalytics;
}
