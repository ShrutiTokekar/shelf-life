import { expect, test, type Page } from '@playwright/test';
import { expectNoSeriousA11yViolations } from './helpers';

/** The link in the newest email to this address (E2E keeps emails in memory; test-only route). */
async function linkFor(page: Page, to: string, subject: RegExp) {
  await expect
    .poll(
      async () => {
        const res = await page.request.get(`/api/v1/test/emails?to=${encodeURIComponent(to)}`);
        const { emails } = (await res.json()) as { emails: { subject: string }[] };
        return emails.filter((e) => subject.test(e.subject)).length;
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);
  const res = await page.request.get(`/api/v1/test/emails?to=${encodeURIComponent(to)}`);
  const { emails } = (await res.json()) as { emails: { subject: string; text: string }[] };
  const mail = emails.filter((e) => subject.test(e.subject)).at(-1)!;
  return /https?:\/\/\S+/.exec(mail.text)![0];
}

test('Milestone 9b sign up with email, confirm, set up, sign out, reset the password, sign in', async ({
  page,
}, info) => {
  // Three flows in one (sign-up, reset, sign-in): longer than the default 30 s on a busy machine.
  test.setTimeout(90_000);
  const email = `maya-${info.project.name}-${crypto.randomUUID().slice(0, 8)}@example.com`;

  await page.goto('/welcome');
  await page.getByRole('link', { name: 'New here? Create an account' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Create your account' })).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  await page.getByLabel('Your name').fill('Maya Rao');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('correct horse battery');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Check your email' })).toBeVisible();

  // Not confirmed yet: signing in is refused and sends a fresh link.
  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('correct horse battery');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText(/Confirm your email first/)).toBeVisible();

  // Confirming signs in; a new account sets up its home list like a Google one.
  await page.goto(await linkFor(page, email, /Confirm your email/));
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole('textbox', { name: 'List name' }).fill('Home');
  await page.getByRole('button', { name: 'Create home list' }).click();
  // Creating the list and pantry can take a few seconds on a busy machine.
  await expect(page.getByRole('heading', { level: 1, name: /today/i })).toBeVisible({
    timeout: 15_000,
  });

  await page.goto('/profile');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/welcome$/);

  // Forgot password → link → new password → sign in with it.
  await page.getByRole('link', { name: 'Sign in with email' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  await page.getByRole('link', { name: 'Forgot your password?' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Reset your password' })).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByText(/If there’s an account for/)).toBeVisible();
  await page.goto(await linkFor(page, email, /Reset your/));
  await expect(
    page.getByRole('heading', { level: 1, name: 'Choose a new password' }),
  ).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  await page.getByLabel('New password').fill('password1234');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByText(/appeared in a data breach/)).toBeVisible();
  await page.getByLabel('New password').fill('a brand new password');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Password changed' })).toBeVisible();

  await page.getByRole('link', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('correct horse battery');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText(/don’t match/)).toBeVisible();
  await page.getByLabel('Password').fill('a brand new password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /today/i })).toBeVisible();
});
