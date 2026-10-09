import { and, eq, inArray, lt, notInArray } from 'drizzle-orm';
import type { Db } from '../db/client';
import { schema } from '../db/client';

/** Email sign-ups never confirmed are removed after this long (Milestone 9b). */
export const UNCONFIRMED_TTL_MS = 24 * 3600_000;

/**
 * Hourly (with the reminders job): delete email accounts whose address was never confirmed
 * within 24 hours. They can't sign in, hold no data, and would stop the address's owner from
 * using it with Google. Accounts that also sign in with Google are never touched.
 */
export async function deleteUnconfirmedAccounts(db: Db, now: Date): Promise<number> {
  const withOtherSignIn = db
    .select({ userId: schema.account.userId })
    .from(schema.account)
    .where(notInArray(schema.account.providerId, ['credential']));
  const stale = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .innerJoin(schema.account, eq(schema.account.userId, schema.user.id))
    .where(
      and(
        eq(schema.user.emailVerified, false),
        eq(schema.account.providerId, 'credential'),
        lt(schema.user.createdAt, new Date(now.getTime() - UNCONFIRMED_TTL_MS)),
        notInArray(schema.user.id, withOtherSignIn),
      ),
    );
  if (stale.length === 0) return 0;
  await db.delete(schema.user).where(
    inArray(
      schema.user.id,
      stale.map((s) => s.id),
    ),
  );
  return stale.length;
}
