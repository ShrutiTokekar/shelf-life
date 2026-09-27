import { expect, test } from '@playwright/test';
import {
  completeOnboarding,
  expectNoHorizontalScroll,
  expectNoSeriousA11yViolations,
  setTextSize,
  signInAsNewUser,
} from './helpers';

for (const size of ['default', 'largest'] as const) {
  test.describe(`text size ${size}`, () => {
    test(`A11Y-6 Welcome has no serious violations and no sideways scroll (${size})`, async ({
      page,
    }) => {
      await page.goto('/welcome');
      await setTextSize(page, size);
      await page.reload();
      await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
      await expectNoSeriousA11yViolations(page);
      await expectNoHorizontalScroll(page);
    });

    test(`A11Y-6 Onboarding and Today have no serious violations (${size})`, async ({ page }) => {
      await signInAsNewUser(page);
      await page.goto('/onboarding');
      await setTextSize(page, size);
      await page.reload();
      await expect(page.getByRole('textbox', { name: 'List name' })).toBeVisible();
      await expectNoSeriousA11yViolations(page);
      await expectNoHorizontalScroll(page);

      await page.getByRole('button', { name: 'Create home list' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-text-size', size);
      await expectNoSeriousA11yViolations(page);
      await expectNoHorizontalScroll(page);
    });
  });
}

test('SRS 6 offline state: the page stays usable and shows the offline banner', async ({
  page,
  context,
}) => {
  await signInAsNewUser(page);
  await completeOnboarding(page);
  await context.setOffline(true);
  await expect(
    page.getByRole('status').filter({ hasText: 'Offline, changes will sync' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText('Offline, changes will sync')).toBeHidden();
});
