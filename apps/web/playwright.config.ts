import { defineConfig, devices } from '@playwright/test';

const WEB = 'https://localhost:5173';
const API_PORT = 8788;

/**
 * E2E runs the real web app (Vite, https) against the real API with NODE_ENV=test, which adds a
 * test-only login route so Google OAuth isn't needed. Needs Postgres (pnpm db:up).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: {
    baseURL: WEB,
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @shelf-life/api e2e:serve',
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        DATABASE_URL:
          process.env.E2E_DATABASE_URL ??
          'postgres://postgres:postgres@localhost:5432/shelflife_test',
        BETTER_AUTH_SECRET: 'e2e-secret-e2e-secret-e2e-secret-e2e',
        GOOGLE_CLIENT_ID: 'e2e-google-client-id',
        GOOGLE_CLIENT_SECRET: 'e2e-google-client-secret',
        APP_URL: WEB,
      },
    },
    {
      command: 'pnpm --filter @shelf-life/web dev',
      url: WEB,
      ignoreHTTPSErrors: true,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
    },
  ],
});
