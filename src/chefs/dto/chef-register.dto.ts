import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  Min,
  Max,
} from 'class-validator';

/**
 * Step 1: Personal Info — "Join the Atelier"
 * Fields: Full Name, Email, Mobile Number, Primary Cuisine
 */
export class ChefRegisterStep1Dto {
  @IsString()
  @IsNotEmpty()
  full_name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  mobile_number: string;

  @IsString()
  @IsNotEmpty()
  primary_cuisine: string;
}

/**
 * Step 2: Kitchen Space — "Your Kitchen Space"
 * Fields: Kitchen Name, Location (address + lat/lng), Capacity, Appliances
 */
export class ChefRegisterStep2Dto {
  @IsString()
  @IsNotEmpty()
  kitchen_name: string;

  @IsString()
  @IsNotEmpty()
  kitchen_address: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsNumber()
  @Min(1)
  @Max(100)
  max_capacity: number;

  @IsArray()
  @IsString({ each: true })
  appliances: string[];
}

/**
 * Step 3: Security & Verification
 * Files are handled by multer — no DTO fields needed for file data.
 * This DTO is for any additional text fields if needed.
 */
export class ChefRegisterStep3Dto {
  // Files: government_id, food_safety_cert, kitchen_photo
  // These are handled by multer middleware, not in the DTO body.
}
