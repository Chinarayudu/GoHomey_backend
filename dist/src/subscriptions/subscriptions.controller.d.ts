import { CreatePlanDto, CreateSlotDto } from './dto/subscriptions.dto';
import { SubscriptionsService } from './subscriptions.service';
export declare class SubscriptionsController {
    private readonly subscriptionsService;
    constructor(subscriptionsService: SubscriptionsService);
    createPlan(createPlanDto: CreatePlanDto): Promise<any>;
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
                user_id: string;
                bio: string | null;
                rating: number;
                is_verified: boolean;
                trust_tier: number;
            };
        } & {
            id: string;
            created_at: Date;
            slots_remaining: number;
            chef_id: string;
            plan_id: string;
            time_slot: string;
            capacity: number;
        })[];
    } & {
        name: string;
        id: string;
        created_at: Date;
        updated_at: Date;
        description: string;
        price: number;
        goal: string;
        menu_json: import("@prisma/client/runtime/client").JsonValue;
    })[]>;
    findOnePlan(id: string): Promise<any>;
    createSlot(req: any, createSlotDto: CreateSlotDto): Promise<any>;
    findSlotsByChef(chefId: string): Promise<({
        plan: {
            name: string;
            id: string;
            created_at: Date;
            updated_at: Date;
            description: string;
            price: number;
            goal: string;
            menu_json: import("@prisma/client/runtime/client").JsonValue;
        };
    } & {
        id: string;
        created_at: Date;
        slots_remaining: number;
        chef_id: string;
        plan_id: string;
        time_slot: string;
        capacity: number;
    })[]>;
}
