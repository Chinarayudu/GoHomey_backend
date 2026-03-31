import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrderProcessor } from './order.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'orders',
    }),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderProcessor],
  exports: [OrdersService],
})
export class OrdersModule {}
