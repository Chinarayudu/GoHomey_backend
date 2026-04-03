export declare class AdminService {
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
export declare const adminService: AdminService;
