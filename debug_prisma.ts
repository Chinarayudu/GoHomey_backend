import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Prisma models:');
  console.log(Object.keys(prisma).filter(key => !key.startsWith('$')));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
