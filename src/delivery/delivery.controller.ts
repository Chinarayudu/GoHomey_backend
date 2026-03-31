import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DeliveryService } from './delivery.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role, DeliveryStatus } from '@prisma/client';

@ApiTags('delivery')
@Controller('delivery')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Post('process-batch')
  @ApiOperation({
    summary: 'Process pending orders in batches for delivery (Admin/Cron only)',
  })
  processBatch() {
    return this.deliveryService.processBatchedDeliveries();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('active')
  @ApiOperation({ summary: 'Get active deliveries (Admin/Partner only)' })
  findActive() {
    return this.deliveryService.findActiveDeliveries();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch(':id/status')
  @ApiOperation({ summary: 'Update delivery status (Partner only)' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: DeliveryStatus,
  ) {
    return this.deliveryService.updateDeliveryStatus(id, status);
  }
}
