import type { TextSize } from '@shelf-life/shared';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { cx } from '../../lib/cx';
import { Avatar } from '../Avatar/Avatar';
import { Badge } from '../Badge/Badge';
import { Button } from '../Button/Button';
import { BellIcon, ContrastIcon, TimeArrow, UploadIcon } from '../icons';
import type { NavKey } from '../nav';
import { TextSizeControl } from '../TextSizeControl/TextSizeControl';
import { Wordmark } from '../Wordmark/Wordmark';

export type NavHeaderProps = {
  active: NavKey;
  listHref: string;
  listCount?: number;
  remindersCount?: number;
  userName: string;
  userInitial: string;
  textSize: TextSize;
  onTextSizeChange: (size: TextSize) => void;
  highContrast: boolean;
  onHighContrastChange: (on: boolean) => void;
  className?: string;
};

/** Desktop header (≥ 1024 px): wordmark, four tabs with the arrow indicator, tools (SRS 5.1). */
export function NavHeader({
  active,
  listHref,
  listCount = 0,
  remindersCount = 0,
  userName,
  userInitial,
  textSize,
  onTextSizeChange,
  highContrast,
  onHighContrastChange,
  className,
}: NavHeaderProps) {
  const { t } = useTranslation();
  const tabs = [
    { key: 'today', href: '/', label: t('nav.today'), count: 0 },
    { key: 'pantry', href: '/pantry', label: t('nav.pantry'), count: 0 },
    { key: 'list', href: listHref, label: t('nav.groceryList'), count: listCount },
    { key: 'recipes', href: '/recipes', label: t('nav.recipes'), count: 0 },
  ] as const;

  return (
    // Wraps to a second row when Largest text (130%) meets a narrow desktop (A11Y-6).
    <header
      className={cx(
        'flex flex-wrap items-center justify-between gap-x-6 gap-y-3 page-x pt-5',
        className,
      )}
    >
      <Link to="/" className="flex min-h-11 items-center rounded-xl">
        <Wordmark size={38} />
      </Link>

      <nav aria-label={t('nav.primary')}>
        <ul className="flex flex-wrap items-start gap-2">
          {tabs.map((tab) => {
            const on = tab.key === active;
            return (
              <li key={tab.key}>
                <Link
                  to={tab.href}
                  aria-current={on ? 'page' : undefined}
                  aria-label={
                    tab.count > 0
                      ? t('nav.listWithCount', { label: tab.label, count: tab.count })
                      : undefined
                  }
                  className="flex flex-col items-center gap-1.5 rounded-xl"
                >
                  <span
                    className={cx(
                      'flex min-h-11 items-center gap-2 rounded-xl px-4 py-3 text-lg leading-tight',
                      on ? 'font-semibold text-navy' : 'font-medium text-ink',
                    )}
                  >
                    {tab.label}
                    {tab.count > 0 ? <Badge count={tab.count} /> : null}
                  </span>
                  <TimeArrow variant="header" hidden={!on} />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div role="group" aria-label={t('nav.tools')} className="flex flex-wrap items-center gap-3">
        <TextSizeControl value={textSize} onChange={onTextSizeChange} />
        <button
          type="button"
          aria-pressed={highContrast}
          aria-label={t('nav.highContrast')}
          onClick={() => onHighContrastChange(!highContrast)}
          className="flex size-[2.875rem] items-center justify-center rounded-xl bg-white text-ink bordered aria-pressed:bg-periwinkle aria-pressed:text-navy"
        >
          <ContrastIcon size={22} />
        </button>
        <Link
          to="/reminders"
          aria-label={
            remindersCount > 0
              ? t('nav.remindersWithCount', { count: remindersCount })
              : t('nav.reminders')
          }
          className="relative flex size-[2.875rem] items-center justify-center rounded-xl bg-white text-ink bordered"
        >
          <BellIcon size={22} />
          {remindersCount > 0 ? (
            <Badge count={remindersCount} tone="terra" className="absolute -right-2 -top-2" />
          ) : null}
        </Link>
        <Button asChild size="sm">
          <Link to="/scan">
            <UploadIcon size={20} />
            {t('nav.uploadReceipt')}
          </Link>
        </Button>
        <Link
          to="/profile"
          aria-label={t('nav.account', { name: userName })}
          className="rounded-chip"
        >
          <Avatar initial={userInitial} tone="periwinkle" size={44} />
        </Link>
      </div>
    </header>
  );
}
