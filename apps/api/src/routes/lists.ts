import { Hono } from 'hono';
import {
  createInviteInputSchema,
  createListInputSchema,
  updateListInputSchema,
  updateMemberInputSchema,
} from '@shelf-life/shared';
import { createList, deleteList } from '../services/onboarding';
import {
  changeRole,
  createInvite,
  getListDetail,
  removeMember,
  revokeInvite,
  stopSharing,
  updateList,
} from '../services/sharing';
import type { AppEnv } from '../types';

const body = async (c: { req: { json: () => Promise<unknown> } }) => c.req.json().catch(() => ({}));

/** Lists, members and invite links (SRS 11.1, 6.13). Every route checks the caller's role. */
export function listRoutes(appUrl: string) {
  return new Hono<AppEnv>()
    .post('/', async (c) => {
      const input = createListInputSchema.parse(await body(c));
      const created = await createList(c.var.db, c.var.user.id, input);
      return c.json(
        {
          ...created,
          shopBy: created.shopBy,
          createdAt: created.createdAt.toISOString(),
          role: 'owner' as const,
          members: [],
        },
        201,
      );
    })
    .get('/:id', async (c) =>
      c.json(await getListDetail(c.var.db, c.var.user.id, c.req.param('id'), appUrl)),
    )
    .patch('/:id', async (c) => {
      await updateList(
        c.var.db,
        c.var.user.id,
        c.req.param('id'),
        updateListInputSchema.parse(await body(c)),
      );
      return c.body(null, 204);
    })
    .delete('/:id', async (c) => {
      await deleteList(c.var.db, c.var.user.id, c.req.param('id'));
      return c.body(null, 204);
    })
    .post('/:id/invites', async (c) => {
      const input = createInviteInputSchema.parse(await body(c));
      return c.json(
        await createInvite(c.var.db, c.var.user.id, c.req.param('id'), input, appUrl),
        201,
      );
    })
    .delete('/:id/invites/:token', async (c) => {
      await revokeInvite(c.var.db, c.var.user.id, c.req.param('id'), c.req.param('token'));
      return c.body(null, 204);
    })
    .post('/:id/stop-sharing', async (c) => {
      await stopSharing(c.var.db, c.var.user.id, c.req.param('id'));
      return c.body(null, 204);
    })
    .patch('/:id/members/:userId', async (c) => {
      const { role } = updateMemberInputSchema.parse(await body(c));
      await changeRole(c.var.db, c.var.user.id, c.req.param('id'), c.req.param('userId'), role);
      return c.body(null, 204);
    })
    .delete('/:id/members/:userId', async (c) => {
      await removeMember(c.var.db, c.var.user.id, c.req.param('id'), c.req.param('userId'));
      return c.body(null, 204);
    });
}
