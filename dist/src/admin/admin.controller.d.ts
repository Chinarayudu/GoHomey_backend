import { AdminService } from './admin.service';
export declare class AdminController {
    private readonly adminService;
    constructor(adminService: AdminService);
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
    getDailyRevenue(): Promise<{
        created_at: Date;
        amount: number;
    }[]>;
}
