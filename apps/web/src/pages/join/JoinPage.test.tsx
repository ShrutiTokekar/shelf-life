import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { pendingInvite } from '../../lib/pendingInvite';
import { returningUserMe } from '../../test/fixtures';
import { renderApp } from '../../test/renderApp';

describe('JoinPage', () => {
  it('WEL-3 stores the invite token before sign-in and sends the user to sign in', async () => {
    const { router } = renderApp('/join/tok_123', 'signedOut');
    expect(
      await screen.findByText('Sign in to join the list you were invited to.'),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/welcome');
    expect(pendingInvite.get()).toBe('tok_123');
  });

  it('WEL-3 the token survives for signed-in users too', async () => {
    renderApp('/join/tok_456', returningUserMe);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'You’re invited to a list' }),
    ).toBeInTheDocument();
    expect(pendingInvite.get()).toBe('tok_456');
  });
});
