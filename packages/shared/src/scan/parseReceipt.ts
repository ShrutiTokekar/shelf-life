import { diffDays, type IsoDate } from '../dates';
import { estimateFoodExpiry } from '../food/dictionary';
import { DEFAULT_LOCATION, estimateExpiry } from '../pantry/expiry';
import type { Category, ExpirySource, Location } from '../pantry/types';
import { classifyLine, parseDate, type ClassifiedLine, type Unit } from './lines';
import { combineConfidence, confidenceBand, isNonFood, matchFood } from './match';
import { displayName, expandReceiptText, matchKey } from './normalize';
import { findStore } from './stores';

/** One line from OCR (SRS 8.1 step 4); bbox is dropped here, it isn't needed after reading. */
export type OcrLine = { text: string; confidence: number };

export type ParsedItem = {
  /** Line index on the receipt. */
  index: number;
  raw: string;
  /** Matched food name, or a cleaned-up guess when nothing matched. */
  name: string;
  foodId: string | null;
  category: Category;
  location: Location;
  quantity: number | null;
  unit: Unit | null;
  price: number | null;
  /** 0–1, OCR and match combined (SRS 8.2 step 5). */
  confidence: number;
  status: 'matched' | 'needs_look';
  /** Confidence under 0.5: the review screen asks AI cleanup when online (Milestone 6). */
  wantsAi: boolean;
  expiresOn: IsoDate;
  expirySource: ExpirySource;
};

export type SkipReason =
  'store_info' | 'total' | 'tax' | 'payment' | 'discount' | 'not_food' | 'other';

export type SkippedLine = { index: number; raw: string; reason: SkipReason };

export type ParsedReceipt = {
  store: string | null;
  /** The receipt's date if found and plausible, else null (purchase date then = today). */
  receiptDate: IsoDate | null;
  purchasedOn: IsoDate;
  lineCount: number;
  items: ParsedItem[];
  skipped: SkippedLine[];
};

const HEADER_LINES = 6;
/** A receipt date further back than this is probably misread; use today instead. */
const MAX_RECEIPT_AGE_DAYS = 60;

const reasonFor = (kind: ClassifiedLine['kind']): SkipReason =>
  kind === 'store' || kind === 'date'
    ? 'store_info'
    : kind === 'total'
      ? 'total'
      : kind === 'tax'
        ? 'tax'
        : kind === 'payment'
          ? 'payment'
          : kind === 'discount'
            ? 'discount'
            : 'other';

/**
 * SRS 8.2 + 8.3: OCR lines → store, date, grocery items with matches, confidence and estimated
 * expiry, plus the lines that were skipped (kept so the review screen can restore them).
 */
export function parseReceipt(lines: readonly OcrLine[], today: IsoDate): ParsedReceipt {
  const nonEmpty = lines.map((l, index) => ({ ...l, index })).filter((l) => l.text.trim() !== '');

  let store: string | null = null;
  let receiptDate: IsoDate | null = null;
  const classified = nonEmpty.map((l, i) => {
    const c = classifyLine(l.text, l.index, i < HEADER_LINES, (s) => findStore(s) !== null);
    if (!store && i < HEADER_LINES) store = findStore(l.text);
    if (!receiptDate) receiptDate = parseDate(l.text);
    return { ...c, ocr: l.confidence };
  });

  const age = receiptDate ? diffDays(receiptDate, today) : null;
  const purchasedOn =
    receiptDate && age !== null && age >= 0 && age <= MAX_RECEIPT_AGE_DAYS ? receiptDate : today;

  const items: ParsedItem[] = [];
  const skipped: SkippedLine[] = [];

  for (const line of classified) {
    if (line.kind === 'weight') {
      // "2.13 lb @ 1.49/lb" belongs to the item above it.
      const prev = items[items.length - 1];
      if (prev && prev.index < line.index) {
        prev.quantity = line.quantity;
        if (line.unit) prev.unit = line.unit;
        continue;
      }
      skipped.push({ index: line.index, raw: line.raw, reason: 'other' });
      continue;
    }
    if (line.kind !== 'item') {
      skipped.push({ index: line.index, raw: line.raw, reason: reasonFor(line.kind) });
      continue;
    }

    const expanded = expandReceiptText(line.text);
    if (isNonFood(expanded) || isNonFood(line.text)) {
      skipped.push({ index: line.index, raw: line.raw, reason: 'not_food' });
      continue;
    }

    const match = matchFood(matchKey(expanded));
    const usable = match && match.score >= 0.5 ? match : null;
    const confidence = combineConfidence(line.ocr, usable?.score ?? 0.3);
    const band = confidenceBand(confidence);
    const category: Category = usable?.food.category ?? 'other';
    const location: Location = usable?.food.defaultLocation ?? DEFAULT_LOCATION[category];
    const expiry = usable
      ? estimateFoodExpiry(usable.food, location, purchasedOn)
      : {
          expiresOn: estimateExpiry(category, location, purchasedOn),
          source: 'category_default' as const,
        };

    items.push({
      index: line.index,
      raw: line.raw.trim(),
      name: usable?.food.name ?? displayName(expanded),
      foodId: usable?.food.foodId ?? null,
      category,
      location,
      quantity: line.quantity,
      unit: line.unit,
      price: line.price,
      confidence,
      status: band === 'matched' ? 'matched' : 'needs_look',
      wantsAi: band === 'needs_ai',
      expiresOn: expiry.expiresOn,
      expirySource: expiry.source,
    });
  }

  return { store, receiptDate, purchasedOn, lineCount: nonEmpty.length, items, skipped };
}
