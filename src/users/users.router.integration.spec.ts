import request from 'supertest';
import { app, setupTestDb, cleanupQaData, closeConnections, qaEmail, qaPhone } from '../test/testApp';

const PASSWORD = 'Str0ngPassw0rd!';

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await cleanupQaData();
  await closeConnections();
});

async function registerAndLogin(label: string) {
  const email = qaEmail(label);
  const phone = qaPhone();
  await request(app).post('/api/v1/auth/register').send({ name: label, email, phone, password: PASSWORD });
  const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
  return {
    email,
    phone,
    token: loginRes.body.token as string,
    userId: loginRes.body.user.id as string,
  };
}

describe('GET/PATCH /api/v1/users/profile', () => {
  it('[SANITY] fetches the authenticated user\'s full profile', async () => {
    const { token, email } = await registerAndLogin('profile-get');

    const res = await request(app).get('/api/v1/users/profile').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email);
    expect(res.body.addresses).toEqual([]);
  });

  it('updates non-sensitive profile fields', async () => {
    const { token } = await registerAndLogin('profile-patch');

    const res = await request(app)
      .patch('/api/v1/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name', dietary_preference: 'VEG' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Name');
    expect(res.body.dietary_preference).toBe('VEG');
  });

  it('changing password via PATCH /users/profile lets you log in with the new password, not the old one (FINDINGS.md AC-001, fixed)', async () => {
    const { token, email } = await registerAndLogin('profile-password');
    const newPassword = 'BrandNewPassw0rd!';

    const patchRes = await request(app)
      .patch('/api/v1/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: newPassword });
    expect(patchRes.status).toBe(200);

    const loginWithNew = await request(app).post('/api/v1/auth/login').send({ email, password: newPassword });
    const loginWithOld = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });

    expect(loginWithNew.status).toBe(200);
    expect(loginWithNew.body.token).toBeDefined();
    expect(loginWithOld.status).toBe(401);
  });
});

describe('Address management', () => {
  it('creates, lists, and default-swaps addresses', async () => {
    const { token } = await registerAndLogin('addr');

    const createRes = await request(app)
      .post('/api/v1/users/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        label: 'Home',
        address_line: '1 QA Street',
        city: 'Bengaluru',
        state: 'KA',
        zip_code: '560001',
        is_default: true,
      });
    expect(createRes.status).toBe(201);
    const firstAddressId = createRes.body.id;

    const secondRes = await request(app)
      .post('/api/v1/users/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        label: 'Work',
        address_line: '2 QA Street',
        city: 'Bengaluru',
        state: 'KA',
        zip_code: '560002',
        is_default: true,
      });
    expect(secondRes.status).toBe(201);
    expect(secondRes.body.is_default).toBe(true);

    const listRes = await request(app).get('/api/v1/users/addresses').set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(2);
    const first = listRes.body.find((a: any) => a.id === firstAddressId);
    expect(first.is_default).toBe(false);

    const deleteRes = await request(app)
      .delete(`/api/v1/users/addresses/${secondRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(204);
  });

  it('does not allow deleting another user\'s address', async () => {
    const userA = await registerAndLogin('addr-a');
    const userB = await registerAndLogin('addr-b');

    const createRes = await request(app)
      .post('/api/v1/users/addresses')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ label: 'Home', address_line: '1 QA Street', city: 'Bengaluru', state: 'KA', zip_code: '560001' });
    expect(createRes.status).toBe(201);

    const deleteRes = await request(app)
      .delete(`/api/v1/users/addresses/${createRes.body.id}`)
      .set('Authorization', `Bearer ${userB.token}`);

    // Fixed for FINDINGS.md AC-008: a cross-user delete now returns a clean 404
    // instead of a raw Prisma P2025 surfaced as a 500.
    expect(deleteRes.status).toBe(404);

    const listRes = await request(app)
      .get('/api/v1/users/addresses')
      .set('Authorization', `Bearer ${userA.token}`);
    expect(listRes.body).toHaveLength(1);
  });
});

describe('PATCH /api/v1/users/location', () => {
  it('updates location and returns matchedAddress when within 100m of a saved address', async () => {
    const { token } = await registerAndLogin('location');
    const lat = 12.9716;
    const lng = 77.5946;

    await request(app)
      .post('/api/v1/users/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        label: 'Home',
        address_line: '1 QA Street',
        city: 'Bengaluru',
        state: 'KA',
        zip_code: '560001',
        latitude: lat,
        longitude: lng,
      });

    // ~33m north — within the 100m match radius.
    const res = await request(app)
      .patch('/api/v1/users/location')
      .set('Authorization', `Bearer ${token}`)
      .send({ latitude: lat + 0.0003, longitude: lng });

    expect(res.status).toBe(200);
    expect(res.body.data.matchedAddress).not.toBeNull();
  });

  it('rejects a request missing latitude/longitude (400)', async () => {
    const { token } = await registerAndLogin('location-missing');

    const res = await request(app)
      .patch('/api/v1/users/location')
      .set('Authorization', `Bearer ${token}`)
      .send({ latitude: 1 });

    expect(res.status).toBe(400);
  });
});
