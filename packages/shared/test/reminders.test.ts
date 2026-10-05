import { describe, expect, it } from 'vitest';
import {
  addDays,
  emptyReminderState,
  isRunningLow,
  markRead,
  newListItem,
  pruneReminderState,
  putOff,
  remindersFor,
  withQuantity,
  type Activity,
  type ListItem,
  type PantryItem,
} from '../src';

const TODAY = '2026-10-05';
let n = 0;
function item(over: Partial<PantryItem> = {}): PantryItem {
  n++;
  return {
    id: `i${n}`,
    pantryId: 'p',
    listId: 'home',
    foodId: null,
    name: `Item ${n}`,
    category: 'produce',
    location: 'fridge',
    quantity: 1,
    unit: '',
    note: '',
    purchasedOn: addDays(TODAY, -5),
    expiresOn: addDays(TODAY, 10),
    expiryIsEstimate: true,
    expirySource: 'dictionary',
    status: 'active',
    outAt: null,
    addedBy: 'u1',
    receiptLineId: null,
    updatedAt: '',
    ...over,
  };
}
const out = (name: string, daysAgo: number, over: Partial<PantryItem> = {}) =>
  item({ name, status: 'out', quantity: 0, outAt: addDays(TODAY, -daysAgo), ...over });
const entry = (over: Partial<ListItem>): ListItem => ({
  ...newListItem(
    { name: 'x', quantity: null, unit: '' },
    { listId: 'home', userId: 'u2', now: '' },
  ),
  ...over,
});
const ranOutBy = (itemId: string, actorId: string): Activity => ({
  id: `a-${itemId}`,
  pantryId: 'p',
  listId: 'home',
  actorId,
  type: 'ran_out',
  subject: '',
  itemId,
  beforeExpiry: null,
  createdAt: `${TODAY}T08:00:00.000Z`,
});

describe('SRS 8.6 running low', () => {
  it('records the starting amount on the first decrease, and restocking starts over', () => {
    expect(withQuantity({ quantity: 12, startQuantity: null }, 10)).toEqual({
      quantity: 10,
      startQuantity: 12,
      lowAt: null,
    });
    expect(withQuantity({ quantity: 10, startQuantity: 12 }, 2)).toMatchObject({
      startQuantity: 12,
    });
    expect(withQuantity({ quantity: 2, startQuantity: 12, lowAt: TODAY }, 12)).toEqual({
      quantity: 12,
      startQuantity: 12,
      lowAt: null,
    });
  });

  it('is low below 20% of what there was, or when someone marks it low', () => {
    expect(isRunningLow(item({ quantity: 2, startQuantity: 12 }))).toBe(true);
    expect(isRunningLow(item({ quantity: 3, startQuantity: 12 }))).toBe(false);
    expect(isRunningLow(item({ quantity: 5, lowAt: TODAY }))).toBe(true);
    expect(isRunningLow(item({ quantity: 2 }))).toBe(false);
    expect(isRunningLow(item({ quantity: 0, status: 'out', startQuantity: 12 }))).toBe(false);
  });
});

describe('RMD-1..RMD-3 reminders', () => {
  it('ran out (last 30 days, newest first) and running low, with who used the last and the list entry', () => {
    const eggs = out('Eggs', 0);
    const onions = out('Onions', 2);
    const old = out('Old thing', 45);
    const milk = item({ name: 'Whole milk', quantity: 1, unit: 'cup', startQuantity: 8 });
    const fine = item({ name: 'Rice', quantity: 4, startQuantity: 5 });
    const onList = entry({ name: 'Onions', claimedBy: 'u2' });
    const r = remindersFor({
      pantry: [onions, old, eggs, milk, fine],
      listItems: [onList],
      activity: [ranOutBy(eggs.id, 'u3')],
      state: emptyReminderState(),
      today: TODAY,
    });
    expect(r.ranOut.map((x) => [x.item.name, x.daysAgo])).toEqual([
      ['Eggs', 0],
      ['Onions', 2],
    ]);
    expect(r.ranOut[0]!.by).toBe('u3');
    expect(r.ranOut[1]!.listItem).toBe(onList);
    expect(r.low.map((x) => x.item.name)).toEqual(['Whole milk']);
    // RMD-2: unread, except what's already on the list.
    expect(r.unread).toBe(2);
  });

  it('Mark all read, Later (tomorrow), Snooze (2 days) and Not needed (for good)', () => {
    const eggs = out('Eggs', 0);
    const milk = item({ name: 'Milk', quantity: 1, startQuantity: 10 });
    const base = { pantry: [eggs, milk], listItems: [], activity: [], today: TODAY };
    const all = remindersFor({ ...base, state: emptyReminderState() });
    const read = markRead(
      emptyReminderState(),
      [...all.ranOut, ...all.low].map((r) => r.key),
    );
    expect(remindersFor({ ...base, state: read }).unread).toBe(0);

    const later = putOff(emptyReminderState(), all.ranOut[0]!.key, 'later', TODAY);
    expect(remindersFor({ ...base, state: later }).ranOut).toEqual([]);
    expect(remindersFor({ ...base, state: later, today: addDays(TODAY, 1) }).ranOut).toHaveLength(
      1,
    );

    const snoozed = putOff(emptyReminderState(), all.low[0]!.key, 'snooze', TODAY);
    expect(remindersFor({ ...base, state: snoozed, today: addDays(TODAY, 1) }).low).toEqual([]);
    expect(remindersFor({ ...base, state: snoozed, today: addDays(TODAY, 2) }).low).toHaveLength(1);

    const never = putOff(emptyReminderState(), all.ranOut[0]!.key, 'never', TODAY);
    expect(remindersFor({ ...base, state: never, today: addDays(TODAY, 20) }).ranOut).toEqual([]);
    // Running out again later is a new reminder.
    const again = { ...eggs, outAt: addDays(TODAY, 3) };
    expect(
      remindersFor({ ...base, pantry: [again], state: never, today: addDays(TODAY, 3) }).ranOut,
    ).toHaveLength(1);
  });

  it('prunes choices about items that are gone, keeping dismissed ones for items still there', () => {
    const s = putOff(
      putOff(emptyReminderState(), 'ran_out:keep:2026-10-01', 'never', TODAY),
      'ran_out:gone:2026-10-01',
      'never',
      TODAY,
    );
    expect(pruneReminderState(s, ['keep']).hidden).toEqual({ 'ran_out:keep:2026-10-01': 'never' });
  });
});
