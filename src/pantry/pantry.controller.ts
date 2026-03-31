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
import { CreatePantryDto, UpdatePantryDto } from './dto/pantry.dto';
import { PantryService } from './pantry.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('pantry')
@Controller('pantry')
export class PantryController {
  constructor(private readonly pantryService: PantryService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CHEF)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create a new pantry item (Chef only)' })
  create(@Request() req, @Body() createPantryDto: CreatePantryDto) {
    return this.pantryService.create(
      req.user.chefId || req.user.id,
      createPantryDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all pantry items' })
  findAll(
    @Query('category') category?: string,
    @Query('chefId') chefId?: string,
  ) {
    return this.pantryService.findAll({ category, chefId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific pantry item by ID' })
  findOne(@Param('id') id: string) {
    return this.pantryService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CHEF)
  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Update a pantry item (Chef only)' })
  update(
    @Param('id') id: string,
    @Request() req,
    @Body() updatePantryDto: UpdatePantryDto,
  ) {
    return this.pantryService.update(
      id,
      req.user.chefId || req.user.id,
      updatePantryDto,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CHEF)
  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a pantry item (Chef only)' })
  remove(@Param('id') id: string, @Request() req) {
    return this.pantryService.remove(id, req.user.chefId || req.user.id);
  }
}
