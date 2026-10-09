import { ERROR_CODES } from '@shelf-life/shared';
import { createMiddleware } from 'hono/factory';
import type { PwnedCheck } from '../email/pwned';
import type { AppEnv } from '../types';
import { apiError } from './errors';

/** Wrong passwords for one account before it's locked for a while (Milestone 9b). */
export const LOCK_AFTER_FAILURES = 8;
export const LOCK_MS = 15 * 60_000;

async function jsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await req.clone().json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Checks in front of Better Auth's email endpoints (Milestone 9b):
 * - New passwords (sign-up, reset) that appear in a known data breach are refused.
 * - Sign-in: after 8 wrong passwords for one email, that email is locked for 15 minutes,
 *   whatever IP they come from (the per-IP limit is in auth.ts). In memory: one API instance.
 */
export function authGuards(opts: { pwned: PwnedCheck }) {
  const failures = new Map<string, { count: number; until: number }>();
  return createMiddleware<AppEnv>(async (c, next) => {
    if (c.req.method !== 'POST') return next();
    const path = c.req.path.replace(/^\/api\/v1\/auth/, '');

    if (path === '/sign-up/email' || path === '/reset-password') {
      const body = await jsonBody(c.req.raw);
      const password = path === '/sign-up/email' ? body.password : body.newPassword;
      if (typeof password === 'string' && password.length > 0 && (await opts.pwned(password)))
        return apiError(
          c,
          400,
          ERROR_CODES.passwordBreached,
          'That password has appeared in a data breach. Choose a different one.',
        );
      return next();
    }

    if (path === '/sign-in/email') {
      const body = await jsonBody(c.req.raw);
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const t = c.var.now().getTime();
      const entry = failures.get(email);
      if (entry && entry.until > t) {
        c.header('Retry-After', String(Math.ceil((entry.until - t) / 1000)));
        return apiError(
          c,
          429,
          ERROR_CODES.rateLimited,
          'Too many tries. Wait 15 minutes, or reset your password.',
        );
      }
      await next();
      if (!email) return;
      if (c.res.status === 401) {
        // A lock that has run out starts the count again.
        const count = (entry && !entry.until ? entry.count : 0) + 1;
        if (failures.size > 10_000) failures.clear(); // bounded memory
        failures.set(
          email,
          count >= LOCK_AFTER_FAILURES ? { count: 0, until: t + LOCK_MS } : { count, until: 0 },
        );
      } else if (c.res.ok) failures.delete(email);
      return;
    }
    return next();
  });
}
