import { IsString, IsNotEmpty, IsNumber, IsIn } from 'class-validator';

export class CreateMealOrderDto {
  @IsString()
  @IsNotEmpty()
  mealId: string;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;
}

export class CreatePantryOrderDto {
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;
}

export class CreateSocialOrderDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;
}

export class UpdateOrderStatusDto {
  @IsIn([
    'PENDING',
    'CONFIRMED',
    'PREPARING',
    'READY_FOR_PICKUP',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
    'REFUNDED',
  ])
  @IsNotEmpty()
  status:
    | 'PENDING'
    | 'CONFIRMED'
    | 'PREPARING'
    | 'READY_FOR_PICKUP'
    | 'OUT_FOR_DELIVERY'
    | 'DELIVERED'
    | 'CANCELLED'
    | 'REFUNDED';
}
