import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { returningUserMe } from '../../test/fixtures';
import { mockApi } from '../../test/mockApi';
import { renderApp } from '../../test/renderApp';
import { useRecipeStore } from '../../stores/recipes';

afterEach(() => vi.restoreAllMocks());

describe('ProfilePage', () => {
  it('PRO-1 shows the signed-in user', async () => {
    renderApp('/profile', returningUserMe);
    expect(await screen.findByRole('heading', { level: 1, name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByText('Ananya Mehta')).toBeInTheDocument();
    expect(screen.getByText(/ananya@example\.com/)).toBeInTheDocument();
  });

  it('PRO-6 links to Receipt history', async () => {
    renderApp('/profile', returningUserMe);
    expect(await screen.findByRole('link', { name: /Receipt history/ })).toHaveAttribute(
      'href',
      '/profile/receipts',
    );
  });

  it('PRO-6 Sign out calls the API, clears the cached account and goes to Welcome', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    const { router } = renderApp('/profile', returningUserMe);
    await screen.findByRole('heading', { level: 1, name: 'Profile' });
    expect(window.localStorage.getItem('shelf-life:me')).not.toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/auth/sign-out',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/welcome');
    expect(window.localStorage.getItem('shelf-life:me')).toBeNull();
  });

  it('PRO-6 stays signed in and explains when sign-out fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    const { router } = renderApp('/profile', returningUserMe);
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t sign you out');
    expect(router.state.location.pathname).toBe('/profile');
  });

  it('offline: sign-out is disabled with an explanation', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderApp('/profile', returningUserMe);
    expect(
      await screen.findAllByText('You’re offline. Signing out needs a connection.'),
    ).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Sign out on all devices/ })).toBeDisabled();
  });

  it('SEC-9 Sign out on all devices ends every session and wipes this device', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const { router } = renderApp('/profile', returningUserMe);
    await userEvent.click(await screen.findByRole('button', { name: /Sign out on all devices/ }));
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/session/sign-out-everywhere',
      expect.objectContaining({ method: 'POST' }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/welcome'));
    expect(window.localStorage.getItem('shelf-life:me')).toBeNull();
  });

  it('SEC-9 PRO-6 Delete account after 15 minutes asks to sign in again first', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: 'reauth_required',
              message: 'For your safety, sign in again to delete your account.',
            },
          }),
          { status: 403 },
        ),
    );
    const { router } = renderApp('/profile', returningUserMe);
    await userEvent.click(await screen.findByRole('button', { name: /Delete account/ }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'For your safety, sign in again, then delete your account.',
    );
    expect(screen.getByRole('button', { name: 'Sign in again' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/profile');
    expect(window.localStorage.getItem('shelf-life:me')).not.toBeNull();
  });

  it('is reachable from the mobile Today top bar', async () => {
    renderApp('/', returningUserMe);
    await screen.findByRole('heading', { level: 1, name: /today/i });
    const links = screen.getAllByRole('link', { name: 'Account, Ananya Mehta' });
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/profile', '/profile']);
  });

  it('has no serious axe violations', async () => {
    const { container } = renderApp('/profile', returningUserMe);
    await screen.findByRole('heading', { level: 1, name: 'Profile' });
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('PRO-3 "What the AI should know" saves diet, time, cuisines and the avoid list', async () => {
    const patches: unknown[] = [];
    mockApi({
      'PATCH /me/settings': (init: RequestInit) => {
        patches.push(JSON.parse(String(init.body)));
        return returningUserMe.settings;
      },
      'GET /me/saved-recipes': { saved: [] },
    });
    const { container } = renderApp('/profile', returningUserMe);
    const card = await screen.findByRole('region', { name: 'What the AI should know' });
    await userEvent.click(within(card).getByRole('button', { name: 'Mexican' }));
    const avoid = within(card).getByRole('textbox', { name: 'Ingredients to avoid' });
    await userEvent.type(avoid, 'Peanuts, mushrooms ,');
    await userEvent.tab();
    await waitFor(() =>
      expect(patches.at(-1)).toMatchObject({
        cuisines: ['mexican'],
        avoid: ['peanuts', 'mushrooms'],
      }),
    );
    expect(useRecipeStore.getState().prefs).toMatchObject({ avoid: ['peanuts', 'mushrooms'] });
    expect(await seriousViolations(container)).toEqual([]);
  });
});
