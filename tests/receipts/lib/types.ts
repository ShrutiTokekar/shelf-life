/**
 * One labeled receipt (SRS 13 OCR accuracy set). Only text is stored: the OCR lines as the app
 * read them from the photo (after redaction), each with the right answer. Photos stay local.
 */
export type LabeledReceipt = {
  /** File name without .json, e.g. "patel-brothers-03". */
  id: string;
  /** Store slug from the five in SRS 13, or "other". */
  store: string;
  /**
   * "tune": dictionary growth may use this receipt's misses. "holdout": never used for tuning,
   * so its score shows how the parser does on receipts it wasn't adjusted for.
   */
  split: 'tune' | 'holdout';
  /** A person checked every `expect` value. Unchecked drafts are not scored. */
  checked: boolean;
  lines: LabeledLine[];
};

export type LabeledLine = {
  text: string;
  /** Tesseract's confidence for the line, 0–1. */
  confidence: number;
  /**
   * The right answer:
   * - a food id from the dictionary (packages/shared/src/food/data) for a grocery line;
   * - "skip" for anything the app shouldn't add (totals, tax, store info, non-food, weights);
   * - "missing:<name>" for a grocery the dictionary doesn't have yet (counted as a miss).
   */
  expect: string;
};

export const MISSING = 'missing:';
export const SKIP = 'skip';
