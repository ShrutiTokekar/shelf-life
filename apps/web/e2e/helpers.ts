import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export const ORIGIN = 'https://localhost:5174';

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
  await expect(page.getByRole('heading', { level: 1, name: /today/i })).toBeVisible();
}

/**
 * SRS 13: zero serious or critical axe violations. While a modal dialog is open only the dialog
 * is checked: the page behind it is dimmed, inert and hidden from assistive tech, and axe's
 * contrast check misreads it through the overlay. Pages are checked with the dialog closed too.
 */
export async function expectNoSeriousA11yViolations(page: Page) {
  const modal = page.locator('[role="dialog"], [role="alertdialog"]').filter({ visible: true });
  const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  if ((await modal.count()) > 0) builder.include('[role="dialog"], [role="alertdialog"]');
  const results = await builder.analyze();
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

/**
 * A11Y-6: no sideways scroll or clipping. Three checks:
 * 1. the page doesn't scroll sideways;
 * 2. nothing sticks out past the viewport edge (catches fixed elements like the bottom nav, which
 *    don't add to scroll width); content inside intentional sideways scrollers is ignored;
 * 3. on phones the layout width still equals the device width: mobile browsers widen the layout
 *    and zoom out to fit overflowing content, which hides it from checks 1 and 2.
 */
export async function expectNoHorizontalScroll(page: Page) {
  const result = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const clipped = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.right <= vw + 1) return false;
        for (let p = el.parentElement; p; p = p.parentElement) {
          if (['auto', 'scroll', 'hidden'].includes(getComputedStyle(p).overflowX)) return false;
        }
        return true;
      })
      .slice(0, 5)
      .map(
        (el) =>
          `${el.tagName} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}"`,
      );
    return {
      overflow: document.documentElement.scrollWidth - vw,
      clipped,
      innerWidth: window.innerWidth,
    };
  });
  expect(result.overflow).toBeLessThanOrEqual(0);
  expect(result.clipped).toEqual([]);
  const viewport = page.viewportSize();
  if (viewport) expect(result.innerWidth).toBe(viewport.width);
}

/** Signed-in user with a home list, the dev seed (extra lists + members) and the sample pantry. */
export async function openSeededPantry(page: Page) {
  await signInAsNewUser(page);
  await completeOnboarding(page, 'Apartment 4B');
  const seeded = await page.request.post('/api/v1/test/seed-demo', { headers: { origin: ORIGIN } });
  expect(seeded.ok()).toBe(true);
  await page.goto('/pantry');
  await page.getByRole('button', { name: 'Load sample pantry' }).click();
  await expect(page.getByRole('heading', { level: 2, name: /Use today/ })).toBeVisible();
}
