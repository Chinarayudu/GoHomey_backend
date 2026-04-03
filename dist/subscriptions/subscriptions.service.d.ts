export declare class SubscriptionsService {
    createPlan(data: any): Promise<any>;
    findAllPlans(): Promise<({
        slots: ({
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
            chef_id: string;
            slots_remaining: number;
            plan_id: string;
            time_slot: string;
            capacity: number;
        })[];
    } & {
        id: string;
        name: string;
        created_at: Date;
        updated_at: Date;
        price: number;
        goal: string;
        description: string;
        menu_json: import("@prisma/client/runtime/client").JsonValue;
    })[]>;
    findOnePlan(id: string): Promise<any>;
    createSlot(chefId: string, data: any): Promise<any>;
    findSlotsByChef(chefId: string): Promise<({
        plan: {
            id: string;
            name: string;
            created_at: Date;
            updated_at: Date;
            price: number;
            goal: string;
            description: string;
            menu_json: import("@prisma/client/runtime/client").JsonValue;
        };
    } & {
        id: string;
        created_at: Date;
        chef_id: string;
        slots_remaining: number;
        plan_id: string;
        time_slot: string;
        capacity: number;
    })[]>;
}
export declare const subscriptionsService: SubscriptionsService;
