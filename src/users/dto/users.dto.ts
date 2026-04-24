import { IsString, IsOptional, IsEmail, IsEnum } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsEnum(['VEG', 'NON_VEG', 'BOTH'])
  dietary_preference?: 'VEG' | 'NON_VEG' | 'BOTH';

  @IsOptional()
  @IsString({ each: true })
  fitness_goals?: string[];
}
