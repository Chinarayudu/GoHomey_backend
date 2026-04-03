import { prisma } from '../prisma/prisma.service';
import { Chef, Prisma, Role, ChefApplicationStatus } from '@prisma/client';

export class ChefsService {

  /**
   * Step 1: Create chef profile with personal info + cuisine
   * Called after OTP verification when user wants to become a chef.
   */
  async registerStep1(userId: string, data: {
    full_name: string;
    email: string;
    mobile_number: string;
    primary_cuisine: string;
  }): Promise<Chef> {
    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      const error: any = new Error('User not found');
      error.status = 404;
      throw error;
    }

    // Check if chef profile already exists
    const existingChef = await prisma.chef.findFirst({
      where: { user_id: userId },
    });

    if (existingChef) {
      // If already exists, update step 1 fields (allow re-editing)
      return prisma.chef.update({
        where: { id: existingChef.id },
        data: {
          primary_cuisine: data.primary_cuisine,
          registration_step: Math.max(existingChef.registration_step, 1),
        },
      });
    }

    // Update user's name, email if provided (they may differ from OTP registration)
    await prisma.user.update({
      where: { id: userId },
      data: {
        name: data.full_name,
        email: data.email,
        phone: data.mobile_number,
        role: Role.CHEF,
      },
    });

    // Create new chef profile
    return prisma.chef.create({
      data: {
        user_id: userId,
        primary_cuisine: data.primary_cuisine,
        is_verified: false,
        trust_tier: 1,
        application_status: ChefApplicationStatus.DRAFT,
        registration_step: 1,
      },
    });
  }

  /**
   * Step 2: Kitchen space details
   */
  async registerStep2(userId: string, data: {
    kitchen_name: string;
    kitchen_address: string;
    latitude: number;
    longitude: number;
    max_capacity: number;
    appliances: string[];
  }): Promise<Chef> {
    const chef = await prisma.chef.findFirst({
      where: { user_id: userId },
    });

    if (!chef) {
      const error: any = new Error('Chef profile not found. Complete Step 1 first.');
      error.status = 400;
      throw error;
    }

    return prisma.chef.update({
      where: { id: chef.id },
      data: {
        kitchen_name: data.kitchen_name,
        kitchen_address: data.kitchen_address,
        latitude: data.latitude,
        longitude: data.longitude,
        max_capacity: data.max_capacity,
        appliances: data.appliances,
        registration_step: Math.max(chef.registration_step, 2),
      },
    });
  }

  /**
   * Step 3: Document uploads (Government ID, Food Safety Cert, Kitchen Photo)
   * After this step, the application status changes to PENDING_REVIEW
   */
  async registerStep3(userId: string, files: {
    government_id_url?: string;
    food_safety_cert_url?: string;
    kitchen_photo_url?: string;
  }): Promise<Chef> {
    const chef = await prisma.chef.findFirst({
      where: { user_id: userId },
    });

    if (!chef) {
      const error: any = new Error('Chef profile not found. Complete Step 1 first.');
      error.status = 400;
      throw error;
    }

    if (chef.registration_step < 2) {
      const error: any = new Error('Please complete Step 2 (Kitchen Space) first.');
      error.status = 400;
      throw error;
    }

    return prisma.chef.update({
      where: { id: chef.id },
      data: {
        government_id_url: files.government_id_url || chef.government_id_url,
        food_safety_cert_url: files.food_safety_cert_url || chef.food_safety_cert_url,
        kitchen_photo_url: files.kitchen_photo_url || chef.kitchen_photo_url,
        registration_step: 3,
        application_status: ChefApplicationStatus.PENDING_REVIEW,
      },
    });
  }

  /**
   * Get the current registration status / progress for a user
   */
  async getRegistrationStatus(userId: string) {
    const chef = await prisma.chef.findFirst({
      where: { user_id: userId },
      include: { user: true },
    });

    if (!chef) {
      return {
        registered: false,
        current_step: 0,
        application_status: null,
      };
    }

    return {
      registered: true,
      current_step: chef.registration_step,
      application_status: chef.application_status,
      chef_id: chef.id,
      data: {
        // Step 1
        primary_cuisine: chef.primary_cuisine,
        // Step 2
        kitchen_name: chef.kitchen_name,
        kitchen_address: chef.kitchen_address,
        latitude: chef.latitude,
        longitude: chef.longitude,
        max_capacity: chef.max_capacity,
        appliances: chef.appliances,
        // Step 3
        government_id_url: chef.government_id_url,
        food_safety_cert_url: chef.food_safety_cert_url,
        kitchen_photo_url: chef.kitchen_photo_url,
      },
    };
  }

  async findOne(id: string): Promise<Chef | null> {
    return prisma.chef.findUnique({
      where: { id },
      include: { user: true },
    });
  }

  async findAll() {
    return prisma.chef.findMany({
      include: { user: true },
    });
  }

  async verifyChef(id: string, isVerified: boolean, trustTier?: number) {
    return prisma.chef.update({
      where: { id },
      data: {
        is_verified: isVerified,
        trust_tier: trustTier !== undefined ? trustTier : undefined,
        application_status: isVerified
          ? ChefApplicationStatus.APPROVED
          : ChefApplicationStatus.REJECTED,
      },
    });
  }

  async updateApplicationStatus(id: string, status: ChefApplicationStatus) {
    return prisma.chef.update({
      where: { id },
      data: { application_status: status },
    });
  }

  async updateChef(id: string, data: Prisma.ChefUpdateInput) {
    return prisma.chef.update({
      where: { id },
      data,
    });
  }
}

export const chefsService = new ChefsService();
