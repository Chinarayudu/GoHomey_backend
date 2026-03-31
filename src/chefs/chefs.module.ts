import { Module } from '@nestjs/common';
import { ChefsService } from './chefs.service';
import { ChefsController } from './chefs.controller';

@Module({
  providers: [ChefsService],
  controllers: [ChefsController],
  exports: [ChefsService],
})
export class ChefsModule {}
