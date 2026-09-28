import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { cx } from '../../lib/cx';
import { Badge } from '../Badge/Badge';
import { JarIcon, ListIcon, PotIcon, ScanIcon, SunIcon, TimeArrow } from '../icons';
import type { NavKey } from '../nav';

export type NavBottomProps = {
  active: NavKey;
  /** Where "List" goes: the user's home list (SRS 5.2, /lists/:listId defaults to home). */
  listHref: string;
  /** Unchecked items on the list (SRS 5.1 badge). */
  listCount?: number;
  className?: string;
};

type Item = {
  key: Exclude<NavKey, 'none'>;
  href: string;
  label: string;
  icon: (active: boolean) => ReactNode;
};

/** Mobile bottom nav (< 1024 px), matching Figma "Nav/Bottom v2". */
export function NavBottom({ active, listHref, listCount = 0, className }: NavBottomProps) {
  const { t } = useTranslation();
  const iconProps = (on: boolean) => ({ strokeWidth: on ? 2.4 : 2 });
  const left: Item[] = [
    {
      key: 'today',
      href: '/',
      label: t('nav.today'),
      icon: (on) => <SunIcon {...iconProps(on)} />,
    },
    {
      key: 'pantry',
      href: '/pantry',
      label: t('nav.pantry'),
      icon: (on) => <JarIcon {...iconProps(on)} />,
    },
  ];
  const right: Item[] = [
    {
      key: 'list',
      href: listHref,
      label: t('nav.list'),
      icon: (on) => <ListIcon {...iconProps(on)} />,
    },
    {
      key: 'recipes',
      href: '/recipes',
      label: t('nav.recipes'),
      icon: (on) => <PotIcon {...iconProps(on)} />,
    },
  ];

  const renderItem = (item: Item) => {
    const on = item.key === active;
    const count = item.key === 'list' ? listCount : 0;
    const accessibleName =
      count > 0 ? t('nav.listWithCount', { label: item.label, count }) : undefined;
    return (
      <li key={item.key} className="flex min-w-0 flex-1 justify-center">
        <Link
          to={item.href}
          aria-current={on ? 'page' : undefined}
          aria-label={accessibleName}
          className={cx(
            // Tabs share the width so labels never clip at 130% text (A11Y-6).
            'relative flex min-h-11 w-full min-w-11 max-w-[3.75rem] flex-col items-center gap-1 rounded-xl pt-1 text-[0.8125rem] leading-tight',
            on ? 'font-semibold text-navy' : 'font-medium text-slate',
          )}
        >
          <span className="relative">
            {item.icon(on)}
            {count > 0 ? <Badge count={count} className="absolute -top-2 left-4" /> : null}
          </span>
          <span className="whitespace-nowrap">{item.label}</span>
          <TimeArrow variant="bottom" hidden={!on} />
        </Link>
      </li>
    );
  };

  return (
    <nav
      aria-label={t('nav.primary')}
      className={cx(
        'fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white px-2 pt-2.5 min-[380px]:px-4',
        'pb-[max(1.5rem,env(safe-area-inset-bottom))]',
        className,
      )}
    >
      <ul className="mx-auto flex max-w-[30rem] items-start justify-between gap-1">
        {left.map(renderItem)}
        <li className="flex shrink-0 justify-center">
          <Link
            to="/scan"
            aria-label={t('nav.scan')}
            className="flex size-14 items-center justify-center rounded-[1.125rem] bg-navy text-white"
          >
            <ScanIcon />
          </Link>
        </li>
        {right.map(renderItem)}
      </ul>
    </nav>
  );
}
