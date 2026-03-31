import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class CreatePlanDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  goal: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  price: number;

  @ApiProperty()
  @IsNotEmpty()
  menu_json: any;
}

export class CreateSlotDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  plan_id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  time_slot: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  capacity: number;
}
