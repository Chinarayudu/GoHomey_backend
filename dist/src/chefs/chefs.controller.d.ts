import { ChefsService } from './chefs.service';
export declare class ChefsController {
    private chefsService;
    constructor(chefsService: ChefsService);
    applyToBeChef(bio: string, req: any): Promise<{
        id: string;
        created_at: Date;
        updated_at: Date;
        user_id: string;
        bio: string | null;
        rating: number;
        is_verified: boolean;
        trust_tier: number;
    }>;
    findAll(): Promise<({
        user: {
            name: string;
            id: string;
            phone: string;
            email: string;
            password: string;
            role: import(".prisma/client").$Enums.Role;
            created_at: Date;
            updated_at: Date;
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
    })[]>;
    findOne(id: string): Promise<{
        id: string;
        created_at: Date;
        updated_at: Date;
        user_id: string;
        bio: string | null;
        rating: number;
        is_verified: boolean;
        trust_tier: number;
    } | null>;
    verifyChef(id: string, isVerified: boolean, trustTier: number): Promise<{
        id: string;
        created_at: Date;
        updated_at: Date;
        user_id: string;
        bio: string | null;
        rating: number;
        is_verified: boolean;
        trust_tier: number;
    }>;
}
