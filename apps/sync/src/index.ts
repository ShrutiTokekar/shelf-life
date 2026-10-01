import { createDb } from '@shelf-life/api/sync';
import { loadEnv } from './env';
import { createSyncServer } from './server';
import { dbStore } from './store';

const env = loadEnv();
const { db, close } = createDb(env.DATABASE_URL);
const sync = createSyncServer({
  store: dbStore(db),
  secret: env.SYNC_JWT_SECRET,
  log: (msg) => console.log(`[sync] ${msg}`),
});

sync.server.listen(env.SYNC_PORT, () => {
  console.log(`Shelf Life sync listening on ws://localhost:${env.SYNC_PORT}/doc/:name`);
  sync.resumeCarts().catch((err: unknown) => console.error('[sync] resume failed', err));
});

// Save every open doc before the platform stops the container.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    void sync
      .close()
      .then(close)
      .finally(() => process.exit(0));
  });
}
