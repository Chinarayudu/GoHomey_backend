export declare class PantryService {
    create(chefId: string, data: any): Promise<any>;
    findAll(query: {
        category?: string;
        chefId?: string;
    }): Promise<({
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
    update(id: string, chefId: string, data: any): Promise<any>;
    remove(id: string, chefId: string): Promise<void>;
}
export declare const pantryService: PantryService;
