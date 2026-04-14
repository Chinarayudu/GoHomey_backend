import { prisma } from '../src/prisma/prisma.service';

async function main() {
  const id = '28e7bf89-ddac-4727-893a-c0e761b8c38c';
  
  const user = await prisma.user.findUnique({ where: { id } });
  if (user) {
    console.log('Found in User table:', user);
  } else {
    console.log('Not found in User table');
  }

  const chef = await prisma.chef.findUnique({ where: { id } });
  if (chef) {
    console.log('Found in Chef table:', chef);
  } else {
    console.log('Not found in Chef table');
  }

  const chefByUserId = await prisma.chef.findUnique({ where: { user_id: id } });
  if (chefByUserId) {
    console.log('Found in Chef table by user_id:', chefByUserId);
  } else {
    console.log('Not found in Chef table by user_id');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
