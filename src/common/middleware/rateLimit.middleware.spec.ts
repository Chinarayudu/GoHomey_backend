import express from 'express';
import request from 'supertest';
import { createRateLimiter } from './rateLimit.middleware';

function buildApp(max: number, windowMs: number) {
  const app = express();
  const limiter = createRateLimiter({ windowMs, max, message: 'Too many requests' });
  app.get('/ping', limiter, (req, res) => res.json({ ok: true }));
  return app;
}

describe('createRateLimiter', () => {
  it('allows up to `max` requests within the window, then returns 429', async () => {
    const app = buildApp(3, 60_000);

    const r1 = await request(app).get('/ping');
    const r2 = await request(app).get('/ping');
    const r3 = await request(app).get('/ping');
    const r4 = await request(app).get('/ping');

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(200);
    expect(r4.status).toBe(429);
    expect(r4.body.message).toBe('Too many requests');
  });

  it('resets once the window elapses', async () => {
    const app = buildApp(1, 150);

    const r1 = await request(app).get('/ping');
    expect(r1.status).toBe(200);

    const r2 = await request(app).get('/ping');
    expect(r2.status).toBe(429);

    await new Promise((resolve) => setTimeout(resolve, 250));

    const r3 = await request(app).get('/ping');
    expect(r3.status).toBe(200);
  });

  it('is skipped entirely when OTP_BYPASS_ENABLED=true (test-mode signal)', async () => {
    const prev = process.env.OTP_BYPASS_ENABLED;
    process.env.OTP_BYPASS_ENABLED = 'true';
    const app = buildApp(1, 60_000);

    try {
      const r1 = await request(app).get('/ping');
      const r2 = await request(app).get('/ping');
      const r3 = await request(app).get('/ping');

      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
      expect(r3.status).toBe(200);
    } finally {
      if (prev === undefined) delete process.env.OTP_BYPASS_ENABLED;
      else process.env.OTP_BYPASS_ENABLED = prev;
    }
  });
});
