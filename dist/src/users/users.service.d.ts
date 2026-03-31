import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    findOne(where: any): Promise<User | null>;
    findOneWithChef(where: any): Promise<User | null>;
    create(data: any): Promise<User>;
    update(params: {
        where: any;
        data: any;
    }): Promise<User>;
}
