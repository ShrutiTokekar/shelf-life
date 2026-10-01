import { describe, expect, it } from 'vitest';
import {
  CART_MOVE_AFTER_MS,
  checkPatch,
  claimPatch,
  groupListItems,
  listCounts,
  listItemSchema,
  newListItem,
  parseListText,
  planCartMove,
  ranOutRecently,
  unclaimPatch,
  whoIsGettingWhat,
  type ListItem,
  type PantryItem,
} from '../src';

const TODAY = '2026-09-28';
const NOW = '2026-09-28T18:00:00.000Z';
const ctx = { listId: 'list-1', userId: 'u1', now: NOW };

function item(over: Partial<ListItem> = {}): ListItem {
  return { ...newListItem({ name: 'Eggs', quantity: null, unit: '' }, ctx), ...over };
}

function jar(over: Partial<PantryItem> = {}): PantryItem {
  return {
    id: 'jar-1',
    pantryId: 'p1',
    listId: 'home',
    foodId: 'butter',
    name: 'Butter',
    category: 'dairy_eggs',
    location: 'fridge',
    quantity: 0,
    unit: 'stick',
    note: '',
    purchasedOn: '2026-09-01',
    expiresOn: '2026-10-01',
    expiryIsEstimate: true,
    expirySource: 'dictionary',
    status: 'out',
    outAt: '2026-09-27',
    addedBy: 'u1',
    receiptLineId: null,
    updatedAt: NOW,
    ...over,
  };
}

describe('LST-2 parseListText (SRS 9.2 fallback)', () => {
  it.each([
    [
      '2 onions and eggs',
      [
        ['Onions', 2, ''],
        ['Eggs', null, ''],
      ],
    ],
    [
      'milk, bread & butter',
      [
        ['Milk', null, ''],
        ['Bread', null, ''],
        ['Butter', null, ''],
      ],
    ],
    ['2 cartons oat milk', [['Oat milk', 2, 'cartons']]],
    ['1lb paneer', [['Paneer', 1, 'lb']]],
    ['a dozen eggs', [['Eggs', 12, '']]],
    ['2 dozen eggs', [['Eggs', 24, '']]],
    ['three bunches of cilantro', [['Cilantro', 3, 'bunches']]],
    ['1.5 kg atta', [['Atta', 1.5, 'kg']]],
    ['  ,  and ', []],
    ['7up', [['7up', 7, '']]],
  ])('%s', (text, expected) => {
    expect(parseListText(text).map((e) => [e.name, e.quantity, e.unit])).toEqual(expected);
  });

  it('keeps a lone number word as the name', () => {
    expect(parseListText('one')).toEqual([{ name: 'One', quantity: null, unit: '' }]);
  });
});

describe('LST-3 LST-1 LST-8 groups and counts', () => {
  const today = item({ id: 'a', reason: 'ran_out', createdAt: '2026-09-28T09:00:00' });
  const older = item({ id: 'b', reason: 'ran_out', createdAt: '2026-09-25T09:00:00' });
  const manual = item({ id: 'c', claimedBy: 'u2' });
  const inCart = item({ id: 'd', checked: true, checkedAt: NOW, checkedBy: 'u1' });

  it('needed today = ran out today; this week = the rest; checked items are in the cart', () => {
    const g = groupListItems([manual, inCart, older, today], TODAY);
    expect(g.neededToday.map((i) => i.id)).toEqual(['a']);
    expect(g.thisWeek.map((i) => i.id).sort()).toEqual(['b', 'c']);
    expect(g.cart.map((i) => i.id)).toEqual(['d']);
    expect(listCounts([manual, inCart, older, today])).toEqual({ toBuy: 3, inCart: 1 });
  });

  it("who's getting what", () => {
    const w = whoIsGettingWhat([manual, inCart, older, today]);
    expect([...w.byMember.keys()]).toEqual(['u2']);
    expect(w.unclaimed.map((i) => i.id).sort()).toEqual(['a', 'b']);
  });
});

describe('LST-5 LST-7 claims and checking', () => {
  it('claims and unclaims', () => {
    expect(claimPatch('u2')).toEqual({ claimedBy: 'u2' });
    expect(unclaimPatch()).toEqual({ claimedBy: null });
  });

  it('checking records who and when, and claims it; unchecking clears that', () => {
    const checked = { ...item(), ...checkPatch(item(), 'u2', NOW) };
    expect(checked).toMatchObject({
      checked: true,
      checkedBy: 'u2',
      checkedAt: NOW,
      claimedBy: 'u2',
    });
    expect(checkPatch(checked, 'u2', NOW)).toEqual({
      checked: false,
      checkedBy: null,
      checkedAt: null,
    });
    const claimed = item({ claimedBy: 'u3' });
    expect(checkPatch(claimed, 'u2', NOW).claimedBy).toBe('u3');
  });

  it('builds valid items', () => {
    const i = newListItem(
      { name: ' Oat milk ', quantity: 2, unit: 'cartons', note: 'unsweetened', claimedBy: 'u2' },
      ctx,
    );
    expect(() => listItemSchema.parse(i)).not.toThrow();
    expect(i).toMatchObject({ name: 'Oat milk', reason: 'manual', addedBy: 'u1', claimedBy: 'u2' });
  });
});

describe('ADD-3 ran out recently', () => {
  it('ran-out jars from the last week that are not already on the list, newest first', () => {
    const chips = ranOutRecently(
      [
        jar({ id: 'j1', name: 'Butter', outAt: '2026-09-27' }),
        jar({ id: 'j2', name: 'Coffee', outAt: '2026-09-28' }),
        jar({ id: 'j3', name: 'Rice', outAt: '2026-09-10' }),
        jar({ id: 'j4', name: 'Garlic', status: 'active', outAt: null }),
        jar({ id: 'j5', name: 'Eggs', outAt: '2026-09-28' }),
        jar({ id: 'j6', name: 'Ghee', outAt: '2026-09-28' }),
      ],
      [item({ name: 'eggs' }), item({ name: 'Other', pantryItemId: 'j6' })],
      TODAY,
    );
    expect(chips.map((c) => c.name)).toEqual(['Coffee', 'Butter']);
  });
});

describe('LST-7 planCartMove', () => {
  const base = { listId: 'party', pantryId: 'p1', pantry: [], doneShoppingAt: null, now: NOW };
  const checkedAt = (msAgo: number) => new Date(Date.parse(NOW) - msAgo).toISOString();

  it('moves checked items after 2 hours, labeled with the list, matched to the dictionary', () => {
    const plan = planCartMove(
      [
        item({
          id: 'old',
          name: 'Paneer',
          quantity: 1,
          unit: 'pack',
          checked: true,
          checkedBy: 'u2',
          checkedAt: checkedAt(CART_MOVE_AFTER_MS),
        }),
        item({ id: 'new', checked: true, checkedBy: 'u2', checkedAt: checkedAt(60_000) }),
        item({ id: 'open' }),
      ],
      base,
    );
    expect(plan.moved).toEqual(['old']);
    expect(plan.add).toHaveLength(1);
    expect(plan.add[0]).toMatchObject({
      pantryId: 'p1',
      listId: 'party',
      foodId: 'paneer',
      name: 'Paneer',
      category: 'dairy_eggs',
      location: 'fridge',
      quantity: 1,
      unit: 'pack',
      addedBy: 'u2',
      status: 'active',
      expiryIsEstimate: true,
      expirySource: 'dictionary',
    });
    expect(plan.activity.map((a) => [a.type, a.actorId, a.itemId])).toEqual([
      ['bought', 'u2', plan.add[0]!.id],
    ]);
  });

  it('"Done shopping" moves everything checked before it', () => {
    const plan = planCartMove(
      [
        item({ id: 'a', checked: true, checkedAt: checkedAt(60_000) }),
        item({ id: 'b', checked: true, checkedAt: NOW }),
      ],
      { ...base, doneShoppingAt: checkedAt(30_000) },
    );
    expect(plan.moved).toEqual(['a']);
  });

  it('PAN-9 refills the ran-out jar it came from instead of adding a new one', () => {
    const plan = planCartMove(
      [
        item({
          name: 'Butter',
          pantryItemId: 'jar-1',
          checked: true,
          checkedAt: checkedAt(CART_MOVE_AFTER_MS + 1),
        }),
      ],
      { ...base, pantry: [jar()] },
    );
    expect(plan.add).toEqual([]);
    expect(plan.update).toEqual([
      {
        id: 'jar-1',
        patch: expect.objectContaining({
          status: 'active',
          outAt: null,
          quantity: null,
          purchasedOn: '2026-09-28',
          expiresOn: '2026-10-28',
        }),
      },
    ]);
  });

  it('unknown items use the category default', () => {
    const plan = planCartMove(
      [item({ name: 'Birthday candles', checked: true, checkedAt: checkedAt(CART_MOVE_AFTER_MS) })],
      base,
    );
    expect(plan.add[0]).toMatchObject({
      foodId: null,
      category: 'other',
      expirySource: 'category_default',
    });
  });
});
