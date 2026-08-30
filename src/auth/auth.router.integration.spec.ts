import request from 'supertest';
import { app, setupTestDb, cleanupQaData, closeConnections, qaEmail, qaPhone } from '../test/testApp';

/**
 * Integration tests hit the real local Postgres/Redis configured in .env.
 * Run via `npm run test:integration`, which forces OTP_BYPASS_ENABLED=true for
 * this process only, so OTP send/verify is deterministic without a real SMS
 * provider. Every row created here uses the reserved QA email domain/phone
 * prefix from src/test/testApp.ts and is deleted in the afterAll cleanup.
 */

const PASSWORD = 'Str0ngPassw0rd!';

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await cleanupQaData();
  await closeConnections();
});

describe('GET /api/v1/health', () => {
  it('[SANITY] responds 200 with an ok status', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('POST /api/v1/auth/register + POST /api/v1/auth/login', () => {
  it('[SANITY] registers a new user and logs in with the same credentials', async () => {
    const email = qaEmail('register');
    const phone = qaPhone();

    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'QA Register User', email, phone, password: PASSWORD });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.email).toBe(email);
    expect(registerRes.body.password).toBeUndefined();

    const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeDefined();
    expect(loginRes.body.user.email).toBe(email);
  });

  it('rejects registering a duplicate email/phone with 409', async () => {
    const email = qaEmail('dup');
    const phone = qaPhone();
    await request(app).post('/api/v1/auth/register').send({ name: 'Dup', email, phone, password: PASSWORD });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Dup Again', email, phone: qaPhone(), password: PASSWORD });

    expect(res.status).toBe(409);
  });

  it('rejects registration with missing required fields (400)', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: qaEmail('incomplete') });
    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
  });

  it('rejects login with the wrong password (401)', async () => {
    const email = qaEmail('wrongpw');
    const phone = qaPhone();
    await request(app).post('/api/v1/auth/register').send({ name: 'Wrong Pw', email, phone, password: PASSWORD });

    const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'not-the-password' });
    expect(res.status).toBe(401);
  });

  it('rejects login for an unregistered email (401)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: qaEmail('unknown'), password: PASSWORD });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/auth/profile', () => {
  it('[SANITY] returns the decoded JWT payload for a valid Bearer token', async () => {
    const email = qaEmail('profile');
    const phone = qaPhone();
    await request(app).post('/api/v1/auth/register').send({ name: 'Profile', email, phone, password: PASSWORD });
    const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });

    const res = await request(app)
      .get('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${loginRes.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email);
  });

  it('rejects a request with no token (401)', async () => {
    const res = await request(app).get('/api/v1/auth/profile');
    expect(res.status).toBe(401);
  });

  it('rejects a malformed/garbage token (401)', async () => {
    const res = await request(app).get('/api/v1/auth/profile').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/send-otp + POST /api/v1/auth/verify-otp', () => {
  it('[SANITY] sends and verifies an OTP for a brand-new phone (isNewUser: true, temp token)', async () => {
    const phone = qaPhone();

    const sendRes = await request(app).post('/api/v1/auth/send-otp').send({ phone });
    expect(sendRes.status).toBe(200);

    const verifyRes = await request(app).post('/api/v1/auth/verify-otp').send({ phone, otp: '0000' });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.isNewUser).toBe(true);
    expect(verifyRes.body.token).toBeDefined();
  });

  it('returns isNewUser:false and a full login token once the phone belongs to a registered user', async () => {
    const phone = qaPhone();
    const email = qaEmail('otp-existing');
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'OTP Existing', email, phone, password: PASSWORD });

    await request(app).post('/api/v1/auth/send-otp').send({ phone });
    const verifyRes = await request(app).post('/api/v1/auth/verify-otp').send({ phone, otp: '0000' });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.isNewUser).toBe(false);
    expect(verifyRes.body.user.email).toBe(email);
  });

  it('rejects an OTP that fails DTO length validation (400)', async () => {
    const res = await request(app).post('/api/v1/auth/verify-otp').send({ phone: qaPhone(), otp: '12' });
    expect(res.status).toBe(400);
  });
});

describe('Role-gated routes', () => {
  it('denies a USER-role token on an ADMIN-only route (403)', async () => {
    const email = qaEmail('roletest');
    const phone = qaPhone();
    await request(app).post('/api/v1/auth/register').send({ name: 'Role Test', email, phone, password: PASSWORD });
    const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });

    const res = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${loginRes.body.token}`);
    expect(res.status).toBe(403);
  });
});
