import { ERROR_CODES } from '@shelf-life/shared';
import { eq } from 'drizzle-orm';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { Db } from '../db/client';
import { schema } from '../db/client';
import type { AppEnv } from '../types';
import { apiError } from './errors';

/** SEC-9: a session in a browser ends after 5 hours without use. */
export const BROWSER_IDLE_MS = 5 * 3600_000;
/** Last-seen is written at most this often, to keep requests cheap. */
const TOUCH_EVERY_MS = 5 * 60_000;
/** SEC-9: deleting the account needs a sign-in this recent. */
export const REAUTH_WINDOW_MS = 15 * 60_000;
/** SEC-9: the installed app says so right after sign-in; later claims are ignored. */
export const APP_CLAIM_WINDOW_MS = 10 * 60_000;

type SessionTimes = { client: 'browser' | 'app'; lastSeenAt: Date; expiresAt: Date };

/** SEC-9: has this session run out? 30 days from sign-in for all; 5 h idle in a browser. */
export function isSessionExpired(s: SessionTimes, now: Date): boolean {
  if (s.expiresAt.getTime() <= now.getTime()) return true;
  return s.client === 'browser' && now.getTime() - s.lastSeenAt.getTime() > BROWSER_IDLE_MS;
}

/**
 * Checks the idle rule for a session and records this use. Returns false (and ends the session)
 * when it has run out.
 */
export async function useSession(db: Db, sessionId: string, now: Date): Promise<boolean> {
  const [row] = await db
    .select({
      client: schema.session.client,
      lastSeenAt: schema.session.lastSeenAt,
      expiresAt: schema.session.expiresAt,
    })
    .from(schema.session)
    .where(eq(schema.session.id, sessionId))
    .limit(1);
  if (!row) return false;
  if (isSessionExpired(row, now)) {
    await db.delete(schema.session).where(eq(schema.session.id, sessionId));
    return false;
  }
  if (now.getTime() - row.lastSeenAt.getTime() > TOUCH_EVERY_MS)
    await db
      .update(schema.session)
      .set({ lastSeenAt: now })
      .where(eq(schema.session.id, sessionId));
  return true;
}

const expired = (c: Context<AppEnv>) =>
  apiError(c, 401, ERROR_CODES.sessionExpired, 'You were signed out. Please sign in again.');

/** Every /api/v1 route except sign-in needs a live session (SEC-3, SEC-9). */
export const requireSession = createMiddleware<AppEnv>(async (c, next) => {
  const result = await c.var.auth.api.getSession({ headers: c.req.raw.headers });
  if (!result) return apiError(c, 401, ERROR_CODES.unauthorized, 'Please sign in.');
  if (!(await useSession(c.var.db, result.session.id, c.var.now()))) return expired(c);
  c.set('user', result.user);
  c.set('session', result.session);
  await next();
});

/**
 * Better Auth's own endpoints (get-session, update-user…) also respect the idle rule, so an
 * old browser cookie can't be used there either. Signing in and out are always allowed.
 */
export const authIdleCheck = createMiddleware<AppEnv>(async (c, next) => {
  const path = c.req.path.replace(/^\/api\/v1\/auth/, '');
  const open = /^\/(sign-in|callback|sign-out|error|ok)(\/|$)/.test(path);
  if (!open && c.req.header('cookie')) {
    const result = await c.var.auth.api.getSession({
      headers: c.req.raw.headers,
      query: { disableRefresh: true },
    });
    if (result && !(await useSession(c.var.db, result.session.id, c.var.now()))) return expired(c);
  }
  await next();
});
