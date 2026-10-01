import { expect, test } from '@playwright/test';
import { expectNoSeriousA11yViolations, ORIGIN, signInAsNewUser } from './helpers';

test.describe('Welcome and sign in', () => {
  test('WEL-2 signed-out users are sent to /welcome', async ({ page }) => {
    await page.goto('/pantry');
    await expect(page).toHaveURL(/\/welcome$/);
  });

  test('WEL-1 WEL-3 WEL-5 show logo, slogan, invite helper and privacy line', async ({ page }) => {
    await page.goto('/welcome');
    await expect(page.getByRole('heading', { level: 1, name: 'Shelf Life' })).toBeVisible();
    await expect(page.getByText('Use it before you lose it.')).toBeVisible();
    await expect(
      page.getByText('Got an invite link? Just open it and sign in to join the list.'),
    ).toBeVisible();
    await expect(page.getByText('Receipts are read on your phone, never uploaded.')).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test('WEL-2 Continue with Google sends the browser to Google OAuth', async ({ page }) => {
    await page.route('https://accounts.google.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Google</title>' }),
    );
    await page.goto('/welcome');
    await page.getByRole('button', { name: 'Continue with Google' }).click();
    await page.waitForURL(/accounts\.google\.com/);
    const url = new URL(page.url());
    expect(url.searchParams.get('client_id')).toBe('e2e-google-client-id');
    expect(url.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/api/v1/auth/callback/google`);
  });

  test('WEL-3 an invite link opened before sign-in is opened after sign-in', async ({ page }) => {
    await page.goto('/join/invite-token-123');
    await expect(page).toHaveURL(/\/welcome$/);
    await expect(page.getByText('Sign in to join the list you were invited to.')).toBeVisible();

    await signInAsNewUser(page);
    await page.goto('/');
    // The saved invite comes first (a made-up token here, so it's reported and forgotten; a real
    // join is covered in lists.spec.ts), then home list setup.
    await expect(page).toHaveURL(/\/join\/invite-token-123$/);
    await expect(page.getByText(/expired or was turned off/)).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('shelf-life:pending-invite'))).toBeNull();
    await page.goto('/');
    await expect(page).toHaveURL(/\/onboarding$/);
  });
});
