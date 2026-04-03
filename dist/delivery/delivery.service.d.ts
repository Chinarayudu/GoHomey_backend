export declare class DeliveryService {
    createDelivery(orderId: string, deliveryPartnerId?: string): Promise<{
        id: string;
        created_at: Date;
        updated_at: Date;
        status: import(".prisma/client").$Enums.DeliveryStatus;
        order_id: string;
        driver_id: string | null;
        pickup_time: Date | null;
        delivered_time: Date | null;
        pod_image: string | null;
    }>;
    findActiveDeliveries(): Promise<({
        order: {
            chef: {
                user: {
                    name: string;
                };
            } & {
                id: string;
                created_at: Date;
                updated_at: Date;
                bio: string | null;
                rating: number;
                is_verified: boolean;
                trust_tier: number;
                user_id: string;
            };
            user: {
                phone: string;
                name: string;
            };
        } & {
            id: string;
            created_at: Date;
            updated_at: Date;
            user_id: string;
            chef_id: string;
            order_type: import(".prisma/client").$Enums.OrderType;
            status: import(".prisma/client").$Enums.OrderStatus;
            total_price: number;
        };
    } & {
        id: string;
        created_at: Date;
        updated_at: Date;
        status: import(".prisma/client").$Enums.DeliveryStatus;
        order_id: string;
        driver_id: string | null;
        pickup_time: Date | null;
        delivered_time: Date | null;
        pod_image: string | null;
    })[]>;
    updateDeliveryStatus(id: string, status: any): Promise<{
        id: string;
        created_at: Date;
        updated_at: Date;
        status: import(".prisma/client").$Enums.DeliveryStatus;
        order_id: string;
        driver_id: string | null;
        pickup_time: Date | null;
        delivered_time: Date | null;
        pod_image: string | null;
    }>;
    processBatchedDeliveries(): Promise<void>;
}
export declare const deliveryService: DeliveryService;
