jest.mock('../../prisma/prisma.service', () => ({
  prisma: {
    otpCode: {
      upsert: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  },
}));

import { prisma } from '../../prisma/prisma.service';
import { otpStore } from './otp.store';

const mockOtpCode = (prisma as unknown as {
  otpCode: { upsert: jest.Mock; findUnique: jest.Mock; deleteMany: jest.Mock };
}).otpCode;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('otpStore', () => {
  it('upserts the OTP with an expiry ttlSeconds in the future', async () => {
    const before = Date.now();
    await otpStore.save('+919876500001', '123456', 300);

    expect(mockOtpCode.upsert).toHaveBeenCalledTimes(1);
    const arg = mockOtpCode.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ phone: '+919876500001' });
    expect(arg.create).toMatchObject({ phone: '+919876500001', code: '123456' });
    expect(arg.update).toMatchObject({ code: '123456' });
    const expiresMs = arg.create.expires_at.getTime();
    expect(expiresMs).toBeGreaterThanOrEqual(before + 300_000);
    expect(expiresMs).toBeLessThanOrEqual(Date.now() + 300_000);
  });

  it('returns the code when a non-expired OTP exists', async () => {
    mockOtpCode.findUnique.mockResolvedValue({
      phone: '+919876500001',
      code: '654321',
      expires_at: new Date(Date.now() + 60_000),
    });

    await expect(otpStore.get('+919876500001')).resolves.toBe('654321');
    expect(mockOtpCode.deleteMany).not.toHaveBeenCalled();
  });

  it('returns null when no OTP exists', async () => {
    mockOtpCode.findUnique.mockResolvedValue(null);

    await expect(otpStore.get('+919876500001')).resolves.toBeNull();
  });

  it('returns null and deletes the row when the OTP has expired', async () => {
    mockOtpCode.findUnique.mockResolvedValue({
      phone: '+919876500001',
      code: '654321',
      expires_at: new Date(Date.now() - 1_000),
    });

    await expect(otpStore.get('+919876500001')).resolves.toBeNull();
    expect(mockOtpCode.deleteMany).toHaveBeenCalledWith({ where: { phone: '+919876500001' } });
  });

  it('delete removes the OTP for the phone', async () => {
    await otpStore.delete('+919876500001');

    expect(mockOtpCode.deleteMany).toHaveBeenCalledWith({ where: { phone: '+919876500001' } });
  });
});
