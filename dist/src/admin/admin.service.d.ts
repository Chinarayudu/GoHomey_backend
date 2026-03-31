import { PrismaService } from '../prisma/prisma.service';
export declare class AdminService {
    private prisma;
    constructor(prisma: PrismaService);
    getPlatformStats(): Promise<{
        users: number;
        chefs: {
            verified: number;
            pending: number;
        };
        orders: number;
        revenue: any;
    }>;
    getTopChefs(): Promise<any[]>;
    getDailyRevenue(days?: number): Promise<{
        created_at: Date;
        amount: number;
    }[]>;
}
