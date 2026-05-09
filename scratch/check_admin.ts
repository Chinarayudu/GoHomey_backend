import { Role } from '@prisma/client';
import { prisma } from '../src/prisma/prisma.service';

async function checkAdmin() {
  const admins = await prisma.user.findMany({
    where: { role: Role.ADMIN },
  });
  console.log('Admins:', admins);
  
  if (admins.length === 0) {
    console.log('No admins found. Creating one...');
    // In a real scenario, we'd hash the password, but for testing purposes we just want to see if we can create one
    // Actually, I'll use the existing signup logic or just manual create for test
  }
}

checkAdmin().finally(() => prisma.$disconnect());
