import { expect, test } from '@playwright/test';
import {
  expectNoHorizontalScroll,
  expectNoSeriousA11yViolations,
  openSeededPantry,
  setTextSize,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await openSeededPantry(page);
});

test('PAN-3 PAN-5 PAN-7 shelves, list filter and pantry labels', async ({ page }) => {
  await expect(page.getByText('26 items, shelved by what to use first')).toBeVisible();
  const lists = page.getByRole('group', { name: 'From list' });
  await expect(lists.getByRole('button')).toHaveText([
    /All lists\s*26/,
    /Apartment 4B/,
    /Family groceries/,
    /Diwali party/,
  ]);
  await expect(
    page.getByRole('article', { name: 'Paneer' }).getByText('Diwali party'),
  ).toBeVisible();
  await expectNoSeriousA11yViolations(page);
});

test('PAN-8 Used it counts down, then Undo restores', async ({ page }) => {
  const tomatoes = page.getByRole('article', { name: 'Tomatoes' });
  await tomatoes.getByRole('button', { name: 'Used it: Tomatoes' }).click();
  await expect(tomatoes.getByText('5 · Fridge')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(tomatoes.getByText('6 · Fridge')).toBeVisible();
});

test('PAN-8 SRS 8.6 last unit moves the jar to Ran out; PAN-9 then Add to list', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Used it: Spinach' }).click();
  const ranOut = page.getByRole('region', { name: /Ran out/ });
  await expect(ranOut.getByRole('article', { name: 'Spinach' })).toBeVisible();
  await ranOut.getByRole('button', { name: 'Add Spinach to Apartment 4B' }).click();
  await expect(
    ranOut.getByRole('article', { name: 'Spinach' }).getByText('On the list'),
  ).toBeVisible();
});

test('PAN-11 PAN-8 add, edit and delete an item from the sheet', async ({ page }, info) => {
  const add =
    info.project.name === 'mobile'
      ? page.getByRole('button', { name: 'Add item' }).first()
      : page.getByRole('button', { name: 'Add item' }).last();
  await add.click();
  const dialog = page.getByRole('dialog', { name: 'Add an item' });
  await dialog.getByLabel('Name').fill('Mangoes');
  await dialog.getByLabel('Quantity').fill('4');
  await dialog.getByRole('combobox', { name: 'List label' }).click();
  await page.getByRole('option', { name: 'Diwali party' }).click();
  await dialog.getByRole('button', { name: 'Add to pantry' }).click();
  const jar = page.getByRole('article', { name: 'Mangoes' });
  await expect(jar.getByText('Diwali party')).toBeVisible();

  await jar.getByRole('button', { name: 'Edit Mangoes' }).click();
  await page.getByRole('dialog', { name: 'Edit Mangoes' }).getByLabel('Quantity').fill('2');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(jar.getByText('2 · Fridge')).toBeVisible();

  await jar.getByRole('button', { name: 'Edit Mangoes' }).click();
  await page.getByRole('button', { name: 'Delete item' }).click();
  await expect(page.getByRole('article', { name: 'Mangoes' })).toHaveCount(0);
});

test('PAN-12 filters combine (Diwali party + Dairy & eggs)', async ({ page }) => {
  await page
    .getByRole('group', { name: 'From list' })
    .getByRole('button', { name: /Diwali party/ })
    .click();
  await page
    .getByRole('group', { name: 'Category' })
    .getByRole('button', { name: /Dairy & eggs/ })
    .click();
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article', { name: 'Paneer' })).toBeVisible();
});

test('SRS 8.7 changes persist on this device across reloads', async ({ page }) => {
  await page.getByRole('button', { name: 'Used it: Tomatoes' }).click();
  await expect(
    page.getByRole('article', { name: 'Tomatoes' }).getByText('5 · Fridge'),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('article', { name: 'Tomatoes' }).getByText('5 · Fridge'),
  ).toBeVisible();
});

test('rule 3: add and use items while offline', async ({ page, context }) => {
  await context.setOffline(true);
  await expect(page.getByText('Offline, changes will sync')).toBeVisible();
  await page.getByRole('button', { name: 'Used it: Tomatoes' }).click();
  await expect(
    page.getByRole('article', { name: 'Tomatoes' }).getByText('5 · Fridge'),
  ).toBeVisible();
  await context.setOffline(false);
});

test('A11Y-4 skip link jumps to the shelves; A11Y-6 no sideways scroll at 130%', async ({
  page,
}) => {
  await page.reload();
  await expect(page.getByRole('heading', { level: 2, name: /Use today/ })).toBeVisible();
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to items to use first' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#shelves')).toBeFocused();

  await setTextSize(page, 'largest');
  await page.reload();
  await expect(page.getByRole('heading', { level: 2, name: /Use today/ })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectNoSeriousA11yViolations(page);
});

test('A11Y-6 adding an item with an estimated date never widens the page on a phone', async ({
  page,
}, info) => {
  const add =
    info.project.name === 'mobile'
      ? page.getByRole('button', { name: 'Add item' }).first()
      : page.getByRole('button', { name: 'Add item' }).last();
  await add.click();
  await page.getByRole('dialog', { name: 'Add an item' }).getByLabel('Name').fill('Mangoes');
  await page.getByRole('button', { name: 'Add to pantry' }).click();
  await expect(page.getByRole('article', { name: 'Mangoes' }).getByText('· est.')).toBeVisible();
  await expectNoHorizontalScroll(page);
});
