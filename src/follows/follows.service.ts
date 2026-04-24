import { prisma } from '../prisma/prisma.service';

export class FollowsService {
  async follow(userId: string, chefId: string) {
    return prisma.follow.upsert({
      where: {
        user_id_chef_id: {
          user_id: userId,
          chef_id: chefId,
        },
      },
      update: {},
      create: {
        user_id: userId,
        chef_id: chefId,
      },
    });
  }

  async unfollow(userId: string, chefId: string) {
    return prisma.follow.delete({
      where: {
        user_id_chef_id: {
          user_id: userId,
          chef_id: chefId,
        },
      },
    });
  }

  async findFollowing(userId: string) {
    return prisma.follow.findMany({
      where: { user_id: userId },
      include: {
        chef: {
          select: {
            id: true,
            name: true,
            bio: true,
            rating: true,
            primary_cuisine: true,
            kitchen_name: true,
            kitchen_photo_url: true,
          },
        },
      },
    });
  }

  async isFollowing(userId: string, chefId: string) {
    const follow = await prisma.follow.findUnique({
      where: {
        user_id_chef_id: {
          user_id: userId,
          chef_id: chefId,
        },
      },
    });
    return !!follow;
  }
}

export const followsService = new FollowsService();
