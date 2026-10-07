import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { schema } from '../db/client';
import { APP_CLAIM_WINDOW_MS } from '../middleware/requireSession';
import type { AppEnv } from '../types';

const clientSchema = z.object({ client: z.literal('app') }).strict();

/** /session/* (SEC-9). */
export const sessionRoutes = new Hono<AppEnv>()
  /**
   * The installed app (Home Screen PWA) says so right after sign-in, so this session lasts
   * 30 days instead of signing out after 5 hours without use. Only within 10 minutes of sign-in.
   */
  .post('/client', async (c) => {
    clientSchema.parse(await c.req.json().catch(() => ({})));
    const s = c.var.session;
    const age = c.var.now().getTime() - new Date(s.createdAt).getTime();
    if (age > APP_CLAIM_WINDOW_MS) return c.json({ client: 'browser' as const });
    await c.var.db.update(schema.session).set({ client: 'app' }).where(eq(schema.session.id, s.id));
    return c.json({ client: 'app' as const });
  })
  /** "Sign out on all devices": ends every session of this person, this one included. */
  .post('/sign-out-everywhere', async (c) => {
    await c.var.db.delete(schema.session).where(eq(schema.session.userId, c.var.user.id));
    return c.body(null, 204);
  });
