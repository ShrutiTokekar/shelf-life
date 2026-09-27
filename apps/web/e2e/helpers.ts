import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export const ORIGIN = 'https://localhost:5173';

/** Signs in through the test-only API route (exists only when the API runs with NODE_ENV=test). */
export async function signInAsNewUser(page: Page, name = 'Ananya Mehta') {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const res = await page.request.post('/api/v1/test/login', {
    data: { email, name },
    headers: { origin: ORIGIN },
  });
  expect(res.ok()).toBe(true);
  return { email };
}

/** Finish home list setup with defaults. */
export async function completeOnboarding(page: Page, name = 'Home') {
  await page.goto('/');
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole('textbox', { name: 'List name' }).fill(name);
  await page.getByRole('button', { name: 'Create home list' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
}

/** SRS 13: zero serious or critical axe violations. */
export async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const serious = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  expect(serious).toEqual([]);
}

/** A11Y-6: set the text size the way the app does, without clicking through the UI. */
export async function setTextSize(page: Page, size: 'default' | 'large' | 'largest') {
  await page.evaluate((s) => {
    localStorage.setItem(
      'shelf-life:ui-settings',
      JSON.stringify({
        state: { textSize: s, highContrast: false, reduceMotion: false },
        version: 0,
      }),
    );
  }, size);
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}
