import { UpdateUserDto } from './dto/users.dto';
import { UsersService } from './users.service';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getProfile(req: any): Promise<{
        name: string;
        id: string;
        phone: string;
        email: string;
        password: string;
        role: import("@prisma/client").$Enums.Role;
        created_at: Date;
        updated_at: Date;
    } | null>;
    updateProfile(req: any, updateData: UpdateUserDto): Promise<{
        name: string;
        id: string;
        phone: string;
        email: string;
        password: string;
        role: import("@prisma/client").$Enums.Role;
        created_at: Date;
        updated_at: Date;
    }>;
    findAll(): {
        message: string;
    };
}
