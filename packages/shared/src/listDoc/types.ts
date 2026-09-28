import { z } from 'zod';

/** SRS 10, ListItem.reason */
export const LIST_ITEM_REASONS = ['ran_out', 'recipe', 'manual', 'suggestion'] as const;

/**
 * An item on a grocery list, stored in that list's Yjs doc (`items` map, SRS 8.7).
 * `pantryItemId` links a ran-out jar to its list entry so the jar can show
 * "On the list · {claimer}" (PAN-9).
 */
export const listItemSchema = z.object({
  id: z.string().min(1),
  listId: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  quantity: z.number().min(0).nullable(),
  unit: z.string().max(20),
  note: z.string().max(200),
  reason: z.enum(LIST_ITEM_REASONS),
  recipeId: z.string().nullable(),
  pantryItemId: z.string().nullable(),
  addedBy: z.string(),
  claimedBy: z.string().nullable(),
  checked: z.boolean(),
  checkedBy: z.string().nullable(),
  checkedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type ListItem = z.infer<typeof listItemSchema>;
