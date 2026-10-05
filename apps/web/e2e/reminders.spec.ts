import { expect, test } from '@playwright/test';
import {
  expectNoHorizontalScroll,
  expectNoSeriousA11yViolations,
  openSeededPantry,
  setTextSize,
} from './helpers';

test.describe('Reminders (SRS 6.10)', () => {
  test('RMD-1..RMD-3 something runs out → reminder → Add to list → on the list', async ({
    page,
  }) => {
    await openSeededPantry(page);
    // Run something out from the pantry (the sample pantry's Tortillas).
    await page.getByRole('button', { name: /^Edit Tortillas/ }).click();
    await page.getByRole('button', { name: 'Mark as ran out' }).click();

    await page.goto('/reminders');
    await expect(page.getByRole('heading', { level: 1, name: 'Reminders' })).toBeVisible();
    const tortillas = page.getByRole('listitem', { name: /Tortillas/ });
    await expect(tortillas).toContainText('Ran out today · You used the last of it');
    await expectNoSeriousA11yViolations(page);

    await tortillas.getByRole('button', { name: 'Add Tortillas to the list' }).click();
    await expect(tortillas.getByRole('button')).toHaveCount(0);
    await page.goto('/lists');
    await expect(page.getByText('Tortillas').first()).toBeVisible();
  });

  test('A11Y-6 reminders at the largest text size don’t scroll sideways', async ({ page }) => {
    await openSeededPantry(page);
    await setTextSize(page, 'largest');
    await page.goto('/reminders');
    await expect(page.getByRole('heading', { level: 1, name: 'Reminders' })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
