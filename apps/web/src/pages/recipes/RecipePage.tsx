import { matchRecipe } from '@shelf-life/ranking';
import type { Recipe, RecipeIngredient } from '@shelf-life/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import {
  CartIcon,
  CheckIcon,
  ChevronLeftIcon,
  ClockIcon,
  PlusIcon,
  SparkIcon,
  UsersIcon,
} from '../../components/icons';
import { HeartButton } from '../../components/Recipe/HeartButton';
import { RecipeTile } from '../../components/Recipe/RecipeTile';
import { SavesChips } from '../../components/Recipe/SavesChips';
import { PageSkeleton } from '../../components/Skeleton/Skeleton';
import { cuisineName } from '../../features/recipes/text';
import { useRecipeActions } from '../../features/recipes/useRecipeActions';
import { loadLocalRecipes, usePantryRecipes } from '../../features/recipes/useRecipes';
import { fetchRecipe } from '../../lib/api';
import { cx } from '../../lib/cx';
import { useRecipeStore } from '../../stores/recipes';

type Load = { state: 'loading' } | { state: 'ready'; recipe: Recipe } | { state: 'missing' };
type Loaded = { id: string; load: Load };

/** A recipe from this device first (local set, saved, recently seen), then the API. */
function useRecipe(id: string): Load {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    let live = true;
    const setLoad = (load: Load) => setLoaded({ id, load });
    void (async () => {
      const local = (await loadLocalRecipes()).find((r) => r.id === id);
      const { saved, seen } = useRecipeStore.getState();
      const onDevice = local ?? saved[id]?.recipe ?? seen[id];
      if (onDevice) {
        if (live) setLoad({ state: 'ready', recipe: onDevice });
        return;
      }
      try {
        const recipe = await fetchRecipe(id);
        useRecipeStore.getState().remember([recipe]);
        if (live) setLoad({ state: 'ready', recipe });
      } catch {
        if (live) setLoad({ state: 'missing' });
      }
    })();
    return () => {
      live = false;
    };
  }, [id]);
  return loaded && loaded.id === id ? loaded.load : { state: 'loading' };
}

const amountText = (i: RecipeIngredient) =>
  [i.amount !== null ? +i.amount.toFixed(2) : null, i.unit].filter((x) => x !== null).join(' ');

function timerText(seconds: number) {
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim() : `${m} min`;
}

/**
 * Full recipe (SRS 6.15, Figma mobile 15, web 17), the simple version for Milestone 6: title,
 * time, servings, diet and cuisine, what it saves, ingredients with have/missing and "+ List",
 * and numbered steps with their timings. Cook-along, scaling and AI chat come in Milestone 7.
 */
export function RecipePage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const load = useRecipe(id);
  const data = usePantryRecipes();
  const saved = useRecipeStore((s) => !!s.saved[id]);
  const { toggleSave, addMissing } = useRecipeActions(data.lists);

  if (load.state === 'loading' || data.status === 'loading') return <PageSkeleton />;
  if (load.state === 'missing')
    return (
      <div className="mx-auto w-full max-w-3xl page-x pb-8 pt-6">
        <h1 className="sr-only">{t('pages.recipe')}</h1>
        <EmptyState
          title={t('recipes.detail.notFound')}
          body={navigator.onLine ? '' : t('recipes.detail.offline')}
          action={
            <Button asChild>
              <Link to="/recipes">{t('recipes.detail.back')}</Link>
            </Button>
          }
        />
      </div>
    );

  const recipe = load.recipe;
  const match = matchRecipe(recipe, data.items, data.listItems, data.today);
  const have = new Set(match.used.map((u) => u.ingredient));
  const missing = new Map(match.missing.map((m) => [m.ingredient, m]));
  const assumed = new Set(match.assumed);

  return (
    <article className="mx-auto flex w-full max-w-5xl flex-col gap-6 page-x pb-8 pt-4 lg:pt-7">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/recipes"
          className="-ml-2 inline-flex min-h-11 items-center gap-2 px-2 font-semibold text-ink"
        >
          <ChevronLeftIcon size={22} />
          {t('recipes.detail.back')}
        </Link>
        <HeartButton title={recipe.title} saved={saved} onToggle={() => toggleSave(recipe)} />
      </div>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-8">
        <RecipeTile cuisine={recipe.cuisine} className="h-40 w-full lg:size-56" />
        <div className="flex flex-col gap-3">
          <h1 className="font-wordmark text-[2rem] leading-tight [overflow-wrap:anywhere] lg:text-[2.75rem]">
            {recipe.title}
          </h1>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-secondary">
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon size={18} />
              {t('recipes.minutes', { count: recipe.minutes })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <UsersIcon size={18} />
              {t('recipes.detail.serves', { count: recipe.servings })}
            </span>
            <span>{t(`recipes.diets.${recipe.diet}`)}</span>
            <span className="rounded-chip bg-shelf px-2.5 py-0.5 text-sm font-semibold text-ink">
              {cuisineName(t, recipe.cuisine)}
            </span>
          </p>
          {match.saves.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="font-semibold">
                {t('recipes.detail.savesCount', { count: match.saves.length })}
              </p>
              <SavesChips saves={match.saves} max={8} />
            </div>
          ) : null}
          {recipe.source === 'ai' ? (
            <p className="flex items-center gap-2 text-sm text-secondary">
              <SparkIcon size={16} />
              {t('recipes.detail.aiNote')}
            </p>
          ) : null}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
        <section aria-labelledby="ingredients" className="rounded-hero bg-white p-5 bordered">
          <h2 id="ingredients" className="text-2xl">
            {t('recipes.detail.ingredients')}
          </h2>
          <p className="mt-1 text-sm text-secondary">
            {t('recipes.haveOf', { have: match.have, total: match.total })}
          </p>
          <ul className="mt-3 flex flex-col">
            {recipe.ingredients.map((ing, i) => {
              const m = missing.get(ing);
              const got = have.has(ing);
              const label = got
                ? t('recipes.detail.have')
                : m
                  ? m.state === 'claimed' || m.state === 'on_list'
                    ? t('recipes.detail.onList')
                    : t('recipes.detail.missing')
                  : ing.basic
                    ? t('recipes.detail.basic')
                    : assumed.has(ing)
                      ? t('recipes.detail.assumed')
                      : t('recipes.detail.optional');
              return (
                <li
                  key={`${ing.name}-${i}`}
                  data-testid="ingredient"
                  className="flex min-h-12 items-center gap-3 border-line py-1.5 [&:not(:first-child)]:border-t"
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      'flex size-6 shrink-0 items-center justify-center rounded-full',
                      got
                        ? 'bg-sage text-olive-dark'
                        : m
                          ? 'bg-apricot text-apricot-dark'
                          : 'bg-shelf text-slate',
                    )}
                  >
                    {got ? (
                      <CheckIcon size={14} strokeWidth={3} />
                    ) : m ? (
                      <CartIcon size={14} />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{ing.name}</span>
                    {amountText(ing) ? (
                      <span className="text-secondary"> · {amountText(ing)}</span>
                    ) : null}
                    <span className="block text-xs text-secondary">{label}</span>
                  </span>
                  {m && (m.state === 'missing' || m.state === 'ran_out') ? (
                    <button
                      type="button"
                      onClick={() => void addMissing(ing, recipe)}
                      aria-label={t('recipes.addToListLabel', { name: ing.name })}
                      className="inline-flex min-h-11 items-center gap-1 rounded-button px-3 font-semibold text-navy bordered"
                    >
                      <PlusIcon size={16} />
                      {t('recipes.detail.addToList').replace('+ ', '')}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="steps" className="flex flex-col gap-3">
          <h2 id="steps" className="text-2xl">
            {t('recipes.detail.steps')}
          </h2>
          <ol className="flex flex-col gap-3">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-4 rounded-card bg-white p-4 bordered">
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-periwinkle font-display text-xl text-navy"
                >
                  {i + 1}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <h3 className="font-ui text-lg font-semibold">
                    <span className="sr-only">{`${t('recipes.detail.step', { n: i + 1 })}: `}</span>
                    {step.title}
                  </h3>
                  <p>{step.text}</p>
                  {step.timerSeconds ? (
                    <p className="mt-1 inline-flex items-center gap-1.5 self-start rounded-chip bg-shelf px-2.5 py-1 text-sm font-semibold">
                      <ClockIcon size={15} />
                      {t('recipes.detail.timer', { time: timerText(step.timerSeconds) })}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
          <p className="text-sm text-secondary">{t('recipes.detail.cookAlong')}</p>
        </section>
      </div>
    </article>
  );
}
