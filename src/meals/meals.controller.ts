import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CreateMealDto, UpdateMealDto } from './dto/meals.dto';
import { MealsService } from './meals.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('meals')
@Controller('meals')
export class MealsController {
  constructor(private readonly mealsService: MealsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CHEF)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create a new daily meal (Chef only)' })
  create(@Request() req, @Body() createMealDto: CreateMealDto) {
    return this.mealsService.create(
      req.user.chefId || req.user.id,
      createMealDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all daily meals' })
  findAll(@Query('date') date?: string, @Query('chefId') chefId?: string) {
    return this.mealsService.findAll({ date, chefId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific meal by ID' })
  findOne(@Param('id') id: string) {
    return this.mealsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CHEF)
  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Update a meal (Chef only)' })
  update(
    @Param('id') id: string,
    @Request() req,
    @Body() updateMealDto: UpdateMealDto,
  ) {
    return this.mealsService.update(
      id,
      req.user.chefId || req.user.id,
      updateMealDto,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CHEF)
  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a meal (Chef only)' })
  remove(@Param('id') id: string, @Request() req) {
    return this.mealsService.remove(id, req.user.chefId || req.user.id);
  }
}
