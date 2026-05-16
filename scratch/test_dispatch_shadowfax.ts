import 'dotenv/config';
import { prisma } from '../src/prisma/prisma.service';
import { deliveryService } from '../src/delivery/delivery.service';
import { resolveShadowfaxBaseUrl } from '../src/delivery/shadowfax.client';

async function main() {
  console.log('SHADOWFAX_API_MODE:', process.env.SHADOWFAX_API_MODE || 'testing');
  console.log('SHADOWFAX_BASE_URL:', resolveShadowfaxBaseUrl());

  await prisma.deliveryPartner.updateMany({
    where: { name: { equals: 'Borzo', mode: 'insensitive' } },
    data: { is_active: false },
  });

  const existing = await prisma.deliveryPartner.findFirst({
    where: { name: { equals: 'Shadowfax', mode: 'insensitive' } },
  });
  if (!existing) {
    await prisma.deliveryPartner.create({
      data: {
        name: 'Shadowfax',
        is_active: true,
        api_key: process.env.SHADOWFAX_API_TOKEN,
        base_url: process.env.SHADOWFAX_BASE_URL,
      },
    });
    console.log('Created Shadowfax partner');
  }

  const ready = await prisma.order.findMany({
    where: { status: 'READY_FOR_PICKUP' },
    select: { id: true, status: true },
    take: 5,
  });
  console.log(`READY_FOR_PICKUP orders: ${ready.length}`, ready.map((o) => o.id));

  const result = await deliveryService.dispatchReadyForPickupToShadowfax(
    ready.length ? ready.map((o) => o.id) : undefined,
  );
  console.log('\nDispatch result:', JSON.stringify(result, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
