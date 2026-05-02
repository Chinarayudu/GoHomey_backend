import { IsString, IsNotEmpty, IsNumber, IsOptional, IsDateString, IsInt, Min, IsBoolean } from 'class-validator';

export class CreateSocialEventDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  price: number;

  @IsInt()
  @IsNotEmpty()
  @Min(1)
  slots_total: number;

  @IsOptional()
  @IsBoolean()
  social_balance?: boolean;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsInt()
  slots_male_total?: number;

  @IsOptional()
  @IsInt()
  slots_female_total?: number;
}

export class UpdateSocialEventDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  slots_total?: number;

  @IsOptional()
  @IsBoolean()
  social_balance?: boolean;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsInt()
  slots_male_total?: number;

  @IsOptional()
  @IsInt()
  slots_female_total?: number;
}
