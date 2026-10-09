import { z } from 'zod';

/** Error envelope used by every API route (SRS 11). */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const ERROR_CODES = {
  unauthorized: 'unauthorized',
  // SEC-9: the session ran out (5 h idle in a browser, 30 days at most); sign in again.
  sessionExpired: 'session_expired',
  // SEC-9: deleting the account needs a sign-in from the last 15 minutes.
  reauthRequired: 'reauth_required',
  // Milestone 9b: a new password found in a known data breach.
  passwordBreached: 'password_breached',
  forbidden: 'forbidden',
  notFound: 'not_found',
  validation: 'validation_error',
  rateLimited: 'rate_limited',
  // SRS 9: AI is off, failing or over its daily limit; the app uses its non-AI fallback.
  aiUnavailable: 'ai_unavailable',
  aiLimit: 'ai_limit',
  conflict: 'conflict',
  internal: 'internal_error',
} as const;
