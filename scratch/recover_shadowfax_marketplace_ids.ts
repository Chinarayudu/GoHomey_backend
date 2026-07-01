import 'dotenv/config';
import { prisma } from '../src/prisma/prisma.service';

const mappings = [
  {
    delivery_id: 'bdeae426-9c89-49db-b5ee-76d690ad4f57',
    shadowfax_order_id: '21044861',
  },
  {
    delivery_id: '086cd6c7-c420-4e62-9ac3-1f1086d87cf7',
    shadowfax_order_id: '21044862',
  },
  {
    delivery_id: 'd9557d4c-67d2-4a0a-88e3-00a67bbcb820',
    shadowfax_order_id: '21044863',
  },
  {
    delivery_id: '588944f9-b7a7-4265-bd89-e43de07ec520',
    shadowfax_order_id: '21044864',
  },
  {
    delivery_id: '7d5222be-60bc-40b1-a844-8f71498dc984',
    shadowfax_order_id: '21044865',
  },
  {
    delivery_id: '6a3b5956-df2c-4102-b3d3-77f4509d86c6',
    shadowfax_order_id: '21044866',
  },
];

async function main() {
  for (const mapping of mappings) {
    await prisma.delivery.update({
      where: { id: mapping.delivery_id },
      data: {
        status: 'ASSIGNED',
        external_tracking_id: mapping.shadowfax_order_id,
        order: {
          update: {
            status: 'OUT_FOR_DELIVERY',
          },
        },
      },
    });
    console.log(
      `Recovered delivery ${mapping.delivery_id} -> Shadowfax ${mapping.shadowfax_order_id}`,
    );
  }
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
