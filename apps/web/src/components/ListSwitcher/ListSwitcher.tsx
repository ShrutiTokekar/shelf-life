import type { ListWithRole } from '@shelf-life/shared';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { cx } from '../../lib/cx';
import type { Person } from '../../lib/people';
import { AvatarStack } from '../AvatarStack/AvatarStack';
import { BottomSheet } from '../BottomSheet/BottomSheet';
import { Button } from '../Button/Button';
import { CheckIcon, ChevronDownIcon, LockIcon, PlusIcon } from '../icons';
import { PantryLabel } from '../PantryLabel/PantryLabel';

export type SwitcherList = ListWithRole & { people: Person[]; toBuy: number };

/** LST-1: avatars + list name + chevron; opens Switch lists (SHR-1). */
export function ListSwitcher({ list, onOpen }: { list: SwitcherList; onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={t('lists.switcher', { name: list.name })}
      onClick={onOpen}
      className="inline-flex min-h-12 max-w-full items-center gap-2 rounded-button border-2 border-navy bg-white px-3 text-navy"
    >
      {list.isPrivate ? <LockIcon size={18} /> : <AvatarStack people={list.people} size={24} />}
      <span className="truncate font-semibold">{list.name}</span>
      <ChevronDownIcon size={20} className="shrink-0" />
    </button>
  );
}

/** "You, Maya, Arjun" / "You + 5 others" / "Private". */
export function peopleSummary(
  list: SwitcherList,
  t: (key: string, o?: Record<string, unknown>) => string,
): string {
  if (list.isPrivate) return t('lists.private');
  const others = list.people.slice(1).map((p) => p.name.split(' ')[0]);
  if (others.length <= 2) return [t('lists.you'), ...others].join(', ');
  return t('lists.youAnd', { count: others.length });
}

/** SHR-1 Switch lists sheet (Figma mobile 18). */
export function SwitchListsSheet({
  open,
  lists,
  currentId,
  onClose,
}: {
  open: boolean;
  lists: readonly SwitcherList[];
  currentId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <BottomSheet open={open} title={t('lists.yourLists')} onClose={onClose}>
      <p className="text-ink">{t('lists.switchIntro')}</p>
      <ul className="mt-4 flex flex-col gap-3">
        {lists.map((l) => {
          const current = l.id === currentId;
          return (
            <li key={l.id}>
              <Link
                to={`/lists/${l.id}`}
                onClick={onClose}
                aria-current={current ? 'page' : undefined}
                className={cx(
                  'flex items-center gap-3 rounded-card border-2 bg-white p-4',
                  current ? 'border-navy' : 'border-line',
                )}
              >
                {l.isPrivate ? (
                  <span className="flex size-10 items-center justify-center rounded-chip bg-shelf text-slate">
                    <LockIcon size={20} />
                  </span>
                ) : (
                  <AvatarStack people={l.people} size={32} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{l.name}</span>
                  <span className="block text-sm text-secondary">
                    {t('lists.listSummary', { people: peopleSummary(l, t), count: l.toBuy })}
                  </span>
                  <span className="mt-1 inline-flex rounded-chip bg-shelf px-2 py-0.5">
                    <PantryLabel
                      listName={t('lists.pantryLabel', { name: l.name })}
                      color={l.color}
                    />
                  </span>
                </span>
                {current ? (
                  <span className="flex size-7 items-center justify-center rounded-chip bg-navy text-white">
                    <CheckIcon size={16} strokeWidth={2.6} />
                    <span className="sr-only">{t('lists.current')}</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
      <Button asChild fullWidth className="mt-4">
        <Link to="/lists/new" onClick={onClose}>
          <PlusIcon size={20} />
          {t('lists.newList')}
        </Link>
      </Button>
    </BottomSheet>
  );
}
