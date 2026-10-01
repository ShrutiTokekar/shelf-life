import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  acceptInviteResponseSchema,
  inviteSchema,
  invitePreviewSchema,
  listDetailSchema,
  meResponseSchema,
  syncTokenResponseSchema,
} from '@shelf-life/shared';
import { docAccess } from '../src/services/access';
import { verifySyncToken } from '../src/services/syncToken';
import { setup } from './helpers';

let t: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => {
  t = await setup();
});
afterEach(async () => {
  await t.close();
});

const SECRET = 'test-sync-secret-at-least-32-characters!!';

async function json(res: Response) {
  return res.json() as Promise<unknown>;
}

/** An owner with a home list (+ pantry) and a second list, and a second user. */
async function world() {
  const owner = await t.signIn('ananya@example.com', 'Ananya Mehta');
  const home = (await json(
    await t.request('/api/v1/lists', {
      method: 'POST',
      cookie: owner.cookie,
      body: JSON.stringify({ name: 'Apartment 4B', color: 'navy' }),
    }),
  )) as { id: string; pantryId: string };
  const party = (await json(
    await t.request('/api/v1/lists', {
      method: 'POST',
      cookie: owner.cookie,
      body: JSON.stringify({ name: 'Diwali party', color: 'amber' }),
    }),
  )) as { id: string };
  const maya = await t.signIn('maya@example.com', 'Maya Rao');
  return { owner, home, party, maya };
}

async function invite(cookie: string, listId: string, body: object = {}) {
  const res = await t.request(`/api/v1/lists/${listId}/invites`, {
    method: 'POST',
    cookie,
    body: JSON.stringify(body),
  });
  return { res, invite: res.ok ? inviteSchema.parse(await json(res)) : null };
}

async function accept(cookie: string, token: string) {
  return t.request(`/api/v1/invites/${token}/accept`, { method: 'POST', cookie });
}

describe('SHR-3 invite links', () => {
  it('creates a 14-day link with a role (default Can edit) and joins with it', async () => {
    const { owner, party, maya } = await world();
    const { res, invite: link } = await invite(owner.cookie, party.id);
    expect(res.status).toBe(201);
    expect(link!.role).toBe('edit');
    expect(link!.url).toBe(`https://localhost:5173/join/${link!.token}`);
    expect(link!.token).toMatch(/^[\w-]{32}$/);
    const days = (Date.parse(link!.expiresAt) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(13.9);
    expect(days).toBeLessThanOrEqual(14);

    const preview = invitePreviewSchema.parse(
      await json(await t.request(`/api/v1/invites/${link!.token}`, { cookie: maya.cookie })),
    );
    expect(preview).toMatchObject({
      listName: 'Diwali party',
      invitedBy: 'Ananya Mehta',
      role: 'edit',
      memberCount: 1,
      sharesPantry: false,
      alreadyMember: false,
    });

    const joined = await accept(maya.cookie, link!.token);
    expect(acceptInviteResponseSchema.parse(await json(joined)).listId).toBe(party.id);
    // Joining twice is harmless.
    expect((await accept(maya.cookie, link!.token)).status).toBe(200);

    const me = meResponseSchema.parse(
      await json(await t.request('/api/v1/me', { cookie: maya.cookie })),
    );
    expect(me.lists.map((l) => [l.name, l.role])).toEqual([['Diwali party', 'edit']]);
    // SHR-6: another list never shares the pantry.
    expect(me.pantries).toEqual([]);
  });

  it('a revoked or expired link stops working', async () => {
    const { owner, party, maya } = await world();
    const { invite: link } = await invite(owner.cookie, party.id, { role: 'view' });
    const revoked = await t.request(`/api/v1/lists/${party.id}/invites/${link!.token}`, {
      method: 'DELETE',
      cookie: owner.cookie,
    });
    expect(revoked.status).toBe(204);
    const res = await accept(maya.cookie, link!.token);
    expect(res.status).toBe(404);
    expect(await res.text()).toMatch(/expired or was turned off/);
    expect((await accept(maya.cookie, 'not-a-real-token')).status).toBe(404);
  });

  it('records who a link was sent to and validates it', async () => {
    const { owner, party } = await world();
    const bad = await invite(owner.cookie, party.id, { sendTo: 'not a contact' });
    expect(bad.res.status).toBe(400);
    const { invite: sent } = await invite(owner.cookie, party.id, { sendTo: 'priya@example.com' });
    expect(sent!.sentTo).toBe('priya@example.com');
    const detail = listDetailSchema.parse(
      await json(await t.request(`/api/v1/lists/${party.id}`, { cookie: owner.cookie })),
    );
    expect(detail.invites.map((i) => i.sentTo)).toEqual(['priya@example.com']);
  });

  it('SHR-7 private lists cannot be shared until Private is turned off', async () => {
    const owner = await t.signIn();
    await t.request('/api/v1/lists', {
      method: 'POST',
      cookie: owner.cookie,
      body: JSON.stringify({ name: 'Home', color: 'navy' }),
    });
    const justMe = (await json(
      await t.request('/api/v1/lists', {
        method: 'POST',
        cookie: owner.cookie,
        body: JSON.stringify({ name: 'Just me', color: 'gray', isPrivate: true }),
      }),
    )) as { id: string };
    expect((await invite(owner.cookie, justMe.id)).res.status).toBe(403);
    await t.request(`/api/v1/lists/${justMe.id}`, {
      method: 'PATCH',
      cookie: owner.cookie,
      body: JSON.stringify({ isPrivate: false, name: 'Weekend baking' }),
    });
    expect((await invite(owner.cookie, justMe.id)).res.status).toBe(201);
  });

  it('SRS 11.3 limits invite attempts to 10 per IP per hour', async () => {
    const { maya } = await world();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++)
      statuses.push(
        (
          await t.request('/api/v1/invites/nope/accept', {
            method: 'POST',
            cookie: maya.cookie,
            headers: { 'x-forwarded-for': '203.0.113.9' },
          })
        ).status,
      );
    expect(statuses.slice(0, 10).every((s) => s === 404)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});

describe('SHR-4 SHR-5 roles and members (SEC-3)', () => {
  async function withMember(role: 'edit' | 'view') {
    const w = await world();
    const { invite: link } = await invite(w.owner.cookie, w.party.id, { role });
    await accept(w.maya.cookie, link!.token);
    return w;
  }

  it('non-members get 404 for everything on a list', async () => {
    const { party, maya } = await world();
    expect((await t.request(`/api/v1/lists/${party.id}`, { cookie: maya.cookie })).status).toBe(
      404,
    );
    expect((await invite(maya.cookie, party.id)).res.status).toBe(404);
  });

  it('only the owner changes roles, renames and stops sharing', async () => {
    const { owner, party, maya } = await withMember('edit');
    const patch = (cookie: string, path: string, body: object) =>
      t.request(path, { method: 'PATCH', cookie, body: JSON.stringify(body) });
    expect((await patch(maya.cookie, `/api/v1/lists/${party.id}`, { name: 'Mine' })).status).toBe(
      403,
    );
    expect(
      (
        await patch(owner.cookie, `/api/v1/lists/${party.id}/members/${maya.user.id}`, {
          role: 'view',
        })
      ).status,
    ).toBe(204);
    expect(
      (
        await patch(maya.cookie, `/api/v1/lists/${party.id}/members/${owner.user.id}`, {
          role: 'view',
        })
      ).status,
    ).toBe(403);
    const detail = listDetailSchema.parse(
      await json(await t.request(`/api/v1/lists/${party.id}`, { cookie: maya.cookie })),
    );
    expect(detail.role).toBe('view');
    expect(detail.members.map((m) => [m.displayName, m.role])).toEqual([
      ['Ananya Mehta', 'owner'],
      ['Maya Rao', 'view'],
    ]);
    // Viewers don't see invite links.
    expect(detail.invites).toEqual([]);
    expect((await invite(maya.cookie, party.id)).res.status).toBe(403);
  });

  it('members can leave; the owner can remove people but not leave', async () => {
    const { owner, party, maya } = await withMember('edit');
    const del = (cookie: string, userId: string) =>
      t.request(`/api/v1/lists/${party.id}/members/${userId}`, { method: 'DELETE', cookie });
    expect((await del(owner.cookie, owner.user.id)).status).toBe(403);
    expect((await del(maya.cookie, owner.user.id)).status).toBe(403);
    expect((await del(maya.cookie, maya.user.id)).status).toBe(204);
    expect((await t.request(`/api/v1/lists/${party.id}`, { cookie: maya.cookie })).status).toBe(
      404,
    );
  });

  it('SHR-4 Stop sharing removes everyone else and turns off every link', async () => {
    const { owner, party, maya } = await withMember('edit');
    const { invite: link } = await invite(owner.cookie, party.id);
    const res = await t.request(`/api/v1/lists/${party.id}/stop-sharing`, {
      method: 'POST',
      cookie: owner.cookie,
    });
    expect(res.status).toBe(204);
    const detail = listDetailSchema.parse(
      await json(await t.request(`/api/v1/lists/${party.id}`, { cookie: owner.cookie })),
    );
    expect(detail.members.map((m) => m.userId)).toEqual([owner.user.id]);
    expect(detail.invites).toEqual([]);
    expect((await accept(maya.cookie, link!.token)).status).toBe(404);
  });
});

describe('SHR-6 shared home pantry', () => {
  it('joining a home list shares its pantry; /me lists it after your own', async () => {
    const { owner, home, maya } = await world();
    // Maya has her own home too.
    await t.request('/api/v1/lists', {
      method: 'POST',
      cookie: maya.cookie,
      body: JSON.stringify({ name: 'Maya’s place', color: 'olive' }),
    });
    const { invite: link } = await invite(owner.cookie, home.id);
    const preview = invitePreviewSchema.parse(
      await json(await t.request(`/api/v1/invites/${link!.token}`, { cookie: maya.cookie })),
    );
    expect(preview.sharesPantry).toBe(true);
    await accept(maya.cookie, link!.token);
    const me = meResponseSchema.parse(
      await json(await t.request('/api/v1/me', { cookie: maya.cookie })),
    );
    expect(me.pantries.map((p) => [p.name, p.own, p.canEdit])).toEqual([
      ['Maya’s place', true, true],
      ['Apartment 4B', false, true],
    ]);
    expect(me.pantry!.id).not.toBe(home.pantryId);
  });
});

describe('SEC-3 doc access and sync tokens (SRS 11.1)', () => {
  it('lists: members write, viewers read, others nothing; pantries: home-list members only', async () => {
    const { owner, home, party, maya } = await world();
    expect(await docAccess(t.db, owner.user.id, `list:${party.id}`)).toBe('write');
    expect(await docAccess(t.db, maya.user.id, `list:${party.id}`)).toBeNull();
    const { invite: view } = await invite(owner.cookie, party.id, { role: 'view' });
    await accept(maya.cookie, view!.token);
    expect(await docAccess(t.db, maya.user.id, `list:${party.id}`)).toBe('read');
    // On the party list only: no pantry access.
    expect(await docAccess(t.db, maya.user.id, `pantry:${home.pantryId}`)).toBeNull();
    expect(await docAccess(t.db, owner.user.id, `pantry:${home.pantryId}`)).toBe('write');
    const { invite: homeLink } = await invite(owner.cookie, home.id, { role: 'view' });
    await accept(maya.cookie, homeLink!.token);
    expect(await docAccess(t.db, maya.user.id, `pantry:${home.pantryId}`)).toBe('read');
    expect(await docAccess(t.db, maya.user.id, 'pantry:not-a-uuid')).toBeNull();
    expect(await docAccess(t.db, maya.user.id, `other:${home.pantryId}`)).toBeNull();
  });

  it('issues a 5-minute token for one doc, only to members', async () => {
    const { owner, party, maya } = await world();
    const res = await t.request(`/api/v1/sync-token?doc=list:${party.id}`, {
      cookie: owner.cookie,
    });
    const body = syncTokenResponseSchema.parse(await json(res));
    expect(body.access).toBe('write');
    expect(body.url).toBeNull();
    const claims = await verifySyncToken(SECRET, body.token);
    expect(claims).toEqual({ userId: owner.user.id, doc: `list:${party.id}`, access: 'write' });
    expect(await verifySyncToken(SECRET, body.token, Date.now() + 6 * 60_000)).toBeNull();
    expect(await verifySyncToken('another-secret-another-secret-xx', body.token)).toBeNull();

    expect(
      (await t.request(`/api/v1/sync-token?doc=list:${party.id}`, { cookie: maya.cookie })).status,
    ).toBe(404);
    expect((await t.request('/api/v1/sync-token?doc=bogus', { cookie: owner.cookie })).status).toBe(
      400,
    );
    expect((await t.request(`/api/v1/sync-token?doc=list:${party.id}`)).status).toBe(401);
  });
});
