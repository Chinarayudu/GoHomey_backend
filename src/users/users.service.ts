import { calculateDistance } from '../common/utils/location';
import { prisma } from '../prisma/prisma.service';
import { User, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const safeUserSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  role: true,
  gender: true,
  created_at: true,
  updated_at: true,
  dietary_preference: true,
  fitness_goals: true,
  latitude: true,
  longitude: true,
};

const safeChefSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  role: true,
  bio: true,
  rating: true,
  is_verified: true,
  trust_tier: true,
  created_at: true,
  updated_at: true,
  primary_cuisine: true,
  kitchen_name: true,
  kitchen_address: true,
  latitude: true,
  longitude: true,
  max_capacity: true,
  max_concurrent_slots_per_hour: true,
  appliances: true,
  government_id_url: true,
  food_safety_cert_url: true,
  kitchen_photo_url: true,
  bank_name: true,
  bank_account_number: true,
  ifsc_code: true,
  application_status: true,
  registration_step: true,
  user_id: true,
};

const safeAddressSelect = {
  id: true,
  user_id: true,
  label: true,
  address_line: true,
  city: true,
  state: true,
  zip_code: true,
  latitude: true,
  longitude: true,
  is_default: true,
  created_at: true,
  updated_at: true,
};

export class UsersService {
  async findOne(where: Prisma.UserWhereUniqueInput): Promise<User | null> {
    return prisma.user.findUnique({
      where,
    });
  }

  async findOneWithChef(where: Prisma.UserWhereUniqueInput): Promise<any> {
    return prisma.user.findUnique({
      where,
      select: {
        ...safeUserSelect,
        chef: {
          select: safeChefSelect,
        },
        addresses: {
          select: safeAddressSelect,
          orderBy: { created_at: 'desc' },
        },
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
      const error: any = new Error(
        'User with this email or phone already exists',
      );
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
  }): Promise<any> {
    const { where, data } = params;
    return prisma.user.update({
      data,
      where,
      select: safeUserSelect,
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

    const existingAddress = await prisma.address.findFirst({
      where: {
        user_id: userId,
        label: data.label,
        address_line: data.address_line,
        city: data.city,
        state: data.state,
        zip_code: data.zip_code,
      },
    });

    if (existingAddress) {
      if (data.is_default && !existingAddress.is_default) {
        return prisma.address.update({
          where: { id: existingAddress.id },
          data: { is_default: true },
        });
      }

      return existingAddress;
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
        const dist = calculateDistance(
          latitude,
          longitude,
          addr.latitude,
          addr.longitude,
        );
        if (dist <= 0.1) {
          // 0.1 km = 100 meters
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
