import * as bcrypt from 'bcrypt';
import { calculateDistance } from '../common/utils/location';

jest.mock('../prisma/prisma.service', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    chef: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    address: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

import { prisma } from '../prisma/prisma.service';
import { usersService } from './users.service';

const mockPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock; findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
  chef: { findUnique: jest.Mock; update: jest.Mock };
  address: { findMany: jest.Mock; updateMany: jest.Mock };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('UsersService.create', () => {
  it('rejects with 409 when a user with the same email or phone already exists', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'existing' });

    await expect(
      usersService.create({ email: 'dup@homey.test', phone: '+919876500020', password: 'pw' }),
    ).rejects.toMatchObject({ status: 409 });
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it('hashes the password with bcrypt before creating the user', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.create.mockImplementation(({ data }) => Promise.resolve({ id: 'new-user', ...data }));

    await usersService.create({
      email: 'new@homey.test',
      phone: '+919876500021',
      password: 'PlainText123!',
      name: 'New User',
    });

    const [callArgs] = mockPrisma.user.create.mock.calls[0];
    expect(callArgs.data.password).not.toBe('PlainText123!');
    const matches = await bcrypt.compare('PlainText123!', callArgs.data.password);
    expect(matches).toBe(true);
  });
});

describe('UsersService.update — password handling', () => {
  // Fixed for FINDINGS.md AC-001: update() now hashes a supplied password
  // before persisting it, same as create().
  it('hashes a newly supplied password before persisting it', async () => {
    let capturedData: any = null;
    mockPrisma.user.update.mockImplementation(({ data }) => {
      capturedData = data;
      return Promise.resolve({ id: 'u1' });
    });

    await usersService.update({
      where: { id: 'u1' },
      data: { password: 'PlainText123!' } as any,
    });

    expect(capturedData.password).not.toBe('PlainText123!');
    expect(capturedData.password).toMatch(/^\$2[aby]\$/);
    const matches = await bcrypt.compare('PlainText123!', capturedData.password);
    expect(matches).toBe(true);
  });

  it('passes non-password fields straight through unmodified', async () => {
    mockPrisma.user.update.mockImplementation(({ data }) => Promise.resolve({ id: 'u1', ...data }));

    const result = await usersService.update({
      where: { id: 'u1' },
      data: { name: 'Updated Name' } as any,
    });

    expect(result.name).toBe('Updated Name');
  });
});

describe('UsersService.resolveAuthenticatedUserId', () => {
  it('rejects with 401 when authUser is missing', async () => {
    await expect(usersService.resolveAuthenticatedUserId(null)).rejects.toMatchObject({ status: 401 });
  });

  it('returns the id directly when a matching User row exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

    const id = await usersService.resolveAuthenticatedUserId({ id: 'user-1' });

    expect(id).toBe('user-1');
  });

  it('falls back to a Chef row already linked via user_id', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.chef.findUnique = jest.fn(); // not used on this path
    (prisma as any).chef.findFirst = jest.fn().mockResolvedValue({
      id: 'chef-1',
      user_id: 'user-2',
      phone: '+919876500022',
      email: 'chef@homey.test',
      password: 'hash',
    });

    const id = await usersService.resolveAuthenticatedUserId({ id: 'chef-1' });

    expect(id).toBe('user-2');
  });

  it('links an unlinked Chef to an existing User found by phone/email', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    (prisma as any).chef.findFirst = jest.fn().mockResolvedValue({
      id: 'chef-2',
      user_id: null,
      phone: '+919876500023',
      email: 'chef2@homey.test',
      password: 'hash',
    });
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'user-3' });
    mockPrisma.chef.update.mockResolvedValue({});

    const id = await usersService.resolveAuthenticatedUserId({ id: 'chef-2' });

    expect(mockPrisma.chef.update).toHaveBeenCalledWith({
      where: { id: 'chef-2' },
      data: { user_id: 'user-3' },
    });
    expect(id).toBe('user-3');
  });

  it('creates and links a new User when an unlinked Chef has no matching User', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    (prisma as any).chef.findFirst = jest.fn().mockResolvedValue({
      id: 'chef-3',
      user_id: null,
      name: 'Chef Three',
      phone: '+919876500024',
      email: 'chef3@homey.test',
      password: 'hash',
      latitude: 1,
      longitude: 1,
    });
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ id: 'user-4' });
    mockPrisma.chef.update.mockResolvedValue({});

    const id = await usersService.resolveAuthenticatedUserId({ id: 'chef-3' });

    expect(mockPrisma.user.create).toHaveBeenCalled();
    expect(mockPrisma.chef.update).toHaveBeenCalledWith({
      where: { id: 'chef-3' },
      data: { user_id: 'user-4' },
    });
    expect(id).toBe('user-4');
  });

  it('rejects with 403 when neither a User nor a Chef row can be found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    (prisma as any).chef.findFirst = jest.fn().mockResolvedValue(null);

    await expect(
      usersService.resolveAuthenticatedUserId({ id: 'nobody', phone: '+919876500025' }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe('UsersService.updateLocation', () => {
  it('syncs the new location to a linked Chef profile', async () => {
    mockPrisma.user.update.mockResolvedValue({ id: 'user-5', latitude: 10, longitude: 20 });
    mockPrisma.chef.findUnique.mockResolvedValue({ id: 'chef-5' });
    mockPrisma.address.findMany.mockResolvedValue([]);

    await usersService.updateLocation('user-5', 10, 20);

    expect(mockPrisma.chef.update).toHaveBeenCalledWith({
      where: { id: 'chef-5' },
      data: { latitude: 10, longitude: 20 },
    });
  });

  it('does not touch the Chef table when the user is not a chef', async () => {
    mockPrisma.user.update.mockResolvedValue({ id: 'user-6', latitude: 10, longitude: 20 });
    mockPrisma.chef.findUnique.mockResolvedValue(null);
    mockPrisma.address.findMany.mockResolvedValue([]);

    await usersService.updateLocation('user-6', 10, 20);

    expect(mockPrisma.chef.update).not.toHaveBeenCalled();
  });

  it('matches a saved address within 100 meters', async () => {
    const baseLat = 12.9716;
    const baseLng = 77.5946;
    // ~55m north — within the 100m match radius.
    const nearbyLat = baseLat + 0.0005;

    expect(calculateDistance(baseLat, baseLng, nearbyLat, baseLng)).toBeLessThanOrEqual(0.1);

    mockPrisma.user.update.mockResolvedValue({ id: 'user-7', latitude: baseLat, longitude: baseLng });
    mockPrisma.chef.findUnique.mockResolvedValue(null);
    mockPrisma.address.findMany.mockResolvedValue([
      { id: 'addr-1', latitude: nearbyLat, longitude: baseLng },
    ]);

    const result = await usersService.updateLocation('user-7', baseLat, baseLng);

    expect(result.matchedAddress?.id).toBe('addr-1');
  });

  it('does not match a saved address beyond 100 meters', async () => {
    const baseLat = 12.9716;
    const baseLng = 77.5946;
    // ~555m north — outside the 100m match radius.
    const farLat = baseLat + 0.005;

    expect(calculateDistance(baseLat, baseLng, farLat, baseLng)).toBeGreaterThan(0.1);

    mockPrisma.user.update.mockResolvedValue({ id: 'user-8', latitude: baseLat, longitude: baseLng });
    mockPrisma.chef.findUnique.mockResolvedValue(null);
    mockPrisma.address.findMany.mockResolvedValue([{ id: 'addr-2', latitude: farLat, longitude: baseLng }]);

    const result = await usersService.updateLocation('user-8', baseLat, baseLng);

    expect(result.matchedAddress).toBeNull();
  });
});
