import { expect, test } from '@playwright/test';
import { completeOnboarding, expectNoSeriousA11yViolations, signInAsNewUser } from './helpers';

test.describe('Onboard (SRS 5.3 flow 1)', () => {
  test('WEL-2 WEL-4 new user names the home list, picks a color and lands on Today', async ({
    page,
  }) => {
    await signInAsNewUser(page);
    await page.goto('/');
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole('textbox', { name: 'List name' })).toHaveValue('Home');
    await expectNoSeriousA11yViolations(page);

    await page.getByRole('textbox', { name: 'List name' }).fill('Apartment 4B');
    await page.getByRole('radio', { name: 'Olive' }).click();
    await page.getByRole('button', { name: 'Create home list' }).click();

    await expect(page.getByRole('heading', { level: 1, name: /today/i })).toBeVisible();
    await expect(page.getByText('Your shelves are empty')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Scan your first receipt' })).toBeVisible();

    const me = await (await page.request.get('/api/v1/me')).json();
    expect(me.lists).toHaveLength(1);
    expect(me.lists[0]).toMatchObject({
      name: 'Apartment 4B',
      color: 'olive',
      isHome: true,
      role: 'owner',
    });
    expect(me.pantry.homeListId).toBe(me.lists[0].id);
  });

  test('WEL-2 returning user goes straight to Today and can’t reopen setup', async ({ page }) => {
    await signInAsNewUser(page);
    await completeOnboarding(page);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: /today/i })).toBeVisible();
    await page.goto('/onboarding');
    await expect(page).toHaveURL(/\/$/);
  });

  test('WEL-4 an empty name is rejected with an inline message', async ({ page }) => {
    await signInAsNewUser(page);
    await page.goto('/onboarding');
    await page.getByRole('textbox', { name: 'List name' }).fill('   ');
    await page.getByRole('button', { name: 'Create home list' }).click();
    await expect(page.getByText('Give your list a name.')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'List name' })).toBeFocused();
  });
});
