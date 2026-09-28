/**
 * SRS 8.2 step 3: turn receipt shorthand into words a person (and the dictionary) understands.
 * "GV WHL MLK" → "whole milk"; "GRK YOGURT" → "greek yogurt"; "KS ORG BNNA" → "banana".
 */

/** Receipt abbreviations → words (matched as whole tokens, lowercase). */
export const ABBREVIATIONS: Record<string, string> = {
  whl: 'whole',
  wh: 'whole',
  mlk: 'milk',
  mk: 'milk',
  grk: 'greek',
  ygrt: 'yogurt',
  yog: 'yogurt',
  yogrt: 'yogurt',
  org: 'organic',
  orgnc: 'organic',
  bnna: 'banana',
  bnnas: 'bananas',
  ban: 'banana',
  chkn: 'chicken',
  chk: 'chicken',
  brst: 'breast',
  bnls: 'boneless',
  sknls: 'skinless',
  grnd: 'ground',
  shrd: 'shredded',
  chs: 'cheese',
  chse: 'cheese',
  chdr: 'cheddar',
  mozz: 'mozzarella',
  veg: 'vegetable',
  vegs: 'vegetables',
  frzn: 'frozen',
  frz: 'frozen',
  tom: 'tomato',
  toms: 'tomatoes',
  tmto: 'tomato',
  pot: 'potato',
  pots: 'potatoes',
  onn: 'onion',
  onns: 'onions',
  grn: 'green',
  rd: 'red',
  ylw: 'yellow',
  blk: 'black',
  wht: 'white',
  brwn: 'brown',
  brn: 'brown',
  cilntro: 'cilantro',
  cilan: 'cilantro',
  spnch: 'spinach',
  spin: 'spinach',
  strwbry: 'strawberry',
  strwb: 'strawberries',
  strawb: 'strawberries',
  blubry: 'blueberry',
  bluebry: 'blueberries',
  blueb: 'blueberries',
  raspb: 'raspberries',
  avoc: 'avocado',
  avo: 'avocado',
  brd: 'bread',
  ww: 'whole wheat',
  oj: 'orange juice',
  crm: 'cream',
  hvy: 'heavy',
  btr: 'butter',
  bttr: 'butter',
  unsltd: 'unsalted',
  sltd: 'salted',
  pnt: 'peanut',
  pnut: 'peanut',
  crt: 'carrot',
  crts: 'carrots',
  crrt: 'carrot',
  brocc: 'broccoli',
  broc: 'broccoli',
  caulif: 'cauliflower',
  cuke: 'cucumber',
  cukes: 'cucumbers',
  lett: 'lettuce',
  rom: 'romaine',
  mshrm: 'mushroom',
  mshrms: 'mushrooms',
  grps: 'grapes',
  grp: 'grape',
  ppr: 'pepper',
  pprs: 'peppers',
  jal: 'jalapeno',
  gar: 'garlic',
  grlc: 'garlic',
  gngr: 'ginger',
  lmn: 'lemon',
  lmns: 'lemons',
  aprct: 'apricot',
  pch: 'peach',
  pchs: 'peaches',
  pnapl: 'pineapple',
  wtrmln: 'watermelon',
  sw: 'sweet',
  swt: 'sweet',
  pot8: 'potato',
  tort: 'tortillas',
  tortla: 'tortilla',
  flr: 'flour',
  pwdr: 'powder',
  pwd: 'powder',
  slt: 'salt',
  sug: 'sugar',
  sgr: 'sugar',
  oil: 'oil',
  evoo: 'olive oil',
  xvoo: 'olive oil',
  ckn: 'chicken',
  trky: 'turkey',
  bf: 'beef',
  grd: 'ground',
  saus: 'sausage',
  bcn: 'bacon',
  shrmp: 'shrimp',
  slmn: 'salmon',
  tlpia: 'tilapia',
  icecrm: 'ice cream',
  ic: 'ice cream',
  crmr: 'creamer',
  cof: 'coffee',
  cff: 'coffee',
  jce: 'juice',
  jc: 'juice',
  bev: 'beverage',
  spk: 'sparkling',
  wtr: 'water',
  cer: 'cereal',
  grnla: 'granola',
  ptato: 'potato',
  chips: 'chips',
  pnr: 'paneer',
  panir: 'paneer',
  dhl: 'dal',
  dl: 'dal',
  rce: 'rice',
  bsmti: 'basmati',
  basm: 'basmati',
  tp: 'toilet paper',
  ptwl: 'paper towel',
  atta: 'atta',
  ghe: 'ghee',
  dhai: 'dahi',
  hldi: 'haldi',
  jra: 'jeera',
  mth: 'methi',
};

/** Store brands and shelf labels that tell us nothing about the food (removed as leading tokens). */
export const BRAND_PREFIXES: string[] = [
  'great value',
  'gv',
  'kirkland signature',
  'kirkland',
  'ks',
  '365 everyday value',
  '365 wfm',
  '365',
  'wfm',
  'whole foods',
  'trader joe s',
  'trader joes',
  'tjs',
  'tj s',
  'tj',
  'good gather',
  'good & gather',
  'gg',
  'market pantry',
  'mkt pantry',
  'mp',
  'up&up',
  'o organics',
  'signature select',
  'signature',
  'simple truth organic',
  'simple truth',
  'kroger',
  'private selection',
  'hmart',
  'h mart',
  'laxmi',
  'swad',
  'deep',
  'aashirvaad',
  'sujata',
  'shan',
  '24 mantra',
  '24 mantra organic',
  'rani',
  'dhara',
  'amul',
  'haldirams',
  'mtr',
  'gits',
  'bibigo',
  'nongshim',
  'wegmans',
  'publix',
  'safeway',
  'lucerne',
  'food club',
  'aldi',
  'simply nature',
  'friendly farms',
  'happy farms',
  'fit & active',
];

/** Words that don't change what the food is; dropped before matching (kept in the raw line). */
export const MODIFIERS = new Set([
  'organic',
  'fresh',
  'natural',
  'premium',
  'select',
  'choice',
  'value',
  'family',
  'size',
  'pack',
  'large',
  'lg',
  'small',
  'sm',
  'medium',
  'med',
  'jumbo',
  'xl',
  'mini',
  'bag',
  'bags',
  'box',
  'jar',
  'bottle',
  'btl',
  'can',
  'cans',
  'ea',
  'each',
  'pkg',
  'pk',
  'ct',
  'count',
  'bunch',
  'bnch',
  'bu',
  'loose',
  'bulk',
  'grade',
  'a',
  'aa',
  'usda',
  'the',
  'of',
  'and',
  'w',
  'with',
  'new',
  'original',
  'classic',
  'plain',
  'regular',
  'reg',
  'store',
  'brand',
  'item',
  'lb',
  'lbs',
  'oz',
  'kg',
  'g',
  'gm',
  'gal',
  'l',
  'ltr',
  'ml',
  'qt',
  'pt',
  'dz',
  'doz',
  'dozen',
]);

const titleCase = (s: string) => s.replace(/\b([a-z])/g, (c) => c.toUpperCase());

/** Lowercase, drop punctuation noise, expand abbreviations, remove leading store brands. */
export function expandReceiptText(text: string): string {
  let s = text
    .toLowerCase()
    .replace(/[’'`]/g, ' ')
    .replace(/[^a-z0-9%&.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Remove store-brand prefixes (longest first so "kirkland signature" beats "kirkland").
  for (const brand of [...BRAND_PREFIXES].sort((a, b) => b.length - a.length)) {
    if (s === brand) break;
    if (s.startsWith(brand + ' ')) {
      s = s.slice(brand.length + 1);
      break;
    }
  }
  return s
    .split(' ')
    .map(fixOcrDigits)
    .map((t) => ABBREVIATIONS[t] ?? t)
    .join(' ')
    .trim();
}

/**
 * OCR often reads letters as digits inside words: "cilantr0", "spinac1". In a token that is
 * mostly letters, map 0→o, 1→l, 5→s, 8→b. Pure numbers and sizes ("400g", "2%") are left alone.
 */
export function fixOcrDigits(token: string): string {
  const letters = (token.match(/[a-z]/g) ?? []).length;
  const digits = (token.match(/[0-9]/g) ?? []).length;
  if (letters < 3 || digits === 0 || digits > letters / 2) return token;
  if (/^\d+([.,]\d+)?[a-z]{1,3}$/.test(token)) return token; // sizes like 400g, 2lb
  return token.replace(/0/g, 'o').replace(/1/g, 'l').replace(/5/g, 's').replace(/8/g, 'b');
}

/**
 * Words that describe a product without naming the food ("whole carrots", "nonfat yogurt").
 * They don't count against a match's coverage unless the food's own name uses them
 * ("whole milk" still needs "whole").
 */
export const WEAK_WORDS = new Set([
  'whole',
  'nonfat',
  'non',
  'fat',
  'free',
  'lowfat',
  'low',
  'reduced',
  'skim',
  'sliced',
  'diced',
  'chopped',
  'raw',
  'cooked',
  'roasted',
  'salted',
  'unsalted',
  'baby',
  'mini',
  'extra',
  'firm',
  'soft',
  'hass',
  'seedless',
  'boneless',
  'skinless',
  'thin',
  'thick',
  'cut',
  'peeled',
  'fresh',
  'frozen',
  'dried',
  'dry',
  'ripe',
  'sweet',
  'hot',
  'mild',
  'spicy',
  'hmart',
  'vine',
  'on',
]);

/** Words used for dictionary matching: expanded text minus quantities and modifiers. */
export function matchKey(expanded: string): string {
  return expanded
    .split(' ')
    .filter(
      (t) =>
        t && !MODIFIERS.has(t) && !/^\d+([.,]\d+)?(%|lb|lbs|oz|kg|g|gm|ct|pk|l|ml|gal)?$/.test(t),
    )
    .join(' ')
    .trim();
}

/** "whole milk" → "Whole Milk" for display when nothing in the dictionary matched. */
export function displayName(expanded: string): string {
  const key = matchKey(expanded);
  return titleCase(key || expanded);
}
