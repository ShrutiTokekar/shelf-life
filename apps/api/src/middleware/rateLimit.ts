import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { ERROR_CODES } from '@shelf-life/shared';
import type { AppEnv } from '../types';
import { apiError } from './errors';

/**
 * Fixed-window, in-memory rate limit per user (SRS 11.3: 120 requests / minute).
 * In memory is fine while the API runs as a single Northflank service.
 */
export function rateLimitPerUser(limit = 120, windowMs = 60_000, now = () => Date.now()) {
  return rateLimit((c) => c.var.user.id, limit, windowMs, now);
}

/**
 * SRS 11.3 "Invite accept attempts per IP: 10 / hour". Behind Northflank's proxy the client IP is
 * the first X-Forwarded-For entry.
 */
export function rateLimitPerIp(limit = 10, windowMs = 3_600_000, now = () => Date.now()) {
  return rateLimit(
    (c) =>
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      c.req.header('x-real-ip') ||
      'local',
    limit,
    windowMs,
    now,
  );
}

function rateLimit(
  keyOf: (c: Context<AppEnv>) => string,
  limit: number,
  windowMs: number,
  now: () => number,
) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return createMiddleware<AppEnv>(async (c, next) => {
    const key = keyOf(c);
    const t = now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      entry = { count: 0, resetAt: t + windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    if (entry.count > limit) {
      c.header('Retry-After', String(Math.ceil((entry.resetAt - t) / 1000)));
      return apiError(
        c,
        429,
        ERROR_CODES.rateLimited,
        'Too many requests. Wait a moment and try again.',
      );
    }
    await next();
  });
}
