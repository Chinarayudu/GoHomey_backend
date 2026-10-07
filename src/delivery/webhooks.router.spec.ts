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

describe('Shadowfax Marketplace callbacks (payloads from Shadowfax callback doc)', () => {
  const { deliveryService } = jest.requireMock('./delivery.service');
  const flush = () => new Promise((resolve) => setImmediate(resolve));

  const allotted = {
    pick_to_drop_distance: 0.92,
    order_status: 'ALLOTTED',
    sfx_order_id: 21043942,
    rider_name: 'Shashank Arya',
    rider_contact: '7992362908',
    rider_id: 139468,
    client_order_id: 'order_111288',
    allot_time: '2026-06-23T10:23:10.000000Z',
    track_url: 'https://track.shadowfax.in/abc123',
  };

  beforeEach(() => {
    delete process.env.SHADOWFAX_WEBHOOK_SECRET;
  });

  it('matches on client_order_id or sfx_order_id and saves track_url', async () => {
    mockPrisma.delivery.findFirst.mockResolvedValue({
      id: 'del-1',
      status: 'ASSIGNED',
      external_tracking_url: null,
    });

    const res = await request(buildApp())
      .post('/api/v1/webhooks/shadowfax')
      .send(allotted);
    await flush();

    expect(res.status).toBe(200);
    expect(mockPrisma.delivery.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { order_id: 'order_111288' },
          { external_tracking_id: 'order_111288' },
          { external_tracking_id: '21043942' },
        ],
      },
    });
    expect(mockPrisma.delivery.update).toHaveBeenCalledWith({
      where: { id: 'del-1' },
      data: { external_tracking_url: 'https://track.shadowfax.in/abc123' },
    });
  });

  it('moves the delivery forward on DISPATCHED', async () => {
    mockPrisma.delivery.findFirst.mockResolvedValue({
      id: 'del-1',
      status: 'ASSIGNED',
      external_tracking_url: 'https://track.shadowfax.in/abc123',
    });

    await request(buildApp())
      .post('/api/v1/webhooks/shadowfax')
      .send({
        ...allotted,
        order_status: 'DISPATCHED',
        track: 'https://track.shadowfax.in/abc123',
      });
    await flush();

    expect(deliveryService.updateDeliveryStatus).toHaveBeenCalledWith(
      'del-1',
      'PICKED_UP',
    );
    expect(mockPrisma.delivery.update).not.toHaveBeenCalled();
  });

  it('ignores a late ARRIVED callback after the rider was dispatched', async () => {
    mockPrisma.delivery.findFirst.mockResolvedValue({
      id: 'del-1',
      status: 'PICKED_UP',
      external_tracking_url: 'https://track.shadowfax.in/abc123',
    });

    await request(buildApp())
      .post('/api/v1/webhooks/shadowfax')
      .send({ ...allotted, order_status: 'ARRIVED' });
    await flush();

    expect(deliveryService.updateDeliveryStatus).not.toHaveBeenCalled();
  });

  it('does not reopen a DELIVERED delivery or clear its tracking URL', async () => {
    mockPrisma.delivery.findFirst.mockResolvedValue({
      id: 'del-1',
      status: 'DELIVERED',
      external_tracking_url: 'https://track.shadowfax.in/abc123',
    });

    await request(buildApp())
      .post('/api/v1/webhooks/shadowfax')
      .send({
        order_status: 'ARRIVED_CUSTOMER_DOORSTEP',
        sfx_order_id: 21043942,
        client_order_id: 'order_111288',
        drop_image_url: 'None',
      });
    await flush();

    expect(deliveryService.updateDeliveryStatus).not.toHaveBeenCalled();
    expect(mockPrisma.delivery.update).not.toHaveBeenCalled();
  });

  it('marks the delivery FAILED on CANCELLED', async () => {
    mockPrisma.delivery.findFirst.mockResolvedValue({
      id: 'del-1',
      status: 'ASSIGNED',
      external_tracking_url: null,
    });

    await request(buildApp())
      .post('/api/v1/webhooks/shadowfax')
      .send({
        order_status: 'CANCELLED',
        sfx_order_id: 21043979,
        client_order_id: 'order_111288',
        rider_latitude: 'None',
        cancel_reason_text: 'Operational Issue with order',
      });
    await flush();

    expect(deliveryService.updateDeliveryStatus).toHaveBeenCalledWith(
      'del-1',
      'FAILED',
    );
  });
});
