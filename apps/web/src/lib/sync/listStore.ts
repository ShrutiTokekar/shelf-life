import { listItemSchema, type ListItem } from '@shelf-life/shared';
import * as Y from 'yjs';

/** A list doc's `items` map (SRS 8.7). The grocery list UI arrives in Milestone 5. */
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
