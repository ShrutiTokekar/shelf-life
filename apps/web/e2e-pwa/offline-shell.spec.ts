import { expect, test } from '@playwright/test';

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
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();

  // Wait for the service worker to install and take control of the page.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
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

  // Reload straight away, as a user might: the write must already be on its way to IndexedDB.
  await page.reload();
  await expect(page.getByRole('article', { name: 'Paneer' })).toBeVisible();
});
