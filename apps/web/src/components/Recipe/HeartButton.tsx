import { useTranslation } from 'react-i18next';
import { cx } from '../../lib/cx';
import { HeartIcon } from '../icons';

/** SAV-2: save toggle. Filled terra heart = saved; `aria-pressed` says so to screen readers. */
export function HeartButton({
  title,
  saved,
  onToggle,
  className,
}: {
  title: string;
  saved: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={t('recipes.save', { title })}
      onClick={onToggle}
      className={cx(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-terra',
        className,
      )}
    >
      <HeartIcon size={24} fill={saved ? 'currentColor' : 'none'} />
    </button>
  );
}
