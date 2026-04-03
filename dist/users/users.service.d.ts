import { User, Prisma } from '@prisma/client';
export declare class UsersService {
    findOne(where: Prisma.UserWhereUniqueInput): Promise<User | null>;
    findOneWithChef(where: Prisma.UserWhereUniqueInput): Promise<User | null>;
    create(data: any): Promise<User>;
    update(params: {
        where: Prisma.UserWhereUniqueInput;
        data: Prisma.UserUpdateInput;
    }): Promise<User>;
}
export declare const usersService: UsersService;
