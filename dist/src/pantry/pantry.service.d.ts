import { PrismaService } from '../prisma/prisma.service';
export declare class PantryService {
    private prisma;
    constructor(prisma: PrismaService);
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
            user_id: string;
            bio: string | null;
            rating: number;
            is_verified: boolean;
            trust_tier: number;
        };
    } & {
        name: string;
        id: string;
        created_at: Date;
        updated_at: Date;
        price: number;
        chef_id: string;
        category: string;
        inventory: number;
        image_url: string | null;
    })[]>;
    findOne(id: string): Promise<any>;
    update(id: string, chefId: string, data: any): Promise<any>;
    remove(id: string, chefId: string): Promise<void>;
}
