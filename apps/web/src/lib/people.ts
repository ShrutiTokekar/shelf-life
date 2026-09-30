import type { MeResponse } from '@shelf-life/shared';
import { useMemo } from 'react';
import type { AvatarTone } from '../components/Avatar/Avatar';

export type Person = { name: string; initial: string; tone: AvatarTone };

const MEMBER_TONES: AvatarTone[] = ['periwinkle', 'sage', 'peach', 'apricot'];

/** Everyone the user shares a list with (and the user), each with a stable avatar tint. */
export function usePeople(me: MeResponse): Map<string, Person> {
  return useMemo(() => {
    const map = new Map<string, Person>();
    const add = (id: string, name: string) => {
      if (!map.has(id))
        map.set(id, {
          name,
          initial: name.charAt(0).toUpperCase(),
          tone: MEMBER_TONES[map.size % MEMBER_TONES.length]!,
        });
    };
    add(me.user.id, me.user.displayName);
    for (const l of me.lists) for (const m of l.members) add(m.userId, m.displayName);
    return map;
  }, [me]);
}
