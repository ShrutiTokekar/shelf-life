import { z } from 'zod';

/** SRS 10, PantryItem.category */
export const CATEGORIES = [
  'produce',
  'dairy_eggs',
  'grains_dals',
  'spices_oils',
  'frozen',
  'other',
] as const;
export type Category = (typeof CATEGORIES)[number];

/** SRS 10, PantryItem.location */
export const LOCATIONS = ['fridge', 'freezer', 'cupboard'] as const;
export type Location = (typeof LOCATIONS)[number];

/** SRS 10, PantryItem.status */
export const ITEM_STATUSES = ['active', 'used', 'out', 'discarded'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

/** SRS 10 lists dictionary, ai, user; `category_default` is the SRS 8.3 fallback table. */
export const EXPIRY_SOURCES = ['dictionary', 'ai', 'user', 'category_default'] as const;
export type ExpirySource = (typeof EXPIRY_SOURCES)[number];

const isoDate = z.iso.date();

export const pantryItemSchema = z.object({
  id: z.string().min(1),
  pantryId: z.string().min(1),
  /** The pantry label: which list this item came from (SRS 8.9). */
  listId: z.string().min(1),
  foodId: z.string().nullable(),
  name: z.string().trim().min(1).max(60),
  category: z.enum(CATEGORIES),
  location: z.enum(LOCATIONS),
  /** null when unknown ("some"). */
  quantity: z.number().min(0).nullable(),
  unit: z.string().max(20),
  note: z.string().max(200),
  purchasedOn: isoDate,
  expiresOn: isoDate,
  expiryIsEstimate: z.boolean(),
  expirySource: z.enum(EXPIRY_SOURCES),
  status: z.enum(ITEM_STATUSES),
  /** When the item ran out, for "Ran out 2 days ago". */
  outAt: isoDate.nullable(),
  addedBy: z.string().min(1),
  receiptLineId: z.string().nullable(),
  updatedAt: z.string(),
});
export type PantryItem = z.infer<typeof pantryItemSchema>;

/** Fields the item sheet edits (SRS 7 ItemSheet). */
export const itemFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Give the item a name.')
    .max(60, 'Keep the name under 60 characters.'),
  quantity: z.number().min(0, 'Quantity can’t be negative.').nullable(),
  unit: z.string().trim().max(20),
  location: z.enum(LOCATIONS),
  category: z.enum(CATEGORIES),
  listId: z.string().min(1),
  expiresOn: isoDate,
  note: z.string().trim().max(200),
});
export type ItemForm = z.infer<typeof itemFormSchema>;
