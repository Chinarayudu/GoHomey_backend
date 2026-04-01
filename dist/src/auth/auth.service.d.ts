import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
export declare class AuthService {
    private usersService;
    private jwtService;
    constructor(usersService: UsersService, jwtService: JwtService);
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
}
