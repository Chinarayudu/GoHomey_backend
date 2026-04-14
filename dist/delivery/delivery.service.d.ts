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
                } | null;
            } & {
                id: string;
                name: string;
                phone: string;
                email: string;
                password: string;
                role: import(".prisma/client").$Enums.Role;
                bio: string | null;
                rating: number;
                is_verified: boolean;
                trust_tier: number;
                created_at: Date;
                updated_at: Date;
                primary_cuisine: string | null;
                kitchen_name: string | null;
                kitchen_address: string | null;
                latitude: number | null;
                longitude: number | null;
                max_capacity: number | null;
                appliances: string[];
                government_id_url: string | null;
                food_safety_cert_url: string | null;
                kitchen_photo_url: string | null;
                bank_name: string | null;
                bank_account_number: string | null;
                ifsc_code: string | null;
                application_status: import(".prisma/client").$Enums.ChefApplicationStatus;
                registration_step: number;
                user_id: string | null;
            };
            user: {
                name: string;
                phone: string;
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
