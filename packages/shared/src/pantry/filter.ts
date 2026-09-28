import type { IsoDate } from '../dates';
import { isOnShelf, shelfFor, type Shelf } from './status';
import { CATEGORIES, LOCATIONS, type Category, type Location, type PantryItem } from './types';

export const SORTS = ['expiry', 'category', 'location', 'az'] as const;
export type Sort = (typeof SORTS)[number];

export type PantryFilters = {
  /** Single-select "From list" chip; null = All lists (PAN-3). */
  listId: string | null;
  /** Single-select category chip; null = All (PAN-4). */
  category: Category | null;
  /** Name search (PAN-1). */
  query: string;
};

export const NO_FILTERS: PantryFilters = { listId: null, category: null, query: '' };

function matchesQuery(item: PantryItem, query: string) {
  const q = query.trim().toLowerCase();
  return q === '' || item.name.toLowerCase().includes(q);
}

/** Filters combine: list AND category AND name (SRS 8.9, PAN-12). Hidden statuses are dropped. */
export function filterItems(items: readonly PantryItem[], f: PantryFilters): PantryItem[] {
  return items.filter(
    (item) =>
      isOnShelf(item) &&
      (f.listId === null || item.listId === f.listId) &&
      (f.category === null || item.category === f.category) &&
      matchesQuery(item, f.query),
  );
}

/**
 * Chip counts are faceted: each list chip counts items matching the *other* filters (category and
 * search), and each category chip counts items matching list and search. So a count always equals
 * what you'd see after tapping that chip.
 */
export function countByList(
  items: readonly PantryItem[],
  f: PantryFilters,
): Record<string, number> & { all: number } {
  const pool = filterItems(items, { ...f, listId: null });
  const counts: Record<string, number> = {};
  for (const item of pool) counts[item.listId] = (counts[item.listId] ?? 0) + 1;
  return Object.assign(counts, { all: pool.length });
}

export function countByCategory(
  items: readonly PantryItem[],
  f: PantryFilters,
): Record<Category, number> & { all: number } {
  const pool = filterItems(items, { ...f, category: null });
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  for (const item of pool) counts[item.category]++;
  return Object.assign(counts, { all: pool.length });
}

export type Group<K extends string = string> = { key: K; items: PantryItem[] };

const byName = (a: PantryItem, b: PantryItem) => a.name.localeCompare(b.name);

/** Soonest expiry first, then name. */
export function byExpiry(a: PantryItem, b: PantryItem) {
  return a.expiresOn.localeCompare(b.expiresOn) || byName(a, b);
}

/** Most recently run out first. */
function byOutAt(a: PantryItem, b: PantryItem) {
  return (b.outAt ?? '').localeCompare(a.outAt ?? '') || byName(a, b);
}

export const SHELF_ORDER: readonly Shelf[] = ['today', 'soon', 'fresh', 'out'];

/** PAN-5: the four shelves in order. Empty shelves are kept so the page can say so. */
export function groupIntoShelves(items: readonly PantryItem[], today: IsoDate): Group<Shelf>[] {
  const groups = Object.fromEntries(SHELF_ORDER.map((s) => [s, [] as PantryItem[]])) as Record<
    Shelf,
    PantryItem[]
  >;
  for (const item of items) groups[shelfFor(item, today)].push(item);
  return SHELF_ORDER.map((key) => ({
    key,
    items: groups[key].sort(key === 'out' ? byOutAt : byExpiry),
  }));
}

/**
 * PAN-12: Category and Location sorts group by that dimension (in the SRS order, empty groups
 * dropped); A to Z is one plain group. Ran-out items get their own trailing "out" group so
 * they're never mixed with food you still have.
 */
export function groupItems(items: readonly PantryItem[], sort: Sort, today: IsoDate): Group[] {
  if (sort === 'expiry') return groupIntoShelves(items, today);
  const have = items.filter((i) => shelfFor(i, today) !== 'out');
  const out = items.filter((i) => shelfFor(i, today) === 'out').sort(byOutAt);
  let groups: Group[];
  if (sort === 'az') {
    groups = [{ key: 'az', items: [...have].sort(byName) }];
  } else {
    const keys: readonly (Category | Location)[] = sort === 'category' ? CATEGORIES : LOCATIONS;
    groups = keys
      .map((key) => ({
        key,
        items: have
          .filter((i) => (sort === 'category' ? i.category : i.location) === key)
          .sort(byExpiry),
      }))
      .filter((g) => g.items.length > 0);
  }
  return out.length ? [...groups, { key: 'out', items: out }] : groups;
}
