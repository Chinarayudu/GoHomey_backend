export declare class AuthService {
    private readonly jwtSecret;
    validateUser(email: string, pass: string): Promise<any>;
    login(user: any): Promise<{
        access_token: string;
        user: {
            id: any;
            name: any;
            email: any;
            role: any;
        };
    }>;
    register(registrationData: any): Promise<{
        name: string;
        id: string;
        phone: string;
        email: string;
        role: import(".prisma/client").$Enums.Role;
        created_at: Date;
        updated_at: Date;
    }>;
    sendOtp(phone: string): Promise<{
        message: string;
    }>;
    verifyOtp(phone: string, otp: string): Promise<{
        isNewUser: boolean;
        phone: string;
        message: string;
    } | {
        access_token: string;
        user: {
            id: any;
            name: any;
            email: any;
            role: any;
        };
        isNewUser: boolean;
        phone?: undefined;
        message?: undefined;
    }>;
}
export declare const authService: AuthService;
