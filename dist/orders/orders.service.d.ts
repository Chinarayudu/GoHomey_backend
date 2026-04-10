export declare class OrdersService {
    createDailyMealOrder(userId: string, mealId: string, quantity: number): Promise<{
        items: {
            id: string;
            price: number;
            item_id: string;
            quantity: number;
            daily_meal_id: string | null;
            pantry_id: string | null;
            fuel_slot_id: string | null;
            order_id: string;
        }[];
    } & {
        id: string;
        created_at: Date;
        updated_at: Date;
        user_id: string;
        chef_id: string;
        order_type: import(".prisma/client").$Enums.OrderType;
        status: import(".prisma/client").$Enums.OrderStatus;
        total_price: number;
    }>;
    createPantryOrder(userId: string, itemId: string, quantity: number): Promise<{
        items: {
            id: string;
            price: number;
            item_id: string;
            quantity: number;
            daily_meal_id: string | null;
            pantry_id: string | null;
            fuel_slot_id: string | null;
            order_id: string;
        }[];
    } & {
        id: string;
        created_at: Date;
        updated_at: Date;
        user_id: string;
        chef_id: string;
        order_type: import(".prisma/client").$Enums.OrderType;
        status: import(".prisma/client").$Enums.OrderStatus;
        total_price: number;
    }>;
    findUserOrders(userId: string): Promise<({
        items: {
            id: string;
            price: number;
            item_id: string;
            quantity: number;
            daily_meal_id: string | null;
            pantry_id: string | null;
            fuel_slot_id: string | null;
            order_id: string;
        }[];
        payment: {
            id: string;
            created_at: Date;
            updated_at: Date;
            status: import(".prisma/client").$Enums.PaymentStatus;
            amount: number;
            gateway_id: string | null;
            escrow_status: string;
            order_id: string;
        } | null;
        delivery: {
            id: string;
            created_at: Date;
            updated_at: Date;
            status: import(".prisma/client").$Enums.DeliveryStatus;
            order_id: string;
            driver_id: string | null;
            pickup_time: Date | null;
            delivered_time: Date | null;
            pod_image: string | null;
        } | null;
    } & {
        id: string;
        created_at: Date;
        updated_at: Date;
        user_id: string;
        chef_id: string;
        order_type: import(".prisma/client").$Enums.OrderType;
        status: import(".prisma/client").$Enums.OrderStatus;
        total_price: number;
    })[]>;
    findChefOrders(chefId: string): Promise<({
        items: {
            id: string;
            price: number;
            item_id: string;
            quantity: number;
            daily_meal_id: string | null;
            pantry_id: string | null;
            fuel_slot_id: string | null;
            order_id: string;
        }[];
        payment: {
            id: string;
            created_at: Date;
            updated_at: Date;
            status: import(".prisma/client").$Enums.PaymentStatus;
            amount: number;
            gateway_id: string | null;
            escrow_status: string;
            order_id: string;
        } | null;
        delivery: {
            id: string;
            created_at: Date;
            updated_at: Date;
            status: import(".prisma/client").$Enums.DeliveryStatus;
            order_id: string;
            driver_id: string | null;
            pickup_time: Date | null;
            delivered_time: Date | null;
            pod_image: string | null;
        } | null;
    } & {
        id: string;
        created_at: Date;
        updated_at: Date;
        user_id: string;
        chef_id: string;
        order_type: import(".prisma/client").$Enums.OrderType;
        status: import(".prisma/client").$Enums.OrderStatus;
        total_price: number;
    })[]>;
    updateOrderStatus(id: string, status: any): Promise<{
        id: string;
        created_at: Date;
        updated_at: Date;
        user_id: string;
        chef_id: string;
        order_type: import(".prisma/client").$Enums.OrderType;
        status: import(".prisma/client").$Enums.OrderStatus;
        total_price: number;
    }>;
}
export declare const ordersService: OrdersService;
