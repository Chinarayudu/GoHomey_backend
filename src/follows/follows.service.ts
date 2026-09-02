import { prisma } from '../prisma/prisma.service';

function createHttpError(message: string, status: number) {
  const error: any = new Error(message);
  error.status = status;
  return error;
}

export class FollowsService {
  async resolveFollowerUserId(authUser: any) {
    if (!authUser) {
      throw createHttpError('Unauthorized', 401);
    }

    if (authUser.id) {
      const user = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: { id: true },
      });

      if (user) {
        return user.id;
      }
    }

    const chef = await prisma.chef.findFirst({
      where: {
        OR: [
          ...(authUser.id ? [{ id: authUser.id }, { user_id: authUser.id }] : []),
          ...(authUser.phone ? [{ phone: authUser.phone }] : []),
        ],
      },
      select: { user_id: true },
    });

    if (chef?.user_id) {
      return chef.user_id;
    }

    throw createHttpError(
      'User profile not found for this token. Please login/register as a user before following chefs.',
      403,
    );
  }

  async follow(userId: string, chefId: string) {
    const [user, chef] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
      prisma.chef.findUnique({ where: { id: chefId }, select: { id: true } }),
    ]);

    if (!user) {
      throw createHttpError('User profile not found', 404);
    }

    if (!chef) {
      throw createHttpError('Chef not found', 404);
    }

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
    await prisma.follow.deleteMany({
      where: {
        user_id: userId,
        chef_id: chefId,
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
            food_safety_cert_url: true,
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
