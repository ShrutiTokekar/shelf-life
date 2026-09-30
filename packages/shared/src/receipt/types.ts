import { z } from 'zod';

/** SRS 10, ReceiptLine.kind: an item the user reviewed, or a line the parser skipped. */
export const RECEIPT_LINE_KINDS = ['item', 'skipped'] as const;
export type ReceiptLineKind = (typeof RECEIPT_LINE_KINDS)[number];

/** SRS 10, ReceiptLine.matchSource. `ai` arrives with AI line cleanup in Milestone 6. */
export const MATCH_SOURCES = ['parser', 'ai'] as const;
export type MatchSource = (typeof MATCH_SOURCES)[number];

/** Why a line was skipped (SRS 8.2 step 6). */
export const SKIP_REASONS = [
  'store_info',
  'total',
  'tax',
  'payment',
  'discount',
  'not_food',
  'other',
] as const;

/** SRS 10, Receipt.reviewState: drives the history status chip (HIS-3). */
export const REVIEW_STATES = ['clean', 'edited', 'needs_review'] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

/**
 * One text line of a receipt with what happened to it (SRS 10 ReceiptLine). Text only: the photo
 * is never stored (SEC-5).
 */
export const receiptLineSchema = z.object({
  id: z.string().min(1),
  /** Position on the receipt. */
  index: z.number().int().min(0),
  rawText: z.string().max(200),
  price: z.number().nullable(),
  kind: z.enum(RECEIPT_LINE_KINDS),
  /** Skipped lines: why. */
  skipReason: z.enum(SKIP_REASONS).nullable(),
  /** Item lines: the name it was matched or corrected to. */
  matchName: z.string().max(60).nullable(),
  matchSource: z.enum(MATCH_SOURCES),
  /** 0–1, OCR and match combined (SRS 8.2 step 5). */
  confidence: z.number().min(0).max(1),
  /** The user confirmed an unsure match, or it was sure enough not to need it. */
  confirmed: z.boolean(),
  /** The user changed the match, unticked it, or restored it from the skipped lines. */
  edited: z.boolean(),
  /** The pantry item this line created, or null when it wasn't added. */
  pantryItemId: z.string().nullable(),
});
export type ReceiptLine = z.infer<typeof receiptLineSchema>;

/** SRS 10 Receipt. Lives in the pantry doc's `receipts` map (SRS 8.7), keyed by id. */
export const receiptSchema = z.object({
  id: z.string().min(1),
  pantryId: z.string().min(1),
  /** The pantry label applied to its items (REV-6). */
  listId: z.string().min(1),
  storeName: z.string().max(60),
  /** The purchase date (the receipt's date, or the scan day). */
  purchasedOn: z.iso.date(),
  total: z.number().nullable(),
  scannedBy: z.string().min(1),
  lineCount: z.number().int().min(0),
  itemsAdded: z.number().int().min(0),
  reviewState: z.enum(REVIEW_STATES),
  lines: z.array(receiptLineSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Receipt = z.infer<typeof receiptSchema>;
