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
