import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class CreatePantryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsNumber()
  @IsNotEmpty()
  price: number;

  @IsNumber()
  @IsNotEmpty()
  inventory: number;

  @IsOptional()
  @IsString()
  image_url?: string;
}

export class UpdatePantryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsNumber()
  inventory?: number;

  @IsOptional()
  @IsString()
  image_url?: string;
}
