import { expect, test } from '@playwright/test';
import {
  expectNoHorizontalScroll,
  expectNoSeriousA11yViolations,
  openSeededPantry,
  setTextSize,
} from './helpers';

test.describe('Today (SRS 6.2)', () => {
  test('TOD-1..TOD-7 priorities from the sample pantry, finishing one, and the timeline', async ({
    page,
  }) => {
    await openSeededPantry(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: /need(s)? you today/ })).toBeVisible();
    const cards = page.getByTestId('priority');
    await expect(cards).toHaveCount(3);
    await expect(page.getByText('0 of 3 done')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your shelf life' })).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    // Finish #1 with one tap; progress updates.
    await cards
      .first()
      .getByRole('button', { name: /^Used it/ })
      .click();
    await expect(page.getByText(/^1 of \d done$/)).toBeVisible();

    // A timeline chip opens the item.
    await page.getByRole('list', { name: 'Later' }).getByRole('button').first().click();
    await expect(page.getByRole('dialog', { name: /^Edit / })).toBeVisible();
  });

  test('A11Y-6 at the largest text size nothing clips or scrolls sideways', async ({ page }) => {
    await openSeededPantry(page);
    await setTextSize(page, 'largest');
    await page.goto('/');
    await expect(page.getByTestId('priority').first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('TOD-8 web shows the grocery list preview and recent activity', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'web-only panels');
    await openSeededPantry(page);
    await page.goto('/');
    await expect(page.getByRole('region', { name: /Grocery list · \d+ to buy/ })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Since yesterday' })).toBeVisible();
  });
});
