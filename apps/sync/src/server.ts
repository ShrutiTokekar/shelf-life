import { createServer, type IncomingMessage, type Server } from 'node:http';
import { verifySyncToken, type DocAccess } from '@shelf-life/api/sync';
import {
  applyCartMoveToPantry,
  readItems,
  readListItems,
  readListMeta,
  removeMovedItems,
} from '@shelf-life/docs';
import { docNameSchema, planCartMove } from '@shelf-life/shared';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';
import type { Store } from './store';

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

/** Close codes. 44xx stops the y-websocket client retrying; 40xx makes it retry. */
export const CLOSE = {
  /** Bad or expired token: the client fetches a fresh one and reconnects. */
  badToken: 4001,
  /** SRS 11.3: over 50 updates/s. */
  tooFast: 4029,
  /** Not a member (any more): stop. */
  forbidden: 4403,
} as const;

type Conn = { ws: WebSocket; userId: string; canWrite: boolean; clients: Set<number> };

type Room = {
  name: string;
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  conns: Set<Conn>;
  dirty: boolean;
  /** Set while loading from Postgres. */
  ready: Promise<void>;
};

export type SyncServerOptions = {
  store: Store;
  secret: string;
  now?: () => number;
  /** SRS 8.7: snapshot every 30 s. */
  saveEveryMs?: number;
  /** How often waiting carts are checked for the 2-hour rule (LST-7). */
  cartCheckEveryMs?: number;
  /** SRS 11.2: 50 updates per second per connection. */
  maxMessagesPerSecond?: number;
  log?: (msg: string) => void;
};

const send = (ws: WebSocket, message: Uint8Array) => {
  if (ws.readyState === WebSocket.OPEN) ws.send(message);
};

/**
 * The y-websocket relay (SRS 3.3, 11.2): standard sync + awareness protocol, one room per doc.
 * Every connection needs a sync token for that doc and is re-checked against the database (SEC-3);
 * "Can view" members receive updates but their changes are dropped (SHR-5). It also moves checked
 * cart items into the list's pantry (LST-7), since shoppers may not have pantry access (SHR-6).
 */
export function createSyncServer(opts: SyncServerOptions) {
  const now = opts.now ?? (() => Date.now());
  const log = opts.log ?? (() => undefined);
  const maxPerSecond = opts.maxMessagesPerSecond ?? 50;
  const rooms = new Map<string, Room>();
  const cartTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function getRoom(name: string): Room {
    let room = rooms.get(name);
    if (room) return room;
    const doc = new Y.Doc({ gc: true });
    const awareness = new awarenessProtocol.Awareness(doc);
    awareness.setLocalState(null);
    const created: Room = {
      name,
      doc,
      awareness,
      conns: new Set(),
      dirty: false,
      ready: opts.store.load(name).then((state) => {
        if (state) Y.applyUpdate(doc, state, 'load');
      }),
    };
    room = created;
    rooms.set(name, room);

    doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === 'load') return;
      created.dirty = true;
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      const message = encoding.toUint8Array(encoder);
      for (const c of created.conns) send(c.ws, message);
      if (name.startsWith('list:')) scheduleCartCheck(created);
    });
    awareness.on(
      'update',
      (
        { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
        origin: unknown,
      ) => {
        const changed = [...added, ...updated, ...removed];
        const conn = origin as Conn | null;
        if (conn?.clients) {
          for (const id of added) conn.clients.add(id);
          for (const id of removed) conn.clients.delete(id);
        }
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(awareness, changed),
        );
        const message = encoding.toUint8Array(encoder);
        for (const c of created.conns) send(c.ws, message);
      },
    );
    return room;
  }

  const hasCart = (room: Room) =>
    room.name.startsWith('list:') && readListItems(room.doc).some((i) => i.checked);

  async function save(room: Room) {
    if (!room.dirty) return;
    room.dirty = false;
    try {
      await opts.store.save(room.name, Y.encodeStateAsUpdate(room.doc), hasCart(room));
    } catch (err) {
      room.dirty = true;
      log(`save failed for ${room.name}: ${String(err)}`);
    }
  }

  /** Save and drop a room nobody has open, unless its cart still has to move. */
  async function release(room: Room) {
    await save(room);
    if (room.conns.size === 0 && !hasCart(room) && rooms.get(room.name) === room) {
      rooms.delete(room.name);
      room.awareness.destroy();
      room.doc.destroy();
    }
  }

  function scheduleCartCheck(room: Room) {
    clearTimeout(cartTimers.get(room.name));
    cartTimers.set(
      room.name,
      setTimeout(() => {
        cartTimers.delete(room.name);
        void moveCart(room);
      }, 200),
    );
  }

  /** LST-7: move what's due from this list's cart into its pantry, labeled with the list. */
  async function moveCart(room: Room) {
    const listId = room.name.slice('list:'.length);
    const items = readListItems(room.doc).filter((i) => i.checked);
    if (items.length === 0) return;
    const pantryId = await opts.store.pantryOf(listId);
    if (!pantryId) return;
    const pantryRoom = getRoom(`pantry:${pantryId}`);
    await pantryRoom.ready;
    const plan = planCartMove(items, {
      listId,
      pantryId,
      pantry: readItems(pantryRoom.doc),
      doneShoppingAt: readListMeta(room.doc).doneShoppingAt,
      now: new Date(now()).toISOString(),
    });
    if (plan.moved.length === 0) return;
    applyCartMoveToPantry(pantryRoom.doc, plan);
    removeMovedItems(room.doc, plan);
    log(`moved ${plan.moved.length} item(s) from ${room.name} into pantry:${pantryId}`);
    await release(pantryRoom);
    if (room.conns.size === 0) await release(room);
  }

  function onMessage(conn: Conn, room: Room, data: Uint8Array) {
    const decoder = decoding.createDecoder(data);
    const encoder = encoding.createEncoder();
    const type = decoding.readVarUint(decoder);
    if (type === MESSAGE_SYNC) {
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      if (conn.canWrite) {
        syncProtocol.readSyncMessage(decoder, encoder, room.doc, conn);
      } else {
        // SHR-5: a viewer may ask for the doc (step 1) but its changes (step 2, updates) are dropped.
        const step = decoding.readVarUint(decoder);
        if (step === syncProtocol.messageYjsSyncStep1)
          syncProtocol.readSyncStep1(decoder, encoder, room.doc);
      }
      if (encoding.length(encoder) > 1) send(conn.ws, encoding.toUint8Array(encoder));
    } else if (type === MESSAGE_AWARENESS) {
      awarenessProtocol.applyAwarenessUpdate(
        room.awareness,
        decoding.readVarUint8Array(decoder),
        conn,
      );
    }
  }

  async function onConnection(ws: WebSocket, req: IncomingMessage) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const match = /^\/doc\/([^/]+)$/.exec(url.pathname);
    const name = match ? decodeURIComponent(match[1]!) : '';
    const token = url.searchParams.get('token') ?? '';

    // Queue messages that arrive while we check the token and load the doc.
    const early: Uint8Array[] = [];
    const queue = (data: RawData) => early.push(new Uint8Array(data as Buffer));
    ws.on('message', queue);

    const claims = docNameSchema.safeParse(name).success
      ? await verifySyncToken(opts.secret, token, now())
      : null;
    if (!claims || claims.doc !== name) return ws.close(CLOSE.badToken, 'bad token');
    // SEC-3: the token can be up to 5 minutes old; check membership now too.
    const current: DocAccess | null = await opts.store.access(claims.userId, name);
    if (!current) return ws.close(CLOSE.forbidden, 'not a member');
    if (ws.readyState !== WebSocket.OPEN) return;

    const room = getRoom(name);
    await room.ready;
    const conn: Conn = {
      ws,
      userId: claims.userId,
      canWrite: current === 'write' && claims.access === 'write',
      clients: new Set(),
    };
    room.conns.add(conn);

    let windowStart = now();
    let count = 0;
    const handle = (data: Uint8Array) => {
      const t = now();
      if (t - windowStart >= 1000) {
        windowStart = t;
        count = 0;
      }
      if (++count > maxPerSecond) return ws.close(CLOSE.tooFast, 'too many updates');
      try {
        onMessage(conn, room, data);
      } catch (err) {
        log(`bad message on ${name}: ${String(err)}`);
      }
    };
    ws.off('message', queue);
    ws.on('message', (data: RawData) => handle(new Uint8Array(data as Buffer)));
    ws.on('close', () => {
      room.conns.delete(conn);
      awarenessProtocol.removeAwarenessStates(room.awareness, [...conn.clients], null);
      if (room.conns.size === 0) void release(room);
    });

    // Start the sync: our state vector (step 1), then everyone's presence.
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, room.doc);
    send(ws, encoding.toUint8Array(encoder));
    const states = room.awareness.getStates();
    if (states.size > 0) {
      const aw = encoding.createEncoder();
      encoding.writeVarUint(aw, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        aw,
        awarenessProtocol.encodeAwarenessUpdate(room.awareness, [...states.keys()]),
      );
      send(ws, encoding.toUint8Array(aw));
    }
    for (const data of early) handle(data);
  }

  const server: Server = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
      return;
    }
    res.writeHead(404).end();
  });
  const wss = new WebSocketServer({ server, maxPayload: 5 * 1024 * 1024 });
  wss.on('connection', (ws, req) => {
    onConnection(ws, req).catch((err) => {
      log(`connection failed: ${String(err)}`);
      ws.close(1011, 'server error');
    });
  });

  const saveTimer = setInterval(() => {
    for (const room of rooms.values()) void save(room);
  }, opts.saveEveryMs ?? 30_000);
  const cartTimer = setInterval(() => {
    for (const room of rooms.values()) if (room.name.startsWith('list:')) void moveCart(room);
  }, opts.cartCheckEveryMs ?? 60_000);

  return {
    server,
    rooms,
    /** Reload lists whose carts were waiting when the service last stopped. */
    async resumeCarts() {
      for (const name of await opts.store.pendingCarts()) {
        const room = getRoom(name);
        await room.ready;
        await moveCart(room);
      }
    },
    /** Test hook: run the 2-hour check now. */
    async checkCarts() {
      for (const room of [...rooms.values()])
        if (room.name.startsWith('list:')) await moveCart(room);
    },
    async flush() {
      await Promise.all([...rooms.values()].map(save));
    },
    async close() {
      clearInterval(saveTimer);
      clearInterval(cartTimer);
      for (const t of cartTimers.values()) clearTimeout(t);
      for (const client of wss.clients) client.terminate();
      await Promise.all([...rooms.values()].map(save));
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

export type SyncServer = ReturnType<typeof createSyncServer>;
