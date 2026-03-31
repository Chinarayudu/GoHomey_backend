import { CreatePantryDto, UpdatePantryDto } from './dto/pantry.dto';
import { PantryService } from './pantry.service';
export declare class PantryController {
    private readonly pantryService;
    constructor(pantryService: PantryService);
    create(req: any, createPantryDto: CreatePantryDto): Promise<any>;
    findAll(category?: string, chefId?: string): Promise<({
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
        name: string;
        created_at: Date;
        updated_at: Date;
        chef_id: string;
        price: number;
        category: string;
        inventory: number;
        image_url: string | null;
    })[]>;
    findOne(id: string): Promise<any>;
    update(id: string, req: any, updatePantryDto: UpdatePantryDto): Promise<any>;
    remove(id: string, req: any): Promise<void>;
}
