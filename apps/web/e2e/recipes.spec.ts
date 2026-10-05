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

test.describe('Recipe + cook-along (SRS 6.15)', () => {
  test('RCP-3 RCP-7 RCP-10 scale, cook along step by step, then "I made this"', async ({
    page,
  }) => {
    await openSeededPantry(page);
    await page.goto('/recipes/masala-omelette');
    await expect(page.getByRole('heading', { level: 1, name: 'Masala omelette' })).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    // Scale 1 → 2 servings: 2 eggs become 4.
    const servings = page.getByRole('group', { name: 'Servings: 1' });
    await servings.getByRole('button', { name: 'More servings' }).click();
    await expect(page.getByTestId('ingredient').first()).toContainText('4 Eggs');

    // Cook-along: full screen, step by step.
    await page
      .getByRole('link', { name: /Start cook/ })
      .first()
      .click();
    await expect(page.getByText('Step 1 of 3 · Masala omelette')).toBeVisible();
    await expectNoSeriousA11yViolations(page);
    await page.getByRole('button', { name: /Next step/ }).click();
    await expect(page.getByRole('button', { name: 'Start 1:00 timer' })).toBeVisible();
    await page.getByRole('button', { name: /Next step/ }).click();
    await page.getByRole('button', { name: /^Finish$/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'All done!' })).toBeVisible();

    // I made this: the sample pantry's eggs ran out today, so nothing to subtract from them;
    // whatever else it used is listed. Saving records it in History.
    await page.getByRole('button', { name: 'I made this' }).click();
    const sheet = page.getByRole('dialog', { name: 'Nice! What did you use?' });
    await expect(sheet).toBeVisible();
    await expectNoSeriousA11yViolations(page);
    await sheet.getByRole('button', { name: 'Save to pantry' }).click();
    await expect(page.getByText(/you made Masala omelette/)).toBeVisible();

    await page.goto('/recipes/history');
    await expect(page.getByTestId('cooked-recipe')).toContainText('Masala omelette');
  });

  test('A11Y-6 the recipe page at the largest text size doesn’t scroll sideways', async ({
    page,
  }) => {
    await openSeededPantry(page);
    await setTextSize(page, 'largest');
    await page.goto('/recipes/palak-paneer-quick');
    await expect(page.getByRole('heading', { level: 2, name: 'Steps' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.goto('/recipes/palak-paneer-quick/cook');
    await expect(page.getByText(/Step 1 of 5/)).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

test.describe('AI swap + chat (RCP-4, RCP-8)', () => {
  test('chat answers with actions that change the recipe; the safety footer is shown', async ({
    page,
  }, info) => {
    // E2E runs the API with the mock AI provider: no outside calls.
    await openSeededPantry(page);
    await page.goto('/recipes/black-bean-quesadillas');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Black bean and pepper quesadillas' }),
    ).toBeVisible();

    // Wide screens show the chat as a side panel (web 17); otherwise "Ask AI" opens a sheet.
    const wide = (page.viewportSize()?.width ?? 0) >= 1280;
    if (!wide) await page.getByRole('button', { name: 'Ask AI' }).first().click();
    const chat = wide
      ? page.getByRole('region', { name: 'Ask Shelf Life AI' })
      : page.getByRole('dialog', { name: 'Ask Shelf Life AI' });
    await expect(chat.getByText(/AI can make mistakes/)).toBeVisible();

    await chat.getByRole('button', { name: 'Make it for 4' }).click();
    const log = chat.getByRole('log');
    await expect(log).toContainText('for 4 servings (mock)');
    await expectNoSeriousA11yViolations(page);
    await log.getByRole('button', { name: 'Make it for 4' }).click();
    await expect(log.getByRole('button', { name: 'Make it for 4, done' })).toBeDisabled();
    if (!wide) await page.keyboard.press('Escape');
    await expect(page.getByRole('group', { name: 'Servings: 4' })).toBeVisible();
    info.annotations.push({ type: 'layout', description: wide ? 'side panel' : 'sheet' });
  });
});
