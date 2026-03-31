import { ChefsService } from './chefs.service';
export declare class ChefsController {
    private chefsService;
    constructor(chefsService: ChefsService);
    applyToBeChef(bio: string, req: any): Promise<{
        id: string;
        created_at: Date;
        updated_at: Date;
        bio: string | null;
        rating: number;
        is_verified: boolean;
        trust_tier: number;
        user_id: string;
    }>;
    findAll(): Promise<({
        user: {
            id: string;
            phone: string;
            email: string;
            name: string;
            password: string;
            role: import("@prisma/client").$Enums.Role;
            created_at: Date;
            updated_at: Date;
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
    })[]>;
    findOne(id: string): Promise<{
        id: string;
        created_at: Date;
        updated_at: Date;
        bio: string | null;
        rating: number;
        is_verified: boolean;
        trust_tier: number;
        user_id: string;
    } | null>;
    verifyChef(id: string, isVerified: boolean, trustTier: number): Promise<{
        id: string;
        created_at: Date;
        updated_at: Date;
        bio: string | null;
        rating: number;
        is_verified: boolean;
        trust_tier: number;
        user_id: string;
    }>;
}
