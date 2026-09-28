import { describe, expect, it } from 'vitest';
import {
  addDays,
  applyUsedIt,
  buildSamplePantry,
  countByCategory,
  countByList,
  DEFAULT_SHELF_LIFE_DAYS,
  diffDays,
  estimateExpiry,
  filterItems,
  formatQuantity,
  formatRanOut,
  formatTimeLeft,
  groupIntoShelves,
  groupItems,
  isCountable,
  NO_FILTERS,
  pantryItemSchema,
  shelfFor,
  todayIso,
  type PantryItem,
} from '../src';

const TODAY = '2026-09-28';
let seq = 0;
function item(over: Partial<PantryItem> = {}): PantryItem {
  seq++;
  return {
    id: `i${seq}`,
    pantryId: 'p1',
    listId: 'home',
    foodId: null,
    name: `Item ${seq}`,
    category: 'produce',
    location: 'fridge',
    quantity: 1,
    unit: 'bag',
    note: '',
    purchasedOn: '2026-09-20',
    expiresOn: addDays(TODAY, 10),
    expiryIsEstimate: false,
    expirySource: 'user',
    status: 'active',
    outAt: null,
    addedBy: 'u1',
    receiptLineId: null,
    updatedAt: '2026-09-28T00:00:00.000Z',
    ...over,
  };
}

describe('dates', () => {
  it('adds and diffs calendar days across month and DST boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09');
    expect(diffDays('2026-11-01', '2026-11-08')).toBe(7);
    expect(diffDays('2026-11-08', '2026-11-01')).toBe(-7);
  });

  it('todayIso uses the local calendar date', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('SRS 8.3 status', () => {
  it('daysLeft ≤ 0 → today, 1–7 → soon, ≥ 8 → fresh', () => {
    expect(shelfFor(item({ expiresOn: addDays(TODAY, -2) }), TODAY)).toBe('today');
    expect(shelfFor(item({ expiresOn: TODAY }), TODAY)).toBe('today');
    expect(shelfFor(item({ expiresOn: addDays(TODAY, 1) }), TODAY)).toBe('soon');
    expect(shelfFor(item({ expiresOn: addDays(TODAY, 7) }), TODAY)).toBe('soon');
    expect(shelfFor(item({ expiresOn: addDays(TODAY, 8) }), TODAY)).toBe('fresh');
  });

  it('quantity 0 or status out → out, whatever the date', () => {
    expect(shelfFor(item({ quantity: 0, expiresOn: addDays(TODAY, 30) }), TODAY)).toBe('out');
    expect(shelfFor(item({ status: 'out', expiresOn: TODAY }), TODAY)).toBe('out');
  });
});

describe('SRS 4.5 status words', () => {
  it.each([
    [-3, 'Expired 3 days ago'],
    [-1, 'Expired yesterday'],
    [0, 'Expires today'],
    [1, '1 day left'],
    [2, '2 days left'],
    [7, '7 days left'],
    [10, '10 days'],
    [21, '3 weeks'],
    [95, '3 months'],
    [400, '1 year'],
    [800, '2 years'],
  ])('%i days → "%s"', (days, words) => {
    expect(formatTimeLeft(days)).toBe(words);
  });

  it('ran out wording', () => {
    expect(formatRanOut(TODAY, TODAY)).toBe('Ran out today');
    expect(formatRanOut(addDays(TODAY, -1), TODAY)).toBe('Ran out yesterday');
    expect(formatRanOut(addDays(TODAY, -2), TODAY)).toBe('Ran out 2 days ago');
    expect(formatRanOut(null, TODAY)).toBe('Ran out');
  });

  it('quantity wording', () => {
    expect(formatQuantity({ quantity: 1, unit: 'bag' })).toBe('1 bag');
    expect(formatQuantity({ quantity: 6, unit: '' })).toBe('6');
    expect(formatQuantity({ quantity: 1.5, unit: 'lb' })).toBe('1.5 lb');
    expect(formatQuantity({ quantity: null, unit: '' })).toBe('');
  });
});

describe('SRS 8.3 expiry estimation', () => {
  it('expiresOn = purchase date + default shelf life for category × location', () => {
    expect(estimateExpiry('produce', 'fridge', '2026-09-28')).toBe('2026-10-05');
    expect(estimateExpiry('frozen', 'freezer', '2026-09-28')).toBe(addDays('2026-09-28', 240));
    expect(estimateExpiry('other', 'cupboard', '2026-09-28')).toBe('2026-10-05');
  });

  it('has a positive default for every category and location', () => {
    for (const byLocation of Object.values(DEFAULT_SHELF_LIFE_DAYS)) {
      for (const days of Object.values(byLocation)) expect(days).toBeGreaterThan(0);
    }
  });
});

describe('PAN-8 / SRS 8.6 "Used it"', () => {
  it('counts down countable items one at a time', () => {
    expect(applyUsedIt({ quantity: 6, unit: '' }, TODAY)).toEqual({
      patch: { quantity: 5, status: 'active', outAt: null },
      ranOut: false,
    });
    expect(applyUsedIt({ quantity: 2, unit: 'Bags' }, TODAY).patch.quantity).toBe(1);
  });

  it('the last unit runs the item out', () => {
    expect(applyUsedIt({ quantity: 1, unit: 'bag' }, TODAY)).toEqual({
      patch: { quantity: 0, status: 'out', outAt: TODAY },
      ranOut: true,
    });
  });

  it('weighed or measured items are finished in one tap', () => {
    expect(applyUsedIt({ quantity: 500, unit: 'g' }, TODAY).ranOut).toBe(true);
    expect(applyUsedIt({ quantity: 1, unit: 'gal' }, TODAY).ranOut).toBe(true);
    expect(applyUsedIt({ quantity: 2.5, unit: '' }, TODAY).ranOut).toBe(true);
    expect(applyUsedIt({ quantity: null, unit: '' }, TODAY).ranOut).toBe(true);
  });

  it('knows which units are countable', () => {
    expect(isCountable({ quantity: 3, unit: 'cans' })).toBe(true);
    expect(isCountable({ quantity: 3, unit: 'kg' })).toBe(false);
    expect(isCountable({ quantity: null, unit: '' })).toBe(false);
  });
});

describe('SRS 8.9 filters', () => {
  const items = [
    item({ name: 'Spinach', listId: 'home', category: 'produce' }),
    item({ name: 'Paneer', listId: 'diwali', category: 'dairy_eggs' }),
    item({ name: 'Mango', listId: 'diwali', category: 'produce' }),
    item({ name: 'Old milk', status: 'used', category: 'dairy_eggs' }),
    item({ name: 'Bin', status: 'discarded' }),
    item({ name: 'Eggs', status: 'out', quantity: 0, category: 'dairy_eggs' }),
  ];

  it('drops used and discarded items but keeps ran-out ones', () => {
    expect(filterItems(items, NO_FILTERS).map((i) => i.name)).toEqual([
      'Spinach',
      'Paneer',
      'Mango',
      'Eggs',
    ]);
  });

  it('PAN-12 list AND category combine (Diwali party + Produce)', () => {
    expect(
      filterItems(items, { listId: 'diwali', category: 'produce', query: '' }).map((i) => i.name),
    ).toEqual(['Mango']);
  });

  it('PAN-1 search matches names case-insensitively', () => {
    expect(filterItems(items, { ...NO_FILTERS, query: ' PAN ' }).map((i) => i.name)).toEqual([
      'Paneer',
    ]);
  });

  it('PAN-3 PAN-4 chip counts are faceted by the other filters', () => {
    const f = { listId: 'diwali', category: 'produce' as const, query: '' };
    expect(countByList(items, f)).toMatchObject({ all: 2, home: 1, diwali: 1 });
    expect(countByCategory(items, f)).toMatchObject({
      all: 2,
      produce: 1,
      dairy_eggs: 1,
      frozen: 0,
    });
  });
});

describe('PAN-5 PAN-12 grouping', () => {
  const items = [
    item({
      name: 'B fresh',
      expiresOn: addDays(TODAY, 30),
      location: 'cupboard',
      category: 'grains_dals',
    }),
    item({
      name: 'A fresh',
      expiresOn: addDays(TODAY, 9),
      location: 'cupboard',
      category: 'grains_dals',
    }),
    item({ name: 'Soon', expiresOn: addDays(TODAY, 3), location: 'fridge' }),
    item({ name: 'Today', expiresOn: TODAY, location: 'fridge' }),
    item({ name: 'Old out', status: 'out', quantity: 0, outAt: addDays(TODAY, -3) }),
    item({ name: 'New out', status: 'out', quantity: 0, outAt: TODAY }),
  ];

  it('shelves come in order Use today, Use this week, Good for now, Ran out', () => {
    const shelves = groupIntoShelves(items, TODAY);
    expect(shelves.map((s) => [s.key, s.items.map((i) => i.name)])).toEqual([
      ['today', ['Today']],
      ['soon', ['Soon']],
      ['fresh', ['A fresh', 'B fresh']],
      ['out', ['New out', 'Old out']],
    ]);
  });

  it('keeps empty shelves', () => {
    expect(groupIntoShelves([], TODAY).map((s) => s.items.length)).toEqual([0, 0, 0, 0]);
  });

  it('Location sort groups by location in SRS order, ran out last', () => {
    expect(
      groupItems(items, 'location', TODAY).map((g) => [g.key, g.items.map((i) => i.name)]),
    ).toEqual([
      ['fridge', ['Today', 'Soon']],
      ['cupboard', ['A fresh', 'B fresh']],
      ['out', ['New out', 'Old out']],
    ]);
  });

  it('Category sort groups by category', () => {
    expect(groupItems(items, 'category', TODAY).map((g) => g.key)).toEqual([
      'produce',
      'grains_dals',
      'out',
    ]);
  });

  it('A to Z is one plain list', () => {
    expect(groupItems(items, 'az', TODAY)[0]!.items.map((i) => i.name)).toEqual([
      'A fresh',
      'B fresh',
      'Soon',
      'Today',
    ]);
  });

  it('expiry sort returns the shelves', () => {
    expect(groupItems(items, 'expiry', TODAY).map((g) => g.key)).toEqual([
      'today',
      'soon',
      'fresh',
      'out',
    ]);
  });
});

describe('sample pantry (development seed)', () => {
  let n = 0;
  const sample = buildSamplePantry({
    pantryId: 'p1',
    today: TODAY,
    listIds: ['home', 'family', 'diwali'],
    memberIds: ['me', 'arjun', 'meera'],
    newId: () => `id${++n}`,
  });

  it('every item is valid', () => {
    for (const i of sample.items) expect(() => pantryItemSchema.parse(i)).not.toThrow();
  });

  it('fills all four shelves across three lists, with enough fresh items for "+N more"', () => {
    const shelves = groupIntoShelves(sample.items, TODAY);
    for (const s of shelves) expect(s.items.length).toBeGreaterThan(0);
    expect(shelves.find((s) => s.key === 'fresh')!.items.length).toBeGreaterThan(4);
    expect(new Set(sample.items.map((i) => i.listId))).toEqual(
      new Set(['home', 'family', 'diwali']),
    );
  });

  it('PAN-9 one ran-out item is already on its list, claimed by someone else', () => {
    expect(sample.listItems).toHaveLength(1);
    const onions = sample.items.find((i) => i.name === 'Onions')!;
    expect(sample.listItems[0]).toMatchObject({
      pantryItemId: onions.id,
      listId: onions.listId,
      claimedBy: 'arjun',
    });
  });

  it('falls back to the home list and you when there are fewer lists and members', () => {
    const solo = buildSamplePantry({
      pantryId: 'p',
      today: TODAY,
      listIds: ['home'],
      memberIds: ['me'],
      newId: () => `x${++n}`,
    });
    expect(new Set(solo.items.map((i) => i.listId))).toEqual(new Set(['home']));
    expect(new Set(solo.items.map((i) => i.addedBy))).toEqual(new Set(['me']));
  });
});
