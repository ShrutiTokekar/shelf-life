import {
  activitySchema,
  type CartMove,
  pantryItemSchema,
  type Activity,
  type PantryItem,
} from '@shelf-life/shared';
import * as Y from 'yjs';

/** The pantry doc's append-only `activity` map: entry id → plain object (SRS 8.7). */
export function activityMap(doc: Y.Doc): Y.Map<Activity> {
  return doc.getMap<Activity>('activity');
}

export function recordActivity(doc: Y.Doc, entries: Activity[]) {
  doc.transact(() => {
    for (const entry of entries) activityMap(doc).set(entry.id, activitySchema.parse(entry));
  });
}

/** Undo removes the entries the undone action wrote. */
export function removeActivity(doc: Y.Doc, ids: string[]) {
  doc.transact(() => {
    for (const id of ids) activityMap(doc).delete(id);
  });
}

export function readActivity(doc: Y.Doc): Activity[] {
  const out: Activity[] = [];
  activityMap(doc).forEach((value) => {
    const parsed = activitySchema.safeParse(value);
    if (parsed.success) out.push(parsed.data);
  });
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * The pantry doc's `pantry` map: item id → Y.Map of fields. Fields are separate so two people
 * editing different fields of the same item both keep their change (CRDT merge, SRS 8.7).
 */
type ItemMap = Y.Map<unknown>;

export function itemsMap(doc: Y.Doc): Y.Map<ItemMap> {
  return doc.getMap<ItemMap>('pantry');
}

export function readItems(doc: Y.Doc): PantryItem[] {
  const out: PantryItem[] = [];
  itemsMap(doc).forEach((fields) => {
    const parsed = pantryItemSchema.safeParse(fields.toJSON());
    if (parsed.success) out.push(parsed.data);
  });
  return out;
}

export function readItem(doc: Y.Doc, id: string): PantryItem | null {
  const fields = itemsMap(doc).get(id);
  const parsed = fields ? pantryItemSchema.safeParse(fields.toJSON()) : null;
  return parsed?.success ? parsed.data : null;
}

function writeFields(target: ItemMap, values: Partial<PantryItem>) {
  for (const [key, value] of Object.entries(values)) target.set(key, value);
}

export function addItems(doc: Y.Doc, items: PantryItem[]) {
  doc.transact(() => {
    for (const item of items) {
      const fields = new Y.Map<unknown>();
      itemsMap(doc).set(item.id, fields);
      writeFields(fields, pantryItemSchema.parse(item));
    }
  });
}

/** Patch an item. Returns the item as it was, for Undo. */
export function updateItem(
  doc: Y.Doc,
  id: string,
  patch: Partial<Omit<PantryItem, 'id' | 'pantryId'>>,
): PantryItem | null {
  const before = readItem(doc, id);
  const fields = itemsMap(doc).get(id);
  if (!before || !fields) return null;
  pantryItemSchema.parse({ ...before, ...patch });
  doc.transact(() => writeFields(fields, { ...patch, updatedAt: new Date().toISOString() }));
  return before;
}

/** Delete an item. Returns it, for Undo. */
export function removeItem(doc: Y.Doc, id: string): PantryItem | null {
  const before = readItem(doc, id);
  if (before) itemsMap(doc).delete(id);
  return before;
}

/** Undo: put an item back exactly as it was (re-inserting it if it was deleted). */
export function restoreItem(doc: Y.Doc, snapshot: PantryItem) {
  doc.transact(() => {
    let fields = itemsMap(doc).get(snapshot.id);
    if (!fields) {
      fields = new Y.Map<unknown>();
      itemsMap(doc).set(snapshot.id, fields);
    }
    writeFields(fields, snapshot);
  });
}

/** LST-7: the pantry side of a cart move, in one transaction (new items, refills, activity). */
export function applyCartMoveToPantry(doc: Y.Doc, move: CartMove) {
  doc.transact(() => {
    addItems(doc, move.add);
    for (const { id, patch } of move.update) {
      if (itemsMap(doc).has(id)) updateItem(doc, id, patch);
    }
    recordActivity(doc, move.activity);
  });
}
