import { groupListItems, todayIso, type ListItem } from '@shelf-life/shared';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import {
  CartIcon,
  CheckIcon,
  ChevronLeftIcon,
  EmptyJarIcon,
  PlusIcon,
} from '../../components/icons';
import { ListRow } from '../../components/ListRow/ListRow';
import { PageSkeleton } from '../../components/Skeleton/Skeleton';
import { SkipLink } from '../../components/SkipLink/SkipLink';
import { useMe } from '../../lib/session';
import { useList } from '../../lib/sync/useDocs';
import { useListActions } from './useListActions';
import { useListPeople } from './listPeople';

/**
 * LST-9 shopping mode: full screen, one item per row, 20 px+ text, 44 px checkboxes, and the screen
 * stays on (Wake Lock API, where supported). Works offline: checks are local first.
 */
export function ShoppingModePage() {
  const { t } = useTranslation();
  const me = useMe();
  const { listId = '' } = useParams();
  const list = me.lists.find((l) => l.id === listId);
  const { doc, items, status } = useList(list ? listId : null);
  const actions = useListActions(doc, listId, me.user.id);
  const { personOf } = useListPeople(me, list);

  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
    };
    const acquire = () =>
      nav.wakeLock?.request('screen').then(
        (l) => (lock = l),
        () => undefined,
      );
    void acquire();
    // The lock drops when the tab is hidden; take it again when the shopper comes back.
    const onVisible = () => document.visibilityState === 'visible' && void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, []);

  if (!list) return <EmptyState title={t('lists.notFoundTitle')} body={t('lists.notFoundBody')} />;
  if (status === 'loading') return <PageSkeleton />;

  const canEdit = list.role !== 'view';
  const groups = groupListItems(items, todayIso());
  const open = [...groups.neededToday, ...groups.thisWeek];
  const reason = (item: ListItem) => ({
    icon: item.checked ? (
      <CartIcon size={18} />
    ) : item.reason === 'ran_out' ? (
      <EmptyJarIcon size={18} />
    ) : (
      <PlusIcon size={18} />
    ),
    text: item.claimedBy
      ? item.claimedBy === me.user.id
        ? t('lists.claim.you')
        : t('lists.claim.other', { name: personOf(item.claimedBy).name.split(' ')[0] })
      : item.note || t('lists.claim.nobodyShort'),
  });

  return (
    <div className="min-h-dvh bg-cream">
      <SkipLink targetId="shop-items" text={t('skip.main')} />
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b-2 border-line bg-cream px-3 py-3">
        <Link
          to={`/lists/${listId}`}
          aria-label={t('shopping.exit')}
          className="flex size-11 items-center justify-center rounded-xl text-ink"
        >
          <ChevronLeftIcon size={26} />
        </Link>
        <h1 className="min-w-0 flex-1 truncate font-ui text-2xl font-semibold text-ink">
          {t('shopping.title', { name: list.name })}
        </h1>
        <p role="status" className="text-lg font-semibold text-secondary">
          {t('shopping.left', { count: open.length })}
        </p>
      </header>
      <main
        id="shop-items"
        tabIndex={-1}
        className="mx-auto flex max-w-2xl flex-col gap-4 pb-32 outline-none"
      >
        <p className="px-5 pt-3 text-base text-secondary">{t('shopping.awake')}</p>
        {open.length === 0 && groups.cart.length > 0 ? (
          <p className="mx-5 flex items-center gap-2 rounded-card bg-sage p-4 text-lg font-semibold text-olive-dark">
            <CheckIcon size={22} />
            {t('shopping.allDone')}
          </p>
        ) : null}
        <ul className="divide-y-2 divide-line border-y-2 border-line bg-white">
          {[...open, ...groups.cart].map((item) => (
            <ListRow
              key={item.id}
              item={item}
              large
              claimer={null}
              reason={reason(item)}
              canEdit={canEdit}
              onCheck={() => actions.check(item)}
              onClaim={() => undefined}
              onEdit={() => undefined}
            />
          ))}
        </ul>
      </main>
      {canEdit && groups.cart.length > 0 ? (
        <footer className="fixed inset-x-0 bottom-0 border-t-2 border-line bg-cream p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-2xl">
            <Button fullWidth icon={<CartIcon size={22} />} onClick={actions.doneShopping}>
              {t('shopping.done')}
            </Button>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
