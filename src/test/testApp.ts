import app from '../app';
import { prisma, connectPrisma, disconnectPrisma } from '../prisma/prisma.service';
import { redisClient } from '../common/redis/redis.client';
import { ordersQueue } from '../common/queues/queues';

export { app };

/**
 * All QA-generated test data must be recognizable by this prefix/domain so
 * cleanupQaData() can safely delete it from the shared local dev DB without
 * touching real user data. Never reuse these for anything but automated tests.
 */
export const QA_EMAIL_DOMAIN = 'homey.test';
export const QA_PHONE_PREFIX = '+91700000';

let counter = 0;
function unique(): string {
  counter += 1;
  const random = Math.floor(Math.random() * 1e6).toString().padStart(6, '0');
  return `${Date.now()}${process.pid}${counter}${random}`;
}

export function qaEmail(label = 'qa'): string {
  return `${label}.${unique()}@${QA_EMAIL_DOMAIN}`;
}

/**
 * Phone field has no length/format constraint in the app (RegisterDto only
 * requires a non-empty string), so this is intentionally longer than a real
 * phone number — do NOT truncate the unique suffix, or concurrent/rapid test
 * runs will collide on phone and cascade into spurious 409s (see FINDINGS.md
 * note on this test suite's own history of that bug).
 */
export function qaPhone(): string {
  return `${QA_PHONE_PREFIX}${unique()}`;
}

export async function setupTestDb(): Promise<void> {
  await connectPrisma();
}

export async function cleanupQaData(): Promise<void> {
  await prisma.address.deleteMany({
    where: { user: { email: { endsWith: `@${QA_EMAIL_DOMAIN}` } } },
  });
  await prisma.chef.deleteMany({
    where: {
      OR: [
        { email: { endsWith: `@${QA_EMAIL_DOMAIN}` } },
        { phone: { startsWith: QA_PHONE_PREFIX } },
      ],
    },
  });
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: { endsWith: `@${QA_EMAIL_DOMAIN}` } },
        { phone: { startsWith: QA_PHONE_PREFIX } },
      ],
    },
  });
}

export async function closeConnections(): Promise<void> {
  await disconnectPrisma();
  await redisClient.quit().catch(() => {});
  await ordersQueue.close().catch(() => {});
}
