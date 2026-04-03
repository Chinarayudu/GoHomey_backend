import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class CreatePlanDto {
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
  @IsNotEmpty()
  price: number;

  @IsNotEmpty()
  menu_json: any;
}

export class CreateSlotDto {
  @IsString()
  @IsNotEmpty()
  plan_id: string;

  @IsString()
  @IsNotEmpty()
  time_slot: string;

  @IsNumber()
  @IsNotEmpty()
  capacity: number;
}
