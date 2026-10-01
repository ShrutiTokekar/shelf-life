import { defineConfig, devices } from '@playwright/test';

const WEB_PORT = 5175;
const SYNC_PORT = 8792;
const API_PORT = 8789;
const WEB = `http://localhost:${WEB_PORT}`;

/**
 * Rule 3 / SRS 12.4: offline app shell. Runs the production build (with the Workbox service
 * worker) over http://localhost, since Chrome won't register a service worker on the
 * self-signed dev certificate.
 */
export default defineConfig({
  testDir: './e2e-pwa',
  reporter: process.env.CI ? [['github']] : 'list',
  use: { baseURL: WEB, ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
  webServer: [
    {
      command: 'pnpm --filter @shelf-life/api e2e:serve',
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        DATABASE_URL:
          process.env.E2E_DATABASE_URL ??
          'postgres://postgres:postgres@localhost:5432/shelflife_test',
        BETTER_AUTH_SECRET: 'e2e-secret-e2e-secret-e2e-secret-e2e',
        SYNC_JWT_SECRET: 'e2e-sync-secret-e2e-sync-secret-e2e-s',
        GOOGLE_CLIENT_ID: 'e2e-google-client-id',
        GOOGLE_CLIENT_SECRET: 'e2e-google-client-secret',
        APP_URL: WEB,
      },
    },
    {
      // SRS 11.2 sync service, for live lists and the two-device test.
      command: 'pnpm --filter @shelf-life/sync start',
      url: `http://localhost:${SYNC_PORT}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        SYNC_PORT: String(SYNC_PORT),
        DATABASE_URL:
          process.env.E2E_DATABASE_URL ??
          'postgres://postgres:postgres@localhost:5432/shelflife_test',
        SYNC_JWT_SECRET: 'e2e-sync-secret-e2e-sync-secret-e2e-s',
      },
    },
    {
      command: 'pnpm exec vite build && pnpm exec vite preview',
      url: WEB,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        PLAIN_HTTP: '1',
        WEB_PORT: String(WEB_PORT),
        API_PROXY_TARGET: `http://localhost:${API_PORT}`,
        SYNC_PROXY_TARGET: `ws://localhost:${SYNC_PORT}`,
      },
    },
  ],
});
