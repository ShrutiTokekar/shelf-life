import { useTranslation } from 'react-i18next';
import type { Person } from '../../lib/people';
import { cx } from '../../lib/cx';
import { Avatar } from '../Avatar/Avatar';
import { WarnIcon } from '../icons';

export type ClaimPillProps = {
  /** Who is getting it: null = nobody yet. */
  claimer: (Person & { isYou: boolean }) | null;
  /** Web uses the short "Nobody yet" (Figma 14); mobile the full sentence (Figma 06). */
  short?: boolean;
  className?: string;
};

/** LST-5 claim status. Unclaimed uses a warning icon + words in terra-dark, never color alone. */
export function ClaimPill({ claimer, short = false, className }: ClaimPillProps) {
  const { t } = useTranslation();
  if (!claimer) {
    return (
      <span
        className={cx(
          'inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-terra-dark',
          short && 'rounded-chip bg-terra-light px-2.5 py-1',
          className,
        )}
      >
        <WarnIcon size={15} />
        {short ? t('lists.claim.nobodyShort') : t('lists.claim.nobody')}
      </span>
    );
  }
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ink',
        short && 'rounded-chip bg-shelf py-1 pl-1 pr-2.5',
        className,
      )}
    >
      <Avatar initial={claimer.initial} tone={claimer.tone} size={20} />
      {claimer.isYou ? t('lists.claim.you') : t('lists.claim.other', { name: claimer.name })}
    </span>
  );
}
