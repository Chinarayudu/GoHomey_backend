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

describe('Chef registration <-> User identity linking', () => {
  it('links a new Chef record to the authenticated User on step-1 and upgrades the User role to CHEF', async () => {
    const email = qaEmail('chef');
    const phone = qaPhone();
    await request(app).post('/api/v1/auth/register').send({ name: 'Chef QA', email, phone, password: PASSWORD });
    const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
    const token = loginRes.body.token;

    const step1Res = await request(app)
      .post('/api/v1/chefs/register/step-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ full_name: 'Chef QA', email, mobile_number: phone, primary_cuisine: 'South Indian' });

    expect(step1Res.status).toBe(201);
    expect(step1Res.body.data.registration_step).toBe(1);
    expect(step1Res.body.data.user_id).toBeDefined();

    const profileRes = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(profileRes.body.role).toBe('CHEF');
    expect(profileRes.body.chef).toBeTruthy();

    // A fresh OTP login for the same phone should now resolve through the
    // linked Chef record and report isChef: true.
    await request(app).post('/api/v1/auth/send-otp').send({ phone });
    const verifyRes = await request(app).post('/api/v1/auth/verify-otp').send({ phone, otp: '0000' });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.isChef).toBe(true);
    expect(verifyRes.body.user.role).toBe('CHEF');
  });

  it('rejects chef step-1 registration with missing required fields (400)', async () => {
    const email = qaEmail('chef-bad');
    const phone = qaPhone();
    await request(app).post('/api/v1/auth/register').send({ name: 'Chef Bad', email, phone, password: PASSWORD });
    const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });

    const res = await request(app)
      .post('/api/v1/chefs/register/step-1')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .send({ full_name: 'Chef Bad' });

    expect(res.status).toBe(400);
  });

  it('rejects chef step-2 before step-1 has been completed (400)', async () => {
    const email = qaEmail('chef-step2');
    const phone = qaPhone();
    await request(app).post('/api/v1/auth/register').send({ name: 'Chef Step2', email, phone, password: PASSWORD });
    const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });

    const res = await request(app)
      .post('/api/v1/chefs/register/step-2')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .send({
        kitchen_name: 'QA Kitchen',
        kitchen_address: '1 QA Street',
        latitude: 1,
        longitude: 1,
        max_capacity: 10,
        appliances: ['Oven'],
      });

    expect(res.status).toBe(400);
  });
});
