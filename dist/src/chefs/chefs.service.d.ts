import { PrismaService } from '../prisma/prisma.service';
import { Chef, Prisma } from '@prisma/client';
export declare class ChefsService {
    private prisma;
    constructor(prisma: PrismaService);
    create(userId: string, bio?: string): Promise<Chef>;
    findOne(id: string): Promise<Chef | null>;
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
    verifyChef(id: string, isVerified: boolean, trustTier?: number): Promise<{
        id: string;
        created_at: Date;
        updated_at: Date;
        bio: string | null;
        rating: number;
        is_verified: boolean;
        trust_tier: number;
        user_id: string;
    }>;
    updateChef(id: string, data: Prisma.ChefUpdateInput): Promise<{
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
