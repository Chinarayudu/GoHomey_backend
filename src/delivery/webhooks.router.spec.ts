import express from 'express';
import request from 'supertest';

jest.mock('../prisma/prisma.service', () => ({
  prisma: {
    delivery: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('./delivery.service', () => ({
  deliveryService: {
    updateDeliveryStatus: jest.fn(),
  },
}));

import { prisma } from '../prisma/prisma.service';
import webhooksRouter from './webhooks.router';

const mockPrisma = prisma as unknown as { delivery: { findFirst: jest.Mock; update: jest.Mock } };
const ORIGINAL_ENV = { ...process.env };

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/webhooks', webhooksRouter);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('Shadowfax webhook secret verification', () => {
  it('accepts the callback when SHADOWFAX_WEBHOOK_SECRET is not configured (back-compat)', async () => {
    delete process.env.SHADOWFAX_WEBHOOK_SECRET;
    mockPrisma.delivery.findFirst.mockResolvedValue(null);

    const res = await request(buildApp())
      .post('/api/v1/webhooks/shadowfax')
      .send({ coid: 'order-1', status: 'DELIVERED' });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('rejects with 401 when the secret is configured and the header is missing', async () => {
    process.env.SHADOWFAX_WEBHOOK_SECRET = 'test-secret';

    const res = await request(buildApp())
      .post('/api/v1/webhooks/shadowfax')
      .send({ coid: 'order-1', status: 'DELIVERED' });

    expect(res.status).toBe(401);
  });

  it('rejects with 401 when the secret is configured and the header value is wrong', async () => {
    process.env.SHADOWFAX_WEBHOOK_SECRET = 'test-secret';

    const res = await request(buildApp())
      .post('/api/v1/webhooks/shadowfax')
      .set('x-shadowfax-webhook-secret', 'wrong-secret')
      .send({ coid: 'order-1', status: 'DELIVERED' });

    expect(res.status).toBe(401);
  });

  it('accepts with 200 when the secret header matches exactly', async () => {
    process.env.SHADOWFAX_WEBHOOK_SECRET = 'test-secret';
    mockPrisma.delivery.findFirst.mockResolvedValue(null);

    const res = await request(buildApp())
      .post('/api/v1/webhooks/shadowfax')
      .set('x-shadowfax-webhook-secret', 'test-secret')
      .send({ coid: 'order-1', status: 'DELIVERED' });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });
});
