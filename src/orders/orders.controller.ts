import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  CreateMealOrderDto,
  CreatePantryOrderDto,
  UpdateOrderStatusDto,
} from './dto/orders.dto';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role, OrderStatus } from '@prisma/client';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('meal')
  @ApiOperation({ summary: 'Create a new daily meal order' })
  createMealOrder(@Request() req, @Body() body: CreateMealOrderDto) {
    return this.ordersService.createDailyMealOrder(
      req.user.id,
      body.mealId,
      body.quantity,
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('pantry')
  @ApiOperation({ summary: 'Create a new pantry item order' })
  createPantryOrder(@Request() req, @Body() body: CreatePantryOrderDto) {
    return this.ordersService.createPantryOrder(
      req.user.id,
      body.itemId,
      body.quantity,
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('user')
  @ApiOperation({ summary: 'Get current user orders' })
  findUserOrders(@Request() req) {
    return this.ordersService.findUserOrders(req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CHEF)
  @ApiBearerAuth()
  @Get('chef')
  @ApiOperation({ summary: 'Get orders received by the chef' })
  findChefOrders(@Request() req) {
    return this.ordersService.findChefOrders(req.user.chefId || req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CHEF, Role.ADMIN)
  @ApiBearerAuth()
  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status (Chef/Admin only)' })
  updateStatus(@Param('id') id: string, @Body() body: UpdateOrderStatusDto) {
    return this.ordersService.updateOrderStatus(id, body.status as any);
  }
}
