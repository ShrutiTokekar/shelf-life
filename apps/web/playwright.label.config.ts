import { defineConfig } from '@playwright/test';

const WEB_PORT = 5176;
const WEB = `http://localhost:${WEB_PORT}`;

/**
 * `pnpm receipts:label`: reads the receipt photos in tests/receipts/photos with the app's own OCR
 * pipeline, in a local browser, and writes draft labels (text only). No API, nothing leaves this
 * machine. See tests/receipts/README.md.
 */
export default defineConfig({
  testDir: './e2e-label',
  workers: 1,
  timeout: 180_000,
  reporter: 'list',
  use: { baseURL: WEB },
  webServer: {
    command: 'pnpm --filter @shelf-life/web dev',
    url: WEB,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { PLAIN_HTTP: '1', WEB_PORT: String(WEB_PORT) },
  },
});
