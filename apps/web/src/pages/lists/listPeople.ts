import type { ListWithRole, MeResponse } from '@shelf-life/shared';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Person } from '../../lib/people';
import { usePeople } from '../../lib/people';

/**
 * Names and avatars for a list's people. Someone no longer on any of your lists shows as
 * "Former member" (SHR-8): their items and claims stay.
 */
export function useListPeople(me: MeResponse, list: ListWithRole | undefined) {
  const { t } = useTranslation();
  const people = usePeople(me);
  const personOf = useCallback(
    (userId: string, name?: string): Person =>
      people.get(userId) ??
      (name
        ? { name, initial: name.charAt(0).toUpperCase(), tone: 'peach' }
        : { name: t('lists.formerMember'), initial: '?', tone: 'peach' }),
    [people, t],
  );
  const members = useMemo(
    () =>
      (list?.members ?? []).map((m) => ({
        ...personOf(m.userId, m.displayName),
        userId: m.userId,
        isYou: m.userId === me.user.id,
      })),
    [list, personOf, me.user.id],
  );
  const claimerOf = useCallback(
    (userId: string | null) =>
      userId ? { ...personOf(userId), isYou: userId === me.user.id } : null,
    [personOf, me.user.id],
  );
  return { people, personOf, members, claimerOf };
}
