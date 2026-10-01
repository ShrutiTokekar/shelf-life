import {
  countByCategory,
  countByList,
  filterItems,
  groupItems,
  NO_FILTERS,
  shelfFor,
  SORTS,
  todayIso,
  type Category,
  type Group,
  type PantryFilters,
  type PantryItem,
  type Shelf as ShelfKey,
  type Sort,
} from '@shelf-life/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button/Button';
import { categoryIcon, CategoryChips } from '../../components/CategoryChips/CategoryChips';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import {
  BoxIcon,
  ClockIcon,
  EmptyJarIcon,
  GridIcon,
  LeafIcon,
  PlusIcon,
  ScanIcon,
  SnowIcon,
  WarnIcon,
  FridgeIcon,
} from '../../components/icons';
import { IconButton } from '../../components/IconButton/IconButton';
import { ItemSheet } from '../../components/ItemSheet/ItemSheet';
import { JarCard } from '../../components/JarCard/JarCard';
import { ListFilterChips } from '../../components/ListFilterChips/ListFilterChips';
import { SearchField } from '../../components/SearchField/SearchField';
import { Select } from '../../components/Select/Select';
import { SegmentedControl } from '../../components/SegmentedControl/SegmentedControl';
import { Shelf, type ShelfTone } from '../../components/Shelf/Shelf';
import { PageSkeleton } from '../../components/Skeleton/Skeleton';
import { openEntryFor } from '@shelf-life/docs';
import { useListsItems, usePantry } from '../../lib/sync/useDocs';
import { DESKTOP_QUERY, useMediaQuery } from '../../lib/useMediaQuery';
import { useCurrentPantry } from '../../lib/pantries';
import { usePeople } from '../../lib/people';
import { useMe } from '../../lib/session';
import type { PantryHighlightState } from '../../stores/reviewDraft';
import { DevSeedButton } from './DevSeedButton';
import { usePantryActions } from './usePantryActions';

const SHELF_ICON: Record<ShelfKey, JSX.Element> = {
  today: <WarnIcon size={18} />,
  soon: <ClockIcon size={18} />,
  fresh: <LeafIcon size={18} />,
  out: <EmptyJarIcon size={18} />,
};
const LOCATION_ICON = {
  fridge: <FridgeIcon size={18} />,
  freezer: <SnowIcon size={18} />,
  cupboard: <BoxIcon size={18} />,
};

const HIGHLIGHT_MS = 3000;

type SheetState = { mode: 'add' } | { mode: 'edit'; itemId: string } | null;

/** Pantry (SRS 6.3, Figma mobile 03 / web 13). */
export function PantryPage() {
  const { t } = useTranslation();
  const me = useMe();
  const current = useCurrentPantry();
  const pantryId = current.pantry.id;
  // SHR-5: "Can view" members of a shared home see the pantry but can't change it.
  const readOnly = !current.pantry.canEdit;
  const { doc, items, status, retry } = usePantry(pantryId);
  const today = todayIso();
  const [filters, setFilters] = useState<PantryFilters>(NO_FILTERS);
  const [sort, setSort] = useState<Sort>('expiry');
  const [params, setParams] = useSearchParams();
  // "Add manually" from the scanner (SCN-7) opens the add sheet straight away.
  const [sheet, setSheet] = useState<SheetState>(() =>
    params.get('add') === '1' ? { mode: 'add' } : null,
  );
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  // REV-7: jars just added from a receipt are highlighted for 3 s.
  const location = useLocation();
  const navigate = useNavigate();
  const [highlight] = useState<ReadonlySet<string>>(
    () => new Set((location.state as PantryHighlightState | null)?.highlight ?? []),
  );
  const [highlightOn, setHighlightOn] = useState(highlight.size > 0);
  useEffect(() => {
    if (!highlightOn) return;
    // Drop the state so a reload or Back doesn't highlight them again.
    navigate({ search: location.search }, { replace: true, state: null });
    const id = setTimeout(() => setHighlightOn(false), HIGHLIGHT_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightOn]);

  const lists = current.lists;
  const listById = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists]);
  const people = usePeople(me);

  const outListIds = useMemo(
    () => [...new Set(items.filter((i) => shelfFor(i, today) === 'out').map((i) => i.listId))],
    [items, today],
  );
  const listItems = useListsItems(outListIds);
  const actions = usePantryActions({ doc, pantryId, userId: me.user.id, today, lists });

  const onSearch = useCallback((query: string) => setFilters((f) => ({ ...f, query })), []);
  const onShelf = useMemo(() => filterItems(items, NO_FILTERS), [items]);
  const visible = useMemo(() => filterItems(items, filters), [items, filters]);
  const groups = useMemo(() => groupItems(visible, sort, today), [visible, sort, today]);
  const listCounts = useMemo(() => countByList(items, filters), [items, filters]);
  const categoryCounts = useMemo(() => countByCategory(items, filters), [items, filters]);
  const editing =
    sheet?.mode === 'edit' ? (items.find((i) => i.id === sheet.itemId) ?? null) : null;
  const filtered =
    filters.listId !== null || filters.category !== null || filters.query.trim() !== '';

  if (status === 'loading') return <PageSkeleton />;

  function renderJar(item: PantryItem) {
    // A jar whose list was deleted says so, rather than borrowing another list's label (PAN-7).
    const list = listById.get(item.listId) ?? {
      name: t('pantry.removedList'),
      color: 'gray' as const,
    };
    const entry = openEntryFor(listItems[item.listId] ?? [], item.id);
    return (
      <JarCard
        key={item.id}
        item={item}
        status={shelfFor(item, today)}
        today={today}
        list={{ name: list.name, color: list.color }}
        addedBy={people.get(item.addedBy) ?? null}
        onList={
          entry
            ? {
                claimedBy: entry.claimedBy
                  ? (people.get(entry.claimedBy)?.name.split(' ')[0] ?? null)
                  : null,
              }
            : null
        }
        onUsed={() => actions.usedIt(item)}
        onEdit={() => setSheet({ mode: 'edit', itemId: item.id })}
        onAddToList={() => void actions.addToList(item)}
        readOnly={readOnly}
        highlighted={highlightOn && highlight.has(item.id)}
      />
    );
  }

  function groupMeta(group: Group): {
    tone: ShelfTone;
    icon: JSX.Element;
    title: string;
    helper: string;
  } {
    const key = group.key;
    if (key === 'today' || key === 'soon' || key === 'fresh' || key === 'out') {
      return {
        tone: key,
        icon: SHELF_ICON[key],
        title: t(`pantry.shelves.${key}.title`),
        helper: t(`pantry.shelves.${key}.helper`),
      };
    }
    if (key === 'az')
      return {
        tone: 'neutral',
        icon: <GridIcon size={18} />,
        title: t('pantry.shelves.az.title'),
        helper: t('pantry.shelves.az.helper'),
      };
    if (key in LOCATION_ICON) {
      return {
        tone: 'neutral',
        icon: LOCATION_ICON[key as keyof typeof LOCATION_ICON],
        title: t(`locations.${key}`),
        helper: t('pantry.count', { count: group.items.length }),
      };
    }
    return {
      tone: 'neutral',
      icon: categoryIcon[key as Category],
      title: t(`categories.${key}`),
      helper: t('pantry.count', { count: group.items.length }),
    };
  }

  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-3.5 page-x pb-8 pt-8 lg:gap-6 lg:pt-7">
      <div className="flex flex-col gap-3.5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[2rem] leading-[1.1] lg:text-[4rem]">{t('pantry.title')}</h1>
            <p className="mt-0.5 text-sm font-medium text-secondary lg:mt-1.5 lg:text-lg">
              {t('pantry.summary', { count: onShelf.length })}
            </p>
            {current.pantries.length > 1 ? (
              // SHR-6: someone on another person's home list can open that pantry too.
              <Select
                inline
                className="mt-1 justify-start"
                label={t('pantry.whichPantry')}
                value={pantryId}
                onChange={current.setPantry}
                options={current.pantries.map((p) => ({
                  value: p.id,
                  label: p.own
                    ? t('pantry.yourPantry')
                    : t('pantry.sharedPantry', { name: p.name }),
                }))}
              />
            ) : null}
            {readOnly ? (
              <p className="mt-1 text-sm text-ink">
                {t('pantry.viewOnly', { name: current.pantry.name })}
              </p>
            ) : null}
          </div>
          <IconButton
            hidden={readOnly}
            className="size-12 rounded-[0.875rem] border-2 border-navy text-navy lg:hidden"
            icon={<PlusIcon size={22} />}
            label={t('pantry.addItem')}
            onClick={() => setSheet({ mode: 'add' })}
          />
        </div>
        <div className="flex items-end gap-3">
          <SearchField
            className="flex-1 lg:w-80 lg:flex-none"
            label={t('pantry.search')}
            // Mobile 03 shows "Search pantry" in the field; web 13 has a visible label + "e.g. yogurt".
            placeholder={isDesktop ? t('pantry.searchPlaceholder') : t('pantry.search')}
            clearLabel={t('pantry.clearSearch')}
            hideLabel
            onSearch={onSearch}
          />
          <Button
            variant="secondary"
            size="sm"
            className={readOnly ? 'hidden' : 'max-lg:hidden'}
            icon={<PlusIcon size={20} />}
            onClick={() => setSheet({ mode: 'add' })}
          >
            {t('pantry.addItem')}
          </Button>
        </div>
      </div>

      <ListFilterChips
        lists={lists}
        value={filters.listId}
        onChange={(listId) => setFilters((f) => ({ ...f, listId }))}
        counts={listCounts}
      />
      <SegmentedControl
        className="lg:w-fit"
        label={t('pantry.sort')}
        value={sort}
        onChange={setSort}
        options={SORTS.map((s) => ({ value: s, label: t(`pantry.sorts.${s}`) }))}
      />
      <CategoryChips
        value={filters.category}
        onChange={(category) => setFilters((f) => ({ ...f, category }))}
        counts={categoryCounts}
      />

      <div id="shelves" tabIndex={-1} className="mt-1 flex flex-col gap-5 outline-none lg:gap-6">
        {status === 'error' ? (
          <ErrorState message={t('pantry.storageError')} onRetry={retry} />
        ) : onShelf.length === 0 ? (
          <EmptyState
            title={t('pantry.emptyTitle')}
            body={t('pantry.emptyBody')}
            action={
              readOnly ? undefined : (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex flex-wrap justify-center gap-3">
                    <Button icon={<PlusIcon size={20} />} onClick={() => setSheet({ mode: 'add' })}>
                      {t('pantry.addItem')}
                    </Button>
                    <Button asChild variant="secondary">
                      <Link to="/scan">
                        <ScanIcon size={22} />
                        {t('pantry.scanReceipt')}
                      </Link>
                    </Button>
                  </div>
                  {import.meta.env.DEV && doc && current.pantry.own ? (
                    <DevSeedButton doc={doc} me={me} />
                  ) : null}
                </div>
              )
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState
            title={t('pantry.noMatches')}
            body={t('pantry.emptyBody')}
            action={
              <Button variant="secondary" onClick={() => setFilters(NO_FILTERS)}>
                {t('pantry.clearFilters')}
              </Button>
            }
          />
        ) : (
          groups
            .filter((g) => sort === 'expiry' || g.items.length > 0)
            .map((group) => {
              const meta = groupMeta(group);
              return (
                <Shelf
                  key={group.key}
                  tone={meta.tone}
                  icon={meta.icon}
                  title={meta.title}
                  helper={meta.helper}
                  count={group.items.length}
                  limit={
                    sort === 'expiry' && group.key === 'fresh' && !filtered && !highlightOn
                      ? 4
                      : undefined
                  }
                >
                  {group.items.map(renderJar)}
                </Shelf>
              );
            })
        )}
      </div>

      <ItemSheet
        open={sheet !== null && (sheet.mode === 'add' || editing !== null)}
        mode={sheet?.mode ?? 'add'}
        item={editing}
        lists={lists}
        defaultListId={filters.listId ?? current.pantry.homeListId}
        today={today}
        onClose={() => {
          setSheet(null);
          if (params.has('add')) setParams({}, { replace: true });
        }}
        onSave={(form, meta) => {
          actions.save(form, meta.estimated, editing);
          setSheet(null);
        }}
        onRanOut={
          editing
            ? () => {
                actions.ranOut(editing);
                setSheet(null);
              }
            : undefined
        }
        onDelete={
          editing
            ? () => {
                actions.remove(editing);
                setSheet(null);
              }
            : undefined
        }
      />
    </div>
  );
}
