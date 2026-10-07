import { prisma } from '../../prisma/prisma.service';

/**
 * Postgres-backed OTP storage (replaces the former Redis `OTP:<phone>` key).
 * One row per phone; saving a new OTP overwrites the previous one.
 */
export const otpStore = {
  async save(phone: string, code: string, ttlSeconds: number): Promise<void> {
    const expires_at = new Date(Date.now() + ttlSeconds * 1000);
    await prisma.otpCode.upsert({
      where: { phone },
      create: { phone, code, expires_at },
      update: { code, expires_at, created_at: new Date() },
    });
  },

  /** Returns the stored OTP, or null if none exists or it has expired. */
  async get(phone: string): Promise<string | null> {
    const row = await prisma.otpCode.findUnique({ where: { phone } });
    if (!row) return null;
    if (row.expires_at.getTime() <= Date.now()) {
      await prisma.otpCode.deleteMany({ where: { phone } });
      return null;
    }
    return row.code;
  },

  async delete(phone: string): Promise<void> {
    await prisma.otpCode.deleteMany({ where: { phone } });
  },
};
