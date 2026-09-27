import { createMiddleware } from 'hono/factory';
import { ERROR_CODES } from '@shelf-life/shared';
import type { AppEnv } from '../types';
import { apiError } from './errors';

/**
 * Fixed-window, in-memory rate limit per user (SRS 11.3: 120 requests / minute).
 * In memory is fine while the API runs as a single Northflank service.
 */
export function rateLimitPerUser(limit = 120, windowMs = 60_000, now = () => Date.now()) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return createMiddleware<AppEnv>(async (c, next) => {
    const key = c.var.user.id;
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
