import 'dotenv/config';
import { prisma } from '../src/prisma/prisma.service';
import { resolveShadowfaxBaseUrl } from '../src/delivery/shadowfax.client';

async function createPartner() {
  await prisma.deliveryPartner.updateMany({
    where: { name: { equals: 'Borzo', mode: 'insensitive' } },
    data: { is_active: false },
  });

  const baseUrl = resolveShadowfaxBaseUrl();

  const existing = await prisma.deliveryPartner.findFirst({
    where: { name: { equals: 'Shadowfax', mode: 'insensitive' } },
  });

  const data = {
    name: 'Shadowfax',
    is_active: true,
    api_key: process.env.SHADOWFAX_API_TOKEN,
    base_url: baseUrl,
  };

  const partner = existing
    ? await prisma.deliveryPartner.update({ where: { id: existing.id }, data })
    : await prisma.deliveryPartner.create({ data });

  console.log('Shadowfax partner ready:', partner.id);
  console.log('Testing API base URL:', baseUrl);
}

createPartner().finally(() => prisma.$disconnect());
