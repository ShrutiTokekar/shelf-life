import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { cx } from '../../lib/cx';
import { AvatarStack } from '../AvatarStack/AvatarStack';
import { LockIcon, PlusIcon } from '../icons';
import type { SwitcherList } from '../ListSwitcher/ListSwitcher';

/**
 * LST-11 web list tabs (Figma web 14): avatars, name, count, then "+ New list". Each tab is a link
 * to its list (navigation, so links with aria-current rather than an ARIA tablist).
 */
export function ListTabs({
  lists,
  activeId,
}: {
  lists: readonly SwitcherList[];
  activeId: string;
}) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('lists.yourLists')}>
      <ul className="flex flex-wrap gap-3">
        {lists.map((l) => {
          const active = l.id === activeId;
          return (
            <li key={l.id}>
              <Link
                to={`/lists/${l.id}`}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'inline-flex min-h-12 items-center gap-2 rounded-button px-3.5 font-semibold text-ink',
                  active
                    ? 'border-2 border-navy bg-white text-navy'
                    : 'border-2 border-shelf bg-shelf',
                )}
              >
                {l.isPrivate ? <LockIcon size={18} /> : <AvatarStack people={l.people} size={22} />}
                {l.name}
                <span
                  className={cx(
                    'rounded-chip px-2 text-xs',
                    active ? 'bg-navy text-white' : 'bg-white text-ink',
                  )}
                >
                  {l.toBuy}
                </span>
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            to="/lists/new"
            className="inline-flex min-h-12 items-center gap-1.5 rounded-button border-2 border-dashed border-navy px-3.5 font-semibold text-navy"
          >
            <PlusIcon size={18} />
            {t('lists.newListShort')}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
