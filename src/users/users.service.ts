import { calculateDistance } from '../common/utils/location';
import { prisma } from '../prisma/prisma.service';
import { User, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export class UsersService {
  async findOne(where: Prisma.UserWhereUniqueInput): Promise<User | null> {
    return prisma.user.findUnique({
      where,
    });
  }

  async findOneWithChef(where: Prisma.UserWhereUniqueInput): Promise<any> {
    return prisma.user.findUnique({
      where,
      include: {
        chef: true,
        addresses: true,
      },
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

  // Address Management
  async addAddress(userId: string, data: any) {
    if (data.is_default) {
      // Unset other defaults
      await prisma.address.updateMany({
        where: { user_id: userId, is_default: true },
        data: { is_default: false },
      });
    }

    return prisma.address.create({
      data: {
        ...data,
        user_id: userId,
      },
    });
  }

  async findAddresses(userId: string) {
    return prisma.address.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
  }

  async updateAddress(addressId: string, userId: string, data: any) {
    if (data.is_default) {
      await prisma.address.updateMany({
        where: { user_id: userId, is_default: true },
        data: { is_default: false },
      });
    }

    return prisma.address.update({
      where: { id: addressId, user_id: userId },
      data,
    });
  }

  async removeAddress(addressId: string, userId: string) {
    return prisma.address.delete({
      where: { id: addressId, user_id: userId },
    });
  }

  async updateLocation(userId: string, latitude: number, longitude: number) {
    // 1. Update User location
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { latitude, longitude },
    });

    // 2. If user is a chef, sync location to Chef profile
    const chef = await prisma.chef.findUnique({
      where: { user_id: userId },
    });

    if (chef) {
      await prisma.chef.update({
        where: { id: chef.id },
        data: { latitude, longitude },
      });
    }

    // 3. Find if this matches any saved address (within 100 meters)
    const savedAddresses = await prisma.address.findMany({
      where: { user_id: userId },
    });

    let matchedAddress: any = null;
    for (const addr of savedAddresses) {
      if (addr.latitude && addr.longitude) {
        const dist = calculateDistance(latitude, longitude, addr.latitude, addr.longitude);
        if (dist <= 0.1) { // 0.1 km = 100 meters
          matchedAddress = addr;
          break;
        }
      }
    }

    return {
      user: updatedUser,
      matchedAddress: matchedAddress,
    };
  }
}

export const usersService = new UsersService();
