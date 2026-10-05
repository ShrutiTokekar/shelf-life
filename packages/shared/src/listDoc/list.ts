import { addDays, diffDays, todayIso, type IsoDate } from '../dates';
import { estimateFoodExpiry, foodByName } from '../food/dictionary';
import { newId } from '../ids';
import type { Activity } from '../pantry/activity';
import { DEFAULT_LOCATION, estimateExpiry } from '../pantry/expiry';
import type { PantryItem } from '../pantry/types';
import { matchFood } from '../scan/match';
import { expandReceiptText, matchKey } from '../scan/normalize';
import type { ListItem } from './types';

// ---- LST-2 / SRS 9.2 fallback: "2 onions and eggs" → two items, without AI ----

export type ParsedListEntry = { name: string; quantity: number | null; unit: string };

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  dozen: 12,
};

/** Units people type in front of a grocery ("2 cartons oat milk", "1 lb paneer"). */
const UNITS = new Set([
  'lb',
  'lbs',
  'kg',
  'g',
  'oz',
  'gal',
  'l',
  'ml',
  'pack',
  'packs',
  'bag',
  'bags',
  'box',
  'boxes',
  'bunch',
  'bunches',
  'carton',
  'cartons',
  'bottle',
  'bottles',
  'can',
  'cans',
  'jar',
  'jars',
  'dozen',
  'loaf',
  'loaves',
  'packet',
  'packets',
]);

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Split free text into list items on commas, "and", "&", "+" and new lines, reading a leading
 * quantity and unit. The AI parser (Milestone 6) replaces this when online; this stays the
 * fallback (rule 2).
 */
export function parseListText(text: string): ParsedListEntry[] {
  return text
    .split(/\s*(?:,|;|\n|\+|&|\band\b)\s*/i)
    .map((part) => part.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .map((part) => {
      const words = part.split(' ');
      let quantity: number | null = null;
      let unit = '';
      const first = words[0]!.toLowerCase();
      const numeric = /^(\d+(?:[.,]\d+)?)([a-z]+)?$/i.exec(first);
      if (numeric) {
        quantity = Number(numeric[1]!.replace(',', '.'));
        if (numeric[2] && UNITS.has(numeric[2].toLowerCase())) unit = numeric[2].toLowerCase();
        words.shift();
      } else if (first in NUMBER_WORDS && words.length > 1) {
        quantity = NUMBER_WORDS[first]!;
        words.shift();
      }
      if (quantity !== null && !unit && words.length > 1 && UNITS.has(words[0]!.toLowerCase())) {
        unit = words.shift()!.toLowerCase();
      }
      if (unit === 'dozen' && quantity !== null) {
        // "a dozen eggs" → 12; "2 dozen eggs" → 24.
        quantity *= 12;
        unit = '';
      }
      if (words[0]?.toLowerCase() === 'of') words.shift();
      const name = words.join(' ').slice(0, 60);
      return { name: capitalize(name || part.slice(0, 60)), quantity, unit };
    })
    .filter((e) => e.name.trim() !== '');
}

// ---- LST-3 grouping, LST-1 counts ----

export type ListGroups = {
  /** Ran out today (and, from Milestone 6, needed for tonight's recipe). */
  neededToday: ListItem[];
  /** Everything else still to buy. */
  thisWeek: ListItem[];
  /** Checked off, waiting to move into the pantry (LST-7). */
  cart: ListItem[];
};

const localDate = (timestamp: string) => todayIso(new Date(timestamp));

export function isNeededToday(item: ListItem, today: IsoDate): boolean {
  return item.reason === 'ran_out' && localDate(item.createdAt) === today;
}

export function groupListItems(items: readonly ListItem[], today: IsoDate): ListGroups {
  const byCreated = [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const open = byCreated.filter((i) => !i.checked);
  return {
    neededToday: open.filter((i) => isNeededToday(i, today)),
    thisWeek: open.filter((i) => !isNeededToday(i, today)),
    cart: byCreated
      .filter((i) => i.checked)
      .sort((a, b) => (b.checkedAt ?? '').localeCompare(a.checkedAt ?? '')),
  };
}

/** LST-1 "4 to buy · 2 in cart". */
export function listCounts(items: readonly ListItem[]) {
  const inCart = items.filter((i) => i.checked).length;
  return { toBuy: items.length - inCart, inCart };
}

/** LST-8 "Who's getting what": claimer → item names, plus the unclaimed ones. */
export function whoIsGettingWhat(items: readonly ListItem[]): {
  byMember: Map<string, ListItem[]>;
  unclaimed: ListItem[];
} {
  const byMember = new Map<string, ListItem[]>();
  const unclaimed: ListItem[] = [];
  for (const item of items) {
    if (item.checked) continue;
    if (!item.claimedBy) unclaimed.push(item);
    else byMember.set(item.claimedBy, [...(byMember.get(item.claimedBy) ?? []), item]);
  }
  return { byMember, unclaimed };
}

// ---- Edits (LST-5 claims, LST-7 checking): the patch each action writes ----

export const claimPatch = (userId: string): Partial<ListItem> => ({ claimedBy: userId });
export const unclaimPatch = (): Partial<ListItem> => ({ claimedBy: null });

/** Checking an item also claims it for whoever bought it. */
export function checkPatch(item: ListItem, userId: string, now: string): Partial<ListItem> {
  return item.checked
    ? { checked: false, checkedBy: null, checkedAt: null }
    : { checked: true, checkedBy: userId, checkedAt: now, claimedBy: item.claimedBy ?? userId };
}

/** A new list item from the add field or sheet. */
export function newListItem(
  entry: ParsedListEntry & { note?: string; claimedBy?: string | null },
  ctx: { listId: string; userId: string; now: string },
  extra: Partial<Pick<ListItem, 'reason' | 'pantryItemId' | 'recipeId'>> = {},
): ListItem {
  return {
    id: newId(),
    listId: ctx.listId,
    name: entry.name.trim().slice(0, 60),
    quantity: entry.quantity,
    unit: entry.unit.slice(0, 20),
    note: (entry.note ?? '').slice(0, 200),
    reason: extra.reason ?? 'manual',
    recipeId: extra.recipeId ?? null,
    pantryItemId: extra.pantryItemId ?? null,
    addedBy: ctx.userId,
    claimedBy: entry.claimedBy ?? null,
    checked: false,
    checkedBy: null,
    checkedAt: null,
    createdAt: ctx.now,
  };
}

/**
 * LST-2 / ADD-3 "Ran out recently" chips: ran-out jars from the last 7 days that aren't already
 * waiting on this list, newest first.
 */
export function ranOutRecently(
  pantry: readonly PantryItem[],
  listItems: readonly ListItem[],
  today: IsoDate,
  limit = 5,
): PantryItem[] {
  const waiting = new Set(listItems.filter((i) => !i.checked).map((i) => i.pantryItemId));
  const names = new Set(listItems.filter((i) => !i.checked).map((i) => i.name.toLowerCase()));
  return pantry
    .filter(
      (p) =>
        p.status === 'out' &&
        p.outAt !== null &&
        diffDays(p.outAt, today) <= 7 &&
        !waiting.has(p.id) &&
        !names.has(p.name.toLowerCase()),
    )
    .sort((a, b) => (b.outAt ?? '').localeCompare(a.outAt ?? ''))
    .slice(0, limit);
}

// ---- LST-7: the cart moves into the pantry, labeled with this list ----

/** Checked items move on "Done shopping", or on their own 2 hours after checking. */
export const CART_MOVE_AFTER_MS = 2 * 60 * 60 * 1000;

export type CartMove = {
  add: PantryItem[];
  update: { id: string; patch: Partial<PantryItem> }[];
  /** List items that moved (removed from the list). */
  moved: string[];
  activity: Activity[];
};

/** What should move now, and what it becomes in the pantry. Pure; the sync service applies it. */
export function planCartMove(
  items: readonly ListItem[],
  ctx: {
    listId: string;
    pantryId: string;
    pantry: readonly PantryItem[];
    /** "Done shopping" time from the list doc's `meta` map, if tapped. */
    doneShoppingAt: string | null;
    now: string;
  },
): CartMove {
  const nowMs = Date.parse(ctx.now);
  const doneMs = ctx.doneShoppingAt ? Date.parse(ctx.doneShoppingAt) : -Infinity;
  const byId = new Map(ctx.pantry.map((p) => [p.id, p]));
  const out: CartMove = { add: [], update: [], moved: [], activity: [] };

  for (const item of items) {
    if (!item.checked || !item.checkedAt) continue;
    const checkedMs = Date.parse(item.checkedAt);
    if (!(checkedMs <= doneMs || nowMs - checkedMs >= CART_MOVE_AFTER_MS)) continue;

    const purchasedOn = localDate(item.checkedAt);
    const buyer = item.checkedBy ?? item.addedBy;
    const restock = item.pantryItemId ? byId.get(item.pantryItemId) : undefined;
    const match = restock ? null : matchFood(matchKey(expandReceiptText(item.name)));
    // Typed names are usually clean; take a confident match only (a wrong food is worse than none).
    const food = restock
      ? undefined
      : (foodByName(item.name) ?? (match && match.score >= 0.6 ? match.food : undefined));
    const quantity = item.quantity ?? restock?.quantity ?? null;
    let pantryItemId: string;

    if (restock) {
      // PAN-9: a ran-out jar that was put on the list is simply full again.
      pantryItemId = restock.id;
      const days = diffDays(restock.purchasedOn, restock.expiresOn);
      out.update.push({
        id: restock.id,
        patch: {
          status: 'active',
          outAt: null,
          quantity: quantity === 0 ? null : quantity,
          // Full again (SRS 8.6): running low starts over from here.
          startQuantity: quantity === 0 ? null : quantity,
          lowAt: null,
          unit: item.unit || restock.unit,
          purchasedOn,
          expiresOn: addDays(purchasedOn, Math.max(1, days)),
          expiryIsEstimate: true,
          updatedAt: ctx.now,
        },
      });
    } else {
      const category = food?.category ?? 'other';
      const location = food?.defaultLocation ?? DEFAULT_LOCATION[category];
      const expiry = food
        ? estimateFoodExpiry(food, location, purchasedOn)
        : {
            expiresOn: estimateExpiry(category, location, purchasedOn),
            source: 'category_default' as const,
          };
      pantryItemId = newId();
      out.add.push({
        id: pantryItemId,
        pantryId: ctx.pantryId,
        // SRS 8.9: the pantry label is this list.
        listId: ctx.listId,
        foodId: food?.foodId ?? null,
        name: item.name,
        category,
        location,
        quantity: quantity === 0 ? null : quantity,
        unit: item.unit,
        note: item.note,
        purchasedOn,
        expiresOn: expiry.expiresOn,
        expiryIsEstimate: true,
        expirySource: expiry.source,
        status: 'active',
        outAt: null,
        addedBy: buyer,
        receiptLineId: null,
        updatedAt: ctx.now,
      });
    }
    out.moved.push(item.id);
    out.activity.push({
      id: newId(),
      pantryId: ctx.pantryId,
      listId: ctx.listId,
      actorId: buyer,
      type: 'bought',
      subject: item.name,
      itemId: pantryItemId,
      beforeExpiry: null,
      createdAt: ctx.now,
    });
  }
  return out;
}
