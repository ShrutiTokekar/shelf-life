import { describe, expect, it } from 'vitest';
import {
  addDays,
  DEFAULT_NOTIFICATION_SETTINGS,
  emptyReminderState,
  expiryAlert,
  expiryLeadDays,
  nameList,
  putOff,
  ranOutFollowUpKey,
  ranOutFollowUpPayload,
  ranOutFollowUps,
  weeklyPayload,
  weeklyReminderDue,
  type Activity,
  type ListItem,
  type PantryItem,
} from '../src';

const TODAY = '2026-10-05'; // a Monday
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
const ranOut = (it: PantryItem, at: string): Activity => ({
  id: `a-${it.id}`,
  pantryId: 'p',
  listId: 'home',
  actorId: 'u1',
  type: 'ran_out',
  subject: it.name,
  itemId: it.id,
  beforeExpiry: null,
  createdAt: at,
});
const entry = (over: Partial<ListItem>): ListItem => ({
  id: 'l1',
  listId: 'home',
  name: 'x',
  quantity: null,
  unit: '',
  note: '',
  reason: 'ran_out',
  recipeId: null,
  pantryItemId: null,
  addedBy: 'u2',
  claimedBy: null,
  checked: false,
  checkedBy: null,
  checkedAt: null,
  createdAt: '',
  ...over,
});

describe('SRS 8.8 hourly reminders: what is due', () => {
  it('nameList keeps pushes short', () => {
    expect(nameList(['Milk'])).toBe('milk');
    expect(nameList(['Milk', 'Eggs'])).toBe('milk and eggs');
    expect(nameList(['Milk', 'Eggs', 'Rice'])).toBe('milk, eggs and rice');
    expect(nameList(['Milk', 'Eggs', 'Rice', 'Dal'])).toBe('milk, eggs and 2 more');
  });

  it('PRO-5 expiry alert timing: off, same day, 1 day before, 2 days before', () => {
    expect(['off', 'same_day', '1_day', '2_days'].map((a) => expiryLeadDays(a as never))).toEqual([
      null,
      0,
      1,
      2,
    ]);
    const milk = item({ name: 'Milk', expiresOn: addDays(TODAY, 1) });
    const spinach = item({ name: 'Spinach', expiresOn: addDays(TODAY, 1) });
    const used = item({ name: 'Bread', expiresOn: addDays(TODAY, 1), status: 'used' });
    const later = item({ name: 'Rice', expiresOn: addDays(TODAY, 2) });
    const items = [milk, spinach, used, later];
    expect(expiryAlert({ items, alert: '1_day', localDate: TODAY })).toEqual({
      key: `expiry:${TODAY}`,
      payload: expect.objectContaining({
        title: 'Milk and spinach expire tomorrow',
        url: '/',
      }),
    });
    expect(expiryAlert({ items, alert: '2_days', localDate: TODAY })?.payload.title).toBe(
      'Rice expires in 2 days',
    );
    expect(expiryAlert({ items, alert: 'same_day', localDate: TODAY })).toBeNull();
    expect(expiryAlert({ items, alert: 'off', localDate: TODAY })).toBeNull();
  });

  it('RMD-4 ran-out follow-up: 12 to 72 hours on, not on a list, not put off', () => {
    const now = new Date('2026-10-05T12:00:00Z');
    const eggs = item({ name: 'Eggs', status: 'out', quantity: 0, outAt: '2026-10-04' });
    const fresh = item({ name: 'Milk', status: 'out', quantity: 0, outAt: TODAY });
    const old = item({ name: 'Ghee', status: 'out', quantity: 0, outAt: '2026-10-01' });
    const listed = item({ name: 'Rice', status: 'out', quantity: 0, outAt: '2026-10-04' });
    const putOffItem = item({ name: 'Dal', status: 'out', quantity: 0, outAt: '2026-10-04' });
    const pantry = [eggs, fresh, old, listed, putOffItem];
    const activity = [
      ranOut(eggs, '2026-10-04T20:00:00Z'), // 16 h ago
      ranOut(fresh, '2026-10-05T06:00:00Z'), // 6 h ago
      ranOut(old, '2026-10-01T08:00:00Z'), // 4 days ago
      ranOut(listed, '2026-10-04T08:00:00Z'),
      ranOut(putOffItem, '2026-10-04T08:00:00Z'),
    ];
    const state = putOff(
      emptyReminderState(),
      `ran_out:${putOffItem.id}:${putOffItem.outAt}`,
      'later',
      TODAY,
    );
    const due = ranOutFollowUps({
      pantry,
      listItems: [entry({ pantryItemId: listed.id, name: 'Rice' })],
      activity,
      state,
      localDate: TODAY,
      now,
    });
    expect(due.map((i) => i.name)).toEqual(['Eggs']);
    expect(ranOutFollowUpKey(eggs)).toBe(`ran_out_later:${eggs.id}:2026-10-04`);
    expect(ranOutFollowUpPayload(due)).toEqual(
      expect.objectContaining({ title: 'Still out of eggs', url: '/reminders' }),
    );
    expect(ranOutFollowUpPayload([eggs, listed]).title).toBe('Still out of eggs and rice');
  });

  it('a ran-out item with no activity counts from the end of its out day', () => {
    const eggs = item({ name: 'Eggs', status: 'out', quantity: 0, outAt: '2026-10-04' });
    const args = { pantry: [eggs], listItems: [], activity: [], state: emptyReminderState() };
    expect(
      ranOutFollowUps({ ...args, localDate: TODAY, now: new Date('2026-10-05T06:00:00Z') }),
    ).toEqual([]);
    expect(
      ranOutFollowUps({ ...args, localDate: TODAY, now: new Date('2026-10-05T13:00:00Z') }),
    ).toEqual([eggs]);
  });

  it('PRO-5 weekly reminder: the chosen day and time in the person’s time zone, for 2 hours', () => {
    const s = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      weeklyReminder: true,
      weeklyDay: 6, // Saturday
      weeklyTime: '10:00',
      timeZone: 'Asia/Kolkata',
    };
    // Saturday Oct 10, 10:30 AM in Kolkata = 05:00 UTC.
    expect(weeklyReminderDue(s, new Date('2026-10-10T05:00:00Z'))).toBe('weekly:2026-10-10');
    // 9:30 AM: not yet. 12:30 PM: window passed. Sunday: wrong day.
    expect(weeklyReminderDue(s, new Date('2026-10-10T04:00:00Z'))).toBeNull();
    expect(weeklyReminderDue(s, new Date('2026-10-10T07:00:00Z'))).toBeNull();
    expect(weeklyReminderDue(s, new Date('2026-10-11T05:00:00Z'))).toBeNull();
    // 10:00 AM Saturday UTC is still Saturday 3:30 PM in Kolkata: the time zone decides.
    expect(weeklyReminderDue({ ...s, timeZone: 'UTC' }, new Date('2026-10-10T10:30:00Z'))).toBe(
      'weekly:2026-10-10',
    );
    expect(
      weeklyReminderDue({ ...s, weeklyReminder: false }, new Date('2026-10-10T05:00:00Z')),
    ).toBeNull();
  });

  it('RMD-4 weekly reminder summarizes the lists', () => {
    expect(
      weeklyPayload([
        { name: 'Diwali party', open: 2 },
        { name: 'Apartment 4B', open: 7 },
        { name: 'Work', open: 0 },
      ]),
    ).toEqual({
      title: 'Time to plan this week’s shop',
      body: '7 things on Apartment 4B · 2 on Diwali party',
      url: '/lists',
      tag: 'weekly',
    });
    expect(weeklyPayload([{ name: 'Home', open: 1 }]).body).toBe('1 thing on Home');
    expect(weeklyPayload([]).body).toBe('Your lists are empty. Add what you need for the week.');
  });
});
