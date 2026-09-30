/**
 * SRS 8.2 steps 1–2: classify each receipt line and pull out price, quantity and unit.
 * Receipts vary a lot by store; these rules are deliberately forgiving and the fixtures in
 * test/scan.test.ts cover the formats we've seen (Patel Brothers, Costco, Trader Joe's, Target,
 * H Mart).
 */

export type LineKind =
  | 'store' // store name / header
  | 'item' // a purchased product
  | 'weight' // "2.13 lb @ 1.49 /lb" continuation of the previous item
  | 'discount' // coupon, savings, markdown
  | 'total' // subtotal / total / balance
  | 'tax'
  | 'payment' // tender, card, change, approval codes
  | 'date'
  | 'other'; // address, phone, thank-you, barcodes, blank-ish noise

export type ClassifiedLine = {
  index: number;
  raw: string;
  kind: LineKind;
  /** Item/discount lines: the price at the end of the line (negative for discounts). */
  price: number | null;
  /** Item lines: text without the price, tax flags and item codes. */
  text: string;
  /** Weight lines, or a size inside the item text ("PANEER 400G"). */
  quantity: number | null;
  unit: Unit | null;
};

/** Units SRS 8.2 extracts; '' = a plain count. */
export type Unit = 'lb' | 'kg' | 'g' | 'oz' | 'ct' | 'pack' | 'gal' | 'L';

const PRICE_END = /(-?)\$?\s?(\d{1,4}[.,]\d{2})\s*(-?)\s*(?:[A-Z]{1,2}|\*)?\s*$/i;
const TOTAL =
  /\b(sub\s?-?total|total|balance(\s?due)?|amount\s?due|grand\s?total|net\s?sales|items?\s?sold|#\s?of\s?items|item\s?count)\b/i;
const TAX = /\b(tax|hst|gst|vat|crv|bottle\s?deposit)\b/i;
const PAYMENT =
  /\b(visa|master\s?card|mastercard|amex|discover|debit|credit|cash|change\s?due|change|tend(er)?|payment|approved|approval|auth(orization)?\s?(code|#)?|ref\s?#|card\s?#|chip\s?read|contactless|ebt|snap|aid\s?:|app\s?label|entry\s?method|signature)\b/i;
const DISCOUNT =
  /\b(savings?|you\s?saved|coupon|discount|disc|instant\s?savings|member\s?(price|savings)|markdown|promo|bogo|price\s?cut|rewards?|loyalty)\b/i;
const OTHER =
  /\b(thank\s?you|thanks|welcome|store\s?#|st#|register|reg\s?#|trans(action)?\s?#|cashier|operator|op\s?#|receipt|return\s?policy|survey|www\.|\.com|tel|phone|manager|mgr|open\s?\d|hours|feedback|save\s?money|live\s?better)\b/i;
const PHONE = /\(?\b\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/;
const ADDRESS =
  /^\s*\d{2,6}\s+[a-z0-9 .]+\b(st|street|ave|avenue|rd|road|blvd|dr|drive|hwy|highway|ln|lane|pkwy|way|ct|plaza|sq)\b/i;
const CITY_STATE_ZIP = /\b[A-Z]{2}\s+\d{5}(-\d{4})?\b/;
const DATE = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b|\b(\d{4})-(\d{2})-(\d{2})\b/;
const WEIGHT = /^\s*(\d+(?:[.,]\d+)?)\s*(lb|lbs|kg|oz)\s*@\s*\$?\s*\d+[.,]\d{2}\s*\/\s*(lb|kg|oz)/i;
const MULTIPLE = /^\s*(\d{1,2})\s*@\s*\$?\s*\d+[.,]\d{2}/;
const ITEM_CODE = /^\s*(?:[A-Z]\s+)?\d{4,14}\s+/; // UPC / item numbers at the start (Costco "E 1234567", Target)
/** Tax / food-stamp flags printed after the name (Target "NF", Walmart "F", Costco "E"). */
const TAX_FLAG = /\s+(?:NF|N|F|T|X|E|A|B|FN|TF|FT)$/;
const LETTERS = /[a-z]{2,}/i;

/** Size inside the item text: "400G", "4LB", "1 GAL", "18CT", "12 PK", "1.5 L". */
const SIZE = /(\d+(?:[.,]\d+)?)\s?(lbs?|kg|g|gm|oz|ct|pk|pack|gal|l|ltr)\b/i;

function normUnit(u: string): Unit {
  const k = u.toLowerCase();
  if (k.startsWith('lb')) return 'lb';
  if (k === 'kg') return 'kg';
  if (k === 'g' || k === 'gm') return 'g';
  if (k === 'oz') return 'oz';
  if (k === 'ct') return 'ct';
  if (k === 'pk' || k === 'pack') return 'pack';
  if (k === 'gal') return 'gal';
  return 'L';
}

const num = (s: string) => Number(s.replace(',', '.'));

export function parsePrice(line: string): number | null {
  const m = PRICE_END.exec(line);
  if (!m) return null;
  const negative = m[1] === '-' || m[3] === '-';
  return (negative ? -1 : 1) * num(m[2]!);
}

/** A date on the receipt, as ISO (yyyy-mm-dd), or null. mm/dd/yy(yy) is US format. */
export function parseDate(line: string): string | null {
  const m = DATE.exec(line);
  if (!m) return null;
  let y: number, mo: number, d: number;
  if (m[4]) {
    y = Number(m[4]);
    mo = Number(m[5]);
    d = Number(m[6]);
  } else {
    mo = Number(m[1]);
    d = Number(m[2]);
    y = Number(m[3]);
    if (y < 100) y += 2000;
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function classifyLine(
  raw: string,
  index: number,
  isHeaderZone: boolean,
  isStoreName: (s: string) => boolean,
): ClassifiedLine {
  const base: ClassifiedLine = {
    index,
    raw,
    kind: 'other',
    price: null,
    text: '',
    quantity: null,
    unit: null,
  };
  const line = raw.trim();
  if (!LETTERS.test(line) && !PRICE_END.test(line))
    return parseDate(line) ? { ...base, kind: 'date' } : base;

  const weight = WEIGHT.exec(line);
  if (weight)
    return { ...base, kind: 'weight', quantity: num(weight[1]!), unit: normUnit(weight[2]!) };
  const multiple = MULTIPLE.exec(line);
  if (multiple && !LETTERS.test(line.replace(/\b(ea|each|for)\b/gi, ''))) {
    return { ...base, kind: 'weight', quantity: Number(multiple[1]), unit: null };
  }

  if (isHeaderZone && isStoreName(line)) return { ...base, kind: 'store', text: line };
  if (TAX.test(line) && PRICE_END.test(line))
    return { ...base, kind: 'tax', price: parsePrice(line) };
  if (TOTAL.test(line)) return { ...base, kind: 'total', price: parsePrice(line) };
  if (PAYMENT.test(line)) return { ...base, kind: 'payment' };
  const price = parsePrice(line);
  if (DISCOUNT.test(line) || (price !== null && price < 0))
    return { ...base, kind: 'discount', price };
  if (parseDate(line) && (!price || /\d{1,2}:\d{2}/.test(line))) return { ...base, kind: 'date' };
  if (OTHER.test(line) || PHONE.test(line) || ADDRESS.test(line) || CITY_STATE_ZIP.test(line))
    return base;
  if (price === null) return base;

  // An item: strip the price (+ tax flag), item codes and trailing "F"/"N" markers.
  let text = line.replace(PRICE_END, '').replace(ITEM_CODE, '').trim();
  text = text.replace(TAX_FLAG, '').trim();
  if (!LETTERS.test(text)) return base;
  const size = SIZE.exec(text);
  return {
    ...base,
    kind: 'item',
    price,
    text,
    quantity: size ? num(size[1]!) : null,
    unit: size ? normUnit(size[2]!) : null,
  };
}
