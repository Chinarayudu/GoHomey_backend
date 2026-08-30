import request from 'supertest';
import jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { Role, OrderType } from '@prisma/client';
import { app, setupTestDb, cleanupQaData, closeConnections, qaEmail, qaPhone } from '../test/testApp';
import { prisma } from '../prisma/prisma.service';
import { JWT_SECRET } from '../config/env';

/**
 * Focused authz test for FINDINGS.md: PATCH /orders/:id/status previously had
 * no ownership check, letting any CHEF-role token update any order's status
 * (including triggering a chef payout release on DELIVERED). Fixtures are
 * created directly via Prisma + a hand-signed JWT (same payload shape as
 * AuthService.login()) rather than the full OTP/chef-onboarding flow, to keep
 * this focused on the authorization check itself.
 */

const createdOrderIds: string[] = [];

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  if (createdOrderIds.length > 0) {
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
  }
  await cleanupQaData();
  await closeConnections();
});

function signToken(payload: { sub: string; email: string; phone: string; role: string }) {
  return jwt.sign(payload, JWT_SECRET);
}

async function createQaChef(label: string) {
  const hashed = await bcrypt.hash('unused-password', 10);
  const chef = await prisma.chef.create({
    data: {
      name: label,
      email: qaEmail(label),
      phone: qaPhone(),
      password: hashed,
      role: Role.CHEF,
    },
  });
  const token = signToken({ sub: chef.id, email: chef.email, phone: chef.phone, role: Role.CHEF });
  return { chef, token };
}

async function createQaUser(label: string, role: Role = Role.USER) {
  const hashed = await bcrypt.hash('unused-password', 10);
  const user = await prisma.user.create({
    data: {
      name: label,
      email: qaEmail(label),
      phone: qaPhone(),
      password: hashed,
      role,
    },
  });
  const token = signToken({ sub: user.id, email: user.email, phone: user.phone, role });
  return { user, token };
}

async function createQaOrder(chefId: string, userId: string) {
  const order = await prisma.order.create({
    data: {
      user_id: userId,
      chef_id: chefId,
      order_type: OrderType.DAILY_MEAL,
      status: 'PENDING',
      total_price: 100,
    },
  });
  createdOrderIds.push(order.id);
  return order;
}

describe('PATCH /api/v1/orders/:id/status — ownership', () => {
  it('returns 403 when a chef tries to update another chef\'s order', async () => {
    const chefA = await createQaChef('order-chef-a');
    const chefB = await createQaChef('order-chef-b');
    const customer = await createQaUser('order-cust-1');
    const order = await createQaOrder(chefA.chef.id, customer.user.id);

    const res = await request(app)
      .patch(`/api/v1/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${chefB.token}`)
      .send({ status: 'CONFIRMED' });

    expect(res.status).toBe(403);

    const unchanged = await prisma.order.findUnique({ where: { id: order.id } });
    expect(unchanged?.status).toBe('PENDING');
  });

  it('allows a chef to update their own order status', async () => {
    const chef = await createQaChef('order-chef-own');
    const customer = await createQaUser('order-cust-2');
    const order = await createQaOrder(chef.chef.id, customer.user.id);

    const res = await request(app)
      .patch(`/api/v1/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${chef.token}`)
      .send({ status: 'CONFIRMED' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CONFIRMED');
  });

  it('allows an admin to update any order status regardless of ownership', async () => {
    const chef = await createQaChef('order-chef-admin-target');
    const customer = await createQaUser('order-cust-3');
    const order = await createQaOrder(chef.chef.id, customer.user.id);
    const admin = await createQaUser('order-admin', Role.ADMIN);

    const res = await request(app)
      .patch(`/api/v1/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'CONFIRMED' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CONFIRMED');
  });
});
