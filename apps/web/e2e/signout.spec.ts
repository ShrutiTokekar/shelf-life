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

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();

  // The server session is gone, not just the UI state.
  expect((await page.request.get('/api/v1/me')).status()).toBe(401);
  expect(await page.evaluate(() => localStorage.getItem('shelf-life:me'))).toBeNull();
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
});
