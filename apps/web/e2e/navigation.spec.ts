import { expect, test } from '@playwright/test';
import { completeOnboarding, expectNoSeriousA11yViolations, signInAsNewUser } from './helpers';

test.beforeEach(async ({ page }) => {
  await signInAsNewUser(page);
  await completeOnboarding(page);
});

test('SRS 5.1 mobile shows the bottom nav, desktop shows the header', async ({ page }, info) => {
  const nav = page.getByRole('navigation', { name: 'Primary' });
  if (info.project.name === 'mobile') {
    await expect(nav.getByRole('link', { name: 'Scan receipt' })).toBeVisible();
    await expect(page.getByRole('banner')).toBeHidden();
  } else {
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Grocery list' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Upload receipt' })).toBeVisible();
  }
});

test('SRS 5.1 nav moves between pages and marks the current one', async ({ page }, info) => {
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await expect(nav.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('link', { name: 'Pantry' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Pantry' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Pantry' })).toHaveAttribute('aria-current', 'page');
  const listName = info.project.name === 'mobile' ? 'List' : 'Grocery list';
  await nav.getByRole('link', { name: listName, exact: true }).click();
  await expect(page).toHaveURL(/\/lists\/[0-9a-f-]{36}$/);
});

test('A11Y-4 skip link is first and jumps to today’s priorities', async ({ page }) => {
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: "Skip to today's priorities" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#priorities')).toBeFocused();
});

test('A11Y-4 focused controls show a visible 3 px navy ring', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'Header tools are desktop only');
  const upload = page.getByRole('link', { name: 'Upload receipt' });
  // Reach it with the keyboard so :focus-visible applies, as it would for a real user.
  for (let i = 0; i < 20 && !(await upload.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab');
  }
  await expect(upload).toBeFocused();
  const outline = await upload.evaluate((el) => {
    const s = getComputedStyle(el);
    return { width: s.outlineWidth, style: s.outlineStyle, color: s.outlineColor };
  });
  expect(outline).toEqual({ width: '3px', style: 'solid', color: 'rgb(77, 92, 159)' });
});

test('A11Y-3 nav targets are at least 44×44 px', async ({ page }) => {
  const links = page.getByRole('navigation', { name: 'Primary' }).getByRole('link');
  for (const link of await links.all()) {
    const box = await link.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});

test('A11Y-7 high contrast toggle swaps secondary text to ink', async ({ page }, info) => {
  test.skip(
    info.project.name === 'mobile',
    'Toggle lives in the desktop header (Profile on mobile, M8)',
  );
  await page.getByRole('button', { name: 'High contrast' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
  const slate = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--slate').trim(),
  );
  expect(slate.toLowerCase()).toBe('#2b3360');
  await expectNoSeriousA11yViolations(page);
});
