import 'dotenv/config';
import { prisma } from '../src/prisma/prisma.service';

async function createPartner() {
  await prisma.deliveryPartner.updateMany({
    where: { name: { equals: 'Borzo', mode: 'insensitive' } },
    data: { is_active: false },
  });

  const existing = await prisma.deliveryPartner.findFirst({
    where: { name: { equals: 'Shadowfax', mode: 'insensitive' } },
  });

  const data = {
    name: 'Shadowfax',
    is_active: true,
    api_key: process.env.SHADOWFAX_API_TOKEN,
    base_url:
      process.env.SHADOWFAX_BASE_URL || 'https://hlbackend.staging.shadowfax.in',
  };

  const partner = existing
    ? await prisma.deliveryPartner.update({ where: { id: existing.id }, data })
    : await prisma.deliveryPartner.create({ data });

  console.log('Shadowfax partner ready:', partner.id);
}

createPartner().finally(() => prisma.$disconnect());
