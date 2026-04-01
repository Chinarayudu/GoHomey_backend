import { PrismaService } from '../prisma/prisma.service';
import { Chef, Prisma } from '@prisma/client';
export declare class ChefsService {
    private prisma;
    constructor(prisma: PrismaService);
    create(userId: string, bio?: string): Promise<Chef>;
    findOne(id: string): Promise<Chef | null>;
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
    verifyChef(id: string, isVerified: boolean, trustTier?: number): Promise<{
        id: string;
        created_at: Date;
        updated_at: Date;
        user_id: string;
        bio: string | null;
        rating: number;
        is_verified: boolean;
        trust_tier: number;
    }>;
    updateChef(id: string, data: Prisma.ChefUpdateInput): Promise<{
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
