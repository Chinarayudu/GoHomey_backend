export declare class MealsService {
    create(chefId: string, data: any): Promise<any>;
    findAll(query: {
        date?: string;
        chefId?: string;
    }): Promise<({
        chef: {
            user: {
                name: string;
                email: string;
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
    } & {
        id: string;
        created_at: Date;
        updated_at: Date;
        chef_id: string;
        meal_name: string;
        type: string;
        service_window: string | null;
        image_url: string | null;
        price: number;
        slots_total: number;
        slots_remaining: number;
        batch_photo_url: string | null;
        date: Date;
    })[]>;
    findOne(id: string): Promise<any>;
    update(id: string, chefId: string, data: any): Promise<any>;
    remove(id: string, chefId: string): Promise<void>;
}
export declare const mealsService: MealsService;
