import {
  formatRanOut,
  groupListItems,
  listCounts,
  parseListText,
  ranOutRecently,
  todayIso,
  whoIsGettingWhat,
  type ListItem,
} from '@shelf-life/shared';
import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AddItemSheet } from '../../components/AddItemSheet/AddItemSheet';
import { Avatar } from '../../components/Avatar/Avatar';
import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import {
  CartIcon,
  ClockIcon,
  EmptyJarIcon,
  PlusIcon,
  PotIcon,
  ScanIcon,
  SparkIcon,
  UserPlusIcon,
  WarnIcon,
} from '../../components/icons';
import { IconButton } from '../../components/IconButton/IconButton';
import { ListGroup } from '../../components/ListGroup/ListGroup';
import { ListRow } from '../../components/ListRow/ListRow';
import {
  ListSwitcher,
  SwitchListsSheet,
  type SwitcherList,
} from '../../components/ListSwitcher/ListSwitcher';
import { ListTabs } from '../../components/ListTabs/ListTabs';
import { ShareDialog } from '../../components/ShareDialog/ShareDialog';
import { PageSkeleton } from '../../components/Skeleton/Skeleton';
import { cx } from '../../lib/cx';
import { useMe, useSession } from '../../lib/session';
import { useList, useListsItems, usePantry, useSyncState } from '../../lib/sync/useDocs';
import { DESKTOP_QUERY, useMediaQuery } from '../../lib/useMediaQuery';
import { usePlace } from '../../stores/place';
import { useListActions } from './useListActions';
import { useListPeople } from './listPeople';

/** Grocery list (SRS 6.6, Figma mobile 06, web 14). `/share` and `/add` open their dialogs. */
export function ListPage() {
  const { t } = useTranslation();
  const me = useMe();
  const session = useSession();
  const params = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const lastList = usePlace((s) => s.listId);
  const setLastList = usePlace((s) => s.setList);
  // `/lists` (Figma 18) opens the last list with the switcher showing.
  const fallback =
    lastList && me.lists.some((l) => l.id === lastList) ? lastList : me.pantry!.homeListId;
  const listId = params.listId ?? fallback;
  const list = me.lists.find((l) => l.id === listId);
  const { doc, items, status, retry } = useList(list ? listId : null);
  const sync = useSyncState(list ? `list:${listId}` : null);
  // Ran-out chips come from the pantry this list stocks, if this user can see it (SHR-6).
  const canSeePantry = !!list && me.pantries.some((p) => p.id === list.pantryId);
  const pantry = usePantry(canSeePantry ? list!.pantryId : null);
  const { personOf, members, claimerOf } = useListPeople(me, list);
  const actions = useListActions(doc, listId, me.user.id);
  const today = todayIso();
  const [switching, setSwitching] = useState(pathname === '/lists');
  const [editing, setEditing] = useState<ListItem | null>(null);
  const addOpen = pathname.endsWith('/add');
  const shareOpen = pathname.endsWith('/share');

  useEffect(() => {
    if (list) setLastList(list.id);
  }, [list, setLastList]);

  const allIds = useMemo(() => me.lists.map((l) => l.id), [me.lists]);
  const allItems = useListsItems(allIds);
  const switcherLists: SwitcherList[] = useMemo(
    () =>
      me.lists.map((l) => ({
        ...l,
        people: l.members.map((m) => personOf(m.userId, m.displayName)),
        toBuy: (l.id === listId ? items : (allItems[l.id] ?? [])).filter((i) => !i.checked).length,
      })),
    [me.lists, allItems, items, listId, personOf],
  );

  if (!list) {
    return (
      <div className="mx-auto max-w-3xl page-x py-8">
        <EmptyState
          title={t('lists.notFoundTitle')}
          body={t('lists.notFoundBody')}
          action={
            <Button asChild variant="secondary">
              <Link to={`/lists/${me.pantry!.homeListId}`}>{t('nav.groceryList')}</Link>
            </Button>
          }
        />
      </div>
    );
  }
  if (status === 'loading') return <PageSkeleton />;

  const canEdit = list.role !== 'view';
  const groups = groupListItems(items, today);
  const counts = listCounts(items);
  const ranOut = canSeePantry ? ranOutRecently(pantry.items, items, today) : [];
  const current = switcherLists.find((l) => l.id === listId)!;
  const base = `/lists/${listId}`;

  const reasonOf = (item: ListItem) => {
    if (item.checked) {
      const buyer = item.checkedBy ?? item.addedBy;
      return {
        icon: <CartIcon size={15} />,
        text:
          buyer === me.user.id
            ? t('lists.byYou')
            : t('lists.byWho', { name: personOf(buyer).name.split(' ')[0] }),
      };
    }
    const by =
      item.addedBy === me.user.id
        ? t('lists.reason.addedByYou')
        : t('lists.reason.addedBy', { name: personOf(item.addedBy).name.split(' ')[0] });
    const parts =
      item.reason === 'ran_out'
        ? [formatRanOut(todayIso(new Date(item.createdAt)), today), by.toLowerCase()]
        : item.reason === 'recipe'
          ? [t('lists.reason.recipe'), by.toLowerCase()]
          : [by];
    if (item.note) parts.push(item.note);
    const icon =
      item.reason === 'ran_out' ? (
        <EmptyJarIcon size={15} />
      ) : item.reason === 'recipe' ? (
        <PotIcon size={15} />
      ) : item.reason === 'suggestion' ? (
        <SparkIcon size={15} />
      ) : (
        <PlusIcon size={15} />
      );
    return { icon, text: parts.join(' · ') };
  };

  const row = (item: ListItem) => (
    <ListRow
      key={item.id}
      item={item}
      claimer={claimerOf(item.claimedBy)}
      reason={reasonOf(item)}
      canEdit={canEdit}
      wide={isDesktop}
      onCheck={() => actions.check(item)}
      onClaim={() => actions.claim(item)}
      onEdit={() => setEditing(item)}
    />
  );

  const liveText =
    sync === 'live'
      ? isDesktop && !list.isPrivate
        ? t('lists.liveWith', { name: list.name })
        : t('lists.live')
      : sync === 'denied'
        ? t('lists.denied')
        : sync === 'connecting'
          ? t('lists.connecting')
          : t('lists.offline');

  const who = whoIsGettingWhat(items);

  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-4 page-x pb-8 pt-8 lg:gap-6 lg:pt-7">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-3">
          <h1 className="text-[2rem] leading-[1.1] lg:text-[4rem]">{t('lists.title')}</h1>
          {!isDesktop ? (
            <div className="flex items-center justify-between gap-3">
              <ListSwitcher list={current} onOpen={() => setSwitching(true)} />
              {!list.isPrivate || list.role === 'owner' ? (
                <IconButton
                  icon={<UserPlusIcon size={22} />}
                  label={t('lists.share')}
                  className="size-12 rounded-[0.875rem] border-2 border-navy text-navy"
                  onClick={() => navigate(`${base}/share`)}
                />
              ) : null}
            </div>
          ) : null}
          <p
            role="status"
            className="flex items-center gap-2 text-sm font-semibold text-secondary lg:text-lg lg:font-medium"
          >
            <span
              aria-hidden="true"
              className={cx('size-2.5 rounded-chip', sync === 'live' ? 'bg-olive' : 'bg-out-lid')}
            />
            {liveText} · {t('lists.counts', counts)}
          </p>
        </div>
        {isDesktop ? (
          <div className="flex gap-3">
            <Button
              variant="secondary"
              icon={<UserPlusIcon size={20} />}
              onClick={() => navigate(`${base}/share`)}
            >
              {t('lists.share')}
            </Button>
            <Button asChild>
              <Link to={`${base}/shop`}>
                <ScanIcon size={20} />
                {t('lists.startShopping')}
              </Link>
            </Button>
          </div>
        ) : null}
      </div>

      {isDesktop ? <ListTabs lists={switcherLists} activeId={listId} /> : null}

      {canEdit ? (
        <QuickAdd
          wide={isDesktop}
          onAdd={(text) => actions.add(parseListText(text))}
          onOpenSheet={() => navigate(`${base}/add`)}
          ranOut={ranOut}
          onRanOut={actions.addRanOut}
        />
      ) : (
        <p className="rounded-card bg-shelf px-4 py-3 text-ink">{t('lists.viewOnly')}</p>
      )}

      {!isDesktop ? (
        <Button asChild fullWidth>
          <Link to={`${base}/shop`}>
            <ScanIcon size={20} />
            {t('lists.startShopping')}
          </Link>
        </Button>
      ) : null}

      <div
        id="list-items"
        tabIndex={-1}
        className="grid gap-5 outline-none lg:grid-cols-[minmax(0,1fr)_23.75rem] lg:gap-6"
      >
        <div className="flex flex-col gap-5">
          {status === 'error' ? (
            <ErrorState message={t('lists.storageError')} onRetry={retry} />
          ) : items.length === 0 ? (
            <EmptyState
              title={t('lists.emptyTitle')}
              body={t('lists.emptyBody', { name: list.name })}
            />
          ) : (
            <>
              {groups.neededToday.length > 0 ? (
                <ListGroup
                  tone="today"
                  icon={<WarnIcon size={20} />}
                  title={t('lists.groups.neededToday')}
                  helper={t('lists.groups.neededTodayHelper')}
                >
                  {groups.neededToday.map(row)}
                </ListGroup>
              ) : null}
              {groups.thisWeek.length > 0 ? (
                <ListGroup
                  tone="week"
                  icon={<ClockIcon size={20} />}
                  title={t('lists.groups.thisWeek')}
                  helper={t('lists.groups.thisWeekHelper')}
                >
                  {groups.thisWeek.map(row)}
                </ListGroup>
              ) : null}
              {groups.cart.length > 0 && !isDesktop ? (
                <ListGroup
                  tone="cart"
                  icon={<CartIcon size={20} />}
                  title={t('lists.groups.cart', { count: groups.cart.length })}
                  helper={t('lists.groups.cartHelper')}
                >
                  {groups.cart.map(row)}
                </ListGroup>
              ) : null}
              {groups.cart.length > 0 && canEdit && !isDesktop ? (
                <Button variant="secondary" onClick={actions.doneShopping}>
                  {t('lists.doneShopping')}
                </Button>
              ) : null}
            </>
          )}
        </div>

        {isDesktop ? (
          <aside className="flex flex-col gap-5">
            {!list.isPrivate ? (
              <section
                aria-labelledby="who-title"
                className="rounded-card border-2 border-line bg-white p-6"
              >
                <h2 id="who-title" className="text-[1.625rem]">
                  {t('lists.who.title')}
                </h2>
                <ul className="mt-4 flex flex-col gap-3">
                  {[...who.byMember].map(([userId, mine]) => {
                    const p = personOf(userId);
                    return (
                      <li key={userId} className="flex items-center gap-3">
                        <Avatar initial={p.initial} tone={p.tone} size={36} />
                        <span>
                          <span className="block font-semibold text-ink">
                            {userId === me.user.id ? t('lists.you') : p.name.split(' ')[0]}
                          </span>
                          <span className="block text-sm text-secondary">
                            {mine.map((i) => i.name).join(', ')}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                  {who.unclaimed.length > 0 ? (
                    <li className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-chip bg-terra-light text-terra-dark">
                        <WarnIcon size={18} />
                      </span>
                      <span>
                        <span className="block font-semibold text-terra-dark">
                          {t('lists.who.unclaimed')}
                        </span>
                        <span className="block text-sm text-secondary">
                          {who.unclaimed.map((i) => i.name).join(', ')}
                        </span>
                      </span>
                    </li>
                  ) : null}
                </ul>
              </section>
            ) : null}
            <section
              aria-labelledby="cart-title"
              className="rounded-card bg-sage p-6 text-olive-dark"
            >
              <h2 id="cart-title" className="flex items-center gap-2 text-[1.625rem]">
                <CartIcon size={22} />
                {t('lists.groups.cart', { count: groups.cart.length })}
              </h2>
              {groups.cart.length === 0 ? (
                <p className="mt-3 text-sm">{t('lists.cartEmpty')}</p>
              ) : (
                <ul className="mt-3 flex flex-col">{groups.cart.map(row)}</ul>
              )}
              <p className="mt-3 text-sm">{t('lists.groups.cartHelper')}</p>
              {groups.cart.length > 0 && canEdit ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={actions.doneShopping}
                >
                  {t('lists.doneShopping')}
                </Button>
              ) : null}
            </section>
            <section className="rounded-card bg-periwinkle p-6 text-ink">
              <h2 className="font-ui text-lg font-semibold">{t('lists.shoppingCard.title')}</h2>
              <p className="mt-2 text-sm">{t('lists.shoppingCard.body')}</p>
            </section>
          </aside>
        ) : null}
      </div>

      <SwitchListsSheet
        open={switching}
        lists={switcherLists}
        currentId={listId}
        onClose={() => {
          setSwitching(false);
          if (pathname === '/lists') navigate(base, { replace: true });
        }}
      />
      <AddItemSheet
        open={addOpen || editing !== null}
        item={editing}
        listName={list.name}
        isPrivate={list.isPrivate}
        members={members}
        ranOut={ranOut}
        onAdd={(entries) => {
          actions.add(entries);
          navigate(base, { replace: true });
        }}
        onSave={(patch) => {
          if (editing) actions.edit(editing, patch);
          setEditing(null);
        }}
        onDelete={() => {
          if (editing) actions.remove(editing);
          setEditing(null);
        }}
        onRanOut={(jar) => actions.addRanOut(jar)}
        onClose={() => {
          setEditing(null);
          if (addOpen) navigate(base, { replace: true });
        }}
      />
      <ShareDialog
        open={shareOpen}
        listId={listId}
        userId={me.user.id}
        personOf={(id, name) => personOf(id, name)}
        itemCount={counts.toBuy}
        onClose={() => navigate(base, { replace: true })}
        onChanged={() => void session.refresh()}
        onLeft={() => {
          void session.refresh();
          navigate(`/lists/${me.pantry!.homeListId}`, { replace: true });
        }}
      />
    </div>
  );
}

/** LST-2 add field: "2 onions and eggs" adds two items; empty + opens the add sheet. */
function QuickAdd({
  wide,
  onAdd,
  onOpenSheet,
  ranOut,
  onRanOut,
}: {
  wide: boolean;
  onAdd: (text: string) => void;
  onOpenSheet: () => void;
  ranOut: ReturnType<typeof ranOutRecently>;
  onRanOut: (jar: ReturnType<typeof ranOutRecently>[number]) => void;
}) {
  const { t } = useTranslation();
  const inputId = useId();
  const [text, setText] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault();
    if (text.trim() === '') return onOpenSheet();
    onAdd(text);
    setText('');
  }
  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 lg:rounded-card lg:border-2 lg:border-line lg:bg-white lg:p-6"
    >
      <label htmlFor={inputId} className="font-semibold text-ink max-lg:sr-only">
        {t('lists.addLabel')}
      </label>
      <div className="flex gap-3">
        <div className="relative flex-1">
          <input
            id={inputId}
            value={text}
            autoComplete="off"
            maxLength={200}
            placeholder={t('lists.addPlaceholder')}
            onChange={(e) => setText(e.target.value)}
            className="min-h-14 w-full rounded-button bg-white pl-4 pr-16 text-base text-ink bordered lg:pr-4"
          />
          {!wide ? (
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2">
              <IconButton
                type="submit"
                variant="primary"
                icon={<PlusIcon size={22} />}
                label={t('lists.add')}
              />
            </span>
          ) : null}
        </div>
        {wide ? (
          <Button type="submit" icon={<PlusIcon size={20} />}>
            {t('lists.add')}
          </Button>
        ) : null}
      </div>
      {ranOut.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-secondary">{t('lists.ranOutRecently')}</span>
          {ranOut.map((jar) => (
            <button
              key={jar.id}
              type="button"
              aria-label={t('lists.ranOutChip', { name: jar.name })}
              onClick={() => onRanOut(jar)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-chip bg-peach px-3.5 text-sm font-semibold text-peach-dark"
            >
              <PlusIcon size={16} />
              {jar.name}
            </button>
          ))}
        </div>
      ) : null}
    </form>
  );
}
