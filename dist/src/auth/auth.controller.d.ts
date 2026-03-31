import { RegisterDto, LoginDto } from './dto/auth.dto';
import { AuthService } from './auth.service';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    register(registrationData: RegisterDto): Promise<{
        name: string;
        id: string;
        phone: string;
        email: string;
        role: import("@prisma/client").$Enums.Role;
        created_at: Date;
        updated_at: Date;
    }>;
    login(loginData: LoginDto): Promise<{
        access_token: string;
        user: {
            id: any;
            name: any;
            email: any;
            role: any;
        };
    } | {
        message: string;
        statusCode: number;
    }>;
    getProfile(req: any): any;
}
