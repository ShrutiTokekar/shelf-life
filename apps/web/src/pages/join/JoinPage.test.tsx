import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pendingInvite } from '../../lib/pendingInvite';
import { returningUserMe, seededMe } from '../../test/fixtures';
import { mockApi } from '../../test/mockApi';
import { renderApp } from '../../test/renderApp';

afterEach(() => vi.restoreAllMocks());

const preview = {
  listName: 'Apartment 4B',
  color: 'navy',
  role: 'edit',
  invitedBy: 'Ananya Mehta',
  memberCount: 2,
  sharesPantry: true,
  alreadyMember: false,
};

describe('JoinPage (WEL-3, SHR-3)', () => {
  it('WEL-3 stores the invite token before sign-in and sends the user to sign in', async () => {
    const { router } = renderApp('/join/tok_123', 'signedOut');
    expect(
      await screen.findByText('Sign in to join the list you were invited to.'),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/welcome');
    expect(pendingInvite.get()).toBe('tok_123');
  });

  it('SHR-3 shows the invite, joins, and opens the list', async () => {
    const listId = seededMe.lists[0]!.id;
    mockApi({ 'GET /invites/:token': preview, 'POST /invites/:token/accept': { listId } });
    const { router } = renderApp('/join/tok_456', [returningUserMe, seededMe]);
    expect(
      await screen.findByText('Ananya Mehta invited you to “Apartment 4B” (Can edit).'),
    ).toBeInTheDocument();
    expect(screen.getByText(/also see their pantry/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Join list' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/lists/${listId}`));
    expect(pendingInvite.get()).toBeNull();
  });

  it('an expired link says so and is forgotten', async () => {
    mockApi({});
    renderApp('/join/tok_old', returningUserMe);
    expect(await screen.findByText(/expired or was turned off/)).toBeInTheDocument();
    expect(pendingInvite.get()).toBeNull();
  });

  it('after signing in, a saved invite is opened before anything else', async () => {
    pendingInvite.save('tok_saved');
    mockApi({ 'GET /invites/:token': preview });
    const { router } = renderApp('/', returningUserMe);
    await waitFor(() => expect(router.state.location.pathname).toBe('/join/tok_saved'));
  });
});
