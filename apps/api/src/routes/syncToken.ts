import { Hono } from 'hono';
import { docNameSchema, ERROR_CODES, type SyncTokenResponse } from '@shelf-life/shared';
import { apiError } from '../middleware/errors';
import { docAccess } from '../services/access';
import { signSyncToken } from '../services/syncToken';
import type { AppEnv } from '../types';

/** GET /sync-token?doc=list:<id> | pantry:<id> (SRS 11.1): only for members (SEC-3). */
export function syncTokenRoutes(secret: string, syncUrl: string | undefined) {
  return new Hono<AppEnv>().get('/', async (c) => {
    const parsed = docNameSchema.safeParse(c.req.query('doc'));
    if (!parsed.success) return apiError(c, 400, ERROR_CODES.validation, 'Unknown document.');
    const access = await docAccess(c.var.db, c.var.user.id, parsed.data);
    if (!access) return apiError(c, 404, ERROR_CODES.notFound, 'Not found.');
    const { token, expiresAt } = await signSyncToken(secret, {
      userId: c.var.user.id,
      doc: parsed.data,
      access,
    });
    return c.json({
      token,
      url: syncUrl ?? null,
      expiresAt: expiresAt.toISOString(),
      access,
    } satisfies SyncTokenResponse);
  });
}
