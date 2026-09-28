import { addDays, type IsoDate } from '../dates';
import type { ListItem } from '../listDoc/types';
import type { Category, Location, PantryItem } from './types';

/**
 * Development sample pantry: ~26 items across all four shelves and up to three lists, with dates
 * relative to `today` so it always looks current when loaded. Not used in production builds.
 */
export type SampleContext = {
  pantryId: string;
  today: IsoDate;
  /** Up to three lists: [home, second, third]. Missing lists fall back to home. */
  listIds: [string, ...string[]];
  /** People for "added by": [you, second member, third member]. Missing fall back to you. */
  memberIds: [string, ...string[]];
  newId: () => string;
};

type Row = {
  name: string;
  category: Category;
  location: Location;
  quantity: number | null;
  unit: string;
  /** Days until expiry from today (negative = already past). Ignored for ran-out rows. */
  days: number;
  list: 0 | 1 | 2;
  by: 0 | 1 | 2;
  /** Ran out this many days ago. */
  outDaysAgo?: number;
  onListClaimedBy?: 0 | 1 | 2;
};

const ROWS: Row[] = [
  // Use today
  {
    name: 'Spinach',
    category: 'produce',
    location: 'fridge',
    quantity: 1,
    unit: 'bag',
    days: 0,
    list: 0,
    by: 0,
  },
  {
    name: 'Coriander',
    category: 'produce',
    location: 'fridge',
    quantity: 1,
    unit: 'bunch',
    days: -1,
    list: 0,
    by: 1,
  },
  // Use this week
  {
    name: 'Cilantro',
    category: 'produce',
    location: 'fridge',
    quantity: 1,
    unit: 'bunch',
    days: 2,
    list: 0,
    by: 1,
  },
  {
    name: 'Greek yogurt',
    category: 'dairy_eggs',
    location: 'fridge',
    quantity: 500,
    unit: 'g',
    days: 2,
    list: 0,
    by: 2,
  },
  {
    name: 'Paneer',
    category: 'dairy_eggs',
    location: 'fridge',
    quantity: 400,
    unit: 'g',
    days: 3,
    list: 2,
    by: 0,
  },
  {
    name: 'Tomatoes',
    category: 'produce',
    location: 'fridge',
    quantity: 6,
    unit: '',
    days: 5,
    list: 0,
    by: 0,
  },
  {
    name: 'Whole milk',
    category: 'dairy_eggs',
    location: 'fridge',
    quantity: 1,
    unit: 'gal',
    days: 6,
    list: 1,
    by: 2,
  },
  {
    name: 'Bread',
    category: 'grains_dals',
    location: 'cupboard',
    quantity: 1,
    unit: 'loaf',
    days: 4,
    list: 1,
    by: 1,
  },
  // Good for now
  {
    name: 'Tortillas',
    category: 'grains_dals',
    location: 'cupboard',
    quantity: 1,
    unit: 'pack',
    days: 21,
    list: 0,
    by: 1,
  },
  {
    name: 'Rice',
    category: 'grains_dals',
    location: 'cupboard',
    quantity: 5,
    unit: 'lb',
    days: 95,
    list: 1,
    by: 0,
  },
  {
    name: 'Toor dal',
    category: 'grains_dals',
    location: 'cupboard',
    quantity: 4,
    unit: 'lb',
    days: 150,
    list: 0,
    by: 0,
  },
  {
    name: 'Frozen peas',
    category: 'frozen',
    location: 'freezer',
    quantity: 1,
    unit: 'bag',
    days: 240,
    list: 0,
    by: 2,
  },
  {
    name: 'Atta',
    category: 'grains_dals',
    location: 'cupboard',
    quantity: 10,
    unit: 'lb',
    days: 120,
    list: 1,
    by: 2,
  },
  {
    name: 'Ghee',
    category: 'spices_oils',
    location: 'cupboard',
    quantity: 1,
    unit: 'jar',
    days: 200,
    list: 1,
    by: 2,
  },
  {
    name: 'Cumin seeds',
    category: 'spices_oils',
    location: 'cupboard',
    quantity: 200,
    unit: 'g',
    days: 300,
    list: 0,
    by: 0,
  },
  {
    name: 'Turmeric',
    category: 'spices_oils',
    location: 'cupboard',
    quantity: 100,
    unit: 'g',
    days: 330,
    list: 0,
    by: 0,
  },
  {
    name: 'Mustard oil',
    category: 'spices_oils',
    location: 'cupboard',
    quantity: 1,
    unit: 'bottle',
    days: 240,
    list: 1,
    by: 1,
  },
  {
    name: 'Basmati rice',
    category: 'grains_dals',
    location: 'cupboard',
    quantity: 10,
    unit: 'lb',
    days: 180,
    list: 2,
    by: 0,
  },
  {
    name: 'Frozen parathas',
    category: 'frozen',
    location: 'freezer',
    quantity: 2,
    unit: 'packs',
    days: 120,
    list: 0,
    by: 1,
  },
  {
    name: 'Carrots',
    category: 'produce',
    location: 'fridge',
    quantity: 1,
    unit: 'bag',
    days: 12,
    list: 0,
    by: 0,
  },
  {
    name: 'Cheddar',
    category: 'dairy_eggs',
    location: 'fridge',
    quantity: 1,
    unit: 'block',
    days: 25,
    list: 1,
    by: 2,
  },
  {
    name: 'Ice cream',
    category: 'frozen',
    location: 'freezer',
    quantity: 1,
    unit: 'tub',
    days: 60,
    list: 2,
    by: 1,
  },
  {
    name: 'Diya candles',
    category: 'other',
    location: 'cupboard',
    quantity: 12,
    unit: '',
    days: 365,
    list: 2,
    by: 0,
  },
  // Ran out
  {
    name: 'Eggs',
    category: 'dairy_eggs',
    location: 'fridge',
    quantity: 0,
    unit: '',
    days: 0,
    list: 0,
    by: 2,
    outDaysAgo: 0,
  },
  {
    name: 'Onions',
    category: 'produce',
    location: 'cupboard',
    quantity: 0,
    unit: '',
    days: 0,
    list: 0,
    by: 1,
    outDaysAgo: 2,
    onListClaimedBy: 1,
  },
  {
    name: 'Besan',
    category: 'grains_dals',
    location: 'cupboard',
    quantity: 0,
    unit: 'lb',
    days: 0,
    list: 1,
    by: 0,
    outDaysAgo: 5,
  },
];

export function buildSamplePantry(ctx: SampleContext): {
  items: PantryItem[];
  listItems: ListItem[];
} {
  const listId = (i: number) => ctx.listIds[i] ?? ctx.listIds[0];
  const member = (i: number) => ctx.memberIds[i] ?? ctx.memberIds[0];
  const now = new Date().toISOString();
  const items: PantryItem[] = [];
  const listItems: ListItem[] = [];

  for (const row of ROWS) {
    const ranOut = row.outDaysAgo !== undefined;
    const expiresOn = ranOut ? addDays(ctx.today, 3) : addDays(ctx.today, row.days);
    const purchasedOn = ranOut
      ? addDays(ctx.today, -(row.outDaysAgo! + 7))
      : addDays(expiresOn, -Math.max(1, Math.min(14, row.days + 3)));
    const item: PantryItem = {
      id: ctx.newId(),
      pantryId: ctx.pantryId,
      listId: listId(row.list),
      foodId: null,
      name: row.name,
      category: row.category,
      location: row.location,
      quantity: row.quantity,
      unit: row.unit,
      note: '',
      purchasedOn,
      expiresOn,
      expiryIsEstimate: false,
      expirySource: 'user',
      status: ranOut ? 'out' : 'active',
      outAt: ranOut ? addDays(ctx.today, -row.outDaysAgo!) : null,
      addedBy: member(row.by),
      receiptLineId: null,
      updatedAt: now,
    };
    items.push(item);
    if (row.onListClaimedBy !== undefined) {
      listItems.push({
        id: ctx.newId(),
        listId: item.listId,
        name: item.name,
        quantity: null,
        unit: '',
        note: '',
        reason: 'ran_out',
        recipeId: null,
        pantryItemId: item.id,
        addedBy: member(row.by),
        claimedBy: member(row.onListClaimedBy),
        checked: false,
        checkedBy: null,
        checkedAt: null,
        createdAt: now,
      });
    }
  }
  return { items, listItems };
}
