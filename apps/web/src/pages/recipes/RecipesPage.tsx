import { matchRecipe, readiness, type RankedRecipe } from '@shelf-life/ranking';
import { daysLeft } from '@shelf-life/shared';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../../components/Button/Button';
import { Chip } from '../../components/Chip/Chip';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import {
  CheckIcon,
  HeartIcon,
  PotIcon,
  RefreshIcon,
  ScanIcon,
  SparkIcon,
  WarnIcon,
} from '../../components/icons';
import { HeartButton } from '../../components/Recipe/HeartButton';
import { RecipeHeroCard, RecipeRow, SavedRecipeCard } from '../../components/Recipe/RecipeCards';
import { SavesChips } from '../../components/Recipe/SavesChips';
import { SearchField } from '../../components/SearchField/SearchField';
import { PageSkeleton } from '../../components/Skeleton/Skeleton';
import { StatusTag } from '../../components/StatusTag/StatusTag';
import { agoText, cuisineName, recipeNote, whySentence } from '../../features/recipes/text';
import { useRecipeActions } from '../../features/recipes/useRecipeActions';
import { usePantryRecipes } from '../../features/recipes/useRecipes';
import { cx } from '../../lib/cx';
import { usePeople } from '../../lib/people';
import { useMe } from '../../lib/session';
import { useRecipeStore } from '../../stores/recipes';

/** REC-4: #1 plus runners-up #2–#6. */
const SHOWN = 6;

type Data = ReturnType<typeof usePantryRecipes>;

/**
 * Cook with what's left (SRS 6.9, Figma mobile 08, web 12) and Saved recipes (SRS 6.14, mobile
 * 17, web 18): one page with two tabs. Recipes are ranked on this device (SRS 8.5) from the last
 * AI answer plus the local set, so it works offline and with AI off (rule 2).
 */
export function RecipesPage() {
  const { t } = useTranslation();
  const tab = useLocation().pathname.startsWith('/recipes/saved') ? 'saved' : 'tonight';
  const data = usePantryRecipes();
  const savedCount = Object.keys(useRecipeStore((s) => s.saved)).length;
  const { check, status } = data;

  // ANA-5: ask AI when the answer is missing or stale (cached 6 h, or until the pantry changes).
  useEffect(() => {
    if (tab === 'tonight' && status === 'ready') void check();
  }, [tab, status, check]);

  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-5 page-x pb-8 pt-6 lg:gap-6 lg:pt-7">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[2rem] leading-[1.1] lg:text-[4rem]">
            {tab === 'saved' ? t('pages.savedRecipes') : t('recipes.title')}
          </h1>
          {tab === 'tonight' ? (
            <p className="mt-2 hidden text-lg text-secondary lg:block">{t('recipes.subtitle')}</p>
          ) : null}
        </div>
        {tab === 'tonight' ? <AiStatus data={data} /> : null}
      </div>

      <nav aria-label={t('recipes.tabs.label')}>
        <ul className="flex gap-1 rounded-card bg-shelf p-1 lg:inline-flex">
          {(
            [
              ['tonight', '/recipes', <PotIcon key="i" size={18} />, t('recipes.tabs.tonight')],
              [
                'saved',
                '/recipes/saved',
                <HeartIcon key="i" size={18} fill="currentColor" />,
                t('recipes.tabs.saved', { count: savedCount }),
              ],
            ] as const
          ).map(([key, to, icon, label]) => (
            <li key={key} className="flex-1 lg:flex-none">
              <Link
                to={to}
                aria-current={tab === key ? 'page' : undefined}
                className={cx(
                  'flex min-h-11 items-center justify-center gap-2 rounded-button px-4 font-semibold',
                  tab === key ? 'border-2 border-navy bg-white text-navy' : 'text-ink',
                )}
              >
                {icon}
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div id="recipes-ranked" tabIndex={-1} className="flex flex-col gap-5 outline-none lg:gap-6">
        {status === 'loading' ? (
          <PageSkeleton />
        ) : status === 'error' ? (
          <ErrorState message={t('recipes.error')} onRetry={data.retry} />
        ) : tab === 'tonight' ? (
          <Tonight data={data} />
        ) : (
          <Saved data={data} />
        )}
      </div>
    </div>
  );
}

/** REC-1: "AI checked 42 items · just now" and Re-check (to the analysis page). */
function AiStatus({ data }: { data: Data }) {
  const { t } = useTranslation();
  const text =
    data.phase === 'checking'
      ? t('recipes.pill.checking')
      : data.ai
        ? t('recipes.pill.checked', {
            count: data.ai.itemCount,
            when: agoText(t, data.ai.createdAt),
          })
        : data.online
          ? t('recipes.pill.local')
          : t('recipes.pill.offline');
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p
        role="status"
        data-testid="ai-status"
        className="inline-flex min-h-9 items-center gap-2 rounded-chip bg-periwinkle px-3.5 text-sm font-semibold text-ink"
      >
        <SparkIcon size={16} />
        {text}
      </p>
      {data.online ? (
        <Button asChild variant="secondary" size="sm">
          <Link to="/recipes/analyze">
            <RefreshIcon size={18} />
            {t('recipes.recheck')}
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

function Tonight({ data }: { data: Data }) {
  const { t } = useTranslation();
  const me = useMe();
  const people = usePeople(me);
  const saved = useRecipeStore((s) => s.saved);
  const { toggleSave, addMissing } = useRecipeActions(data.lists);
  const { prefs, updatePrefs, ranked, rescue, items } = data;
  const shown = ranked.slice(0, SHOWN);
  const top = shown[0];
  const personName = (id: string) =>
    id === me.user.id ? t('today.activity.you') : (people.get(id)?.name.split(' ')[0] ?? '?');
  const save = (r: RankedRecipe) => (
    <HeartButton
      title={r.recipe.title}
      saved={!!saved[r.recipe.id]}
      onToggle={() => toggleSave(r.recipe)}
    />
  );

  return (
    <>
      <section
        aria-label={t('recipes.rescue')}
        className="flex flex-col gap-3 rounded-card bg-shelf p-4 lg:flex-row lg:items-center lg:justify-between lg:px-5"
      >
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
          <h2 className="font-ui text-base font-semibold">{t('recipes.rescue')}</h2>
          {rescue.length > 0 ? (
            <SavesChips
              short
              max={6}
              saves={rescue.map((item) => ({
                item,
                ingredient: { name: item.name, amount: null, unit: null },
                daysLeft: daysLeft(item, data.today),
              }))}
            />
          ) : (
            <p className="text-sm text-secondary">{t('recipes.rescueNone')}</p>
          )}
        </div>
        {/* REC-2: active preference chips, toggled here and saved to the account. */}
        <div role="group" aria-label={t('recipes.prefs.label')} className="flex flex-wrap gap-2">
          <Chip
            selected={prefs.diet === 'vegetarian' || prefs.diet === 'vegan'}
            onToggle={() =>
              updatePrefs({
                diet: prefs.diet === 'vegetarian' || prefs.diet === 'vegan' ? 'any' : 'vegetarian',
              })
            }
            icon={<CheckIcon size={16} />}
          >
            {prefs.diet === 'vegan' ? t('recipes.diets.vegan') : t('recipes.prefs.vegetarian')}
          </Chip>
          <Chip
            selected={prefs.maxMinutes !== null && prefs.maxMinutes <= 30}
            onToggle={() =>
              updatePrefs({
                maxMinutes: prefs.maxMinutes !== null && prefs.maxMinutes <= 30 ? null : 30,
              })
            }
            icon={<CheckIcon size={16} />}
          >
            {t('recipes.prefs.under30')}
          </Chip>
          <Chip
            selected={prefs.cuisines.length === 0}
            onToggle={() => updatePrefs({ cuisines: [] })}
            icon={<CheckIcon size={16} />}
          >
            {prefs.cuisines.length === 0
              ? t('recipes.prefs.anyCuisine')
              : t('recipes.prefs.cuisines', {
                  names: prefs.cuisines.map((c) => cuisineName(t, c)).join(', '),
                })}
          </Chip>
        </div>
      </section>

      <section aria-label={t('recipes.title')} className="flex flex-col gap-5">
        {!top ? (
          <EmptyState
            title={t('recipes.emptyTitle')}
            body={items.length === 0 ? t('recipes.emptyBody') : t('recipes.emptyPrefsBody')}
            action={
              items.length === 0 ? (
                <Button asChild>
                  <Link to="/scan">
                    <ScanIcon size={22} />
                    {t('recipes.emptyAction')}
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <RecipeHeroCard
              ranked={top}
              why={whySentence(t, top.why)}
              saveButton={save(top)}
              onAddMissing={(m) => void addMissing(m.ingredient, top.recipe)}
            />
            {shown.length > 1 ? (
              <div className="flex flex-col gap-2">
                <h2 className="font-ui text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-secondary">
                  {t('recipes.alsoGood')}
                </h2>
                <ol className="rounded-hero bg-white bordered">
                  {shown.slice(1).map((r, i) => (
                    <RecipeRow
                      key={r.recipe.id}
                      ranked={r}
                      rank={i + 2}
                      note={recipeNote(t, r, personName)}
                    />
                  ))}
                </ol>
              </div>
            ) : null}
          </>
        )}
      </section>

      {/* REC-6 */}
      <p className="flex items-center gap-2 text-sm text-secondary">
        <SparkIcon size={16} />
        {data.ai ? t('recipes.footer') : t('recipes.footerLocal')}
      </p>
    </>
  );
}

type SavedFilter = 'all' | 'ready' | 'under20' | string;

/** SAV-1..SAV-5: saved recipes grouped by how ready they are, re-checked on every open. */
function Saved({ data }: { data: Data }) {
  const { t } = useTranslation();
  const saved = useRecipeStore((s) => s.saved);
  const { toggleSave } = useRecipeActions(data.lists);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SavedFilter>('all');

  const evaluated = useMemo(
    () =>
      Object.values(saved)
        .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
        .map((s) => {
          const m = matchRecipe(s.recipe, data.items, data.listItems, data.today);
          return { ...m, score: 0, why: [], readiness: readiness(m) };
        }),
    [saved, data.items, data.listItems, data.today],
  );
  const cuisines = [...new Set(evaluated.map((r) => r.recipe.cuisine))];
  const q = query.trim().toLowerCase();
  const visible = evaluated.filter(
    (r) =>
      (!q ||
        r.recipe.title.toLowerCase().includes(q) ||
        r.recipe.ingredients.some((i) => i.name.toLowerCase().includes(q))) &&
      (filter === 'all' ||
        (filter === 'ready' && r.readiness === 'ready') ||
        (filter === 'under20' && r.recipe.minutes <= 20) ||
        r.recipe.cuisine === filter),
  );

  if (evaluated.length === 0)
    return (
      <EmptyState
        icon={<HeartIcon size={32} />}
        title={t('recipes.saved.emptyTitle')}
        body={t('recipes.saved.emptyBody')}
        action={
          <Button asChild>
            <Link to="/recipes">{t('recipes.saved.emptyAction')}</Link>
          </Button>
        }
      />
    );

  const groups = (['ready', 'almost', 'needs_more'] as const)
    .map((g) => ({ g, list: visible.filter((r) => r.readiness === g) }))
    .filter((x) => x.list.length > 0);
  const groupTitle = {
    ready: 'recipes.saved.ready',
    almost: 'recipes.saved.almost',
    needs_more: 'recipes.saved.more',
  } as const;

  return (
    <>
      <SearchField
        label={t('recipes.saved.search')}
        placeholder={t('recipes.saved.search')}
        hideLabel
        clearLabel={t('recipes.saved.clear')}
        onSearch={setQuery}
      />
      <div
        role="group"
        aria-label={t('recipes.saved.filters')}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0"
      >
        <Chip selected={filter === 'all'} onToggle={() => setFilter('all')}>
          {t('recipes.saved.all', { count: evaluated.length })}
        </Chip>
        <Chip selected={filter === 'ready'} onToggle={() => setFilter('ready')}>
          {t('recipes.saved.readyNow', {
            count: evaluated.filter((r) => r.readiness === 'ready').length,
          })}
        </Chip>
        <Chip selected={filter === 'under20'} onToggle={() => setFilter('under20')}>
          {t('recipes.saved.under20')}
        </Chip>
        {cuisines.map((c) => (
          <Chip key={c} selected={filter === c} onToggle={() => setFilter(c)}>
            {cuisineName(t, c)}
          </Chip>
        ))}
      </div>
      {groups.length === 0 ? (
        <p role="status" className="text-secondary">
          {t('recipes.saved.noMatch')}
        </p>
      ) : (
        groups.map(({ g, list }) => (
          <section key={g} className="flex flex-col gap-3">
            <h2 className="font-ui text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-secondary">
              {t(groupTitle[g], { count: list.length })}
            </h2>
            <ul className="grid gap-3 lg:grid-cols-2">
              {list.map((r) => (
                <SavedRecipeCard
                  key={r.recipe.id}
                  ranked={r}
                  status={<SavedStatus r={r} />}
                  saveButton={
                    <HeartButton
                      title={r.recipe.title}
                      saved
                      onToggle={() => toggleSave(r.recipe)}
                    />
                  }
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}

/** SAV-4 status chip: "Spinach expires today", "You have everything", "Need parmesan". */
function SavedStatus({ r }: { r: RankedRecipe & { readiness: string } }) {
  const { t } = useTranslation();
  const soonest = r.saves[0];
  if (soonest && soonest.daysLeft <= 0)
    return (
      <StatusTag status="today" text={t('recipes.saved.expires', { name: soonest.item.name })} />
    );
  if (r.missing.length === 0)
    return <StatusTag status="fresh" text={t('recipes.saved.everything')} />;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[0.625rem] bg-apricot py-1.5 pl-2 pr-2.5 text-[0.8125rem] font-semibold text-apricot-dark">
      <WarnIcon size={15} />
      {t('recipes.saved.need', {
        names: r.missing
          .slice(0, 2)
          .map((m) => m.ingredient.name.toLowerCase())
          .join(', '),
      })}
    </span>
  );
}
