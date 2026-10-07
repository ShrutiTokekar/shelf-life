import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { schema } from '../src/db/client';
import { createTestRoutes } from '../src/testRoutes';
import { loadEnv } from '../src/env';
import { setup } from './helpers';

let t: Awaited<ReturnType<typeof setup>>;
afterEach(async () => {
  await t?.close();
  t = undefined as never;
});

const HOUR = 3600_000;
const MIN = 60_000;

/** A clock the test moves forward, starting from the real time (sessions are stamped with it). */
function clock() {
  let offset = 0;
  return { now: () => new Date(Date.now() + offset), advance: (ms: number) => (offset += ms) };
}

const body = (r: Response) =>
  r.json() as Promise<{ error?: { code: string } } & Record<string, unknown>>;

describe('SEC-3 nothing is public', () => {
  it('every route outside sign-in, health and the cron job refuses a request without a session', async () => {
    t = await setup();
    const open: string[] = [];
    const seen = new Set<string>();
    for (const r of t.app.routes) {
      if (r.method === 'ALL') continue; // middleware
      const key = `${r.method} ${r.path}`;
      if (seen.has(key) || r.path.startsWith('/api/v1/test')) continue;
      seen.add(key);
      if (key === 'GET /health' || r.path.startsWith('/api/v1/auth/')) continue;
      const path = r.path
        .replace(/:[A-Za-z]+/g, '00000000-0000-4000-8000-000000000000')
        .replace(/\*/g, 'x');
      const res = await t.request(path, {
        method: r.method,
        body: ['GET', 'HEAD'].includes(r.method) ? undefined : '{}',
      });
      if (![401, 403, 404].includes(res.status)) open.push(`${key} → ${res.status}`);
    }
    expect(seen.size).toBeGreaterThan(30);
    expect(open).toEqual([]);
  });

  it('the test-only sign-in route can’t exist outside tests', () => {
    const env = { ...loadEnv(), NODE_ENV: 'production' as const };
    expect(() => createTestRoutes(env, null as never)).toThrow(/only available when NODE_ENV=test/);
  });

  it('SEC-1 API responses forbid running or framing anything', async () => {
    t = await setup();
    const res = await t.request('/health');
    expect(res.headers.get('content-security-policy')).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    );
    expect(res.headers.get('strict-transport-security')).toContain('max-age=31536000');
  });
});

describe('SEC-9 session time-out', () => {
  it('in a browser: signed out after 5 hours without use; using it keeps it going', async () => {
    const c = clock();
    t = await setup({ now: c.now });
    const { cookie } = await t.signIn();
    const me = () => t.request('/api/v1/me', { cookie });
    expect((await me()).status).toBe(200);
    c.advance(4 * HOUR + 50 * MIN);
    expect((await me()).status).toBe(200);
    c.advance(4 * HOUR + 50 * MIN); // 9 h 40 since sign-in, but used 4 h 50 ago
    expect((await me()).status).toBe(200);
    c.advance(5 * HOUR + MIN);
    const res = await me();
    expect(res.status).toBe(401);
    expect((await body(res)).error?.code).toBe('session_expired');
    expect(await t.db.select().from(schema.session)).toEqual([]);
    expect((await body(await me())).error?.code).toBe('unauthorized');
  });

  it('Better Auth’s own endpoints follow the same rule', async () => {
    const c = clock();
    t = await setup({ now: c.now });
    const { cookie } = await t.signIn();
    c.advance(6 * HOUR);
    const res = await t.request('/api/v1/auth/get-session', { cookie });
    expect(res.status).toBe(401);
    expect((await body(res)).error?.code).toBe('session_expired');
  });

  it('in the installed app: 30 days, however idle; only claimed right after sign-in', async () => {
    const c = clock();
    t = await setup({ now: c.now });
    const { cookie, user } = await t.signIn();
    const claim = (ck: string) =>
      t.request('/api/v1/session/client', {
        method: 'POST',
        cookie: ck,
        body: JSON.stringify({ client: 'app' }),
      });
    expect(await body(await claim(cookie))).toEqual({ client: 'app' });
    c.advance(10 * 24 * HOUR);
    expect((await t.request('/api/v1/me', { cookie })).status).toBe(200);
    c.advance(21 * 24 * HOUR); // 31 days after sign-in
    expect((await body(await t.request('/api/v1/me', { cookie }))).error?.code).toBe(
      'session_expired',
    );

    // A later claim (e.g. a copied browser cookie) doesn't lengthen anything.
    c.advance(-31 * 24 * HOUR);
    const later = await t.newSession(user.id);
    c.advance(11 * MIN);
    expect(await body(await claim(later))).toEqual({ client: 'browser' });
    const [row] = await t.db
      .select()
      .from(schema.session)
      .where(eq(schema.session.userId, user.id));
    expect(row?.client).toBe('browser');
  });

  it('Sign out on all devices ends every session', async () => {
    t = await setup();
    const { cookie, user } = await t.signIn();
    const phone = await t.newSession(user.id);
    expect(
      (
        await t.request('/api/v1/session/sign-out-everywhere', {
          method: 'POST',
          cookie,
          body: '{}',
        })
      ).status,
    ).toBe(204);
    expect((await t.request('/api/v1/me', { cookie: phone })).status).toBe(401);
    expect((await t.request('/api/v1/me', { cookie })).status).toBe(401);
  });

  it('PRO-6 Delete account needs a sign-in from the last 15 minutes', async () => {
    const c = clock();
    t = await setup({ now: c.now, ai: null });
    const { cookie, user } = await t.signIn();
    c.advance(16 * MIN);
    const res = await t.request('/api/v1/me', { method: 'DELETE', cookie });
    expect(res.status).toBe(403);
    expect((await body(res)).error?.code).toBe('reauth_required');
    c.advance(-16 * MIN); // signs in again now
    const fresh = await t.newSession(user.id);
    expect((await t.request('/api/v1/me', { method: 'DELETE', cookie: fresh })).status).toBe(204);
  });
});
