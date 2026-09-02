import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';

jest.mock('../common/redis/redis.client', () => ({
  redisClient: {
    setex: jest.fn().mockResolvedValue('OK'),
    get: jest.fn(),
    del: jest.fn().mockResolvedValue(1),
  },
}));

jest.mock('../prisma/prisma.service', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    chef: {
      update: jest.fn(),
    },
  },
}));

jest.mock('../chefs/chefs.service', () => ({
  chefsService: {
    findByPhone: jest.fn(),
  },
}));

jest.mock('../users/users.service', () => ({
  usersService: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

// auth.service.ts imports this for verifyFirebaseToken(); the real module pulls in
// firebase-admin -> jose/jwks-rsa (ESM), which Jest's default CJS transform can't parse.
jest.mock('../common/services/firebase.service', () => ({
  verifyFirebasePhoneToken: jest.fn(),
}));

import { redisClient } from '../common/redis/redis.client';
import { prisma } from '../prisma/prisma.service';
import { chefsService } from '../chefs/chefs.service';
import { usersService } from '../users/users.service';
import { AuthService, authService as defaultAuthService } from './auth.service';

const mockRedis = redisClient as unknown as {
  setex: jest.Mock;
  get: jest.Mock;
  del: jest.Mock;
};
const mockPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock; findFirst: jest.Mock; update: jest.Mock; create: jest.Mock };
  chef: { update: jest.Mock };
};
const mockChefsService = chefsService as unknown as { findByPhone: jest.Mock };
const mockUsersService = usersService as unknown as {
  findOne: jest.Mock;
  create: jest.Mock;
};

const ORIGINAL_ENV = { ...process.env };

/**
 * OTP_BYPASS_ENABLED / REVIEW_TEST_PHONE / REVIEW_TEST_OTP are read once as
 * class-field initializers when `new AuthService()` runs (auth.service.ts:73-84).
 * MSG91_AUTH_KEY / MSG91_TEMPLATE_ID, by contrast, are read live inside
 * sendOtp() on every call. So env overrides must stay in place for the whole
 * test, not just at construction time — restoration happens in afterEach.
 * The fresh instance still shares the same mocked redisClient/prisma/
 * chefsService/usersService singletons as `defaultAuthService` since those
 * are only imported once at module scope.
 */
function loadAuthServiceWithEnv(overrides: Record<string, string | undefined>): AuthService {
  for (const key of Object.keys(overrides)) {
    const value = overrides[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  return new AuthService();
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('AuthService.sendOtp', () => {
  it('generates and stores a 6-digit OTP via Redis when no bypass/provider is configured', async () => {
    const result = await defaultAuthService.sendOtp('+919876500001');

    expect(result).toEqual({ message: 'OTP sent successfully' });
    expect(mockRedis.setex).toHaveBeenCalledTimes(1);
    const [key, ttl, otp] = mockRedis.setex.mock.calls[0];
    expect(key).toBe('OTP:+919876500001');
    expect(ttl).toBe(300);
    expect(otp).toMatch(/^\d{6}$/);
  });

  it('short-circuits and does not touch Redis when OTP_BYPASS_ENABLED=true', async () => {
    const bypassService = loadAuthServiceWithEnv({ OTP_BYPASS_ENABLED: 'true' });

    const result = await bypassService.sendOtp('+919876500002');

    expect(result).toEqual({ message: 'OTP sent successfully' });
    expect(mockRedis.setex).not.toHaveBeenCalled();
  });

  it('stores the fixed REVIEW_TEST_OTP for the configured REVIEW_TEST_PHONE without calling a provider', async () => {
    const reviewService = loadAuthServiceWithEnv({
      REVIEW_TEST_PHONE: '+910000000000',
      REVIEW_TEST_OTP: '112233',
    });
    const fetchSpy = jest.spyOn(global, 'fetch');

    const result = await reviewService.sendOtp('+910000000000');

    expect(result).toEqual({ message: 'OTP sent successfully' });
    expect(mockRedis.setex).toHaveBeenCalledWith('OTP:+910000000000', 300, '112233');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('calls MSG91 when credentials are configured and stores the OTP only after MSG91 accepts', async () => {
    const msg91Service = loadAuthServiceWithEnv({
      MSG91_AUTH_KEY: 'test-auth-key',
      MSG91_TEMPLATE_ID: 'test-template-id',
    });
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, json: async () => ({ request_id: 'req-123' }) } as any);

    const result = await msg91Service.sendOtp('+919876500003');

    expect(result).toEqual({ message: 'OTP sent successfully' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://control.msg91.com/api/v5/flow/');
    expect((options as any).headers.authkey).toBe('test-auth-key');
    const body = JSON.parse((options as any).body);
    expect(body.template_id).toBe('test-template-id');
    expect(body.recipients[0].mobiles).toBe('919876500003');
    expect(mockRedis.setex).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });

  it('throws a 502 and never stores an OTP when MSG91 responds with an error', async () => {
    const msg91Service = loadAuthServiceWithEnv({
      MSG91_AUTH_KEY: 'test-auth-key',
      MSG91_TEMPLATE_ID: 'test-template-id',
    });
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({ type: 'error', message: 'Invalid template' }),
    } as any);

    await expect(msg91Service.sendOtp('+919876500004')).rejects.toMatchObject({
      status: 502,
    });
    expect(mockRedis.setex).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('AuthService.verifyOtp', () => {
  it('rejects with 400 when Redis has no OTP stored for the phone', async () => {
    mockRedis.get.mockResolvedValue(null);

    await expect(defaultAuthService.verifyOtp('+919876500005', '123456')).rejects.toMatchObject({
      status: 400,
      message: 'Invalid or expired OTP',
    });
  });

  it('rejects with 400 when the supplied OTP does not match the stored one', async () => {
    mockRedis.get.mockResolvedValue('654321');

    await expect(defaultAuthService.verifyOtp('+919876500005', '123456')).rejects.toMatchObject({
      status: 400,
    });
  });

  it('deletes the OTP and resolves identity on a correct match', async () => {
    mockRedis.get.mockResolvedValue('123456');
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockChefsService.findByPhone.mockResolvedValue(null);

    const result: any = await defaultAuthService.verifyOtp('+919876500006', '123456');

    expect(mockRedis.del).toHaveBeenCalledWith('OTP:+919876500006');
    expect(result.isNewUser).toBe(true);
  });

  it('accepts any OTP without touching Redis when OTP_BYPASS_ENABLED=true', async () => {
    const bypassService = loadAuthServiceWithEnv({ OTP_BYPASS_ENABLED: 'true' });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockChefsService.findByPhone.mockResolvedValue(null);

    const result = await bypassService.verifyOtp('+919876500007', 'anything');

    expect(result.isNewUser).toBe(true);
    expect(mockRedis.get).not.toHaveBeenCalled();
  });

  it('requires an exact match for the reviewer phone/OTP pair, independent of Redis', async () => {
    const reviewService = loadAuthServiceWithEnv({
      REVIEW_TEST_PHONE: '+910000000000',
      REVIEW_TEST_OTP: '112233',
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockChefsService.findByPhone.mockResolvedValue(null);

    const result = await reviewService.verifyOtp('+910000000000', '112233');

    expect(result.isNewUser).toBe(true);
    expect(mockRedis.get).not.toHaveBeenCalled();
  });

  it('falls back to the normal Redis-backed flow when the reviewer phone is given the wrong OTP', async () => {
    const reviewService = loadAuthServiceWithEnv({
      REVIEW_TEST_PHONE: '+910000000000',
      REVIEW_TEST_OTP: '112233',
    });
    mockRedis.get.mockResolvedValue(null);

    await expect(reviewService.verifyOtp('+910000000000', '999999')).rejects.toMatchObject({
      status: 400,
    });
    expect(mockRedis.get).toHaveBeenCalled();
  });
});

describe('AuthService identity resolution (via verifyOtp)', () => {
  const phone = '+919876500010';

  beforeEach(() => {
    mockRedis.get.mockResolvedValue('123456');
  });

  it('issues a short-lived (24h) temp registration token for a brand-new phone', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockChefsService.findByPhone.mockResolvedValue(null);

    const result: any = await defaultAuthService.verifyOtp(phone, '123456');

    expect(result.isNewUser).toBe(true);
    expect(result.phone).toBe(phone);
    const decoded = jwt.verify(result.token, process.env.JWT_SECRET as string) as any;
    expect(decoded.isRegistrationPending).toBe(true);
    expect(decoded.role).toBe('USER');
    expect(decoded.exp).toBeDefined();
    // ~24h window (allow scheduling slack)
    expect(decoded.exp - decoded.iat).toBeGreaterThanOrEqual(23 * 3600);
    expect(decoded.exp - decoded.iat).toBeLessThanOrEqual(25 * 3600);
  });

  it('logs in an existing User already linked to a Chef', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'linked@homey.test',
      phone,
      role: 'CHEF',
      password: 'hashed',
      latitude: 1,
      longitude: 1,
      chef: { id: 'chef-1', registration_step: 3, application_status: 'APPROVED' },
    });

    const result: any = await defaultAuthService.verifyOtp(phone, '123456');

    expect(result.isNewUser).toBe(false);
    expect(result.isChef).toBe(true);
    expect(result.registrationStep).toBe(3);
    expect(result.applicationStatus).toBe('APPROVED');
    expect(result.token).toBeDefined();
  });

  it('repairs a linked Chef whose User.role drifted to USER (issues a CHEF token)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1b',
      email: 'drifted@homey.test',
      phone,
      role: 'USER', // inconsistent: linked chef but role never upgraded
      password: 'hashed',
      latitude: 1,
      longitude: 1,
      chef: { id: 'chef-1b', registration_step: 3, application_status: 'APPROVED' },
    });
    mockPrisma.user.update.mockResolvedValue({
      id: 'user-1b',
      email: 'drifted@homey.test',
      phone,
      role: 'CHEF',
      password: 'hashed',
      latitude: 1,
      longitude: 1,
    });

    const result: any = await defaultAuthService.verifyOtp(phone, '123456');

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1b' },
      data: { role: 'CHEF' },
    });
    expect(result.isChef).toBe(true);
    const decoded = jwt.verify(result.token, process.env.JWT_SECRET as string) as any;
    expect(decoded.role).toBe('CHEF');
  });

  it('links an unlinked Chef record found by phone and upgrades the User role to CHEF', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-2',
      email: 'unlinked@homey.test',
      phone,
      role: 'USER',
      password: 'hashed',
      latitude: null,
      longitude: null,
      chef: null,
    });
    mockChefsService.findByPhone.mockResolvedValue({
      id: 'chef-2',
      registration_step: 1,
      application_status: 'DRAFT',
    });
    mockPrisma.chef.update.mockResolvedValue({});
    mockPrisma.user.update.mockResolvedValue({
      id: 'user-2',
      email: 'unlinked@homey.test',
      phone,
      role: 'CHEF',
      password: 'hashed',
      latitude: null,
      longitude: null,
    });

    const result: any = await defaultAuthService.verifyOtp(phone, '123456');

    expect(mockPrisma.chef.update).toHaveBeenCalledWith({
      where: { id: 'chef-2' },
      data: { user_id: 'user-2' },
    });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: { role: 'CHEF' },
    });
    expect(result.isChef).toBe(true);
  });

  it('creates and links a new User when only a standalone Chef record exists for the phone', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockChefsService.findByPhone.mockResolvedValue({
      id: 'chef-3',
      name: 'Standalone Chef',
      phone,
      email: 'standalone@homey.test',
      password: 'placeholder-hash',
      latitude: 10,
      longitude: 20,
      registration_step: 3,
      application_status: 'PENDING_REVIEW',
    });
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'user-3',
      email: 'standalone@homey.test',
      phone,
      role: 'CHEF',
      password: 'placeholder-hash',
      latitude: 10,
      longitude: 20,
    });
    mockPrisma.chef.update.mockResolvedValue({});

    const result: any = await defaultAuthService.verifyOtp(phone, '123456');

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ phone, email: 'standalone@homey.test', role: 'CHEF' }),
    });
    expect(mockPrisma.chef.update).toHaveBeenCalledWith({
      where: { id: 'chef-3' },
      data: { user_id: 'user-3' },
    });
    expect(result.isChef).toBe(true);
    expect(result.isNewUser).toBe(false);
  });
});

describe('AuthService.login', () => {
  it('signs a JWT with no expiry (finding: sessions never expire, see FINDINGS.md AC-004)', async () => {
    const user = {
      id: 'user-4',
      name: 'No Expiry',
      email: 'noexpiry@homey.test',
      phone: '+919876500011',
      role: 'USER',
      latitude: 1,
      longitude: 2,
    };

    const result = await defaultAuthService.login(user);

    const decoded = jwt.verify(result.token, process.env.JWT_SECRET as string) as any;
    expect(decoded.sub).toBe(user.id);
    expect(decoded.exp).toBeUndefined();
    expect(result.user).toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      latitude: user.latitude,
      longitude: user.longitude,
    });
  });
});

describe('AuthService.register', () => {
  it('returns a full non-expiring session token alongside the user', async () => {
    mockUsersService.create.mockResolvedValue({
      id: 'user-9',
      name: 'Fresh Signup',
      email: 'fresh@homey.test',
      phone: '+919876500020',
      role: 'USER',
      password: 'hashed',
      latitude: null,
      longitude: null,
    });

    const result: any = await defaultAuthService.register({
      name: 'Fresh Signup',
      email: 'fresh@homey.test',
      phone: '+919876500020',
      password: 'secret123',
    });

    expect(result.password).toBeUndefined();
    expect(result.token).toBeDefined();
    const decoded = jwt.verify(result.token, process.env.JWT_SECRET as string) as any;
    expect(decoded.sub).toBe('user-9');
    expect(decoded.exp).toBeUndefined();
    expect(decoded.isRegistrationPending).toBeUndefined();
  });
});

describe('AuthService.refreshSession', () => {
  it('upgrades to a full session once the phone belongs to a registered user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-10',
      name: 'Now Registered',
      email: 'now@homey.test',
      phone: '+919876500021',
      role: 'USER',
      latitude: 1,
      longitude: 2,
      chef: null,
    });
    mockChefsService.findByPhone.mockResolvedValue(null);

    const result: any = await defaultAuthService.refreshSession({
      phone: '+919876500021',
    });

    expect(result.isNewUser).toBe(false);
    const decoded = jwt.verify(result.token, process.env.JWT_SECRET as string) as any;
    expect(decoded.sub).toBe('user-10');
    expect(decoded.exp).toBeUndefined();
  });

  it('still returns isNewUser:true with a temp token when registration is incomplete', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockChefsService.findByPhone.mockResolvedValue(null);

    const result: any = await defaultAuthService.refreshSession({
      phone: '+919876500022',
    });

    expect(result.isNewUser).toBe(true);
    const decoded = jwt.verify(result.token, process.env.JWT_SECRET as string) as any;
    expect(decoded.isRegistrationPending).toBe(true);
    expect(decoded.exp).toBeDefined();
  });

  it('rejects a token that carries neither phone nor a resolvable id', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      defaultAuthService.refreshSession({ id: 'ghost' }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('AuthService.validateUser', () => {
  it('returns the user without password on a correct password match', async () => {
    const hashed = await bcrypt.hash('correct-password', 10);
    mockUsersService.findOne.mockResolvedValue({
      id: 'user-5',
      email: 'valid@homey.test',
      password: hashed,
      role: 'USER',
    });

    const result = await defaultAuthService.validateUser('valid@homey.test', 'correct-password');

    expect(result).not.toBeNull();
    expect(result.password).toBeUndefined();
    expect(result.id).toBe('user-5');
  });

  it('returns null on an incorrect password', async () => {
    const hashed = await bcrypt.hash('correct-password', 10);
    mockUsersService.findOne.mockResolvedValue({
      id: 'user-5',
      email: 'valid@homey.test',
      password: hashed,
      role: 'USER',
    });

    const result = await defaultAuthService.validateUser('valid@homey.test', 'wrong-password');

    expect(result).toBeNull();
  });

  it('returns null when no user is found for the email', async () => {
    mockUsersService.findOne.mockResolvedValue(null);

    const result = await defaultAuthService.validateUser('missing@homey.test', 'anything');

    expect(result).toBeNull();
  });
});
