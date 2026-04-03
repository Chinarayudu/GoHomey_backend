export declare class MealsService {
    create(chefId: string, data: any): Promise<any>;
    findAll(query: {
        date?: string;
        chefId?: string;
    }): Promise<({
        chef: {
            user: {
                email: string;
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
        chef_id: string;
        meal_name: string;
        type: string;
        price: number;
        slots_total: number;
        slots_remaining: number;
        date: Date;
    })[]>;
    findOne(id: string): Promise<any>;
    update(id: string, chefId: string, data: any): Promise<any>;
    remove(id: string, chefId: string): Promise<void>;
}
export declare const mealsService: MealsService;
