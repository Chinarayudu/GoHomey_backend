export declare class CreateMealOrderDto {
    mealId: string;
    quantity: number;
}
export declare class CreatePantryOrderDto {
    itemId: string;
    quantity: number;
}
export declare class UpdateOrderStatusDto {
    status: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
}
