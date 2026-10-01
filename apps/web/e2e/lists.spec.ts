import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  completeOnboarding,
  expectNoSeriousA11yViolations,
  ORIGIN,
  signInAsNewUser,
} from './helpers';

/** A signed-in user with a home list, in their own browser context (a separate "device"). */
async function device(
  browser: Browser,
  name: string,
  listName: string,
  viewport: Page['viewportSize'],
) {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: viewport() ?? { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await signInAsNewUser(page, name);
  await completeOnboarding(page, listName);
  return { context, page };
}

async function listIdOf(page: Page, name: string) {
  const me = (await (await page.request.get('/api/v1/me')).json()) as {
    lists: { id: string; name: string }[];
  };
  return me.lists.find((l) => l.name === name)!.id;
}

const rowOf = (page: Page, name: string) =>
  page.getByTestId('list-row').filter({ has: page.getByRole('checkbox', { name, exact: true }) });

test.describe('Lists + sharing, two devices (SRS 15.1 Milestone 5)', () => {
  test.setTimeout(120_000);

  test('LST-10 SHR-3 SHR-5 SHR-6 LST-7 invite, live edits, offline merge, view-only, cart → pantry', async ({
    browser,
    page: first,
  }) => {
    const viewport = () => first.viewportSize();
    const ananya = await device(browser, 'Ananya Mehta', 'Apartment 4B', viewport);
    const maya = await device(browser, 'Maya Rao', 'Maya’s place', viewport);
    const a = ananya.page;
    const m = maya.page;
    const homeId = await listIdOf(a, 'Apartment 4B');

    // SHR-3: Ananya shares her home list; Maya joins with the link.
    const res = await a.request.post(`/api/v1/lists/${homeId}/invites`, {
      data: { role: 'edit' },
      headers: { origin: ORIGIN },
    });
    const { url } = (await res.json()) as { url: string };
    await m.goto(new URL(url).pathname);
    await expect(
      m.getByText('Ananya Mehta invited you to “Apartment 4B” (Can edit).'),
    ).toBeVisible();
    await expect(m.getByText(/also see their pantry/)).toBeVisible();
    await m.getByRole('button', { name: 'Join list' }).click();
    await expect(m).toHaveURL(new RegExp(`/lists/${homeId}$`));
    await expect(m.getByText(/Live/).first()).toBeVisible();

    await a.goto(`/lists/${homeId}`);
    await expect(a.getByText(/Live/).first()).toBeVisible();
    await expectNoSeriousA11yViolations(a);

    // LST-2 + LST-10: one device adds, the other sees it in under a second.
    await a.getByRole('textbox', { name: 'Add to the list' }).fill('2 onions and eggs');
    const added = Date.now();
    await a.getByRole('textbox', { name: 'Add to the list' }).press('Enter');
    await expect(rowOf(m, 'Onions')).toBeVisible({ timeout: 5_000 });
    expect(Date.now() - added).toBeLessThan(1_000 + 500); // 1 s target plus UI/test overhead
    await expect(rowOf(m, 'Eggs')).toBeVisible();

    // LST-5 claims show up for everyone.
    await rowOf(m, 'Eggs')
      .getByRole('button', { name: /I’ll get it: Eggs/ })
      .click();
    await expect(rowOf(a, 'Eggs')).toContainText('Maya Rao is getting it');

    // LST-10: offline edits on both sides merge on reconnect.
    await ananya.context.setOffline(true);
    await a.getByRole('textbox', { name: 'Add to the list' }).fill('milk');
    await a.getByRole('textbox', { name: 'Add to the list' }).press('Enter');
    await m.getByRole('textbox', { name: 'Add to the list' }).fill('atta');
    await m.getByRole('textbox', { name: 'Add to the list' }).press('Enter');
    await expect(rowOf(a, 'Milk')).toBeVisible();
    await expect(rowOf(a, 'Atta')).toHaveCount(0);
    await ananya.context.setOffline(false);
    await expect(rowOf(a, 'Atta')).toBeVisible({ timeout: 15_000 });
    await expect(rowOf(m, 'Milk')).toBeVisible({ timeout: 15_000 });

    // LST-7: Maya checks Onions off and taps Done shopping; the sync service moves it into
    // Ananya's pantry, labeled with this list.
    await rowOf(m, 'Onions').getByRole('checkbox', { name: 'Onions' }).check();
    await expect(a.getByText(/1 in cart/)).toBeVisible();
    await m.getByRole('button', { name: 'Done shopping' }).first().click();
    await expect(rowOf(m, 'Onions')).toHaveCount(0, { timeout: 10_000 });
    await a.goto('/pantry');
    const jar = a.getByRole('article', { name: 'Onions' });
    await expect(jar).toBeVisible({ timeout: 10_000 });
    await expect(jar).toContainText('Apartment 4B');

    // SHR-6: Maya can open the shared home pantry from her Pantry page.
    await m.goto('/pantry');
    await m.getByRole('combobox', { name: 'Showing' }).click();
    await m.getByRole('option', { name: 'Apartment 4B pantry' }).click();
    await expect(m.getByRole('article', { name: 'Onions' })).toBeVisible({ timeout: 10_000 });

    // SHR-5: once Maya can only view, she can't check or add, and the server drops any change.
    const mayaId = ((await (await m.request.get('/api/v1/me')).json()) as { user: { id: string } })
      .user.id;
    await a.request.patch(`/api/v1/lists/${homeId}/members/${mayaId}`, {
      data: { role: 'view' },
      headers: { origin: ORIGIN },
    });
    await m.goto(`/lists/${homeId}`);
    await expect(m.getByText(/You can view this list/)).toBeVisible();
    await expect(rowOf(m, 'Milk').getByRole('checkbox', { name: 'Milk' })).toBeDisabled();
    await expect(m.getByRole('textbox', { name: 'Add to the list' })).toHaveCount(0);

    await ananya.context.close();
    await maya.context.close();
  });

  test('SHR-2 SHR-4 new shared list, share dialog, stop sharing', async ({ page }) => {
    await signInAsNewUser(page);
    await completeOnboarding(page, 'Apartment 4B');
    await page.goto('/lists/new');
    await page.getByRole('textbox', { name: 'List name' }).fill('Diwali party');
    await page.getByRole('radio', { name: /amber/i }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    const dialog = page.getByRole('dialog', { name: 'Share “Diwali party”' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId('share-member')).toContainText('YouOwner');
    await expectNoSeriousA11yViolations(page);
    await dialog.getByRole('button', { name: 'Copy link' }).click();
    await expect(dialog.getByText(/\/join\//)).toBeVisible();
    await dialog.getByRole('button', { name: 'Stop sharing' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Stop sharing' }).click();
    await expect(page.getByText('Only you are on this list now.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Grocery list' })).toBeVisible();
  });

  test('LST-9 shopping mode', async ({ page }) => {
    await signInAsNewUser(page);
    await completeOnboarding(page, 'Home');
    await page.goto('/lists');
    // /lists opens the switcher (Figma 18); close it to use the list.
    await page
      .getByRole('dialog', { name: 'Your lists' })
      .getByRole('button', { name: 'Close' })
      .click();
    await page.getByRole('textbox', { name: 'Add to the list' }).fill('eggs, bread');
    await page.getByRole('textbox', { name: 'Add to the list' }).press('Enter');
    await page.getByRole('link', { name: 'Start shopping mode' }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Shopping: Home' })).toBeVisible();
    await page.getByRole('checkbox', { name: 'Eggs' }).check();
    await expect(page.getByText('1 left')).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });
});
