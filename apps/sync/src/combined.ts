/**
 * Production entry on Render's free plan (one free web service): the API and the sync service in
 * one process on one port. Sync is served at /sync/doc/:name; everything else is the API.
 * Local development and E2E still run them as two processes (`pnpm dev`).
 */
import { dbStore } from './store';
import { createSyncServer } from './server';
import { loadEnv, startApi } from '@shelf-life/api/sync';

const env = loadEnv();
const { server, db, close } = await startApi(env);
const sync = createSyncServer({
  store: dbStore(db),
  secret: env.SYNC_JWT_SECRET,
  server,
  pathPrefix: '/sync',
  log: (msg) => console.log(`[sync] ${msg}`),
});
console.log('Shelf Life sync listening on the same port at /sync/doc/:name');
sync.resumeCarts().catch((err: unknown) => console.error('[sync] resume failed', err));

// Render sends SIGTERM before stopping (including when a free instance spins down): save docs.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    void sync
      .close()
      .then(() => new Promise<void>((resolve) => server.close(() => resolve())))
      .then(close)
      .finally(() => process.exit(0));
  });
}
