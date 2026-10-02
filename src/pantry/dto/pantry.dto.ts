import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsIn,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export const PANTRY_UNIT_TYPES = ['ITEM', 'CONTAINER'] as const;
export const MAX_PIECES_PER_UNIT = 100;

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

  @IsOptional()
  @IsIn(PANTRY_UNIT_TYPES, { message: 'unit_type must be ITEM or CONTAINER' })
  unit_type?: 'ITEM' | 'CONTAINER';

  @IsOptional()
  // Decorators register bottom-up and the first message is shown, so the
  // whole-number check sits last to win for non-numeric input.
  @Max(MAX_PIECES_PER_UNIT, {
    message: `pieces_per_unit must be at most ${MAX_PIECES_PER_UNIT}`,
  })
  @Min(1, { message: 'pieces_per_unit must be at least 1' })
  @IsInt({ message: 'pieces_per_unit must be a whole number' })
  pieces_per_unit?: number;
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

  @IsOptional()
  @IsIn(PANTRY_UNIT_TYPES, { message: 'unit_type must be ITEM or CONTAINER' })
  unit_type?: 'ITEM' | 'CONTAINER';

  @IsOptional()
  // Decorators register bottom-up and the first message is shown, so the
  // whole-number check sits last to win for non-numeric input.
  @Max(MAX_PIECES_PER_UNIT, {
    message: `pieces_per_unit must be at most ${MAX_PIECES_PER_UNIT}`,
  })
  @Min(1, { message: 'pieces_per_unit must be at least 1' })
  @IsInt({ message: 'pieces_per_unit must be a whole number' })
  pieces_per_unit?: number;
}
