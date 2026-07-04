import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
} from 'class-validator';

export class CreateFuelPlanDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  goal: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsInt()
  @IsIn([3, 7, 30])
  duration_days?: number;

  @IsOptional()
  @IsNumber()
  fixed_chef_payout?: number;

  @IsOptional()
  @IsString()
  sop_document_url?: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  delivery_time_slots: string[];

  @IsNotEmpty()
  menu_json: any;

  @IsOptional()
  @IsNumber()
  calories?: number;

  @IsOptional()
  @IsNumber()
  protein?: number;

  @IsOptional()
  @IsNumber()
  carbs?: number;

  @IsOptional()
  @IsNumber()
  fat?: number;
}

export class CreateFuelSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  plan_id: string;

  @IsString()
  @IsNotEmpty()
  assigned_chef_id: string;

  @IsDateString()
  start_date: string;

  @IsString()
  @IsNotEmpty()
  delivery_time_slot: string;
}

export class CreateFuelSlotDto {
  @IsString()
  @IsNotEmpty()
  plan_id: string;
}

export class PauseFuelSubscriptionDto {
  @IsDateString()
  pause_from: string;

  @IsDateString()
  pause_to: string;
}

export class UpdateFulfillmentStatusDto {
  @IsIn([
    'SCHEDULED',
    'COOKING',
    'READY_FOR_PICKUP',
    'PICKED_UP',
    'DELIVERED',
    'PAUSED',
    'MISSED',
    'CANCELLED',
  ])
  status: string;
}
