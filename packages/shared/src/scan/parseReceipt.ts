import { diffDays, type IsoDate } from '../dates';
import { estimateFoodExpiry } from '../food/dictionary';
import { DEFAULT_LOCATION, estimateExpiry } from '../pantry/expiry';
import type { Category, ExpirySource, Location } from '../pantry/types';
import { classifyLine, parseDate, parsePrice, type ClassifiedLine, type Unit } from './lines';
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

/** A line that isn't a grocery; kept (with its price, if any) so it can be restored (REV-5). */
export type SkippedLine = { index: number; raw: string; price: number | null; reason: SkipReason };

export type ParsedReceipt = {
  store: string | null;
  /** The receipt's date if found and plausible, else null (purchase date then = today). */
  receiptDate: IsoDate | null;
  purchasedOn: IsoDate;
  /** The amount paid, from the TOTAL line, when it could be read. */
  total: number | null;
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
      skipped.push({ index: line.index, raw: line.raw, price: null, reason: 'other' });
      continue;
    }
    if (line.kind !== 'item') {
      skipped.push({
        index: line.index,
        raw: line.raw,
        price: line.price,
        reason: reasonFor(line.kind),
      });
      continue;
    }

    const item = parseItemLine(line, purchasedOn);
    if (item) items.push(item);
    else skipped.push({ index: line.index, raw: line.raw, price: line.price, reason: 'not_food' });
  }

  return {
    store,
    receiptDate,
    purchasedOn,
    total: findTotal(classified),
    lineCount: nonEmpty.length,
    items,
    skipped,
  };
}

/** The amount paid: the last TOTAL / BALANCE line, never a subtotal. */
function findTotal(lines: readonly ClassifiedLine[]): number | null {
  let total: number | null = null;
  for (const l of lines) {
    if (l.kind !== 'total' || l.price === null || l.price <= 0) continue;
    if (/sub\s?-?total|items?\s?sold|#\s?of\s?items|item\s?count|net\s?sales/i.test(l.raw))
      continue;
    total = l.price;
  }
  return total;
}

/**
 * SRS 8.2 steps 3–5 for one item line: normalize, match, score, estimate expiry. Returns null for
 * non-food lines. Also used when the user restores a skipped line on the review screen (REV-5).
 */
export function parseItemLine(
  line: Pick<ClassifiedLine, 'index' | 'raw' | 'text' | 'price' | 'quantity' | 'unit'> & {
    ocr: number;
  },
  purchasedOn: IsoDate,
  opts: { allowNonFood?: boolean } = {},
): ParsedItem | null {
  const expanded = expandReceiptText(line.text);
  if (!opts.allowNonFood && (isNonFood(expanded) || isNonFood(line.text))) return null;

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

  return {
    index: line.index,
    raw: line.raw.trim(),
    name: usable?.food.name ?? (displayName(expanded) || line.raw.trim()),
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
  };
}

/**
 * REV-5: turn a skipped line back into an item. The user chose to keep it, so it's matched even
 * when the text looks like something else (a total, a non-food word).
 */
export function itemFromSkippedLine(raw: string, index: number, purchasedOn: IsoDate): ParsedItem {
  const c = classifyLine(raw, index, false, () => false);
  const text =
    c.kind === 'item' ? c.text : raw.replace(/\s*-?\$?\s?\d{1,4}[.,]\d{2}.*$/, '').trim() || raw;
  return parseItemLine(
    {
      index,
      raw,
      text,
      price: c.price ?? parsePrice(raw),
      quantity: c.quantity,
      unit: c.unit,
      ocr: 1,
    },
    purchasedOn,
    { allowNonFood: true },
  )!;
}
