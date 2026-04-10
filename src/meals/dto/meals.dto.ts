import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class CreateMealDto {
  @IsString()
  @IsNotEmpty()
  meal_name: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsNumber()
  @IsNotEmpty()
  price: number;

  @IsNumber()
  @IsNotEmpty()
  slots_total: number;

  @IsString()
  @IsNotEmpty()
  date: string;
}

export class UpdateMealDto {
  @IsOptional()
  @IsString()
  meal_name?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsNumber()
  slots_total?: number;

  @IsOptional()
  @IsString()
  date?: string;
}
