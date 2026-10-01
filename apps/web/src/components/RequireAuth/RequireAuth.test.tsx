import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { newUserMe, returningUserMe } from '../../test/fixtures';
import { renderApp } from '../../test/renderApp';

describe('RequireAuth', () => {
  it('shows a loading skeleton with a status message first', () => {
    renderApp('/', returningUserMe);
    expect(screen.getByText('Loading…').closest('[role="status"]')).toBeInTheDocument();
  });

  it('WEL-2 signed-out users go to /welcome', async () => {
    const { router } = renderApp('/pantry', 'signedOut');
    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/welcome');
  });

  it('WEL-2 new users (no pantry yet) go to home list setup', async () => {
    const { router } = renderApp('/', newUserMe);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Name your home list' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/onboarding');
  });

  it('WEL-2 returning users land on Today', async () => {
    const { router } = renderApp('/', returningUserMe);
    expect(await screen.findByRole('heading', { level: 1, name: /today/i })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('returning users can’t reopen home list setup', async () => {
    const { router } = renderApp('/onboarding', returningUserMe);
    await screen.findByRole('heading', { level: 1, name: /today/i });
    expect(router.state.location.pathname).toBe('/');
  });

  it('shows an error with retry when /me fails and nothing is cached', async () => {
    renderApp('/', ['server', returningUserMe]);
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { level: 1, name: /today/i })).toBeInTheDocument();
  });

  it('SRS 12.4 opens offline from the cached /me', async () => {
    const first = renderApp('/', returningUserMe);
    await screen.findByRole('heading', { level: 1, name: /today/i });
    first.unmount();
    renderApp('/', 'network');
    expect(await screen.findByRole('heading', { level: 1, name: /today/i })).toBeInTheDocument();
  });
});
