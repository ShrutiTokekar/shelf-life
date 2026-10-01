import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { seededMe } from '../../test/fixtures';
import { mockApi } from '../../test/mockApi';
import { renderApp } from '../../test/renderApp';

afterEach(() => vi.restoreAllMocks());

describe('NewListPage (SHR-2, SHR-7)', () => {
  it('creates a list with a label color and goes on to sharing it', async () => {
    let sent: unknown = null;
    mockApi({
      'POST /lists': (init: RequestInit) => {
        sent = JSON.parse(String(init.body));
        return {
          ...seededMe.lists[2],
          id: '0192f0c0-0000-7000-8000-0000000000aa',
          role: 'owner',
          members: [],
        };
      },
    });
    const { container, router } = renderApp('/lists/new', seededMe);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'New shared list' }),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: 'List name' }), 'Diwali party');
    await userEvent.click(screen.getByRole('radio', { name: /terra/i }));
    await userEvent.type(screen.getByLabelText('Shop by (optional)'), '2026-11-01');
    expect(await seriousViolations(container)).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        '/lists/0192f0c0-0000-7000-8000-0000000000aa/share',
      ),
    );
    expect(sent).toEqual({
      name: 'Diwali party',
      color: 'terra',
      isPrivate: false,
      shopBy: '2026-11-01',
    });
  });

  it('asks for a name', async () => {
    renderApp('/lists/new', seededMe);
    await userEvent.click(await screen.findByRole('button', { name: 'Create' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Give your list a name.');
  });
});
