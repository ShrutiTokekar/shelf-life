import {
  listItemSchema,
  type CartMove,
  type ListItem,
  type ListMeta,
} from '@shelf-life/shared';
import * as Y from 'yjs';

/** A list doc's `items` map (SRS 8.7): item id → Y.Map of fields, so edits to different fields merge. */
export function listItemsMap(doc: Y.Doc): Y.Map<Y.Map<unknown>> {
  return doc.getMap<Y.Map<unknown>>('items');
}

export function readListItems(doc: Y.Doc): ListItem[] {
  const out: ListItem[] = [];
  listItemsMap(doc).forEach((fields) => {
    const parsed = listItemSchema.safeParse(fields.toJSON());
    if (parsed.success) out.push(parsed.data);
  });
  return out;
}

export function addListItem(doc: Y.Doc, item: ListItem) {
  const valid = listItemSchema.parse(item);
  doc.transact(() => {
    const fields = new Y.Map<unknown>();
    listItemsMap(doc).set(valid.id, fields);
    for (const [key, value] of Object.entries(valid)) fields.set(key, value);
  });
}

export function removeListItem(doc: Y.Doc, id: string) {
  listItemsMap(doc).delete(id);
}

/** The unchecked list entry for a ran-out pantry item, if any (PAN-9 "On the list"). */
export function openEntryFor(
  items: readonly ListItem[],
  pantryItemId: string,
): ListItem | undefined {
  return items.find((i) => i.pantryItemId === pantryItemId && !i.checked);
}

/** Patch fields of a list item (claim, check, edit). Last writer wins per field (SRS 8.7). */
export function updateListItem(doc: Y.Doc, id: string, patch: Partial<Omit<ListItem, 'id'>>) {
  const fields = listItemsMap(doc).get(id);
  if (!fields) return null;
  const before = listItemSchema.safeParse(fields.toJSON());
  listItemSchema.parse({ ...fields.toJSON(), ...patch });
  doc.transact(() => {
    for (const [key, value] of Object.entries(patch)) fields.set(key, value);
  });
  return before.success ? before.data : null;
}

/** The list doc's `meta` map: "Done shopping" (LST-7). */
export function listMetaMap(doc: Y.Doc): Y.Map<string | null> {
  return doc.getMap<string | null>('meta');
}

export function readListMeta(doc: Y.Doc): ListMeta {
  const meta = listMetaMap(doc);
  return {
    doneShoppingAt: (meta.get('doneShoppingAt') as string | null | undefined) ?? null,
    doneShoppingBy: (meta.get('doneShoppingBy') as string | null | undefined) ?? null,
  };
}

export function markDoneShopping(doc: Y.Doc, userId: string, now: string) {
  doc.transact(() => {
    listMetaMap(doc).set('doneShoppingAt', now);
    listMetaMap(doc).set('doneShoppingBy', userId);
  });
}

/** Remove the list items a cart move took into the pantry (LST-7). */
export function removeMovedItems(doc: Y.Doc, move: Pick<CartMove, 'moved'>) {
  doc.transact(() => {
    for (const id of move.moved) listItemsMap(doc).delete(id);
  });
}
