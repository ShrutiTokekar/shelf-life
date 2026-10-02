import { expect, test } from '@playwright/test';
import {
  expectNoHorizontalScroll,
  expectNoSeriousA11yViolations,
  openSeededPantry,
  setTextSize,
} from './helpers';

test.describe('Recipes (SRS 6.8, 6.9, 6.14)', () => {
  test('ANA-1..ANA-5 REC-1..REC-5 SAV-1..SAV-4 analyze, rank, save and open a recipe', async ({
    page,
  }) => {
    // E2E runs the API with the mock AI provider: no outside calls.
    await openSeededPantry(page);
    await page.goto('/recipes/analyze');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Checking what’s left' }),
    ).toBeVisible();
    const see = page.getByRole('button', { name: /^See \d+ recipes?$/ });
    await expect(see).toBeEnabled({ timeout: 15_000 });
    await expectNoSeriousA11yViolations(page);
    await see.click();

    await expect(
      page.getByRole('heading', { level: 1, name: 'Cook with what’s left' }),
    ).toBeVisible();
    await expect(page.getByTestId('ai-status')).toContainText(/AI checked \d+ items/);
    const hero = page.getByTestId('recipe-hero');
    await expect(hero).toContainText('Best match');
    await expect(hero).toContainText(/Why #1: /);
    await expect(page.getByTestId('recipe-row').first()).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    // SAV-2: save #1, find it on the Saved tab.
    const title = (await hero.getByRole('heading', { level: 2 }).textContent())!.replace(
      /^1\. Best match: /,
      '',
    );
    await hero.getByRole('button', { name: `Save ${title}` }).click();
    await expect(hero.getByRole('button', { name: `Save ${title}` })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('link', { name: /Saved · 1/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Saved recipes' })).toBeVisible();
    await expect(page.getByTestId('saved-recipe')).toContainText(title);
    await expectNoSeriousA11yViolations(page);

    // REC-5: open it.
    await page.getByTestId('saved-recipe').getByRole('link', { name: title }).click();
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Ingredients' })).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    // Saved survives a reload (kept on the account and on this device).
    await page.goto('/recipes/saved');
    await expect(page.getByTestId('saved-recipe')).toContainText(title);
  });

  test('6c Today’s expiring card offers to make the top recipe', async ({ page }) => {
    await openSeededPantry(page);
    await page.goto('/');
    const make = page.getByRole('link', { name: /^Make .+, uses your / }).first();
    await expect(make).toBeVisible();
    await make.click();
    await expect(page.getByRole('heading', { level: 2, name: 'Steps' })).toBeVisible();
  });

  test('A11Y-6 recipes at the largest text size: nothing clips or scrolls sideways', async ({
    page,
  }) => {
    await openSeededPantry(page);
    await setTextSize(page, 'largest');
    await page.goto('/recipes');
    await expect(page.getByTestId('recipe-hero')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
