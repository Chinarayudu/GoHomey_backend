import request from 'supertest';
import jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { Role, OrderType } from '@prisma/client';
import { app, setupTestDb, cleanupQaData, closeConnections, qaEmail, qaPhone } from '../test/testApp';
import { prisma } from '../prisma/prisma.service';
import { JWT_SECRET } from '../config/env';

/**
 * Focused authz test for FINDINGS.md: PATCH /delivery/:id/status previously
 * had no role check at all (every other mutating route in this router is
 * ADMIN-only). A CHEF/USER token could flip any delivery to DELIVERED, which
 * cascades to the linked Order and triggers chef payout release
 * (delivery.service.ts updateDeliveryStatus). We deliberately use a
 * non-terminal status (ASSIGNED) in the admin-success case to avoid
 * exercising that payout side effect here — this test proves the role gate,
 * not full delivery lifecycle correctness.
 */

const createdOrderIds: string[] = [];

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  if (createdOrderIds.length > 0) {
    await prisma.delivery.deleteMany({ where: { order_id: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
  }
  await cleanupQaData();
  await closeConnections();
});

function signToken(payload: { sub: string; email: string; phone: string; role: string }) {
  return jwt.sign(payload, JWT_SECRET);
}

async function createQaUser(label: string, role: Role) {
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

async function createQaDelivery() {
  const chefHashed = await bcrypt.hash('unused-password', 10);
  const chef = await prisma.chef.create({
    data: {
      name: 'delivery-chef',
      email: qaEmail('delivery-chef'),
      phone: qaPhone(),
      password: chefHashed,
      role: Role.CHEF,
    },
  });
  const { user: customer } = await createQaUser('delivery-cust', Role.USER);
  const order = await prisma.order.create({
    data: {
      user_id: customer.id,
      chef_id: chef.id,
      order_type: OrderType.DAILY_MEAL,
      status: 'READY_FOR_PICKUP',
      total_price: 100,
    },
  });
  createdOrderIds.push(order.id);
  const delivery = await prisma.delivery.create({
    data: { order_id: order.id, status: 'PENDING' },
  });
  return delivery;
}

describe('PATCH /api/v1/delivery/:id/status — role gate', () => {
  it('returns 403 for a plain USER token', async () => {
    const delivery = await createQaDelivery();
    const { token } = await createQaUser('delivery-role-user', Role.USER);

    const res = await request(app)
      .patch(`/api/v1/delivery/${delivery.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ASSIGNED' });

    expect(res.status).toBe(403);
  });

  it('returns 403 for a CHEF token', async () => {
    const delivery = await createQaDelivery();
    const { token } = await createQaUser('delivery-role-chef', Role.CHEF);

    const res = await request(app)
      .patch(`/api/v1/delivery/${delivery.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ASSIGNED' });

    expect(res.status).toBe(403);
  });

  it('allows an ADMIN token through the role gate', async () => {
    const delivery = await createQaDelivery();
    const { token } = await createQaUser('delivery-role-admin', Role.ADMIN);

    const res = await request(app)
      .patch(`/api/v1/delivery/${delivery.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ASSIGNED' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ASSIGNED');
  });
});
