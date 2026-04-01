import { CreateMealOrderDto, CreatePantryOrderDto, UpdateOrderStatusDto } from './dto/orders.dto';
import { OrdersService } from './orders.service';
export declare class OrdersController {
    private readonly ordersService;
    constructor(ordersService: OrdersService);
    createMealOrder(req: any, body: CreateMealOrderDto): Promise<any>;
    createPantryOrder(req: any, body: CreatePantryOrderDto): Promise<any>;
    findUserOrders(req: any): Promise<({
        payment: {
            id: string;
            created_at: Date;
            updated_at: Date;
            status: import(".prisma/client").$Enums.PaymentStatus;
            order_id: string;
            amount: number;
            gateway_id: string | null;
            escrow_status: string;
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
        items: {
            id: string;
            price: number;
            order_id: string;
            item_id: string;
            quantity: number;
            daily_meal_id: string | null;
            pantry_id: string | null;
            fuel_slot_id: string | null;
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
    })[]>;
    findChefOrders(req: any): Promise<({
        payment: {
            id: string;
            created_at: Date;
            updated_at: Date;
            status: import(".prisma/client").$Enums.PaymentStatus;
            order_id: string;
            amount: number;
            gateway_id: string | null;
            escrow_status: string;
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
        items: {
            id: string;
            price: number;
            order_id: string;
            item_id: string;
            quantity: number;
            daily_meal_id: string | null;
            pantry_id: string | null;
            fuel_slot_id: string | null;
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
    })[]>;
    updateStatus(id: string, body: UpdateOrderStatusDto): Promise<{
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
