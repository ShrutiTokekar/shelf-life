import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiErrorSchema, meResponseSchema } from '@shelf-life/shared';
import { setup } from './helpers';

let t: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => {
  t = await setup();
});
afterEach(async () => {
  await t.close();
});

describe('GET /api/v1/me', () => {
  it('returns 401 with the error envelope when signed out', async () => {
    const res = await t.request('/api/v1/me');
    expect(res.status).toBe(401);
    expect(apiErrorSchema.parse(await res.json()).error.code).toBe('unauthorized');
  });

  it('WEL-2 new user has no pantry yet, so the app routes them to home list setup', async () => {
    const { cookie } = await t.signIn();
    const res = await t.request('/api/v1/me', { cookie });
    expect(res.status).toBe(200);
    const me = meResponseSchema.parse(await res.json());
    expect(me.pantry).toBeNull();
    expect(me.lists).toEqual([]);
    expect(me.user).toMatchObject({ displayName: 'Ananya Mehta', avatarInitial: 'A' });
  });

  it('WEL-2 returning user has a pantry and a home list with the owner role', async () => {
    const { cookie } = await t.signIn();
    await t.request('/api/v1/lists', {
      method: 'POST',
      cookie,
      body: JSON.stringify({ name: 'Apartment 4B', color: 'olive' }),
    });
    const me = meResponseSchema.parse(await (await t.request('/api/v1/me', { cookie })).json());
    expect(me.pantry?.homeListId).toBe(me.lists[0]?.id);
    expect(me.lists[0]).toMatchObject({
      name: 'Apartment 4B',
      color: 'olive',
      isHome: true,
      role: 'owner',
    });
  });
});

describe('POST /api/v1/lists', () => {
  it('WEL-4 validates input and returns a 400 error envelope', async () => {
    const { cookie } = await t.signIn();
    const res = await t.request('/api/v1/lists', {
      method: 'POST',
      cookie,
      body: JSON.stringify({ name: '', color: 'navy' }),
    });
    expect(res.status).toBe(400);
    expect(apiErrorSchema.parse(await res.json()).error.code).toBe('validation_error');
  });

  it('SEC-2 rejects cross-site POSTs', async () => {
    const { cookie } = await t.signIn();
    const res = await t.request('/api/v1/lists', {
      method: 'POST',
      cookie,
      headers: { origin: 'https://evil.example' },
      body: JSON.stringify({ name: 'Home', color: 'navy' }),
    });
    expect(res.status).toBe(403);
  });

  it('SEC-3 users only see their own lists', async () => {
    const a = await t.signIn('a@example.com', 'A');
    const b = await t.signIn('b@example.com', 'B');
    await t.request('/api/v1/lists', {
      method: 'POST',
      cookie: a.cookie,
      body: JSON.stringify({ name: 'A home', color: 'navy' }),
    });
    const me = meResponseSchema.parse(
      await (await t.request('/api/v1/me', { cookie: b.cookie })).json(),
    );
    expect(me.lists).toEqual([]);
  });

  it('SEC-3 non-members get 404 when deleting someone else’s list', async () => {
    const a = await t.signIn('a@example.com', 'A');
    const b = await t.signIn('b@example.com', 'B');
    await t.request('/api/v1/lists', {
      method: 'POST',
      cookie: a.cookie,
      body: JSON.stringify({ name: 'A home', color: 'navy' }),
    });
    const party = (await (
      await t.request('/api/v1/lists', {
        method: 'POST',
        cookie: a.cookie,
        body: JSON.stringify({ name: 'Party', color: 'amber' }),
      })
    ).json()) as { id: string };
    const res = await t.request(`/api/v1/lists/${party.id}`, {
      method: 'DELETE',
      cookie: b.cookie,
    });
    expect(res.status).toBe(404);
  });
});

describe('rate limit', () => {
  it('SRS 11.3 returns 429 after 120 requests a minute', async () => {
    const { cookie } = await t.signIn();
    for (let i = 0; i < 120; i++) {
      expect((await t.request('/api/v1/me', { cookie })).status).toBe(200);
    }
    const res = await t.request('/api/v1/me', { cookie });
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBeTruthy();
  });
});

describe('POST /api/v1/auth/sign-out', () => {
  it('PRO-6 ends the session: /me returns 401 afterwards and the cookie is cleared', async () => {
    const { cookie } = await t.signIn();
    expect((await t.request('/api/v1/me', { cookie })).status).toBe(200);

    const res = await t.request('/api/v1/auth/sign-out', { method: 'POST', cookie, body: '{}' });
    expect(res.status).toBe(200);
    const cleared = res.headers.getSetCookie().find((c) => c.includes('session_token'));
    expect(cleared).toMatch(/Max-Age=0/);

    expect((await t.request('/api/v1/me', { cookie })).status).toBe(401);
  });

  it('SEC-2 rejects a cross-site sign-out', async () => {
    const { cookie } = await t.signIn();
    const res = await t.request('/api/v1/auth/sign-out', {
      method: 'POST',
      cookie,
      headers: { origin: 'https://evil.example' },
      body: '{}',
    });
    expect(res.status).toBe(403);
    expect((await t.request('/api/v1/me', { cookie })).status).toBe(200);
  });
});

describe('test login route', () => {
  it('sets a session cookie that /me accepts', async () => {
    const res = await t.request('/api/v1/test/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'e2e@example.com', name: 'E2E User' }),
    });
    expect(res.status).toBe(200);
    const setCookies = res.headers.getSetCookie();
    expect(setCookies.length).toBeGreaterThan(0);
    expect(setCookies[0]).toMatch(/HttpOnly; Secure; SameSite=Lax/);
    const cookie = setCookies.map((c) => c.split(';')[0]).join('; ');
    expect((await t.request('/api/v1/me', { cookie })).status).toBe(200);
  });
});
