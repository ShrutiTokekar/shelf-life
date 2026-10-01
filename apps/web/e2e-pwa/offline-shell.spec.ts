import { expect, test, type Page } from '@playwright/test';

/**
 * Wait until this device's pantry writes have committed to IndexedDB. A read-only transaction on
 * the same store only completes after earlier write transactions do, so this is deterministic (no
 * sleeps). Needed because a reload in the very same instant as a change can abort that last,
 * still-uncommitted write (measured: a few milliseconds; ~1 in 30 immediate reloads).
 */
async function waitForPantryWrites(page: Page) {
  await page.evaluate(async () => {
    for (const { name } of await indexedDB.databases()) {
      if (!name?.startsWith('shelf-life:pantry:')) continue;
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(name);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('updates', 'readonly');
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
    }
  });
}

// SEC-1: the production build's Content Security Policy must not block anything the app does.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as unknown as { cspViolations: string[] }).cspViolations ??= [];
      (window as unknown as { cspViolations: string[] }).cspViolations.push(
        `${e.violatedDirective} ${e.blockedURI}`,
      );
    });
  });
  page.on('console', (msg) => {
    if (/Content Security Policy/i.test(msg.text())) cspErrors.push(msg.text());
  });
});
const cspErrors: string[] = [];
test.afterEach(() => {
  expect(cspErrors).toEqual([]);
  cspErrors.length = 0;
});

test('SRS 12.4 the installed app opens offline: shell from the service worker, account from cache', async ({
  page,
  context,
  baseURL,
}) => {
  const email = `pwa-${Date.now()}@example.com`;
  const login = await page.request.post('/api/v1/test/login', {
    data: { email, name: 'Ananya Mehta' },
    headers: { origin: baseURL! },
  });
  expect(login.ok()).toBe(true);

  await page.goto('/');
  await page.getByRole('button', { name: 'Create home list' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /today/i })).toBeVisible();

  // Wait for the service worker to install and take control of the page.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: /today/i })).toBeVisible();
  await expect(page.getByText('Offline, changes will sync')).toBeVisible();

  // Client-side navigation keeps working offline.
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Pantry' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Pantry' })).toBeVisible();
});

test('SRS 12.4 the pantry opens offline from this device', async ({ page, context, baseURL }) => {
  const email = `pwa-pantry-${Date.now()}@example.com`;
  await page.request.post('/api/v1/test/login', {
    data: { email, name: 'Ananya Mehta' },
    headers: { origin: baseURL! },
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Create home list' }).click();
  await page.goto('/pantry');
  // Production build: no sample loader, so add an item by hand.
  await expect(page.getByRole('button', { name: 'Load sample pantry' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add item' }).first().click();
  await page.getByRole('dialog').getByLabel('Name').fill('Spinach');
  await page.getByRole('button', { name: 'Add to pantry' }).click();
  await expect(page.getByRole('article', { name: 'Spinach' })).toBeVisible();

  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  // Let the page finish opening (and syncing) before the network drops, as a person would.
  await expect(page.getByRole('article', { name: 'Spinach' })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('article', { name: 'Spinach' })).toBeVisible();
});

test('rule 3 SRS 12.4 an item added while offline is still there after an offline reload', async ({
  page,
  context,
  baseURL,
}) => {
  const email = `pwa-offline-add-${crypto.randomUUID()}@example.com`;
  const login = await page.request.post('/api/v1/test/login', {
    data: { email, name: 'Ananya Mehta' },
    headers: { origin: baseURL! },
  });
  expect(login.ok(), `test login failed: ${login.status()} ${await login.text()}`).toBe(true);
  await page.goto('/');
  await page.getByRole('button', { name: 'Create home list' }).click();
  await page.goto('/pantry');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await expect(page.getByRole('heading', { name: 'Your pantry is empty' })).toBeVisible();

  await context.setOffline(true);
  await expect(page.getByText('Offline, changes will sync')).toBeVisible();
  await page.getByRole('button', { name: 'Add item' }).first().click();
  await page.getByRole('dialog').getByLabel('Name').fill('Paneer');
  await page.getByRole('button', { name: 'Add to pantry' }).click();
  await expect(page.getByRole('article', { name: 'Paneer' })).toBeVisible();

  // Once the write has committed, it survives an offline reload.
  await waitForPantryWrites(page);
  await page.reload();
  await expect(page.getByRole('article', { name: 'Paneer' })).toBeVisible();
});

test('rule 3 decision 1: after the first scan, scanning works offline (engine cached)', async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const { receiptPng } = await import('../e2e/receiptImage');
  const email = `pwa-scan-${crypto.randomUUID()}@example.com`;
  const login = await page.request.post('/api/v1/test/login', {
    data: { email, name: 'Ananya Mehta' },
    headers: { origin: baseURL! },
  });
  expect(login.ok()).toBe(true);
  await page.goto('/');
  await page.getByRole('button', { name: 'Create home list' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /today/i })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  const text = 'PATEL BROTHERS\nPANEER 400G   5.49\nCILANTRO      0.99\nTOTAL         6.48';
  const scan = async () => {
    await page.goto('/scan');
    await page.getByTestId('file-input').setInputFiles({
      name: 'r.png',
      mimeType: 'image/png',
      buffer: await receiptPng(page, text),
    });
    await expect(page.getByRole('heading', { level: 1, name: 'Review items' })).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByText('2 groceries found', { exact: false })).toBeVisible();
  };

  // First scan online downloads and caches the engine.
  await scan();
  const cached = await page.evaluate(async () =>
    (await (await caches.open('shelf-life-ocr')).keys()).map((r) => new URL(r.url).pathname).sort(),
  );
  expect(cached).toEqual(
    expect.arrayContaining(['/ocr/lang/eng.traineddata.gz', '/ocr/worker.min.js']),
  );

  await context.setOffline(true);
  await scan();
  // REV-7 offline: the review saves locally and the receipt shows in history (SRS 12.4).
  await page.getByRole('button', { name: 'Add 2 items to pantry' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Your pantry' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Paneer' })).toBeVisible();
  await page.goto('/profile/receipts');
  await expect(page.getByRole('link', { name: 'Patel Brothers' })).toBeVisible();
});

test('rule 3 LST-10 the grocery list works offline and syncs when back online', async ({
  page,
  context,
  baseURL,
}) => {
  const email = `pwa-list-${crypto.randomUUID()}@example.com`;
  await page.request.post('/api/v1/test/login', {
    data: { email, name: 'Ananya Mehta' },
    headers: { origin: baseURL! },
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Create home list' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /today/i })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.getByRole('link', { name: /List/ }).first().click();
  await expect(page.getByText(/Live/).first()).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/Offline · changes will sync/)).toBeVisible();
  await page.getByRole('textbox', { name: 'Add to the list' }).fill('eggs');
  await page.getByRole('textbox', { name: 'Add to the list' }).press('Enter');
  await expect(page.getByRole('checkbox', { name: 'Eggs' })).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText(/Live/).first()).toBeVisible({ timeout: 15_000 });
  // A second device (a fresh page in the same account) gets the item from the server.
  const other = await context.browser()!.newContext({ storageState: await context.storageState() });
  const second = await other.newPage();
  await second.goto(new URL(page.url()).pathname);
  await expect(second.getByRole('checkbox', { name: 'Eggs' })).toBeVisible({ timeout: 15_000 });
  await other.close();
});
