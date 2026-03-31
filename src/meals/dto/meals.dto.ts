import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class CreateMealDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  meal_name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  price: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  slots_total: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  date: string;
}

export class UpdateMealDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  meal_name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  slots_total?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  date?: string;
}
