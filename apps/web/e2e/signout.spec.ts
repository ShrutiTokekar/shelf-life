import { expect, test } from '@playwright/test';
import { completeOnboarding, expectNoSeriousA11yViolations, signInAsNewUser } from './helpers';

test('PRO-6 sign out ends the session and returns to Welcome', async ({ page }) => {
  await signInAsNewUser(page);
  await completeOnboarding(page);

  // Mobile reaches Profile from the Today top bar, desktop from the header avatar.
  const account = page.getByRole('link', { name: 'Account, Ananya Mehta' });
  await account.filter({ visible: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Profile' })).toBeVisible();
  await expectNoSeriousA11yViolations(page);

  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();

  // The server session is gone, not just the UI state.
  expect((await page.request.get('/api/v1/me')).status()).toBe(401);
  expect(await page.evaluate(() => localStorage.getItem('shelf-life:me'))).toBeNull();
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
});

test('SEC-9 Sign out on all devices ends the session on the other device too', async ({
  page,
  browser,
}) => {
  await signInAsNewUser(page);
  await completeOnboarding(page);
  // A second device signed in to the same account.
  const other = await browser.newContext({
    ignoreHTTPSErrors: true,
    storageState: await page.context().storageState(),
  });
  const phone = await other.newPage();
  await phone.goto('/');
  await expect(phone.getByRole('heading', { level: 1, name: /today/i })).toBeVisible();

  await page.goto('/profile');
  await page.getByRole('button', { name: /Sign out on all devices/ }).click();
  await expect(page).toHaveURL(/\/welcome$/);

  expect((await phone.request.get('/api/v1/me')).status()).toBe(401);
  // The other device notices on its next request and wipes its copy.
  await phone.reload();
  await expect(phone).toHaveURL(/\/welcome$/);
  await expect(phone.getByText(/You were signed out to keep your account safe/)).toBeVisible();
  expect(await phone.evaluate(() => localStorage.getItem('shelf-life:me'))).toBeNull();
  await other.close();
});
