import { prisma } from '../src/prisma/prisma.service';

async function createPartner() {
  const partner = await prisma.deliveryPartner.create({
    data: {
      name: 'Borzo',
      is_active: true,
      api_key: process.env.BORZO_API_TOKEN || 'mock-key',
      base_url: process.env.BORZO_BASE_URL || 'https://robotapitest-in.borzodelivery.com/api/business/1.6'
    }
  });
  console.log('Created Partner:', partner.id);
}

createPartner().finally(() => prisma.$disconnect());
