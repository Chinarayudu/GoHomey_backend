import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ChefsService } from './chefs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('chefs')
@Controller('chefs')
export class ChefsController {
  constructor(private chefsService: ChefsService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('apply')
  @ApiOperation({ summary: 'Apply to be a chef' })
  async applyToBeChef(@Body('bio') bio: string, @Request() req: any) {
    return this.chefsService.create(req.user.id, bio);
  }

  @Get()
  @ApiOperation({ summary: 'Get all chefs' })
  async findAll() {
    return this.chefsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific chef by ID' })
  async findOne(@Param('id') id: string) {
    return this.chefsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Patch(':id/verify')
  @ApiOperation({ summary: 'Verify or unverify a chef (Admin only)' })
  async verifyChef(
    @Param('id') id: string,
    @Body('is_verified') isVerified: boolean,
    @Body('trust_tier') trustTier: number,
  ) {
    return this.chefsService.verifyChef(id, isVerified, trustTier);
  }
}
