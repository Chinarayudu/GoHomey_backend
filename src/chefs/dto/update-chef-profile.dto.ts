import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Body for PATCH /chefs/profile. Every field is optional (partial update), but
 * whatever is sent is validated — `validationMiddleware` runs with
 * `forbidNonWhitelisted`, so this DTO must list every field the endpoint accepts.
 *
 * Bank fields are format-checked here; the IFSC is additionally checked against
 * the bank directory in `chefsService.updateProfile`.
 */
export class UpdateChefProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  primary_cuisine?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  kitchen_name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  kitchen_address?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  max_capacity?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  appliances?: string[];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  bank_name?: string;

  @IsOptional()
  // Strip spaces and dashes anywhere in the value (e.g. "1234 5678 9012",
  // "1234-5678-9012") before validating — the frontend does not need to sanitize.
  @Transform(({ value }) =>
    value == null ? value : String(value).replace(/[\s-]/g, ''),
  )
  @Matches(/^\d{9,18}$/, {
    message: 'bank_account_number must be 9 to 18 digits',
  })
  bank_account_number?: string;

  @IsOptional()
  // Strip all whitespace and uppercase (e.g. "hdfc 0001234") before validating.
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.replace(/\s/g, '').toUpperCase()
      : value,
  )
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, {
    message:
      'ifsc_code must be a valid 11-character IFSC, e.g. HDFC0001234 (4 letters, then 0, then 6 alphanumerics)',
  })
  ifsc_code?: string;
}
