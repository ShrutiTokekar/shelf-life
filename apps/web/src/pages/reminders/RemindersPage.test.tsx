import {
  addItems,
  addListItem,
  readItem,
  readListItems,
  readReminderState,
  recordActivity,
} from '@shelf-life/docs';
import { addDays, newListItem, todayIso, type PantryItem } from '@shelf-life/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDoc, listDocName, pantryDocName } from '../../lib/sync/docs';
import { seriousViolations } from '../../test/axe';
import { returningUserMe, seededMe } from '../../test/fixtures';
import { resetMedia, setDesktop } from '../../test/media';
import { pantryItem } from '../../test/pantryFixtures';
import { PANTRY } from '../../test/receiptFixtures';
import { renderApp } from '../../test/renderApp';

afterEach(() => {
  resetMedia();
  vi.restoreAllMocks();
});

const TODAY = todayIso();
const HOME = returningUserMe.pantry!.homeListId;

async function seed(items: PantryItem[]) {
  const handle = getDoc(pantryDocName(PANTRY));
  await handle.ready;
  addItems(handle.doc, items);
  return handle.doc;
}
const kitchen = () => [
  pantryItem({ id: 'eggs', name: 'Eggs', status: 'out', quantity: 0, outAt: TODAY }),
  pantryItem({
    id: 'onions',
    name: 'Onions',
    status: 'out',
    quantity: 0,
    outAt: addDays(TODAY, -2),
  }),
  pantryItem({ id: 'milk', name: 'Whole milk', quantity: 1, unit: 'cup', startQuantity: 8 }),
  pantryItem({ id: 'rice', name: 'Rice', quantity: 4, startQuantity: 5 }),
];

describe('RemindersPage (SRS 6.10)', () => {
  it('RMD-1..RMD-3 ran out and running low, who used the last, unread dots, on-the-list claimer', async () => {
    const doc = await seed(kitchen());
    recordActivity(doc, [
      {
        id: 'a1',
        pantryId: PANTRY,
        listId: HOME,
        actorId: 'u3',
        type: 'ran_out',
        subject: 'Eggs',
        itemId: 'eggs',
        beforeExpiry: null,
        createdAt: `${TODAY}T08:00:00.000Z`,
      },
    ]);
    const list = getDoc(listDocName(HOME));
    await list.ready;
    addListItem(list.doc, {
      ...newListItem(
        { name: 'Onions', quantity: null, unit: '' },
        { listId: HOME, userId: 'u2', now: '' },
      ),
      pantryItemId: 'onions',
      claimedBy: 'u2',
    });
    const { container } = renderApp('/reminders', seededMe);
    const ranOut = await screen.findByRole('region', { name: 'Ran out' });
    const eggs = within(ranOut).getByRole('listitem', { name: /Eggs/ });
    expect(eggs).toHaveTextContent('Ran out today · Meera used the last of it');
    expect(within(eggs).getByRole('heading', { name: 'Eggs, Unread' })).toBeInTheDocument();
    const onions = within(ranOut).getByRole('listitem', { name: /Onions/ });
    expect(onions).toHaveTextContent('Ran out 2 days ago');
    expect(onions).toHaveTextContent(/Arjun/);
    expect(within(onions).queryByRole('button')).toBeNull();
    const low = screen.getByRole('region', { name: 'Running low' });
    expect(within(low).getAllByTestId('reminder')).toHaveLength(1);
    expect(low).toHaveTextContent('About 1 cup left');
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('RMD-1 Add to list puts it on the list for this jar; RMD-2 Mark all read', async () => {
    await seed(kitchen());
    renderApp('/reminders', returningUserMe);
    const eggs = await screen.findByRole('listitem', { name: /Eggs/ });
    await userEvent.click(within(eggs).getByRole('button', { name: 'Add Eggs to the list' }));
    const list = getDoc(listDocName(HOME));
    await list.ready;
    await waitFor(() =>
      expect(readListItems(list.doc)).toEqual([
        expect.objectContaining({ name: 'Eggs', pantryItemId: 'eggs' }),
      ]),
    );
    // Now on the list: no more actions, and not unread.
    await waitFor(() =>
      expect(
        within(screen.getByRole('listitem', { name: /Eggs/ })).queryByRole('button'),
      ).toBeNull(),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
    expect(screen.queryByText(/Unread/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark all read' })).toBeNull();
  });

  it('RMD-1 Later and Not needed hide it (with Undo); Snooze puts off running low', async () => {
    const doc = await seed(kitchen());
    renderApp('/reminders', returningUserMe);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Remind me about Eggs later' }),
    );
    expect(screen.queryByRole('listitem', { name: /Eggs/ })).toBeNull();
    expect(readReminderState(doc, 'u1').hidden).toEqual({
      [`ran_out:eggs:${TODAY}`]: addDays(TODAY, 1),
    });
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByRole('listitem', { name: /Eggs/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Onions not needed' }));
    expect(screen.queryByRole('listitem', { name: /Onions/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Snooze Whole milk' }));
    expect(screen.queryByRole('region', { name: 'Running low' })).toBeNull();
  });

  it('empty: nothing needs restocking, with a way to the pantry', async () => {
    await seed([pantryItem({ name: 'Rice' })]);
    renderApp('/reminders', returningUserMe);
    expect(
      await screen.findByRole('heading', { name: 'Nothing needs restocking' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open your pantry' })).toHaveAttribute(
      'href',
      '/pantry',
    );
  });

  it('RMD-2 the bell shows the unread count (desktop header and mobile Today)', async () => {
    await seed(kitchen());
    setDesktop(true);
    const { unmount } = renderApp('/pantry', returningUserMe);
    expect(await screen.findByRole('link', { name: 'Reminders, 3 unread' })).toHaveAttribute(
      'href',
      '/reminders',
    );
    unmount();
    setDesktop(false);
    renderApp('/', returningUserMe);
    expect(await screen.findByRole('link', { name: 'Reminders, 3 unread' })).toBeInTheDocument();
  });
});

describe('SRS 8.6 Running low from the item sheet', () => {
  it('marks an item running low (with Undo) so it shows on Reminders', async () => {
    const doc = await seed([
      pantryItem({ id: 'oil', name: 'Olive oil', quantity: 1, unit: 'bottle' }),
    ]);
    renderApp('/pantry', returningUserMe);
    await userEvent.click(await screen.findByRole('button', { name: /^Edit Olive oil/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Running low' }));
    expect(readItem(doc, 'oil')?.lowAt).toBe(TODAY);
    expect(await screen.findByText(/Olive oil marked running low/)).toBeInTheDocument();
  });
});
