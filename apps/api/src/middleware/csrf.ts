import { createMiddleware } from 'hono/factory';
import { ERROR_CODES } from '@shelf-life/shared';
import type { AppEnv } from '../types';
import { apiError } from './errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * SEC-2 CSRF protection: every mutating request must come from the web app's origin.
 * (Hono's built-in csrf() only checks form content types, which would let JSON through.)
 */
export function sameOriginOnly(appOrigin: string) {
  const allowed = new URL(appOrigin).origin;
  return createMiddleware<AppEnv>(async (c, next) => {
    if (!SAFE_METHODS.has(c.req.method) && c.req.header('origin') !== allowed) {
      return apiError(
        c,
        403,
        ERROR_CODES.forbidden,
        'Request blocked: it didn’t come from Shelf Life.',
      );
    }
    await next();
  });
}
