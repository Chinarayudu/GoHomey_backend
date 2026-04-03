import { prisma } from '../prisma/prisma.service';
import { User, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export class UsersService {
  async findOne(where: Prisma.UserWhereUniqueInput): Promise<User | null> {
    return prisma.user.findUnique({
      where,
    });
  }

  async findOneWithChef(where: Prisma.UserWhereUniqueInput): Promise<User | null> {
    return prisma.user.findUnique({
      where,
      include: { chef: true },
    });
  }

  async create(data: any): Promise<User> {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: data.email }, { phone: data.phone }],
      },
    });

    if (existingUser) {
      const error: any = new Error('User with this email or phone already exists');
      error.status = 409;
      throw error;
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    return prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
      },
    });
  }

  async update(params: {
    where: Prisma.UserWhereUniqueInput;
    data: Prisma.UserUpdateInput;
  }): Promise<User> {
    const { where, data } = params;
    return prisma.user.update({
      data,
      where,
    });
  }
}

export const usersService = new UsersService();
