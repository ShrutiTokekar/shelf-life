import { addItems, readListItems } from '@shelf-life/docs';
import { todayIso } from '@shelf-life/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDoc, listDocName, pantryDocName } from '../../lib/sync/docs';
import { seriousViolations } from '../../test/axe';
import { returningUserMe } from '../../test/fixtures';
import { mockApi } from '../../test/mockApi';
import { pantryItem } from '../../test/pantryFixtures';
import { PANTRY } from '../../test/receiptFixtures';
import { renderApp } from '../../test/renderApp';

const w = window as unknown as Record<string, unknown>;
afterEach(() => {
  vi.restoreAllMocks();
  delete w.PushManager;
  delete w.Notification;
  Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true });
});

/** A browser with push: a service worker registration and a Notification permission. */
function pushBrowser(permission: NotificationPermission = 'default') {
  const subscription = {
    toJSON: () => ({ endpoint: 'https://push.example.com/1', keys: { p256dh: 'p', auth: 'a' } }),
    unsubscribe: vi.fn(async () => true),
  };
  let subscribed: typeof subscription | null = null;
  const pushManager = {
    getSubscription: vi.fn(async () => subscribed),
    subscribe: vi.fn(async () => (subscribed = subscription)),
  };
  const reg = { pushManager };
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { ready: Promise.resolve(reg), getRegistration: async () => reg },
    configurable: true,
  });
  w.PushManager = function PushManager() {};
  const N = { permission, requestPermission: vi.fn(async () => (N.permission = 'granted')) };
  w.Notification = N;
  return { pushManager, N };
}

describe('PRO-5 notification settings (SRS 8.8)', () => {
  it('saves each setting to the account; quiet hours are explained', async () => {
    const patches: unknown[] = [];
    mockApi({
      'PATCH /me/settings': (init: RequestInit) => {
        patches.push(JSON.parse(String(init.body)));
        return {};
      },
      'GET /me/saved-recipes': { saved: [] },
    });
    const { container } = renderApp('/profile', [
      returningUserMe,
      returningUserMe,
      returningUserMe,
    ]);
    const card = await screen.findByRole('region', { name: 'Notifications' });
    // No push in this browser: the device switch explains, and is off.
    const device = within(card).getByRole('switch', { name: 'Notifications on this device' });
    expect(device).toBeDisabled();
    expect(device).toHaveAccessibleDescription(/can’t show notifications/);

    await userEvent.click(within(card).getByRole('switch', { name: 'When something runs out' }));
    await userEvent.click(within(card).getByRole('switch', { name: 'Weekly shopping reminder' }));
    await waitFor(() =>
      expect(patches).toEqual(
        expect.arrayContaining([{ notifyRanOut: false }, { weeklyReminder: true }]),
      ),
    );
    expect(within(card).getByRole('combobox', { name: /Day/ })).toBeInTheDocument();
    expect(card).toHaveTextContent('no notifications between 10 PM and 8 AM');
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('turns notifications on for this device (asks permission only on tap) and saves it', async () => {
    const posted: unknown[] = [];
    mockApi({
      'GET /push/key': {
        enabled: true,
        publicKey:
          'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
      },
      'POST /push/subscriptions': (init: RequestInit) => {
        posted.push(JSON.parse(String(init.body)));
        return { id: '0192f0c0-0000-7000-8000-0000000000ee' };
      },
      'PATCH /me/settings': {},
      'GET /me/saved-recipes': { saved: [] },
    });
    const { N, pushManager } = pushBrowser();
    renderApp('/profile', returningUserMe);
    const device = await screen.findByRole('switch', { name: 'Notifications on this device' });
    await waitFor(() => expect(device).toBeEnabled());
    expect(N.requestPermission).not.toHaveBeenCalled();
    await userEvent.click(device);
    await waitFor(() => expect(device).toHaveAttribute('aria-checked', 'true'));
    expect(N.requestPermission).toHaveBeenCalledOnce();
    expect(pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    );
    expect(posted).toEqual([
      { endpoint: 'https://push.example.com/1', keys: { p256dh: 'p', auth: 'a' } },
    ]);
  });

  it('iPhone without the Home Screen app: explains how to turn notifications on', async () => {
    mockApi({ 'GET /me/saved-recipes': { saved: [] } });
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)',
    );
    renderApp('/reminders', returningUserMe);
    const device = await screen.findByRole('switch', { name: 'Notifications on this device' });
    expect(device).toHaveAccessibleDescription(/add Shelf Life to your Home Screen first/);
  });
});

describe('RMD-4 ran out and the notification’s Add to list', () => {
  it('marking something out tells the API (to notify the others on that list)', async () => {
    const sent: unknown[] = [];
    mockApi({
      'POST /push/ran-out': (init: RequestInit) => {
        sent.push(JSON.parse(String(init.body)));
        return { sent: 1 };
      },
      'GET /me/saved-recipes': { saved: [] },
    });
    const handle = getDoc(pantryDocName(PANTRY));
    await handle.ready;
    addItems(handle.doc, [pantryItem({ id: 'eggs', name: 'Eggs', quantity: 1, unit: '' })]);
    renderApp('/pantry', returningUserMe);
    await userEvent.click(await screen.findByRole('button', { name: /^Used it: Eggs/ }));
    await waitFor(() =>
      expect(sent).toEqual([
        expect.objectContaining({ pantryId: PANTRY, itemId: 'eggs', itemName: 'Eggs' }),
      ]),
    );
  });

  it('/reminders?add=<item> adds it to the list and clears the link', async () => {
    mockApi({ 'GET /me/saved-recipes': { saved: [] } });
    const handle = getDoc(pantryDocName(PANTRY));
    await handle.ready;
    addItems(handle.doc, [
      pantryItem({ id: 'eggs', name: 'Eggs', status: 'out', quantity: 0, outAt: todayIso() }),
    ]);
    const { router } = renderApp('/reminders?add=eggs', returningUserMe);
    const list = getDoc(listDocName(returningUserMe.pantry!.homeListId));
    await list.ready;
    await waitFor(() =>
      expect(readListItems(list.doc)).toEqual([expect.objectContaining({ name: 'Eggs' })]),
    );
    await waitFor(() => expect(router.state.location.search).toBe(''));
  });
});
