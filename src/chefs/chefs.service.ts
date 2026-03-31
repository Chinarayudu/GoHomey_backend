import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Chef, Prisma, Role } from '@prisma/client';

@Injectable()
export class ChefsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, bio?: string): Promise<Chef> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existingChef = await this.prisma.chef.findFirst({
      where: { user_id: userId },
    });
    if (existingChef) {
      throw new ConflictException('Chef profile already exists for this user');
    }

    // Update user role to CHEF if it's not already
    await this.prisma.user.update({
      where: { id: userId },
      data: { role: Role.CHEF },
    });

    return this.prisma.chef.create({
      data: {
        user_id: userId,
        bio,
        is_verified: false,
        trust_tier: 1,
      },
    });
  }

  async findOne(id: string): Promise<Chef | null> {
    return this.prisma.chef.findUnique({
      where: { id },
      include: { user: true },
    });
  }

  async findAll() {
    return this.prisma.chef.findMany({
      include: { user: true },
    });
  }

  async verifyChef(id: string, isVerified: boolean, trustTier?: number) {
    return this.prisma.chef.update({
      where: { id },
      data: {
        is_verified: isVerified,
        trust_tier: trustTier !== undefined ? trustTier : undefined,
      },
    });
  }

  async updateChef(id: string, data: Prisma.ChefUpdateInput) {
    return this.prisma.chef.update({
      where: { id },
      data,
    });
  }
}
