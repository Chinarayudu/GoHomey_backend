import { CreateMealDto, UpdateMealDto } from './dto/meals.dto';
import { MealsService } from './meals.service';
export declare class MealsController {
    private readonly mealsService;
    constructor(mealsService: MealsService);
    create(req: any, createMealDto: CreateMealDto): Promise<any>;
    findAll(date?: string, chefId?: string): Promise<({
        chef: {
            user: {
                name: string;
                email: string;
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
        updated_at: Date;
        type: string;
        meal_name: string;
        price: number;
        slots_total: number;
        slots_remaining: number;
        date: Date;
        chef_id: string;
    })[]>;
    findOne(id: string): Promise<any>;
    update(id: string, req: any, updateMealDto: UpdateMealDto): Promise<any>;
    remove(id: string, req: any): Promise<void>;
}
