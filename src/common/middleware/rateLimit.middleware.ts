import rateLimit, { Options } from 'express-rate-limit';

/**
 * Uses express-rate-limit's default in-memory store. Fine for a single
 * instance; if this app ever runs multiple instances behind a load balancer,
 * swap in a shared store (e.g. rate-limit-redis against the existing
 * redisClient) so limits are enforced consistently across instances.
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message: string;
}): ReturnType<typeof rateLimit> {
  const config: Partial<Options> = {
    windowMs: options.windowMs,
    limit: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: options.message },
    // OTP_BYPASS_ENABLED is the existing "this is not reachable by real users"
    // signal used for the automated test suite (see auth.service.ts) — reused
    // here so rapid test requests from a single source don't self-throttle.
    skip: () => process.env.OTP_BYPASS_ENABLED === 'true',
  };
  return rateLimit(config);
}

export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many requests, please try again in a minute.',
});

export const webhookRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many requests.',
});
