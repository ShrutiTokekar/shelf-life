import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'api',
    // PGlite boots Postgres in WebAssembly and runs migrations per test; slow when every project
    // runs at once.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      BETTER_AUTH_SECRET: 'test-secret-at-least-32-characters-long!!',
      SYNC_JWT_SECRET: 'test-sync-secret-at-least-32-characters!!',
      // The per-minute AI limit has its own test; don't let it trip the per-pantry one.
      AI_PER_MINUTE_LIMIT: '1000',
      GOOGLE_CLIENT_ID: 'test-google-client-id',
      GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
      APP_URL: 'https://localhost:5173',
      API_URL: 'https://localhost:5173',
    },
  },
});
