import type { AddressInfo } from 'node:net';
import { signSyncToken, type DocAccess } from '@shelf-life/api/sync';
import {
  addListItem,
  listItemsMap,
  markDoneShopping,
  readActivity,
  readItems,
  readListItems,
  updateListItem,
} from '@shelf-life/docs';
import { checkPatch, newListItem } from '@shelf-life/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { CLOSE, createSyncServer, type SyncServer } from '../src/server';
import type { Store } from '../src/store';

const SECRET = 'test-sync-secret-at-least-32-characters!!';
const LIST = '0192f0c0-0000-7000-8000-00000000000a';
const PANTRY = '0192f0c0-0000-7000-8000-00000000000b';

/** In-memory stand-in for Postgres: saved docs plus who may open what. */
function memoryStore(access: Record<string, Record<string, DocAccess>>) {
  const saved = new Map<string, { state: Uint8Array; hasCart: boolean }>();
  /** People whose every session ended (SEC-9). */
  const signedOut = new Set<string>();
  const store: Store = {
    load: async (name) => saved.get(name)?.state ?? null,
    save: async (name, state, hasCart) => void saved.set(name, { state, hasCart }),
    access: async (userId, name) => access[userId]?.[name] ?? null,
    signedIn: async (userId) => !signedOut.has(userId),
    pantryOf: async (listId) => (listId === LIST ? PANTRY : null),
    pendingCarts: async () => [...saved].filter(([, v]) => v.hasCart).map(([k]) => k),
  };
  return { store, saved, signedOut };
}

const ACCESS = {
  owner: { [`list:${LIST}`]: 'write', [`pantry:${PANTRY}`]: 'write' },
  friend: { [`list:${LIST}`]: 'write' },
  viewer: { [`list:${LIST}`]: 'read' },
} satisfies Record<string, Record<string, DocAccess>>;

let servers: SyncServer[] = [];
let providers: WebsocketProvider[] = [];
afterEach(async () => {
  for (const p of providers) p.destroy();
  providers = [];
  for (const s of servers) await s.close();
  servers = [];
});

async function start(store: Store, now?: () => number, recheckEveryMs?: number) {
  const sync = createSyncServer({
    store,
    secret: SECRET,
    now,
    saveEveryMs: 60_000,
    recheckEveryMs,
  });
  servers.push(sync);
  await new Promise<void>((r) => sync.server.listen(0, r));
  return { sync, port: (sync.server.address() as AddressInfo).port };
}

async function connect(
  port: number,
  userId: string,
  doc: string,
  access: DocAccess = 'write',
  now = Date.now(),
) {
  const { token } = await signSyncToken(SECRET, { userId, doc, access }, now);
  const ydoc = new Y.Doc();
  const provider = new WebsocketProvider(`ws://localhost:${port}/doc`, doc, ydoc, {
    params: { token },
    WebSocketPolyfill: WebSocket as unknown as typeof globalThis.WebSocket,
    disableBc: true,
  });
  providers.push(provider);
  await new Promise<void>((resolve) => {
    if (provider.synced) resolve();
    provider.once('sync', () => resolve());
  });
  return { ydoc, provider };
}

const until = async (check: () => boolean, ms = 3000) => {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 20));
  }
};

const ctx = (userId: string) => ({ listId: LIST, userId, now: new Date().toISOString() });

describe('sync service (SRS 11.2)', () => {
  it('LST-10 relays changes between members in well under a second', async () => {
    const { port } = await start(memoryStore(ACCESS).store);
    const a = await connect(port, 'owner', `list:${LIST}`);
    const b = await connect(port, 'friend', `list:${LIST}`);
    const t0 = Date.now();
    addListItem(a.ydoc, newListItem({ name: 'Eggs', quantity: 12, unit: '' }, ctx('owner')));
    await until(() => readListItems(b.ydoc).length === 1);
    // LST-10's 1 s target is measured end to end in e2e/lists.spec.ts; this is a loose sanity check
    // that also holds when every test project runs at once.
    expect(Date.now() - t0).toBeLessThan(3000);
    const [eggs] = readListItems(b.ydoc);
    updateListItem(b.ydoc, eggs!.id, { claimedBy: 'friend' });
    await until(() => readListItems(a.ydoc)[0]?.claimedBy === 'friend');
  });

  it('LST-10 offline edits on both sides merge on reconnect', async () => {
    const { port } = await start(memoryStore(ACCESS).store);
    const a = await connect(port, 'owner', `list:${LIST}`);
    const b = await connect(port, 'friend', `list:${LIST}`);
    a.provider.disconnect();
    b.provider.disconnect();
    addListItem(a.ydoc, newListItem({ name: 'Milk', quantity: null, unit: '' }, ctx('owner')));
    addListItem(b.ydoc, newListItem({ name: 'Atta', quantity: 20, unit: 'lb' }, ctx('friend')));
    a.provider.connect();
    b.provider.connect();
    const names = (d: Y.Doc) =>
      readListItems(d)
        .map((i) => i.name)
        .sort();
    await until(() => names(a.ydoc).length === 2 && names(b.ydoc).length === 2);
    expect(names(a.ydoc)).toEqual(['Atta', 'Milk']);
  });

  it('SHR-5 a "Can view" member sees changes but cannot make them', async () => {
    const { port } = await start(memoryStore(ACCESS).store);
    const owner = await connect(port, 'owner', `list:${LIST}`);
    const viewer = await connect(port, 'viewer', `list:${LIST}`, 'read');
    addListItem(owner.ydoc, newListItem({ name: 'Eggs', quantity: null, unit: '' }, ctx('owner')));
    await until(() => readListItems(viewer.ydoc).length === 1);
    addListItem(
      viewer.ydoc,
      newListItem({ name: 'Sneaky', quantity: null, unit: '' }, ctx('viewer')),
    );
    await new Promise((r) => setTimeout(r, 300));
    expect(readListItems(owner.ydoc).map((i) => i.name)).toEqual(['Eggs']);
  });

  it('SEC-3 a write token does not beat a read-only role in the database', async () => {
    const { port } = await start(memoryStore(ACCESS).store);
    const owner = await connect(port, 'owner', `list:${LIST}`);
    const viewer = await connect(port, 'viewer', `list:${LIST}`, 'write');
    addListItem(
      viewer.ydoc,
      newListItem({ name: 'Sneaky', quantity: null, unit: '' }, ctx('viewer')),
    );
    await new Promise((r) => setTimeout(r, 300));
    expect(readListItems(owner.ydoc)).toEqual([]);
  });

  it('SEC-3 refuses non-members, bad tokens and tokens for another doc', async () => {
    const { port } = await start(memoryStore(ACCESS).store);
    const closeCode = async (doc: string, token: string) => {
      const ws = new WebSocket(`ws://localhost:${port}/doc/${doc}?token=${token}`);
      return new Promise<number>((resolve) => ws.on('close', (code) => resolve(code)));
    };
    const friendPantry = await signSyncToken(SECRET, {
      userId: 'friend',
      doc: `pantry:${PANTRY}`,
      access: 'write',
    });
    // SHR-6: on the list only, so no pantry.
    expect(await closeCode(`pantry:${PANTRY}`, friendPantry.token)).toBe(CLOSE.forbidden);
    expect(await closeCode(`list:${LIST}`, 'garbage')).toBe(CLOSE.badToken);
    expect(await closeCode(`list:${LIST}`, friendPantry.token)).toBe(CLOSE.badToken);
    const expired = await signSyncToken(
      SECRET,
      { userId: 'owner', doc: `list:${LIST}`, access: 'write' },
      Date.now() - 10 * 60_000,
    );
    expect(await closeCode(`list:${LIST}`, expired.token)).toBe(CLOSE.badToken);
  });

  it('SEC-3 SEC-9 open connections end when someone is removed or signs out everywhere', async () => {
    const access: Record<string, Record<string, DocAccess>> = structuredClone(ACCESS);
    const mem = memoryStore(access);
    const { port } = await start(mem.store, undefined, 50);
    const closed = (p: WebsocketProvider) =>
      new Promise<number>((resolve) =>
        p.on('connection-close', (e: CloseEvent | null) => resolve(e?.code ?? 0)),
      );
    const friend = await connect(port, 'friend', `list:${LIST}`);
    const owner = await connect(port, 'owner', `list:${LIST}`);
    const friendClosed = closed(friend.provider);
    delete access.friend![`list:${LIST}`];
    expect(await friendClosed).toBe(CLOSE.forbidden);
    const ownerClosed = closed(owner.provider);
    mem.signedOut.add('owner');
    expect(await ownerClosed).toBe(CLOSE.forbidden);
  });

  it('SRS 8.7 saves the doc when the last person leaves and serves it after a restart', async () => {
    const mem = memoryStore(ACCESS);
    const first = await start(mem.store);
    const a = await connect(first.port, 'owner', `list:${LIST}`);
    addListItem(a.ydoc, newListItem({ name: 'Ghee', quantity: null, unit: '' }, ctx('owner')));
    await new Promise((r) => setTimeout(r, 100));
    a.provider.destroy();
    await until(() => mem.saved.has(`list:${LIST}`));
    await first.sync.close();
    servers = servers.filter((s) => s !== first.sync);

    const second = await start(mem.store);
    const b = await connect(second.port, 'friend', `list:${LIST}`);
    await until(() => readListItems(b.ydoc).length === 1);
    expect(readListItems(b.ydoc)[0]!.name).toBe('Ghee');
  });

  it('SRS 11.2 closes a connection sending over 50 updates a second', async () => {
    const { port } = await start(memoryStore(ACCESS).store);
    const { token } = await signSyncToken(SECRET, {
      userId: 'owner',
      doc: `list:${LIST}`,
      access: 'write',
    });
    const ws = new WebSocket(`ws://localhost:${port}/doc/list:${LIST}?token=${token}`);
    await new Promise((r) => ws.on('open', r));
    const code = new Promise<number>((resolve) => ws.on('close', (c) => resolve(c)));
    // Awareness messages with no clients: harmless, but they count.
    for (let i = 0; i < 60; i++) ws.send(new Uint8Array([1, 1, 0]));
    expect(await code).toBe(CLOSE.tooFast);
  });
});

describe('LST-7 cart → pantry', () => {
  it('"Done shopping" moves checked items into the list’s pantry, even for a shopper without pantry access', async () => {
    const mem = memoryStore(ACCESS);
    const { port } = await start(mem.store);
    const shopper = await connect(port, 'friend', `list:${LIST}`);
    const item = newListItem({ name: 'Paneer', quantity: 1, unit: 'pack' }, ctx('friend'));
    addListItem(shopper.ydoc, item);
    updateListItem(shopper.ydoc, item.id, checkPatch(item, 'friend', new Date().toISOString()));
    markDoneShopping(shopper.ydoc, 'friend', new Date(Date.now() + 1000).toISOString());
    await until(() => readListItems(shopper.ydoc).length === 0);

    const owner = await connect(port, 'owner', `pantry:${PANTRY}`);
    await until(() => readItems(owner.ydoc).length === 1);
    expect(readItems(owner.ydoc)[0]).toMatchObject({
      name: 'Paneer',
      listId: LIST,
      foodId: 'paneer',
      addedBy: 'friend',
    });
    expect(readActivity(owner.ydoc).map((a) => a.type)).toEqual(['bought']);
  });

  it(
    'moves on its own 2 hours after checking, including carts waiting over a restart',
    { timeout: 15_000 },
    async () => {
      const mem = memoryStore(ACCESS);
      let clock = Date.now();
      const first = await start(mem.store, () => clock);
      const shopper = await connect(first.port, 'friend', `list:${LIST}`);
      const item = newListItem({ name: 'Cilantro', quantity: null, unit: '' }, ctx('friend'));
      addListItem(shopper.ydoc, item);
      updateListItem(
        shopper.ydoc,
        item.id,
        checkPatch(item, 'friend', new Date(clock).toISOString()),
      );
      await new Promise((r) => setTimeout(r, 400));
      expect(readListItems(shopper.ydoc)).toHaveLength(1);
      shopper.provider.destroy();
      await until(() => mem.saved.get(`list:${LIST}`)?.hasCart === true);
      await first.sync.close();
      servers = servers.filter((s) => s !== first.sync);

      clock += 2 * 60 * 60 * 1000;
      const second = await start(mem.store, () => clock);
      await second.sync.resumeCarts();
      // The server's clock moved on 2 hours, so tokens are issued at that time.
      const owner = await connect(second.port, 'owner', `pantry:${PANTRY}`, 'write', clock);
      await until(() => readItems(owner.ydoc).length === 1);
      const list = await connect(second.port, 'owner', `list:${LIST}`, 'write', clock);
      await until(() => listItemsMap(list.ydoc).size === 0);
    },
  );
});

describe('one-port mode (production on Render)', () => {
  it('serves sync at /sync/doc on another HTTP server and leaves other upgrades alone', async () => {
    const { createServer } = await import('node:http');
    const http = createServer((_req, res) => res.writeHead(200).end('api'));
    await new Promise<void>((r) => http.listen(0, r));
    const port = (http.address() as AddressInfo).port;
    const sync = createSyncServer({
      store: memoryStore(ACCESS).store,
      secret: SECRET,
      server: http,
      pathPrefix: '/sync',
    });
    try {
      const { token } = await signSyncToken(SECRET, {
        userId: 'owner',
        doc: `list:${LIST}`,
        access: 'write',
      });
      const a = new Y.Doc();
      const b = new Y.Doc();
      const opts = (t: string) => ({
        params: { token: t },
        WebSocketPolyfill: WebSocket as unknown as typeof globalThis.WebSocket,
        disableBc: true,
      });
      const pa = new WebsocketProvider(
        `ws://localhost:${port}/sync/doc`,
        `list:${LIST}`,
        a,
        opts(token),
      );
      const pb = new WebsocketProvider(
        `ws://localhost:${port}/sync/doc`,
        `list:${LIST}`,
        b,
        opts(token),
      );
      providers.push(pa, pb);
      await until(() => pa.synced && pb.synced);
      addListItem(a, newListItem({ name: 'Ghee', quantity: null, unit: '' }, ctx('owner')));
      await until(() => readListItems(b).length === 1);

      // The API's own routes still answer, and unknown upgrade paths are refused.
      expect(await (await fetch(`http://localhost:${port}/health`)).text()).toBe('api');
      const stray = new WebSocket(`ws://localhost:${port}/elsewhere`);
      await new Promise<void>((resolve) => stray.on('error', () => resolve()));
    } finally {
      for (const p of providers) p.destroy();
      providers = [];
      await sync.close();
      await new Promise<void>((r) => http.close(() => r()));
    }
  });
});
