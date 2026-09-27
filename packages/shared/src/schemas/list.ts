import { z } from 'zod';
import { LIST_COLORS, LIST_NAME_MAX_LENGTH, LIST_ROLES } from '../constants';

export const listColorSchema = z.enum(LIST_COLORS);
export const listRoleSchema = z.enum(LIST_ROLES);

const listName = z
  .string()
  .trim()
  .min(1, 'Give your list a name.')
  .max(LIST_NAME_MAX_LENGTH, `Keep it under ${LIST_NAME_MAX_LENGTH} characters.`);

/** POST /lists body (SRS 11.1). The first call for a user creates the home list and pantry. */
export const createListInputSchema = z.object({
  name: listName,
  color: listColorSchema,
  isPrivate: z.boolean().default(false),
  shopBy: z.iso.date().nullable().optional(),
});
export type CreateListInput = z.input<typeof createListInputSchema>;

export const listSchema = z.object({
  id: z.uuid(),
  pantryId: z.uuid(),
  name: z.string(),
  color: listColorSchema,
  ownerId: z.string(),
  isHome: z.boolean(),
  isPrivate: z.boolean(),
  shopBy: z.string().nullable(),
  createdAt: z.string(),
});
export type List = z.infer<typeof listSchema>;

export const listWithRoleSchema = listSchema.extend({ role: listRoleSchema });
export type ListWithRole = z.infer<typeof listWithRoleSchema>;
