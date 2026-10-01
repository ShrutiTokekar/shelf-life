import type { MeResponse } from '@shelf-life/shared';
import { useMemo } from 'react';
import { usePlace } from '../stores/place';
import { useMe } from './session';

export type PantryChoice = MeResponse['pantries'][number];

/**
 * SHR-6: the pantry being viewed. Most people have one; a member of someone else's home list
 * can also open that pantry, so they pick which one (Pantry page switcher). Falls back to their
 * own pantry.
 */
export function useCurrentPantry() {
  const me = useMe();
  const chosen = usePlace((s) => s.pantryId);
  const setPantry = usePlace((s) => s.setPantry);
  return useMemo(() => {
    const own = me.pantry!;
    const pantries: PantryChoice[] = me.pantries.length
      ? me.pantries
      : [
          {
            ...own,
            name: me.lists.find((l) => l.id === own.homeListId)?.name ?? '',
            own: true,
            canEdit: true,
          },
        ];
    const pantry = pantries.find((p) => p.id === chosen) ?? pantries[0]!;
    const lists = me.lists.filter((l) => l.pantryId === pantry.id);
    // Scans and reviews write, so they go to a pantry this user can edit (their own if needed).
    const writable = pantry.canEdit ? pantry : (pantries.find((p) => p.own) ?? pantry);
    const writableLists = me.lists.filter((l) => l.pantryId === writable.id);
    return { pantry, pantries, lists, writable, writableLists, setPantry };
  }, [me, chosen, setPantry]);
}
