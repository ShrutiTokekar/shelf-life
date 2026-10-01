import type { ListDetail } from '@shelf-life/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { seededMe } from '../../test/fixtures';
import { FAMILY_LIST } from '../../test/listFixtures';
import { mockApi } from '../../test/mockApi';
import { renderApp } from '../../test/renderApp';
import { inviteHref } from './ShareDialog';

afterEach(() => vi.restoreAllMocks());

const list = seededMe.lists[1]!;
function detail(over: Partial<ListDetail> = {}): ListDetail {
  return {
    ...list,
    role: 'owner',
    members: [
      {
        userId: 'u1',
        displayName: 'Ananya Mehta',
        avatarInitial: 'A',
        role: 'owner',
        joinedAt: '2026-09-01T00:00:00Z',
      },
      {
        userId: 'u2',
        displayName: 'Arjun Patel',
        avatarInitial: 'A',
        role: 'edit',
        joinedAt: '2026-09-27T00:00:00Z',
      },
    ],
    invites: [
      {
        token: 'tok-link',
        url: 'https://localhost:5173/join/tok-link',
        role: 'edit',
        expiresAt: '2026-10-12T00:00:00Z',
        sentTo: null,
        acceptedAt: null,
      },
      {
        token: 'tok-ravi',
        url: 'https://localhost:5173/join/tok-ravi',
        role: 'edit',
        expiresAt: '2026-10-12T00:00:00Z',
        sentTo: 'ravi@example.com',
        acceptedAt: null,
      },
    ],
    ...over,
  };
}

async function open(d: ListDetail, extra: Record<string, unknown> = {}) {
  const fetchSpy = mockApi({ 'GET /lists/:id': d, ...extra });
  renderApp(`/lists/${FAMILY_LIST}/share`, seededMe);
  const dialog = await screen.findByRole('dialog', { name: `Share “${list.name}”` });
  return { dialog, fetchSpy };
}

describe('ShareDialog (SHR-3, SHR-4)', () => {
  it('shows people, pending invites and the link; owners manage roles', async () => {
    const { dialog } = await open(detail());
    const members = within(dialog).getAllByTestId('share-member');
    expect(members[0]).toHaveTextContent('YouOwner');
    expect(
      within(dialog).getByRole('combobox', { name: 'Role for Arjun Patel' }),
    ).toHaveTextContent('Can edit');
    expect(within(dialog).getByTestId('share-pending')).toHaveTextContent(
      'ravi@example.comInvite pending',
    );
    expect(
      within(dialog).getByText('Anyone with the link can join as “Can edit”'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/localhost:5173\/join\/tok-link/)).toBeInTheDocument();
    expect(await seriousViolations(document.body)).toEqual([]);
  });

  it('changes a role and removes someone', async () => {
    const calls: string[] = [];
    const { dialog } = await open(detail(), {
      'PATCH /lists/:id/members/:userId': (init: RequestInit) =>
        void calls.push(`role ${init.body}`),
      'DELETE /lists/:id/members/:userId': () => void calls.push('remove'),
    });
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Role for Arjun Patel' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Can view' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove Arjun Patel' }));
    await waitFor(() => expect(calls).toEqual(['role {"role":"view"}', 'remove']));
  });

  it('copies the link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const { dialog } = await open(detail());
    await userEvent.click(within(dialog).getByRole('button', { name: 'Copy link' }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('https://localhost:5173/join/tok-link'),
    );
    expect(await screen.findByText('Link copied')).toBeInTheDocument();
  });

  it('SHR-4 Stop sharing asks first', async () => {
    let stopped = false;
    const { dialog } = await open(detail(), {
      'POST /lists/:id/stop-sharing': () => void (stopped = true),
    });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Stop sharing' }));
    const confirm = screen.getByRole('alertdialog', { name: `Stop sharing “${list.name}”?` });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Stop sharing' }));
    await waitFor(() => expect(stopped).toBe(true));
  });

  it('editors can invite but not manage; viewers only see', async () => {
    const { dialog } = await open(detail({ role: 'view', invites: [] }));
    expect(
      within(dialog).queryByRole('textbox', { name: 'Add people by email or phone' }),
    ).toBeNull();
    expect(within(dialog).queryByRole('combobox')).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Leave this list' })).toBeInTheDocument();
  });

  it('shows the API’s reason when an invite target is not valid', async () => {
    const { dialog } = await open(detail(), {
      'POST /lists/:id/invites': () =>
        new Response(
          JSON.stringify({
            error: {
              code: 'validation_error',
              message: 'Enter an email address or a phone number.',
            },
          }),
          { status: 400 },
        ),
    });
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Add people by email or phone' }),
      'nope',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Invite' }));
    expect(
      await within(dialog).findByText('Enter an email address or a phone number.'),
    ).toBeInTheDocument();
  });

  it('SHR-7 private lists explain and offer to become shareable', async () => {
    const { dialog } = await open(detail({ isPrivate: true, invites: [] }));
    expect(within(dialog).getByText(/This list is private/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Make it shareable' })).toBeInTheDocument();
  });

  it('builds mail and messages links with the invite', () => {
    expect(inviteHref('priya@example.com', 'https://x/join/t', 'Diwali', 'Join:')).toBe(
      'mailto:priya%40example.com?subject=Diwali&body=Join%3A%20https%3A%2F%2Fx%2Fjoin%2Ft',
    );
    expect(inviteHref('+1 (415) 555-0100', 'https://x/join/t', 'Diwali', 'Join:')).toMatch(
      /^sms:\+14155550100\?&body=/,
    );
  });
});
