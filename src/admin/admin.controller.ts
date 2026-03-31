import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get overall platform statistics (Admin only)' })
  getPlatformStats() {
    return this.adminService.getPlatformStats();
  }

  @Get('top-chefs')
  @ApiOperation({ summary: 'Get top performing chefs (Admin only)' })
  getTopChefs() {
    return this.adminService.getTopChefs();
  }

  @Get('revenue/daily')
  @ApiOperation({ summary: 'Get daily revenue analytics (Admin only)' })
  getDailyRevenue() {
    return this.adminService.getDailyRevenue();
  }
}
