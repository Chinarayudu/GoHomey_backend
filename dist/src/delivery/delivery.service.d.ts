import { PrismaService } from '../prisma/prisma.service';
export declare class DeliveryService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    createDelivery(orderId: string, deliveryPartnerId?: string): Promise<{
        id: string;
        created_at: Date;
        updated_at: Date;
        status: import("@prisma/client").$Enums.DeliveryStatus;
        order_id: string;
        driver_id: string | null;
        pickup_time: Date | null;
        delivered_time: Date | null;
        pod_image: string | null;
    }>;
    findActiveDeliveries(): Promise<({
        order: {
            user: {
                phone: string;
                name: string;
            };
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
        } & {
            id: string;
            created_at: Date;
            updated_at: Date;
            user_id: string;
            chef_id: string;
            order_type: import("@prisma/client").$Enums.OrderType;
            status: import("@prisma/client").$Enums.OrderStatus;
            total_price: number;
        };
    } & {
        id: string;
        created_at: Date;
        updated_at: Date;
        status: import("@prisma/client").$Enums.DeliveryStatus;
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
        status: import("@prisma/client").$Enums.DeliveryStatus;
        order_id: string;
        driver_id: string | null;
        pickup_time: Date | null;
        delivered_time: Date | null;
        pod_image: string | null;
    }>;
    processBatchedDeliveries(): Promise<void>;
}
