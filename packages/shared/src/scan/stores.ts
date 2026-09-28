/** Known stores (SRS 8.2 step 1): matched in the first lines of a receipt. Display name first. */
export const KNOWN_STORES: [display: string, ...patterns: RegExp[]][] = [
  ['Patel Brothers', /patel\s*bro(thers|s)?/i],
  ['Costco', /costco/i, /\bwholesale\b/i],
  ["Trader Joe's", /trader\s*joe/i],
  ['Target', /\btarget\b/i],
  ['H Mart', /\bh\s?-?mart\b/i],
  ['Walmart', /wal-?\s?mart/i],
  ['Whole Foods', /whole\s*foods/i],
  ['Kroger', /\bkroger\b/i],
  ['Safeway', /\bsafeway\b/i],
  ['Aldi', /\baldi\b/i],
  ['Publix', /\bpublix\b/i],
  ['Wegmans', /\bwegmans\b/i],
  ["Sam's Club", /sam'?s\s*club/i],
  ['Apna Bazar', /apna\s*bazaa?r/i],
  ['India Bazaar', /india\s*baza+r/i],
  ['Subzi Mandi', /subzi\s*mandi/i],
  ['Namaste Plaza', /namaste\s*plaza/i],
  ['99 Ranch', /99\s*ranch/i],
  ['Stop & Shop', /stop\s*&?\s*shop/i],
  ['ShopRite', /shop\s*rite/i],
  ['Giant', /\bgiant\b/i],
  ['Food Lion', /food\s*lion/i],
  ['Meijer', /\bmeijer\b/i],
  ['Sprouts', /\bsprouts\b/i],
];

export function findStore(line: string): string | null {
  for (const [display, ...patterns] of KNOWN_STORES) {
    if (patterns.some((p) => p.test(line))) return display;
  }
  return null;
}
