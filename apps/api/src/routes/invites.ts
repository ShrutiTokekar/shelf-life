import { Hono } from 'hono';
import { rateLimitPerIp } from '../middleware/rateLimit';
import { acceptInvite, previewInvite } from '../services/sharing';
import type { AppEnv } from '../types';

/** /invites/:token (SHR-3). Accepting is limited to 10 tries per IP per hour (SRS 11.3). */
export function inviteRoutes() {
  const limit = rateLimitPerIp();
  return new Hono<AppEnv>()
    .get('/:token', limit, async (c) =>
      c.json(await previewInvite(c.var.db, c.var.user.id, c.req.param('token'))),
    )
    .post('/:token/accept', limit, async (c) =>
      c.json(await acceptInvite(c.var.db, c.var.user.id, c.req.param('token'))),
    );
}
