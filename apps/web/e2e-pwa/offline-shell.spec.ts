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
