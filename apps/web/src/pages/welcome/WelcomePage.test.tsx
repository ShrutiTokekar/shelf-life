import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { sessionEvents } from '../../lib/api';
import { returningUserMe } from '../../test/fixtures';
import { renderApp } from '../../test/renderApp';

afterEach(() => vi.restoreAllMocks());

describe('WelcomePage', () => {
  it('WEL-1 shows the logo, slogan and description', async () => {
    renderApp('/welcome', 'signedOut');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Shelf Life' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Use it before you lose it.')).toBeInTheDocument();
    expect(screen.getByText(/Scan your receipts, track what’s expiring/)).toBeInTheDocument();
  });

  it('WEL-3 shows the no-invite-codes helper line', async () => {
    renderApp('/welcome', 'signedOut');
    expect(
      await screen.findByText('Got an invite link? Just open it and sign in to join the list.'),
    ).toBeInTheDocument();
  });

  it('WEL-5 shows the privacy line with a lock icon', async () => {
    renderApp('/welcome', 'signedOut');
    const line = await screen.findByText('Receipts are read on your phone, never uploaded.');
    expect(line.querySelector('svg')).not.toBeNull();
  });

  it('WEL-2 "Continue with Google" starts OAuth via the API and navigates to Google', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ url: 'https://accounts.google.com/o/oauth2/auth?x=1', redirect: true }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
    );
    const assign = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      assign,
      origin: 'https://localhost:5173',
    });

    renderApp('/welcome', 'signedOut');
    await userEvent.click(await screen.findByRole('button', { name: 'Continue with Google' }));

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/auth/sign-in/social',
      expect.objectContaining({ method: 'POST' }),
    );
    const social = fetchSpy.mock.calls.find(([url]) => url === '/api/v1/auth/sign-in/social')!;
    const body = JSON.parse(social[1]!.body as string);
    expect(body).toMatchObject({
      provider: 'google',
      callbackURL: 'https://localhost:5173/',
      errorCallbackURL: 'https://localhost:5173/welcome',
    });
    expect(assign).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/auth?x=1');
  });

  it('shows an error with a way to retry when sign-in fails to start', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    renderApp('/welcome', 'signedOut');
    await userEvent.click(await screen.findByRole('button', { name: 'Continue with Google' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Google sign-in didn’t finish');
    expect(screen.getByRole('button', { name: 'Continue with Google' })).not.toHaveAttribute(
      'aria-busy',
    );
  });

  it('shows the error when Google redirects back with ?error', async () => {
    renderApp('/welcome?error=signin', 'signedOut');
    expect(await screen.findByRole('alert')).toHaveTextContent('Google sign-in didn’t finish');
  });

  it('offline: explains sign-in needs a connection and disables the button', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderApp('/welcome', 'signedOut');
    expect(
      await screen.findByText('You’re offline. Signing in needs a connection.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDisabled();
  });

  it('SRS 5.1 skip link comes first', async () => {
    renderApp('/welcome', 'signedOut');
    await screen.findByRole('button', { name: 'Continue with Google' });
    await userEvent.tab();
    expect(document.activeElement).toHaveTextContent('Skip to sign in');
  });

  it('has no serious axe violations', async () => {
    const { container } = renderApp('/welcome', 'signedOut');
    await screen.findByRole('button', { name: 'Continue with Google' });
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('SEC-9 a session that ran out wipes this device and says why', async () => {
    window.localStorage.setItem('shelf-life:me', JSON.stringify(returningUserMe));
    window.localStorage.setItem('shelf-life:recipes', '{}');
    renderApp('/welcome', 'signedOut');
    expect(await screen.findByText(/You were signed out to keep your account safe/)).toBeVisible();
    expect(window.localStorage.getItem('shelf-life:me')).toBeNull();
    expect(window.localStorage.getItem('shelf-life:recipes')).toBeNull();
  });

  it('SEC-9 a first visit doesn’t say "signed out"', async () => {
    renderApp('/welcome', 'signedOut');
    await screen.findByRole('button', { name: 'Continue with Google' });
    expect(screen.queryByText(/You were signed out/)).toBeNull();
  });

  it('SEC-9 when the server ends the session mid-use, the app signs out and says why', async () => {
    const { router } = renderApp('/profile', returningUserMe);
    await screen.findByRole('heading', { level: 1, name: 'Profile' });
    act(() => {
      sessionEvents.dispatchEvent(new Event('unauthorized'));
    });
    expect(await screen.findByText(/You were signed out to keep your account safe/)).toBeVisible();
    expect(router.state.location.pathname).toBe('/welcome');
    expect(window.localStorage.getItem('shelf-life:me')).toBeNull();
  });
});
