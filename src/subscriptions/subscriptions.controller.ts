import {
  Controller,
  Get,
  Post,
  Body,
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
import { CreatePlanDto, CreateSlotDto } from './dto/subscriptions.dto';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Post('plans')
  @ApiOperation({ summary: 'Create a new fuel plan (Admin only)' })
  createPlan(@Body() createPlanDto: CreatePlanDto) {
    return this.subscriptionsService.createPlan(createPlanDto);
  }

  @Get('plans')
  @ApiOperation({ summary: 'Get all available fuel plans' })
  findAllPlans() {
    return this.subscriptionsService.findAllPlans();
  }

  @Get('plans/:id')
  @ApiOperation({ summary: 'Get a specific fuel plan by ID' })
  findOnePlan(@Param('id') id: string) {
    return this.subscriptionsService.findOnePlan(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CHEF)
  @ApiBearerAuth()
  @Post('slots')
  @ApiOperation({ summary: 'Create a new fuel slot for a plan (Chef only)' })
  createSlot(@Request() req, @Body() createSlotDto: CreateSlotDto) {
    return this.subscriptionsService.createSlot(
      req.user.chefId || req.user.id,
      createSlotDto,
    );
  }

  @Get('slots/chef/:chefId')
  @ApiOperation({ summary: 'Get all fuel slots for a specific chef' })
  findSlotsByChef(@Param('chefId') chefId: string) {
    return this.subscriptionsService.findSlotsByChef(chefId);
  }
}
