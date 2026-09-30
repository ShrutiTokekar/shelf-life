import { foodByName } from '../food/dictionary';
import { newId } from '../ids';
import type { Category, ExpirySource, ItemForm, Location, PantryItem } from '../pantry/types';
import {
  itemFromSkippedLine,
  parseReceipt,
  type ParsedItem,
  type ParsedReceipt,
  type SkipReason,
} from '../scan/parseReceipt';
import type { MatchSource, Receipt, ReceiptLine, ReviewState } from './types';

/**
 * The review screen's working copy (SRS 6.5). Built from a fresh scan or from a saved receipt
 * ("Edit items", HIS-5), edited with the pure helpers below, then turned into pantry writes and a
 * receipt record by `commitReview`.
 */
export type ReviewItem = {
  index: number;
  raw: string;
  price: number | null;
  name: string;
  foodId: string | null;
  category: Category;
  location: Location;
  quantity: number | null;
  unit: string;
  note: string;
  expiresOn: string;
  expirySource: ExpirySource;
  confidence: number;
  matchSource: MatchSource;
  /** Below 0.8 confidence: highlighted with a "?" until the user confirms it (REV-4). */
  unsure: boolean;
  confirmed: boolean;
  edited: boolean;
  /** The checkbox (REV-3, default checked). */
  included: boolean;
  /** Edit mode: the pantry item this line already created. */
  pantryItemId: string | null;
};

export type ReviewSkipped = {
  index: number;
  raw: string;
  price: number | null;
  reason: SkipReason;
};

export type ReviewDraft = {
  /** Set when editing a saved receipt. */
  receiptId: string | null;
  storeName: string;
  purchasedOn: string;
  total: number | null;
  lineCount: number;
  listId: string;
  items: ReviewItem[];
  skipped: ReviewSkipped[];
  /** Edit mode: when the receipt was first saved. */
  createdAt: string | null;
};

const MATCHED = 0.8;

function reviewItem(p: ParsedItem): ReviewItem {
  return {
    index: p.index,
    raw: p.raw,
    price: p.price,
    name: p.name,
    foodId: p.foodId,
    category: p.category,
    location: p.location,
    quantity: p.quantity,
    unit: p.unit ?? '',
    note: '',
    expiresOn: p.expiresOn,
    expirySource: p.expirySource,
    confidence: p.confidence,
    matchSource: 'parser',
    unsure: p.status !== 'matched',
    confirmed: false,
    edited: false,
    included: true,
    pantryItemId: null,
  };
}

/** A fresh scan → review draft; items go to `listId` (the home list by default, REV-6). */
export function draftFromParsed(parsed: ParsedReceipt, listId: string): ReviewDraft {
  return {
    receiptId: null,
    storeName: parsed.store ?? '',
    purchasedOn: parsed.purchasedOn,
    total: parsed.total,
    lineCount: parsed.lineCount,
    listId,
    items: parsed.items.map(reviewItem),
    skipped: parsed.skipped.map((s) => ({ ...s })),
    createdAt: null,
  };
}

/**
 * "Edit items" (HIS-5): rebuild the draft from a saved receipt. Lines that became pantry items
 * take that item's current values; lines that weren't added are matched again from their text.
 */
export function draftFromReceipt(receipt: Receipt, pantry: readonly PantryItem[]): ReviewDraft {
  const byId = new Map(pantry.map((i) => [i.id, i]));
  const reparsed = parseReceipt(
    receipt.lines.map((l) => ({ text: l.rawText, confidence: 1 })),
    receipt.purchasedOn,
  );
  const items: ReviewItem[] = [];
  const skipped: ReviewSkipped[] = [];
  for (const line of receipt.lines) {
    if (line.kind === 'skipped') {
      skipped.push({
        index: line.index,
        raw: line.rawText,
        price: line.price,
        reason: line.skipReason ?? 'other',
      });
      continue;
    }
    const base =
      reparsed.items.find((i) => i.index === line.index) ??
      itemFromSkippedLine(line.rawText, line.index, receipt.purchasedOn);
    const item: ReviewItem = {
      ...reviewItem({ ...base, confidence: line.confidence }),
      raw: line.rawText,
      price: line.price,
      name: line.matchName ?? base.name,
      matchSource: line.matchSource,
      unsure: line.confidence < MATCHED,
      confirmed: line.confirmed,
      edited: line.edited,
      included: false,
      pantryItemId: null,
    };
    const existing = line.pantryItemId ? byId.get(line.pantryItemId) : undefined;
    if (existing) {
      Object.assign(item, {
        name: existing.name,
        foodId: existing.foodId,
        category: existing.category,
        location: existing.location,
        quantity: existing.quantity,
        unit: existing.unit,
        note: existing.note,
        expiresOn: existing.expiresOn,
        expirySource: existing.expirySource,
        included: true,
        pantryItemId: existing.id,
      });
    }
    items.push(item);
  }
  return {
    receiptId: receipt.id,
    storeName: receipt.storeName,
    purchasedOn: receipt.purchasedOn,
    total: receipt.total,
    lineCount: receipt.lineCount,
    listId: receipt.listId,
    items: items.sort((a, b) => a.index - b.index),
    skipped: skipped.sort((a, b) => a.index - b.index),
    createdAt: receipt.createdAt,
  };
}

/** An unsure item the user hasn't confirmed yet (REV-4). */
export const needsLook = (item: ReviewItem) => item.unsure && !item.confirmed;

/** REV-2 pills and the REV-6 button count. */
export function reviewCounts(draft: ReviewDraft) {
  const look = draft.items.filter(needsLook).length;
  return {
    matched: draft.items.length - look,
    needsLook: look,
    skipped: draft.skipped.length,
    checked: draft.items.filter((i) => i.included).length,
  };
}

const patchItem = (
  draft: ReviewDraft,
  index: number,
  patch: (item: ReviewItem) => Partial<ReviewItem>,
): ReviewDraft => ({
  ...draft,
  items: draft.items.map((i) => (i.index === index ? { ...i, ...patch(i) } : i)),
});

/** REV-3 checkbox. Unticking a line counts as an edit (HIS-3 "N edited"). */
export const toggleItem = (draft: ReviewDraft, index: number) =>
  patchItem(draft, index, (i) => ({ included: !i.included, edited: true }));

/** REV-4 "Tap to confirm". */
export const confirmItem = (draft: ReviewDraft, index: number) =>
  patchItem(draft, index, () => ({ confirmed: true }));

/**
 * The edit sheet saved new values. The user has now looked at it, so it's confirmed. A new name
 * is matched to the dictionary again; an untouched date keeps its estimate.
 */
export function editItem(
  draft: ReviewDraft,
  index: number,
  form: Omit<ItemForm, 'listId'>,
  estimated: boolean,
): ReviewDraft {
  return patchItem(draft, index, (i) => {
    const renamed = form.name.trim() !== i.name;
    const moved = form.category !== i.category || form.location !== i.location;
    return {
      name: form.name.trim(),
      foodId: renamed ? (foodByName(form.name)?.foodId ?? null) : i.foodId,
      category: form.category,
      location: form.location,
      quantity: form.quantity,
      unit: form.unit,
      note: form.note,
      expiresOn: form.expiresOn,
      expirySource: !estimated ? 'user' : moved ? 'category_default' : i.expirySource,
      confirmed: true,
      edited: true,
      included: true,
    };
  });
}

/** REV-5: restore a skipped line as a ticked item, matched from its text. */
export function restoreSkipped(draft: ReviewDraft, index: number): ReviewDraft {
  const line = draft.skipped.find((s) => s.index === index);
  if (!line) return draft;
  const parsed = itemFromSkippedLine(line.raw, line.index, draft.purchasedOn);
  const item: ReviewItem = {
    ...reviewItem(parsed),
    price: parsed.price ?? line.price,
    // Still highlighted when the match is unsure: the user picked the line, not the match.
    edited: true,
  };
  return {
    ...draft,
    items: [...draft.items, item].sort((a, b) => a.index - b.index),
    skipped: draft.skipped.filter((s) => s.index !== index),
  };
}

/** SRS 10 reviewState: unresolved lines first, then any edit, else clean. */
export function reviewStateOf(lines: readonly ReceiptLine[]): ReviewState {
  if (lines.some(isUnresolved)) return 'needs_review';
  if (lines.some((l) => l.edited)) return 'edited';
  return 'clean';
}

/** HIS-2: an added line whose unsure match the user never confirmed. */
export const isUnresolved = (l: ReceiptLine) =>
  l.kind === 'item' && l.pantryItemId !== null && !l.confirmed;

/** HIS-3 status chip numbers. */
export function receiptStatus(receipt: Receipt) {
  return {
    state: receipt.reviewState,
    unresolved: receipt.lines.filter(isUnresolved).length,
    edited: receipt.lines.filter((l) => l.edited).length,
  };
}

export type ReviewCommit = {
  receipt: Receipt;
  add: PantryItem[];
  update: { id: string; patch: Partial<PantryItem> }[];
  remove: string[];
};

/**
 * REV-7 / HIS-5: the draft → pantry writes plus the receipt record, as one plan the caller applies
 * in a single transaction. Unticking a line that was added before removes that pantry item.
 */
export function commitReview(
  draft: ReviewDraft,
  ctx: {
    pantryId: string;
    userId: string;
    now: string;
    /** Items currently in the pantry (edit mode); lines whose item is gone are re-added. */
    pantry?: readonly PantryItem[];
    /** Edit mode: who scanned it originally. */
    scannedBy?: string;
  },
): ReviewCommit {
  const receiptId = draft.receiptId ?? newId();
  const existing = new Set((ctx.pantry ?? []).map((i) => i.id));
  const add: PantryItem[] = [];
  const update: ReviewCommit['update'] = [];
  const remove: string[] = [];
  const lines: ReceiptLine[] = [];

  for (const item of draft.items) {
    const fields = {
      listId: draft.listId,
      foodId: item.foodId,
      name: item.name.slice(0, 60),
      category: item.category,
      location: item.location,
      quantity: item.quantity,
      unit: item.unit,
      note: item.note,
      purchasedOn: draft.purchasedOn,
      expiresOn: item.expiresOn,
      expiryIsEstimate: item.expirySource !== 'user',
      expirySource: item.expirySource,
    };
    const kept = item.pantryItemId !== null && existing.has(item.pantryItemId);
    let pantryItemId: string | null = null;
    if (item.included && kept) {
      pantryItemId = item.pantryItemId;
      update.push({ id: item.pantryItemId!, patch: fields });
    } else if (item.included) {
      pantryItemId = newId();
      add.push({
        ...fields,
        id: pantryItemId,
        pantryId: ctx.pantryId,
        status: 'active',
        outAt: null,
        addedBy: ctx.userId,
        receiptLineId: `${receiptId}:${item.index}`,
        updatedAt: ctx.now,
      });
    } else if (kept) {
      remove.push(item.pantryItemId!);
    }
    lines.push({
      id: `${receiptId}:${item.index}`,
      index: item.index,
      rawText: item.raw.slice(0, 200),
      price: item.price,
      kind: 'item',
      skipReason: null,
      matchName: item.name.slice(0, 60),
      matchSource: item.matchSource,
      confidence: Math.min(1, Math.max(0, item.confidence)),
      confirmed: !item.unsure || item.confirmed,
      edited: item.edited,
      pantryItemId,
    });
  }
  for (const s of draft.skipped) {
    lines.push({
      id: `${receiptId}:${s.index}`,
      index: s.index,
      rawText: s.raw.slice(0, 200),
      price: s.price,
      kind: 'skipped',
      skipReason: s.reason,
      matchName: null,
      matchSource: 'parser',
      confidence: 1,
      confirmed: true,
      edited: false,
      pantryItemId: null,
    });
  }
  lines.sort((a, b) => a.index - b.index);

  const receipt: Receipt = {
    id: receiptId,
    pantryId: ctx.pantryId,
    listId: draft.listId,
    storeName: draft.storeName.trim().slice(0, 60),
    purchasedOn: draft.purchasedOn,
    total: draft.total,
    scannedBy: ctx.scannedBy ?? ctx.userId,
    lineCount: draft.lineCount,
    itemsAdded: lines.filter((l) => l.pantryItemId !== null).length,
    reviewState: reviewStateOf(lines),
    lines,
    createdAt: draft.createdAt ?? ctx.now,
    updatedAt: ctx.now,
  };
  return { receipt, add, update, remove };
}

/** HIS-5 Re-run matching (P1): match the saved text again with today's dictionary. */
export function rematchDraft(draft: ReviewDraft): ReviewDraft {
  return {
    ...draft,
    items: draft.items.map((item) => {
      if (item.edited) return item;
      const fresh = itemFromSkippedLine(item.raw, item.index, draft.purchasedOn);
      if (!fresh.foodId || fresh.foodId === item.foodId) return item;
      return {
        ...item,
        name: fresh.name,
        foodId: fresh.foodId,
        category: fresh.category,
        location: fresh.location,
        expiresOn: fresh.expiresOn,
        expirySource: fresh.expirySource,
        confidence: Math.max(item.confidence, fresh.confidence),
        unsure: Math.max(item.confidence, fresh.confidence) < MATCHED,
      };
    }),
  };
}

/** A receipt line as shown on the review card and receipt paper: the text without its price. */
export function lineCaption(raw: string): string {
  const stripped = raw
    .replace(/\s*-?\$?\s?\d{1,4}[.,]\d{2}\s*-?\s*(?:[A-Z]{1,2}|\*)?\s*$/i, '')
    .trim();
  return stripped || raw.trim();
}
