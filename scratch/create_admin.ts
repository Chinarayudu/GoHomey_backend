import 'dotenv/config';
import bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { prisma, disconnectPrisma } from '../src/prisma/prisma.service';

async function main() {
  const email = 'admin@gohomeyy.com';
  const password = 'AdminPassword123!';
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { email } });

  const admin = existing
    ? await prisma.user.update({
        where: { email },
        data: {
          name: existing.name || 'GoHomeyy Admin',
          password: passwordHash,
          role: Role.ADMIN,
        },
        select: { id: true, email: true, role: true, phone: true, updated_at: true },
      })
    : await prisma.user.create({
        data: {
          name: 'GoHomeyy Admin',
          email,
          phone: '+910000000001',
          password: passwordHash,
          role: Role.ADMIN,
          gender: 'OTHER',
        },
        select: { id: true, email: true, role: true, phone: true, created_at: true },
      });

  console.log(JSON.stringify({ action: existing ? 'updated' : 'created', admin }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
