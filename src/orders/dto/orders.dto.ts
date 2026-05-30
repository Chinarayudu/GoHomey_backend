import { IsString, IsNotEmpty, IsNumber, IsIn, IsOptional } from 'class-validator';

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

  @IsOptional()
  @IsString()
  deliveryWindow?: string;
}

export class CreateSocialOrderDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;
}

export class CartItemDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  @IsIn([
    'DAILY_MEAL',
    'MEAL',
    'PANTRY_ITEM',
    'PANTRY',
    'SOCIAL_EVENT',
    'SOCIAL',
    'FUEL_PLAN',
    'FUEL_SUBSCRIPTION',
  ])
  type:
    | 'DAILY_MEAL'
    | 'MEAL'
    | 'PANTRY_ITEM'
    | 'PANTRY'
    | 'SOCIAL_EVENT'
    | 'SOCIAL'
    | 'FUEL_PLAN'
    | 'FUEL_SUBSCRIPTION';

  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @IsOptional()
  @IsString()
  plan_id?: string;

  @IsOptional()
  @IsString()
  assigned_chef_id?: string;

  @IsOptional()
  @IsString()
  start_date?: string;

  @IsOptional()
  @IsString()
  delivery_time_slot?: string;
}

export class CheckoutDto {
  @IsNotEmpty()
  items: CartItemDto[];
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
