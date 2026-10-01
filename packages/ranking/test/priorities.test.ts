import {
  addDays,
  newListItem,
  type ListItem,
  type PantryItem,
  type Receipt,
} from '@shelf-life/shared';
import { describe, expect, it } from 'vitest';
import {
  emptyTodayState,
  markDone,
  priorityCandidates,
  snooze,
  timeline,
  timelineColumn,
  todayPriorities,
  unmarkDone,
  type PriorityInput,
} from '../src';

const TODAY = '2026-09-25';
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
    purchasedOn: addDays(TODAY, -3),
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
const entry = (over: Partial<ListItem> = {}): ListItem => ({
  ...newListItem(
    { name: 'Eggs', quantity: null, unit: '' },
    { listId: 'home', userId: 'u2', now: '' },
  ),
  ...over,
});
const receipt = (state: Receipt['reviewState']) =>
  ({ id: `r-${state}`, reviewState: state }) as Receipt;

function input(over: Partial<PriorityInput> = {}): PriorityInput {
  return {
    today: TODAY,
    pantry: [],
    listItems: [],
    receipts: [],
    state: emptyTodayState(TODAY),
    ...over,
  };
}

describe('SRS 8.4 priority candidates', () => {
  const spinach = item({ name: 'Spinach', expiresOn: TODAY });
  const overdue = item({ name: 'Milk', expiresOn: addDays(TODAY, -1) });
  const eggs = item({ name: 'Eggs', status: 'out', quantity: 0, outAt: TODAY });
  const yogurt = item({ name: 'Greek yogurt', expiresOn: addDays(TODAY, 2) });
  const cilantro = item({ name: 'Cilantro', expiresOn: addDays(TODAY, 2) });
  const paneer = item({ name: 'Paneer', expiresOn: addDays(TODAY, 3) });

  it('scores: expires today 100, ran out unclaimed 80, plan for 1–2 days 60−10d, receipt 40, +15 one tap', () => {
    const c = priorityCandidates(
      input({
        pantry: [spinach, eggs, yogurt, cilantro, paneer],
        receipts: [receipt('needs_review'), receipt('clean')],
      }),
    );
    expect(c.map((p) => [p.kind, p.score])).toEqual([
      ['expires', 115],
      ['ran_out', 95],
      ['plan_soon', 40],
      ['review_receipt', 40],
    ]);
    const plan = c.find((p) => p.kind === 'plan_soon')!;
    expect(plan.items.map((i) => i.name)).toEqual(['Cilantro', 'Greek yogurt']);
    expect(plan.remindOn).toBe(addDays(TODAY, 1));
  });

  it('ties go to the earliest expiry', () => {
    const c = priorityCandidates(input({ pantry: [spinach, overdue] }));
    expect(c.map((p) => p.items[0]!.name)).toEqual(['Milk', 'Spinach']);
  });

  it('a ran-out item someone claimed is not a priority; one on the list unclaimed is', () => {
    const claimed = priorityCandidates(
      input({ pantry: [eggs], listItems: [entry({ pantryItemId: eggs.id, claimedBy: 'u2' })] }),
    );
    expect(claimed).toEqual([]);
    const open = priorityCandidates(
      input({ pantry: [eggs], listItems: [entry({ pantryItemId: eggs.id })] }),
    );
    expect(open[0]).toMatchObject({
      kind: 'ran_out',
      listItem: expect.objectContaining({ pantryItemId: eggs.id }),
    });
    // Ran out yesterday: no longer today's news.
    expect(priorityCandidates(input({ pantry: [{ ...eggs, outAt: addDays(TODAY, -1) }] }))).toEqual(
      [],
    );
  });

  it('remind-me day is the day before the first expiry, never today', () => {
    const later = item({ expiresOn: addDays(TODAY, 2) });
    expect(priorityCandidates(input({ pantry: [later] }))[0]!.remindOn).toBe(addDays(TODAY, 1));
    const tomorrow = item({ expiresOn: addDays(TODAY, 1) });
    expect(priorityCandidates(input({ pantry: [tomorrow] }))[0]).toMatchObject({
      score: 50,
      remindOn: addDays(TODAY, 1),
    });
  });

  it('6c: an unclaimed list item the top recipe needs scores 70 + 15', () => {
    const c = priorityCandidates(
      input({ recipeNeeds: [entry({ id: 'cheddar' }), entry({ claimedBy: 'u3' })] }),
    );
    expect(c.map((p) => [p.key, p.score])).toEqual([['recipe_item:cheddar', 85]]);
  });

  it('used and discarded items never show up', () => {
    expect(priorityCandidates(input({ pantry: [{ ...spinach, status: 'used' }] }))).toEqual([]);
  });
});

describe('TOD-1 TOD-2 today’s three', () => {
  const pantry = [
    item({ id: 'a', expiresOn: TODAY }),
    item({ id: 'b', expiresOn: TODAY }),
    item({ id: 'c', expiresOn: TODAY }),
    item({ id: 'd', expiresOn: TODAY }),
  ];

  it('shows at most three, and done ones fill slots', () => {
    const fresh = todayPriorities(input({ pantry }));
    expect(fresh).toMatchObject({ doneCount: 0, total: 3 });
    expect(fresh.active.map((p) => p.key)).toEqual(['expires:a', 'expires:b', 'expires:c']);
    const state = markDone(emptyTodayState(TODAY), 'expires:a', TODAY);
    const after = todayPriorities(input({ pantry, state }));
    expect(after).toMatchObject({ doneCount: 1, total: 3 });
    expect(after.active.map((p) => p.key)).toEqual(['expires:b', 'expires:c']);
    expect(unmarkDone(state, 'expires:a').done).toEqual([]);
  });

  it('snoozing costs 50 points; "Remind me" hides a plan until its day', () => {
    const one = [
      item({ id: 's', expiresOn: TODAY }),
      item({ id: 'y', expiresOn: addDays(TODAY, 2) }),
    ];
    const snoozed = snooze(emptyTodayState(TODAY), 'expires:s', TODAY);
    const ranked = todayPriorities(input({ pantry: one, state: snoozed })).active;
    expect(ranked.map((p) => [p.key, p.score])).toEqual([
      ['expires:s', 65],
      [`plan_soon:${TODAY}`, 40],
    ]);
    const reminded = snooze(emptyTodayState(TODAY), `plan_soon:${TODAY}`, TODAY, addDays(TODAY, 1));
    expect(
      todayPriorities(input({ pantry: one, state: reminded })).active.map((p) => p.kind),
    ).toEqual(['expires']);
  });

  it('yesterday’s state starts fresh', () => {
    const old = markDone(emptyTodayState(addDays(TODAY, -1)), 'expires:a', addDays(TODAY, -1));
    expect(todayPriorities(input({ pantry, state: old })).doneCount).toBe(0);
    expect(markDone(old, 'x', TODAY)).toEqual({ date: TODAY, done: ['x'], snoozed: {} });
  });
});

describe('TOD-6 timeline', () => {
  it('places items by days left: Today, Tomorrow, 2 days, 3 days, This week, Later', () => {
    expect([-2, 0, 1, 2, 3, 4, 7, 8, 400].map(timelineColumn)).toEqual([
      'today',
      'today',
      'tomorrow',
      'in2',
      'in3',
      'week',
      'week',
      'later',
      'later',
    ]);
    const cols = timeline(
      [
        item({ name: 'B', expiresOn: addDays(TODAY, 2) }),
        item({ name: 'A', expiresOn: addDays(TODAY, 2) }),
        item({ name: 'Gone', status: 'out', quantity: 0 }),
        item({ name: 'Used', status: 'used' }),
      ],
      TODAY,
    );
    expect(cols.in2.map((i) => i.name)).toEqual(['A', 'B']);
    expect(Object.values(cols).flat()).toHaveLength(2);
  });
});
