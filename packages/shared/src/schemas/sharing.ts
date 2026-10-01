import { z } from 'zod';
import { LIST_NAME_MAX_LENGTH } from '../constants';
import { listColorSchema, listMemberSchema, listWithRoleSchema } from './list';

/** Roles an invite or a role change can give (owner is never handed out). */
export const INVITE_ROLES = ['edit', 'view'] as const;
export const inviteRoleSchema = z.enum(INVITE_ROLES);
export type InviteRole = z.infer<typeof inviteRoleSchema>;

/** PATCH /lists/:id (SRS 11.1): rename, recolor, shop-by date; SHR-7 turning off Private. */
export const updateListInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Give your list a name.')
      .max(LIST_NAME_MAX_LENGTH, `Keep it under ${LIST_NAME_MAX_LENGTH} characters.`),
    color: listColorSchema,
    shopBy: z.iso.date().nullable(),
    isPrivate: z.boolean(),
  })
  .partial();
export type UpdateListInput = z.infer<typeof updateListInputSchema>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s().-]{7,20}$/;

/** POST /lists/:id/invites (SHR-3): a link with a role, optionally for one email or phone. */
export const createInviteInputSchema = z.object({
  role: inviteRoleSchema.default('edit'),
  sendTo: z
    .string()
    .trim()
    .max(120)
    .refine((s) => EMAIL.test(s) || PHONE.test(s), 'Enter an email address or a phone number.')
    .nullable()
    .optional(),
});
export type CreateInviteInput = z.input<typeof createInviteInputSchema>;

/** How an invite reaches someone: their own mail or messages app opens with the link (SHR-3). */
export function inviteChannel(sendTo: string): 'email' | 'sms' {
  return EMAIL.test(sendTo) ? 'email' : 'sms';
}

export const inviteSchema = z.object({
  token: z.string(),
  url: z.string(),
  role: inviteRoleSchema,
  expiresAt: z.string(),
  sentTo: z.string().nullable(),
  acceptedAt: z.string().nullable(),
});
export type Invite = z.infer<typeof inviteSchema>;

/** GET /lists/:id: the list with members (and, for owners and editors, open invites). */
export const listDetailSchema = listWithRoleSchema.extend({
  members: z.array(listMemberSchema.extend({ joinedAt: z.string() })),
  invites: z.array(inviteSchema),
});
export type ListDetail = z.infer<typeof listDetailSchema>;

/** GET /invites/:token: what the join page shows before accepting. */
export const invitePreviewSchema = z.object({
  listName: z.string(),
  color: listColorSchema,
  role: inviteRoleSchema,
  invitedBy: z.string(),
  memberCount: z.number().int(),
  /** Joining a home list shares its pantry too (SHR-6). */
  sharesPantry: z.boolean(),
  alreadyMember: z.boolean(),
});
export type InvitePreview = z.infer<typeof invitePreviewSchema>;

export const acceptInviteResponseSchema = z.object({ listId: z.uuid() });

export const updateMemberInputSchema = z.object({ role: inviteRoleSchema });

/** Yjs doc names shared by the web app, API and sync service (SRS 8.7, 11.2). */
export const docNameSchema = z.string().regex(/^(pantry|list):[0-9a-f-]{36}$/i);
export type DocName = `pantry:${string}` | `list:${string}`;

/** GET /sync-token?doc=… (SRS 11.1): a 5-minute token for one doc, and where to connect. */
export const syncTokenResponseSchema = z.object({
  token: z.string(),
  /** Sync service base URL; null means "same origin, /sync" (local dev through Vite). */
  url: z.string().nullable(),
  expiresAt: z.string(),
  access: z.enum(['write', 'read']),
});
export type SyncTokenResponse = z.infer<typeof syncTokenResponseSchema>;
