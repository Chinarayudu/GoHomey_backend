import { Role } from '@prisma/client';
import { prisma } from '../src/prisma/prisma.service';

async function checkData() {
  const admin = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
  const user = await prisma.user.findFirst({ where: { role: Role.USER } });
  const chef = await prisma.chef.findFirst({ include: { meals: true } });
  
  const partner = await prisma.deliveryPartner.findFirst({ where: { is_active: true } });
  
  console.log('Admin:', admin?.email);
  console.log('User:', user?.email);
  console.log('Chef:', chef?.email);
  console.log('Meal ID:', chef?.meals[0]?.id);
  console.log('Partner ID:', partner?.id);
}

checkData().finally(() => prisma.$disconnect());
