import { receiptSchema, type Activity, type Receipt, type ReviewCommit } from '@shelf-life/shared';
import type * as Y from 'yjs';
import { addItems, itemsMap, recordActivity, removeItem, updateItem } from './pantry';

/**
 * The pantry doc's `receipts` map: receipt id → plain object with its text lines (SRS 8.7, 10).
 * A receipt is written whole (review save, edit, delete), so it's one value rather than per-field
 * maps; the last save wins. Text only, never the photo (SEC-5).
 */
export function receiptsMap(doc: Y.Doc): Y.Map<Receipt> {
  return doc.getMap<Receipt>('receipts');
}

export function readReceipts(doc: Y.Doc): Receipt[] {
  const out: Receipt[] = [];
  receiptsMap(doc).forEach((value) => {
    const parsed = receiptSchema.safeParse(value);
    if (parsed.success) out.push(parsed.data);
  });
  return out;
}

export function readReceipt(doc: Y.Doc, id: string): Receipt | null {
  const parsed = receiptSchema.safeParse(receiptsMap(doc).get(id));
  return parsed.success ? parsed.data : null;
}

/** HIS-5 Delete: removes the receipt record only; its pantry items stay. Returns it, for Undo. */
export function deleteReceipt(doc: Y.Doc, id: string): Receipt | null {
  const before = readReceipt(doc, id);
  if (before) receiptsMap(doc).delete(id);
  return before;
}

export function putReceipt(doc: Y.Doc, receipt: Receipt) {
  receiptsMap(doc).set(receipt.id, receiptSchema.parse(receipt));
}

/**
 * REV-7 / HIS-5: apply a review in one transaction, so the pantry never shows half a receipt:
 * new items, edits, removals, the receipt record and the activity entry.
 */
export function applyReview(doc: Y.Doc, commit: ReviewCommit, activity: Activity[] = []) {
  doc.transact(() => {
    addItems(doc, commit.add);
    for (const { id, patch } of commit.update) {
      if (itemsMap(doc).has(id)) updateItem(doc, id, patch);
    }
    for (const id of commit.remove) removeItem(doc, id);
    putReceipt(doc, commit.receipt);
    recordActivity(doc, activity);
  });
}
