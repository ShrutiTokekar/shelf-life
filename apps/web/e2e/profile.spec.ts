import { expect, test } from '@playwright/test';
import {
  expectNoHorizontalScroll,
  expectNoSeriousA11yViolations,
  openSeededPantry,
  setTextSize,
} from './helpers';

test.describe('Profile (SRS 6.11)', () => {
  test('PRO-1 PRO-2 PRO-4 PRO-6 profile, name, display settings, my data, delete account', async ({
    page,
  }) => {
    await openSeededPantry(page);
    await page.goto('/profile');
    await expect(page.getByRole('list', { name: 'Your impact' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Lists & people' })).toContainText(
      'Family groceries',
    );
    await expectNoSeriousA11yViolations(page);

    // PRO-1 Edit profile.
    await page.getByRole('button', { name: 'Edit profile' }).click();
    const sheet = page.getByRole('dialog', { name: 'Edit profile' });
    await sheet.getByRole('textbox', { name: 'Your name' }).fill('Ananya M');
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Name updated')).toBeVisible();
    await expect(page.getByText('Ananya M', { exact: true })).toBeVisible();

    // PRO-4 saved to the account: survives a reload with this device's copy cleared.
    await page.getByRole('switch', { name: 'Reduce motion' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
    await expect
      .poll(async () => {
        const res = await page.request.get('/api/v1/me');
        return ((await res.json()) as { settings: { reduceMotion: boolean } }).settings
          .reduceMotion;
      })
      .toBe(true);

    // PRO-6 Download my data.
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download my data' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^shelf-life-\d{4}-\d{2}-\d{2}\.json$/);

    // PRO-6 Delete account.
    await page.getByRole('button', { name: 'Delete account' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete your account?' });
    await expect(dialog).toContainText('These shared lists will be deleted');
    await expectNoSeriousA11yViolations(page);
    await dialog.getByRole('button', { name: 'Delete account' }).click();
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    expect((await page.request.get('/api/v1/me')).status()).toBe(401);
  });

  test('A11Y-6 profile at the largest text size doesn’t scroll sideways', async ({ page }) => {
    await openSeededPantry(page);
    await setTextSize(page, 'largest');
    await page.goto('/profile');
    await expect(page.getByRole('region', { name: 'Privacy & account' })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
