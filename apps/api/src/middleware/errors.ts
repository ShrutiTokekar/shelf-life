import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ZodError } from 'zod';
import { type ApiError, ERROR_CODES } from '@shelf-life/shared';
import { ConflictError, ForbiddenError, NotFoundError } from '../services/onboarding';

export function errorBody(code: string, message: string): ApiError {
  return { error: { code, message } };
}

export function apiError(c: Context, status: ContentfulStatusCode, code: string, message: string) {
  return c.json(errorBody(code, message), status);
}

/** Every error leaves the API as `{ error: { code, message } }` (SRS 11). */
export function onError(err: Error, c: Context) {
  if (err instanceof ZodError) {
    const message = err.issues[0]?.message ?? 'Some fields need a look.';
    return apiError(c, 400, ERROR_CODES.validation, message);
  }
  if (err instanceof ConflictError) return apiError(c, 409, ERROR_CODES.conflict, err.message);
  if (err instanceof NotFoundError) return apiError(c, 404, ERROR_CODES.notFound, err.message);
  if (err instanceof ForbiddenError) return apiError(c, 403, ERROR_CODES.forbidden, err.message);
  if (err instanceof HTTPException) {
    const code = err.status === 403 ? ERROR_CODES.forbidden : ERROR_CODES.validation;
    return apiError(
      c,
      err.status as ContentfulStatusCode,
      code,
      err.message || 'Request rejected.',
    );
  }
  console.error(err);
  return apiError(c, 500, ERROR_CODES.internal, 'Something went wrong on our side. Try again.');
}
