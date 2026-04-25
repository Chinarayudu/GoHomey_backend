import { calculateDistance } from '../common/utils/location';
import { prisma } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export class PantryService {
  async create(chefId: string, data: any): Promise<any> {
    const chef = await prisma.chef.findUnique({ where: { id: chefId } });
    if (!chef) {
      const error: any = new Error('Chef profile not found');
      error.status = 404;
      throw error;
    }

    return prisma.pantryItem.create({
      data: {
        ...data,
        chef_id: chefId,
      },
    });
  }

  async findAll(query: { category?: string; chefId?: string; latitude?: number; longitude?: number }) {
    const { category, chefId, latitude, longitude } = query;
    const items = await prisma.pantryItem.findMany({
      where: {
        chef_id: chefId,
        category: category,
      },
      include: {
        chef: {
          include: {
            user: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (latitude !== undefined && longitude !== undefined) {
      return items.filter((item) => {
        if (item.chef.latitude && item.chef.longitude) {
          const distance = calculateDistance(
            latitude,
            longitude,
            item.chef.latitude,
            item.chef.longitude
          );
          return distance <= 3;
        }
        return false;
      });
    }

    return items;
  }

  async findOne(id: string): Promise<any> {
    const item = await prisma.pantryItem.findUnique({
      where: { id },
      include: { chef: true },
    });
    if (!item) {
      const error: any = new Error('Pantry item not found');
      error.status = 404;
      throw error;
    }
    return item;
  }

  async update(id: string, chefId: string, data: any): Promise<any> {
    const item = await this.findOne(id);
    if (!item) {
      const error: any = new Error('Pantry item not found');
      error.status = 404;
      throw error;
    }
    if (item.chef_id !== chefId) {
      const error: any = new Error('You can only update your own items');
      error.status = 403;
      throw error;
    }

    return prisma.pantryItem.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, chefId: string): Promise<void> {
    const item = await this.findOne(id);
    if (!item || item.chef_id !== chefId) {
      const error: any = new Error('You can only delete your own items');
      error.status = 403;
      throw error;
    }
    await prisma.pantryItem.delete({ where: { id } });
  }
}

export const pantryService = new PantryService();
