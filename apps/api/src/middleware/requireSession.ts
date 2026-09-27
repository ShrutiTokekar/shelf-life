import { createMiddleware } from 'hono/factory';
import { ERROR_CODES } from '@shelf-life/shared';
import type { AppEnv } from '../types';
import { apiError } from './errors';

export const requireSession = createMiddleware<AppEnv>(async (c, next) => {
  const result = await c.var.auth.api.getSession({ headers: c.req.raw.headers });
  if (!result) return apiError(c, 401, ERROR_CODES.unauthorized, 'Please sign in.');
  c.set('user', result.user);
  await next();
});
