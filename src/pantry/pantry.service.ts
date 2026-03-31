import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PantryService {
  constructor(private prisma: PrismaService) {}

  async create(chefId: string, data: any): Promise<any> {
    const chef = await this.prisma.chef.findUnique({ where: { id: chefId } });
    if (!chef) {
      throw new NotFoundException('Chef profile not found');
    }

    return this.prisma.pantryItem.create({
      data: {
        ...data,
        chef_id: chefId,
      },
    });
  }

  async findAll(query: { category?: string; chefId?: string }) {
    const { category, chefId } = query;
    return this.prisma.pantryItem.findMany({
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
  }

  async findOne(id: string): Promise<any> {
    const item = await this.prisma.pantryItem.findUnique({
      where: { id },
      include: { chef: true },
    });
    if (!item) {
      throw new NotFoundException('Pantry item not found');
    }
    return item;
  }

  async update(id: string, chefId: string, data: any): Promise<any> {
    const item = await this.findOne(id);
    if (!item) {
      throw new NotFoundException('Pantry item not found');
    }
    if (item.chef_id !== chefId) {
      throw new ForbiddenException('You can only update your own items');
    }

    return this.prisma.pantryItem.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, chefId: string): Promise<void> {
    const item = await this.findOne(id);
    if (!item || item.chef_id !== chefId) {
      throw new ForbiddenException('You can only delete your own items');
    }
    await this.prisma.pantryItem.delete({ where: { id } });
  }
}
