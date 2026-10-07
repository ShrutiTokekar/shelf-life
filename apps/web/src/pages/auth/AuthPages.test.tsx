import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { returningUserMe } from '../../test/fixtures';
import { renderApp } from '../../test/renderApp';

afterEach(() => vi.restoreAllMocks());

type Reply = { status: number; body?: unknown };
/** Answers fetch by URL path; records what was sent. */
function server(routes: Record<string, Reply>) {
  const calls: { path: string; body: unknown }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = String(input);
    calls.push({ path, body: init?.body ? JSON.parse(String(init.body)) : null });
    const r = routes[path] ?? { status: 404, body: {} };
    return new Response(r.status === 204 ? null : JSON.stringify(r.body ?? {}), {
      status: r.status,
    });
  });
  return calls;
}

describe('Milestone 9b Welcome offers email when it’s set up', () => {
  it('shows Sign in with email and Create an account', async () => {
    server({ '/api/v1/config': { status: 200, body: { emailSignIn: true } } });
    renderApp('/welcome', 'signedOut');
    expect(await screen.findByRole('link', { name: 'Sign in with email' })).toHaveAttribute(
      'href',
      '/sign-in',
    );
    expect(screen.getByRole('link', { name: 'New here? Create an account' })).toHaveAttribute(
      'href',
      '/sign-up',
    );
  });

  it('without an email service only Google is offered', async () => {
    server({ '/api/v1/config': { status: 200, body: { emailSignIn: false } } });
    renderApp('/welcome', 'signedOut');
    await screen.findByRole('button', { name: 'Continue with Google' });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('link', { name: 'Sign in with email' })).toBeNull();
  });

  it('explains a Google sign-in refused for an unconfirmed email account', async () => {
    server({});
    renderApp('/welcome?error=account_not_linked', 'signedOut');
    expect(await screen.findByRole('alert')).toHaveTextContent('waiting to be confirmed');
  });
});

describe('Milestone 9b Create account', () => {
  it('checks the fields inline, then shows "Check your email"', async () => {
    const calls = server({ '/api/v1/auth/sign-up/email': { status: 200, body: { token: null } } });
    renderApp('/sign-up', 'signedOut');
    const submit = await screen.findByRole('button', { name: 'Create account' });
    await userEvent.click(submit);
    expect(screen.getByLabelText('Your name')).toHaveAccessibleDescription('Enter your name.');
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(/Enter an email address/);
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');

    await userEvent.type(screen.getByLabelText('Your name'), 'Maya Rao');
    await userEvent.type(screen.getByLabelText('Email'), 'maya@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'correct horse battery');
    await userEvent.click(submit);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Check your email' }),
    ).toBeVisible();
    expect(screen.getByText(/We’ve sent a link to maya@example.com/)).toBeVisible();
    expect(calls.find((c) => c.path.endsWith('/sign-up/email'))?.body).toEqual({
      name: 'Maya Rao',
      email: 'maya@example.com',
      password: 'correct horse battery',
      callbackURL: `${window.location.origin}/email-verified`,
    });
  });

  it('a breached password is explained on the field', async () => {
    server({
      '/api/v1/auth/sign-up/email': {
        status: 400,
        body: { error: { code: 'password_breached', message: 'x' } },
      },
    });
    renderApp('/sign-up', 'signedOut');
    await userEvent.type(await screen.findByLabelText('Your name'), 'Maya');
    await userEvent.type(screen.getByLabelText('Email'), 'maya@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password1234');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(/data breach/),
    );
  });

  it('Show password reveals what was typed (and says so to screen readers)', async () => {
    server({});
    renderApp('/sign-up', 'signedOut');
    const field = await screen.findByLabelText('Password');
    expect(field).toHaveAttribute('type', 'password');
    const toggle = screen.getByRole('button', { name: 'Show' });
    await userEvent.click(toggle);
    expect(field).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('has no serious axe violations', async () => {
    server({});
    const { container } = renderApp('/sign-up', 'signedOut');
    await screen.findByRole('heading', { level: 1, name: 'Create your account' });
    expect(await seriousViolations(container)).toEqual([]);
  });
});

describe('Milestone 9b Sign in', () => {
  it('wrong password: says so and stays', async () => {
    server({
      '/api/v1/auth/sign-in/email': {
        status: 401,
        body: { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' },
      },
    });
    const { router } = renderApp('/sign-in', 'signedOut');
    await userEvent.type(await screen.findByLabelText('Email'), 'maya@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'not the password');
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That email and password don’t match',
    );
    expect(router.state.location.pathname).toBe('/sign-in');
  });

  it('not confirmed yet: says a new link was sent', async () => {
    server({
      '/api/v1/auth/sign-in/email': {
        status: 403,
        body: { code: 'EMAIL_NOT_VERIFIED', message: '' },
      },
    });
    renderApp('/sign-in', 'signedOut');
    await userEvent.type(await screen.findByLabelText('Email'), 'maya@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'correct horse battery');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText(/We’ve sent a new link to maya@example.com/)).toBeVisible();
  });

  it('signs in and opens the app', async () => {
    server({ '/api/v1/auth/sign-in/email': { status: 200, body: { token: 't' } } });
    const { router } = renderApp('/sign-in', ['signedOut', returningUserMe]);
    await userEvent.type(await screen.findByLabelText('Email'), 'ananya@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'correct horse battery');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('has links to Forgot password and Create an account', async () => {
    server({});
    renderApp('/sign-in', 'signedOut');
    expect(await screen.findByRole('link', { name: 'Forgot your password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/sign-up',
    );
  });
});

describe('Milestone 9b Forgot and reset password', () => {
  it('Forgot: the same answer for any address', async () => {
    const calls = server({ '/api/v1/auth/request-password-reset': { status: 200, body: {} } });
    renderApp('/forgot-password', 'signedOut');
    await userEvent.type(await screen.findByLabelText('Email'), 'maya@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByText(/If there’s an account for maya@example.com/)).toBeVisible();
    expect(calls.at(-1)?.body).toEqual({
      email: 'maya@example.com',
      redirectTo: `${window.location.origin}/reset-password`,
    });
  });

  it('Reset: saves the new password, then offers Sign in', async () => {
    const calls = server({
      '/api/v1/auth/reset-password': { status: 200, body: { status: true } },
    });
    renderApp('/reset-password?token=abc', 'signedOut');
    await userEvent.type(await screen.findByLabelText('New password'), 'a brand new password');
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Password changed' }),
    ).toBeVisible();
    expect(calls.at(-1)?.body).toEqual({ token: 'abc', newPassword: 'a brand new password' });
  });

  it('Reset: an expired or used link offers a new one', async () => {
    server({});
    renderApp('/reset-password?error=INVALID_TOKEN', 'signedOut');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'This link has expired' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Send a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });
});

describe('Milestone 9b Email confirmed', () => {
  it('signs the new person in and sends them on (to setup)', async () => {
    server({});
    const { router } = renderApp('/email-verified', ['signedOut', returningUserMe]);
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('an expired link says what to do', async () => {
    server({});
    renderApp('/email-verified?error=TOKEN_EXPIRED', 'signedOut');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'This link has expired' }),
    ).toBeVisible();
  });
});
