import {
  markDone,
  rankRecipes,
  snooze,
  todayPriorities,
  unmarkDone,
  type Priority,
} from '@shelf-life/ranking';
import { readActivity, readTodayState, updateListItem, writeTodayState } from '@shelf-life/docs';
import {
  claimPatch,
  emptyTodayState,
  unclaimPatch,
  todayIso,
  TEXT_SIZES,
  type Activity,
  type ItemForm,
  type ListItem,
  type PantryItem,
  type TodayState,
} from '@shelf-life/shared';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type * as Y from 'yjs';
import { Avatar } from '../../components/Avatar/Avatar';
import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import {
  ArrowRightIcon,
  BellIcon,
  CalendarIcon,
  CartIcon,
  CheckIcon,
  EmptyJarIcon,
  HandIcon,
  ListIcon,
  PotIcon,
  ScanIcon,
  WarnIcon,
} from '../../components/icons';
import { ItemSheet } from '../../components/ItemSheet/ItemSheet';
import { PriorityCard, type PriorityTone } from '../../components/PriorityCard/PriorityCard';
import { ProgressDots } from '../../components/ProgressDots/ProgressDots';
import { ShelfLegend, ShelfTimeline } from '../../components/ShelfTimeline/ShelfTimeline';
import { PageSkeleton } from '../../components/Skeleton/Skeleton';
import { useToast } from '../../components/Toast/Toast';
import { Wordmark } from '../../components/Wordmark/Wordmark';
import { useLocalRecipes, useRecipePrefs } from '../../features/recipes/useRecipes';
import { formatTime } from '../../lib/format';
import { useCurrentPantry } from '../../lib/pantries';
import { usePeople } from '../../lib/people';
import { useMe } from '../../lib/session';
import { getDoc, listDocName } from '../../lib/sync/docs';
import { useDocSnapshot, useListsItems, useReceipts } from '../../lib/sync/useDocs';
import { DESKTOP_QUERY, useMediaQuery } from '../../lib/useMediaQuery';
import { useRecipeStore } from '../../stores/recipes';
import { useUiSettings } from '../../stores/uiSettings';
import { usePantryActions } from '../pantry/usePantryActions';

const NO_ACTIVITY: Activity[] = [];

/** "Friday, September 25" (desktop) or "Friday, Sep 25" (mobile). */
const longDate = (iso: string, short: boolean) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: short ? 'short' : 'long',
    day: 'numeric',
  }).format(new Date(`${iso}T12:00:00`));
const weekday = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date(`${iso}T12:00:00`));

/**
 * Today (SRS 6.2, Figma mobile 02, web 11): up to three priorities ranked by SRS 8.4, progress,
 * the shelf-life timeline, and on web the grocery list and recent activity. Works offline: it's
 * all read from this device.
 */
export function TodayPage() {
  const { t } = useTranslation();
  const me = useMe();
  const toast = useToast();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const current = useCurrentPantry();
  const pantryId = current.pantry.id;
  const { doc, items, receipts, status, retry } = useReceipts(pantryId);
  const people = usePeople(me);
  const today = todayIso();
  const listIds = useMemo(() => current.lists.map((l) => l.id), [current.lists]);
  const byList = useListsItems(listIds);
  const listItems = useMemo(() => Object.values(byList).flat(), [byList]);
  const actions = usePantryActions({
    doc,
    pantryId,
    userId: me.user.id,
    today,
    lists: current.lists,
  });
  const [editing, setEditing] = useState<PantryItem | null>(null);

  const readState = useCallback(
    (d: Y.Doc) => readTodayState(d, me.user.id, today),
    [me.user.id, today],
  );
  const emptyState = useMemo(() => emptyTodayState(today), [today]);
  const state = useDocSnapshot(doc, readState, emptyState);
  const activity = useDocSnapshot(doc, readActivity, NO_ACTIVITY);
  // Tonight's recipes (SRS 8.5): the local set plus the last AI answer for this pantry.
  const localRecipes = useLocalRecipes();
  const ai = useRecipeStore((s) => s.ai);
  const { prefs } = useRecipePrefs();
  const recipes = useMemo(
    () =>
      localRecipes
        ? rankRecipes({
            recipes: [...(ai?.pantryId === pantryId ? ai.recipes : []), ...localRecipes],
            pantry: items,
            listItems,
            today,
            prefs,
          })
        : [],
    [localRecipes, ai, pantryId, items, listItems, today, prefs],
  );
  const topRecipe = recipes[0] ?? null;
  // SRS 8.4 score 70: open list items tonight's top recipe needs.
  const recipeNeeds = useMemo(
    () =>
      topRecipe
        ? listItems.filter((l) => l.reason === 'recipe' && l.recipeId === topRecipe.recipe.id)
        : [],
    [listItems, topRecipe],
  );
  const ranked = useMemo(
    () => todayPriorities({ today, pantry: items, listItems, receipts, state, recipeNeeds }),
    [today, items, listItems, receipts, state, recipeNeeds],
  );
  /** The best-ranked recipe that uses this item (6c: the expiring card's "Make …"). */
  const recipeFor = (item: PantryItem) =>
    recipes.find((r) => r.used.some((u) => u.item.id === item.id))?.recipe ?? null;

  const setState = useCallback(
    (next: (s: TodayState) => TodayState) => {
      if (doc) writeTodayState(doc, me.user.id, next(readTodayState(doc, me.user.id, today)));
    },
    [doc, me.user.id, today],
  );
  const done = (key: string) => setState((s) => markDone(s, key, today));
  const undoDone = (key: string) => () => setState((s) => unmarkDone(s, key));

  if (status === 'loading') return <PageSkeleton />;

  const nameOf = (userId: string) =>
    userId === me.user.id
      ? t('today.activity.you')
      : (people.get(userId)?.name.split(' ')[0] ?? '?');

  function card(p: Priority, rank: 1 | 2 | 3) {
    const hero = rank === 1;
    const item = p.items[0];
    let tone: PriorityTone;
    let urgency: { icon: JSX.Element; text: string };
    let title: string;
    let reason: string;
    let buttons: JSX.Element;

    if (p.kind === 'expires' && item) {
      const overdue = (p.daysLeft ?? 0) < 0;
      tone = 'today';
      urgency = {
        icon: <WarnIcon size={15} />,
        text: overdue ? t('today.tags.overdue') : t('today.tags.today'),
      };
      title = overdue
        ? t('today.expires.overdueTitle', { name: item.name.toLowerCase() })
        : t('today.expires.title', { name: item.name.toLowerCase() });
      reason = overdue
        ? t('today.expires.overdueReason', { count: -(p.daysLeft ?? 0) })
        : t('today.expires.reason');
      const make = overdue ? null : recipeFor(item);
      buttons = (
        <>
          {make ? (
            <Button asChild size={hero ? 'md' : 'sm'}>
              <Link
                to={`/recipes/${encodeURIComponent(make.id)}`}
                aria-label={t('today.expires.makeLabel', { title: make.title, name: item.name })}
              >
                <PotIcon size={18} />
                {t('today.expires.make', { title: make.title })}
              </Link>
            </Button>
          ) : null}
          <Button
            variant={make ? 'secondary' : hero ? 'primary' : 'secondary'}
            size={hero ? 'md' : 'sm'}
            icon={<CheckIcon size={18} />}
            aria-label={t('today.actions.usedItLabel', { name: item.name })}
            onClick={() => {
              done(p.key);
              actions.usedIt(item, undoDone(p.key));
            }}
          >
            {t('today.actions.usedIt')}
          </Button>
          {hero ? (
            <Button
              variant="ghost"
              onClick={() => {
                setState((s) => snooze(s, p.key, today));
                toast({ message: t('today.toast.snoozed') });
              }}
            >
              {t('today.actions.snooze')}
            </Button>
          ) : null}
        </>
      );
    } else if (p.kind === 'ran_out' && item) {
      tone = 'out';
      urgency = { icon: <EmptyJarIcon size={15} />, text: t('today.tags.ranOut') };
      title = t('today.ranOut.title', { name: item.name.toLowerCase() });
      const listName = current.lists.find((l) => l.id === p.listItem?.listId)?.name;
      const lastBy = activity.find((a) => a.type === 'ran_out' && a.itemId === item.id)?.actorId;
      reason = p.listItem
        ? t('today.ranOut.reasonList', { list: listName ?? '' })
        : lastBy && lastBy !== me.user.id
          ? t('today.ranOut.reasonOther', { name: nameOf(lastBy) })
          : t('today.ranOut.reasonYou');
      const entry = p.listItem;
      buttons = (
        <>
          <Button
            size={hero ? 'md' : 'sm'}
            icon={entry ? <HandIcon size={18} /> : <ListIcon size={18} />}
            onClick={() => {
              done(p.key);
              if (entry) claim(entry, p.key);
              else void actions.addToList(item, { claim: true, alsoUndo: undoDone(p.key) });
            }}
          >
            {entry ? t('today.actions.claim') : t('today.actions.addClaim')}
          </Button>
          <Button
            variant="ghost"
            size={hero ? 'md' : 'sm'}
            onClick={() => {
              done(p.key);
              toast({
                message: t('today.toast.notNeeded'),
                action: { label: t('today.toast.undo'), onAction: undoDone(p.key) },
              });
            }}
          >
            {t('today.actions.notNeeded')}
          </Button>
        </>
      );
    } else if (p.kind === 'recipe_item' && p.listItem && topRecipe) {
      const entry = p.listItem;
      tone = 'plan';
      urgency = { icon: <CartIcon size={15} />, text: t('today.recipe.tag') };
      title = t('today.recipe.title', {
        name: entry.name.toLowerCase(),
        recipe: topRecipe.recipe.title.toLowerCase(),
      });
      reason = t('today.recipe.reason');
      buttons = (
        <Button
          size={hero ? 'md' : 'sm'}
          icon={<HandIcon size={18} />}
          onClick={() => {
            done(p.key);
            claim(entry, p.key);
          }}
        >
          {t('today.recipe.claim')}
        </Button>
      );
    } else if (p.kind === 'plan_soon') {
      tone = 'plan';
      urgency = {
        icon: <CalendarIcon size={15} />,
        text: t('today.tags.inDays', { count: p.daysLeft ?? 1 }),
      };
      const names = p.items.map((i) => i.name.toLowerCase());
      const shown =
        names.length <= 2
          ? names.join(` ${t('common.and')} `)
          : t('today.plan.more', { names: names.slice(0, 2).join(', '), count: names.length - 2 });
      title = t('today.plan.title', { names: shown });
      const day = weekday(p.items[p.items.length - 1]!.expiresOn);
      reason =
        p.items.length === 1
          ? t('today.plan.reasonOne', { day })
          : p.items.length === 2
            ? t('today.plan.reasonTwo', { day })
            : t('today.plan.reasonMany', { day });
      const remindDay = weekday(p.remindOn!);
      buttons = (
        <Button
          variant="secondary"
          size={hero ? 'md' : 'sm'}
          icon={<BellIcon size={18} />}
          onClick={() => {
            // Milestone 8 turns this into a real reminder; until then it comes back that day.
            setState((s) => snooze(s, p.key, today, p.remindOn!));
            toast({ message: t('today.toast.reminded', { day: remindDay }) });
          }}
        >
          {t('today.actions.remind', { day: remindDay })}
        </Button>
      );
    } else {
      const r = p.receipt!;
      tone = 'review';
      const lines = r.lines.filter(
        (l) => l.kind === 'item' && l.pantryItemId && !l.confirmed,
      ).length;
      urgency = { icon: <WarnIcon size={15} />, text: t('today.tags.review') };
      title = t('today.review.title', { store: r.storeName || t('review.unknownStore') });
      reason = t('today.review.reason', { count: lines });
      buttons = (
        <Button asChild size={hero ? 'md' : 'sm'}>
          <Link to={`/scan/review?receipt=${r.id}`}>{t('today.actions.review')}</Link>
        </Button>
      );
    }

    return (
      <PriorityCard
        key={p.key}
        rank={rank}
        tone={tone}
        urgency={urgency}
        title={title}
        reason={reason}
        actions={buttons}
        size={hero ? 'hero' : 'compact'}
      />
    );
  }

  function claim(entry: ListItem, key: string) {
    const handle = getDoc(listDocName(entry.listId));
    void handle.ready.then(() => {
      updateListItem(handle.doc, entry.id, claimPatch(me.user.id));
      toast({
        message: t('today.toast.claimed', { name: entry.name }),
        action: {
          label: t('today.toast.undo'),
          onAction: () => {
            updateListItem(handle.doc, entry.id, unclaimPatch());
            undoDone(key)();
          },
        },
      });
    });
  }

  const onShelf = items.filter((i) => i.status === 'active' || i.status === 'out');
  const { active, doneCount, total } = ranked;
  const ranks = [1, 2, 3] as const;
  const heading =
    total === 0
      ? t('today.nothingUrgent')
      : active.length === 0
        ? t('today.allDone')
        : t('today.heading', { count: total });

  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-6 page-x pb-8 pt-6 lg:pt-7">
      {!isDesktop ? <MobileTopBar /> : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-semibold text-secondary lg:text-lg">
            {longDate(today, !isDesktop)} · {current.pantry.name}
          </p>
          <h1 className="mt-1 text-[2rem] leading-[1.1] lg:text-[4rem]">{heading}</h1>
        </div>
        {total > 0 ? <ProgressDots total={total} done={doneCount} /> : null}
      </div>

      <section
        id="priorities"
        tabIndex={-1}
        aria-label={t('today.priorities')}
        className="flex flex-col gap-4 outline-none lg:gap-6"
      >
        {status === 'error' ? (
          <ErrorState message={t('today.storageError')} onRetry={retry} />
        ) : onShelf.length === 0 ? (
          <EmptyState
            title={t('today.emptyTitle')}
            body={t('today.emptyBody')}
            action={
              <Button asChild>
                <Link to="/scan">
                  <ScanIcon size={22} />
                  {t('today.emptyAction')}
                </Link>
              </Button>
            }
          />
        ) : total === 0 ? (
          // TOD-9
          <EmptyState
            title={t('today.nothingUrgent')}
            body={t('today.nothingUrgentBody')}
            action={
              <Button asChild>
                <Link to="/scan">
                  <ScanIcon size={22} />
                  {t('today.scanAction')}
                </Link>
              </Button>
            }
          />
        ) : active.length === 0 ? (
          <p className="text-lg text-ink">{t('today.allDoneBody')}</p>
        ) : (
          <>
            {active[0] ? card(active[0], ranks[doneCount]!) : null}
            {active.length > 1 ? (
              <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
                {active.slice(1).map((p, i) => card(p, ranks[doneCount + i + 1]!))}
              </div>
            ) : null}
          </>
        )}
      </section>

      {onShelf.length > 0 ? (
        <section aria-labelledby="timeline-title" className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="timeline-title" className="text-[1.75rem] lg:text-[2rem]">
                {t('today.timeline.title')}
              </h2>
              <p className="text-sm text-secondary lg:text-base">{t('today.timeline.helper')}</p>
            </div>
            <Button
              asChild
              variant="secondary"
              size="sm"
              className="shrink-0 self-start whitespace-nowrap sm:self-auto"
            >
              <Link to="/pantry">
                <ArrowRightIcon size={18} />
                {t('today.timeline.viewPantry')}
              </Link>
            </Button>
          </div>
          <ShelfTimeline items={items} today={today} onOpen={setEditing} />
          <ShelfLegend />
        </section>
      ) : null}

      {isDesktop ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <ListPreview
            items={byList[current.pantry.homeListId] ?? []}
            listId={current.pantry.homeListId}
          />
          <ActivityFeed activity={activity} today={today} nameOf={nameOf} />
        </div>
      ) : null}

      <ItemSheet
        open={editing !== null}
        mode="edit"
        item={editing}
        lists={current.lists}
        defaultListId={current.pantry.homeListId}
        today={today}
        onClose={() => setEditing(null)}
        onSave={(form: ItemForm, meta) => {
          if (editing) actions.save(form, meta.estimated, editing);
          setEditing(null);
        }}
        onRanOut={
          editing
            ? () => {
                actions.ranOut(editing);
                setEditing(null);
              }
            : undefined
        }
        onDelete={
          editing
            ? () => {
                actions.remove(editing);
                setEditing(null);
              }
            : undefined
        }
      />
    </div>
  );
}

/** TOD-10 mobile top bar: wordmark, text size, bell, account. */
function MobileTopBar() {
  const { t } = useTranslation();
  const me = useMe();
  const { textSize, setTextSize } = useUiSettings();
  const next = TEXT_SIZES[(TEXT_SIZES.indexOf(textSize) + 1) % TEXT_SIZES.length]!;
  return (
    // flex-wrap: at the largest text size the buttons may drop below the logo rather than
    // push past the screen edge (A11Y-6).
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-3">
      <Wordmark size={28} fixed />
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={t('today.textSize', { size: t(`textSize.${textSize}`) })}
          onClick={() => setTextSize(next)}
          className="flex size-11 items-center justify-center rounded-xl bg-white font-semibold text-ink bordered"
        >
          Aa
        </button>
        <Link
          to="/reminders"
          aria-label={t('nav.reminders')}
          className="flex size-11 items-center justify-center rounded-xl bg-white text-ink bordered"
        >
          <BellIcon size={22} />
        </Link>
        <Link
          to="/profile"
          aria-label={t('nav.account', { name: me.user.displayName })}
          className="rounded-chip"
        >
          <Avatar initial={me.user.avatarInitial} tone="periwinkle" size={44} />
        </Link>
      </div>
    </div>
  );
}

/** TOD-8 (web): the home list, four rows, unclaimed flagged. */
function ListPreview({ items, listId }: { items: ListItem[]; listId: string }) {
  const { t } = useTranslation();
  const me = useMe();
  const people = usePeople(me);
  const open = items.filter((i) => !i.checked);
  return (
    <section
      aria-labelledby="list-preview"
      className="rounded-hero border-2 border-line bg-white p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="list-preview" className="text-[1.625rem]">
          {t('today.list.title', { count: open.length })}
        </h2>
        <Link
          to={`/lists/${listId}`}
          className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-navy"
        >
          <ArrowRightIcon size={18} />
          {t('today.list.open')}
        </Link>
      </div>
      {open.length === 0 ? (
        <p className="mt-3 text-secondary">{t('today.list.empty')}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {open.slice(0, 4).map((i) => {
            const who = i.claimedBy ? people.get(i.claimedBy) : null;
            return (
              <li key={i.id} className="flex min-h-9 items-center justify-between gap-3">
                <span className="font-semibold text-ink">
                  {i.name}
                  {i.quantity !== null ? (
                    <span className="ml-1.5 font-normal text-secondary">
                      {i.unit ? `${i.quantity} ${i.unit}` : `× ${i.quantity}`}
                    </span>
                  ) : null}
                </span>
                {i.claimedBy ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-ink">
                    {who ? <Avatar initial={who.initial} tone={who.tone} size={22} /> : null}
                    {i.claimedBy === me.user.id
                      ? t('lists.claim.you')
                      : t('lists.claim.other', {
                          name: who?.name.split(' ')[0] ?? t('lists.formerMember'),
                        })}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-terra-dark">
                    <WarnIcon size={15} />
                    {t('today.list.unclaimed')}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** TOD-8 (web): "Since yesterday", the last four events across your lists. */
function ActivityFeed({
  activity,
  today,
  nameOf,
}: {
  activity: Activity[];
  today: string;
  nameOf: (userId: string) => string;
}) {
  const { t } = useTranslation();
  const since = new Date(`${today}T00:00:00`);
  since.setDate(since.getDate() - 1);
  const recent = activity
    .filter(
      (a) =>
        new Date(a.createdAt) >= since &&
        ['used', 'ran_out', 'bought', 'scanned', 'cooked'].includes(a.type),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);
  return (
    <section aria-labelledby="since-yesterday" className="rounded-hero bg-sage p-6 text-olive-dark">
      <h2 id="since-yesterday" className="text-[1.625rem]">
        {t('today.activity.title')}
      </h2>
      {recent.length === 0 ? (
        <p className="mt-3">{t('today.activity.empty')}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {recent.map((a) => (
            <li key={a.id} className="flex items-center gap-2">
              <CheckIcon size={16} className="shrink-0" />
              <span>
                {t(`today.activity.${a.type}`, {
                  actor: nameOf(a.actorId),
                  subject: a.subject.toLowerCase(),
                })}
                <span className="text-sm"> · {formatTime(a.createdAt)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
