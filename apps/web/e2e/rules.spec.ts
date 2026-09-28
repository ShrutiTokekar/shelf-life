import { expect, test, type Page } from '@playwright/test';
import {
  completeOnboarding,
  expectNoHorizontalScroll,
  setTextSize,
  signInAsNewUser,
} from './helpers';

/** A11Y-3: every visible interactive control is at least 44×44 px (skip links excluded). */
async function expectTargetsAtLeast44(page: Page) {
  const small = await page.evaluate(() => {
    const els = [
      ...document.querySelectorAll<HTMLElement>(
        'a[href], button, input, select, textarea, [role="radio"]',
      ),
    ];
    return els
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const visible = r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
        const skip = el.getAttribute('href')?.startsWith('#');
        return visible && !skip && (r.width < 44 || r.height < 44);
      })
      .map(
        (el) =>
          `${el.tagName} "${el.getAttribute('aria-label') ?? el.textContent?.trim()}" ${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`,
      );
  });
  expect(small).toEqual([]);
}

test('A11Y-3 all controls on Welcome, setup, Today and Profile are at least 44 px', async ({
  page,
}) => {
  await page.goto('/welcome');
  await expectTargetsAtLeast44(page);
  await signInAsNewUser(page);
  await page.goto('/onboarding');
  await expectTargetsAtLeast44(page);
  await completeOnboarding(page);
  await expectTargetsAtLeast44(page);
  await page.goto('/profile');
  await expect(page.getByRole('heading', { level: 1, name: 'Profile' })).toBeVisible();
  await expectTargetsAtLeast44(page);
});

test('A11Y-6 header survives Largest text at the narrowest desktop width (1024 px)', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'mobile', 'Desktop header only');
  await page.setViewportSize({ width: 1024, height: 768 });
  await signInAsNewUser(page);
  await completeOnboarding(page);
  await setTextSize(page, 'largest');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-text-size', 'largest');
  await expect(page.getByRole('banner')).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test('Rule 9: fonts are self-hosted WOFF2 and actually load', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) external.push(r.url());
  });
  await page.goto('/welcome');
  const loaded = await page.evaluate(async () => {
    const families = ['Fredoka', 'Abril Fatface', 'Agbalumo'];
    return Promise.all(
      families.map(async (f) => (await document.fonts.load(`16px "${f}"`, 'Aa')).length > 0),
    );
  });
  expect(loaded).toEqual([true, true, true]);
  expect(external).toEqual([]);
});
