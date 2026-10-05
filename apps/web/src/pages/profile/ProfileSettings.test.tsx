import { putReceipt, recordActivity } from '@shelf-life/docs';
import type { Activity, Receipt } from '@shelf-life/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDoc, pantryDocName } from '../../lib/sync/docs';
import { useRecipeStore } from '../../stores/recipes';
import { useUiSettings } from '../../stores/uiSettings';
import { seriousViolations } from '../../test/axe';
import { returningUserMe, seededMe } from '../../test/fixtures';
import { resetMedia, setDesktop } from '../../test/media';
import { mockApi } from '../../test/mockApi';
import { PANTRY } from '../../test/receiptFixtures';
import { renderApp } from '../../test/renderApp';

afterEach(() => {
  vi.restoreAllMocks();
  resetMedia();
  useUiSettings.setState(useUiSettings.getInitialState());
});

const now = new Date().toISOString();
const act = (over: Partial<Activity>): Activity => ({
  id: crypto.randomUUID(),
  pantryId: PANTRY,
  listId: returningUserMe.pantry!.homeListId,
  actorId: 'u1',
  type: 'used',
  subject: 'Spinach',
  itemId: 'i',
  beforeExpiry: true,
  createdAt: now,
  ...over,
});

describe('Profile (SRS 6.11)', () => {
  it('PRO-1 PRO-2 hero with my impact, and every list with its people and what’s left to buy', async () => {
    mockApi({ 'PATCH /me/settings': {}, 'GET /me/saved-recipes': { saved: [] } });
    const handle = getDoc(pantryDocName(PANTRY));
    await handle.ready;
    recordActivity(handle.doc, [
      act({}),
      act({}),
      act({ actorId: 'u2' }),
      act({ type: 'cooked', beforeExpiry: null, recipeId: 'masala-omelette' }),
    ]);
    putReceipt(handle.doc, {
      id: 'r1',
      pantryId: PANTRY,
      listId: returningUserMe.pantry!.homeListId,
      storeName: 'Patel Brothers',
      purchasedOn: now.slice(0, 10),
      total: null,
      scannedBy: 'u1',
      lineCount: 0,
      itemsAdded: 0,
      reviewState: 'clean',
      lines: [],
      createdAt: now,
      updatedAt: now,
    } satisfies Receipt);
    setDesktop(true);
    const { container } = renderApp('/profile', seededMe);
    const stats = await screen.findByRole('list', { name: 'Your impact' });
    await waitFor(() =>
      expect(within(stats).getByTestId('stat-saved')).toHaveTextContent(
        '2items saved from waste this month',
      ),
    );
    expect(within(stats).getByTestId('stat-receipts')).toHaveTextContent('1receipt scanned');
    expect(within(stats).getByTestId('stat-cooked')).toHaveTextContent('1recipe cooked');

    const lists = screen.getByRole('region', { name: 'Lists & people' });
    expect(within(lists).getByRole('link', { name: 'Manage Family groceries' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/lists\/.+\/share$/),
    );
    expect(within(lists).getByRole('link', { name: 'Manage Apartment 4B' })).toHaveTextContent(
      'You, Arjun, Meera · 0 to buy',
    );
    expect(within(lists).getByRole('link', { name: /New shared list/ })).toHaveAttribute(
      'href',
      '/lists/new',
    );
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('PRO-4 display settings apply right away and are saved to the account', async () => {
    const patches: unknown[] = [];
    mockApi({
      'PATCH /me/settings': (init: RequestInit) => {
        patches.push(JSON.parse(String(init.body)));
        return {};
      },
      'GET /me/saved-recipes': { saved: [] },
    });
    renderApp('/profile', returningUserMe);
    const display = await screen.findByRole('region', { name: 'Display & accessibility' });
    const contrast = within(display).getByRole('switch', { name: 'High contrast' });
    expect(contrast).toHaveAttribute('aria-checked', 'false');
    expect(contrast).toHaveAccessibleDescription('Darker text and stronger borders');
    await userEvent.click(contrast);
    expect(contrast).toHaveAttribute('aria-checked', 'true');
    expect(useUiSettings.getState().highContrast).toBe(true);
    await userEvent.click(within(display).getByRole('radio', { name: 'Largest' }));
    await waitFor(() =>
      expect(patches.at(-1)).toEqual({
        textSize: 'largest',
        highContrast: true,
        reduceMotion: false,
      }),
    );
    await waitFor(() => expect(useUiSettings.getState().dirty).toBe(false));
    expect(within(display).getByText('Hindi is coming soon')).toBeInTheDocument();
  });

  it('PRO-4 a new device starts from the account’s display settings', async () => {
    mockApi({ 'GET /me/saved-recipes': { saved: [] } });
    renderApp('/profile', {
      ...returningUserMe,
      settings: { ...returningUserMe.settings, textSize: 'large', reduceMotion: true },
    });
    await screen.findByRole('region', { name: 'Display & accessibility' });
    await waitFor(() => expect(useUiSettings.getState().textSize).toBe('large'));
    expect(useUiSettings.getState()).toMatchObject({ reduceMotion: true, accountSynced: true });
  });

  it('PRO-1 Edit profile saves the new name', async () => {
    const sent: unknown[] = [];
    mockApi({
      'PATCH /me/profile': (init: RequestInit) => {
        sent.push(JSON.parse(String(init.body)));
        return undefined;
      },
      'GET /me/saved-recipes': { saved: [] },
    });
    renderApp('/profile', [returningUserMe, returningUserMe]);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit profile' }));
    const sheet = await screen.findByRole('dialog', { name: 'Edit profile' });
    const name = within(sheet).getByRole('textbox', { name: 'Your name' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Ananya M');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(sent).toEqual([{ displayName: 'Ananya M' }]));
    expect(await screen.findByText('Name updated')).toBeInTheDocument();
  });

  it('PRO-6 Download my data saves a file', async () => {
    const fetchSpy = mockApi({
      'GET /me/export': () =>
        new Response('{"user":{}}', {
          status: 200,
          headers: { 'content-disposition': 'attachment; filename="shelf-life-2026-10-05.json"' },
        }),
      'GET /me/saved-recipes': { saved: [] },
    });
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    renderApp('/profile', returningUserMe);
    await userEvent.click(await screen.findByRole('button', { name: 'Download my data' }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(fetchSpy.mock.calls.some(([u]) => String(u).endsWith('/me/export'))).toBe(true);
  });

  it('PRO-6 Delete account: names the shared lists, deletes, and leaves nothing on the device', async () => {
    const deletes: string[] = [];
    mockApi({
      'DELETE /me': () => {
        deletes.push('me');
        return undefined;
      },
      'GET /me/saved-recipes': { saved: [] },
    });
    useRecipeStore.getState().forUser('u1');
    useRecipeStore.setState({
      prefs: { diet: 'vegan', cuisines: [], maxMinutes: null, avoid: [] },
    });
    const { router } = renderApp('/profile', seededMe);
    await userEvent.click(await screen.findByRole('button', { name: 'Delete account' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete your account?' });
    expect(dialog).toHaveTextContent(
      'These shared lists will be deleted for everyone on them: Apartment 4B, Family groceries, Diwali party.',
    );
    expect(within(dialog).getByRole('button', { name: 'Keep my account' })).toHaveFocus();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete account' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/welcome'));
    expect(deletes).toEqual(['me']);
    expect(window.localStorage.getItem('shelf-life:me')).toBeNull();
    expect(useRecipeStore.getState().prefs).toBeNull();
    const dbs = (await indexedDB.databases()).map((d) => d.name);
    expect(dbs.filter((n) => n?.startsWith('shelf-life:'))).toEqual([]);
  });
});
