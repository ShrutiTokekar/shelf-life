import type { Person } from '../../lib/people';
import { cx } from '../../lib/cx';
import { Avatar } from '../Avatar/Avatar';

/** Overlapping member avatars (SRS 7 AvatarStack, −8 px overlap). Decorative: names sit beside it. */
export function AvatarStack({
  people,
  size = 24,
  max = 3,
  className,
}: {
  people: readonly Person[];
  size?: number;
  max?: number;
  className?: string;
}) {
  const shown = people.slice(0, max);
  return (
    <span aria-hidden="true" className={cx('inline-flex shrink-0 items-center', className)}>
      {shown.map((p, i) => (
        <Avatar
          key={`${p.name}-${i}`}
          initial={p.initial}
          tone={p.tone}
          size={size}
          className={cx('ring-2 ring-cream', i > 0 && '-ml-2')}
        />
      ))}
    </span>
  );
}
