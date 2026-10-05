import { matchRecipe, type RecipeMatch } from '@shelf-life/ranking';
import {
  formatAmount,
  otherSystem,
  type Recipe,
  type RecipeIngredient,
} from '@shelf-life/shared';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import {
  CartIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  LeafIcon,
  PlusIcon,
  RefreshIcon,
  SparkIcon,
  UsersIcon,
} from '../../components/icons';
import { QuantityStepper } from '../../components/QuantityStepper/QuantityStepper';
import { HeartButton } from '../../components/Recipe/HeartButton';
import { RecipeTile } from '../../components/Recipe/RecipeTile';
import { SavesChips } from '../../components/Recipe/SavesChips';
import { StepIllustration } from '../../components/Recipe/StepIllustration';
import { TimerButton } from '../../components/Recipe/TimerButton';
import { PageSkeleton } from '../../components/Skeleton/Skeleton';
import { MadeThisSheet } from '../../features/cooking/MadeThisSheet';
import { cuisineName } from '../../features/recipes/text';
import { useRecipe } from '../../features/recipes/useRecipe';
import { useRecipeActions } from '../../features/recipes/useRecipeActions';
import { usePantryRecipes } from '../../features/recipes/useRecipes';
import { cx } from '../../lib/cx';
import { useMe } from '../../lib/session';
import { useReceipts } from '../../lib/sync/useDocs';
import { BottomSheet } from '../../components/BottomSheet/BottomSheet';
import { SwapCard } from '../../components/Chat/SwapCard';
import { RecipeChat } from '../../features/cooking/RecipeChat';
import { useSessionRecipe } from '../../features/cooking/useSessionRecipe';
import { aiSwap } from '../../lib/api';
import { useCookSession, type RecipeUpdate, type Swap } from '../../stores/cookSession';
import { useRecipeStore } from '../../stores/recipes';

/** RCP-3: "150 g", "½ cup (120 ml)". */
export function amountText(i: RecipeIngredient): string {
  if (i.amount === null) return i.unit ?? '';
  const main = [formatAmount(i.amount), i.unit].filter(Boolean).join(' ');
  const other = otherSystem(i.amount, i.unit);
  return other ? `${main} (${other})` : main;
}

/**
 * Full recipe (SRS 6.15, Figma mobile 15, web 17): illustrated header with rank badge and save
 * heart, what it saves, ingredients scaled to the chosen servings with have/missing and "+ List",
 * illustrated step cards with timers, Start cooking / I made this, the AI swap card (RCP-4) and
 * AI chat (RCP-8): a side panel on wide screens, a sheet from "Ask AI" otherwise.
 */
export function RecipePage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const load = useRecipe(id);
  const data = usePantryRecipes();
  const recipe = load.state === 'ready' ? load.recipe : null;
  const session = useSessionRecipe(recipe);
  const match = useMemo(
    () =>
      session.recipe ? matchRecipe(session.recipe, data.items, data.listItems, data.today) : null,
    [session.recipe, data.items, data.listItems, data.today],
  );

  if (load.state === 'loading' || data.status === 'loading') return <PageSkeleton />;
  if (!recipe || !match)
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

  return (
    <RecipeView
      recipe={recipe}
      match={match}
      servings={session.servings}
      setServings={session.setServings}
      swaps={session.swaps}
      update={session.update}
      isBest={data.ranked[0]?.recipe.id === recipe.id}
      data={data}
    />
  );
}

function RecipeView({
  recipe,
  match,
  servings,
  setServings,
  swaps,
  update,
  isBest,
  data,
}: {
  recipe: Recipe;
  match: RecipeMatch;
  servings: number;
  setServings: (n: number) => void;
  swaps: readonly Swap[];
  update: RecipeUpdate | null;
  isBest: boolean;
  data: ReturnType<typeof usePantryRecipes>;
}) {
  const { t } = useTranslation();
  const me = useMe();
  const saved = useRecipeStore((s) => !!s.saved[recipe.id]);
  const { toggleSave, addMissing } = useRecipeActions(data.lists);
  const { doc } = useReceipts(data.pantry.id);
  const [making, setMaking] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const session = match.recipe;
  const swapFor = (name: string) => swaps.find((x) => x.to.toLowerCase() === name.toLowerCase());
  const usedBy = new Map(match.used.map((u) => [u.ingredient, u]));
  const missing = new Map(match.missing.map((m) => [m.ingredient, m]));
  const assumed = new Set(match.assumed);
  const cookHref = `/recipes/${encodeURIComponent(recipe.id)}/cook`;
  const canWrite = data.pantry.canEdit;

  const actions = (
    <>
      <Button asChild>
        <Link to={cookHref}>
          <ChevronRightIcon size={20} />
          <span className="lg:hidden">{t('cook.start')}</span>
          <span className="hidden lg:inline">{t('cook.startWeb')}</span>
        </Link>
      </Button>
      {canWrite ? (
        <Button variant="secondary" icon={<CheckIcon size={20} />} onClick={() => setMaking(true)}>
          {t('cook.made.open')}
        </Button>
      ) : null}
      {canWrite ? (
        <Button
          variant="secondary"
          icon={<SparkIcon size={20} />}
          onClick={() => setChatOpen(true)}
          className="xl:hidden"
        >
          {t('chat.open')}
        </Button>
      ) : null}
    </>
  );
  const chat = (showTitle: boolean, className?: string) => (
    <RecipeChat
      base={recipe}
      recipe={session}
      servings={servings}
      step={null}
      data={data}
      showTitle={showTitle}
      className={className}
    />
  );

  return (
    <article className="mx-auto flex w-full max-w-[90rem] flex-col gap-6 page-x pb-28 pt-4 lg:pb-10 lg:pt-6">
      <nav aria-label={t('recipes.detail.breadcrumb')} className="hidden lg:block">
        <ol className="flex items-center gap-2 text-sm font-semibold">
          <li>
            <Link to="/recipes" className="text-navy underline-offset-2 hover:underline">
              {t('recipes.title')}
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRightIcon size={16} />
          </li>
          <li aria-current="page" className="text-ink">
            {recipe.title}
          </li>
        </ol>
      </nav>

      <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_23rem] xl:items-start xl:gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          {/* RCP-1, RCP-2 */}
          <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
            <div className="relative lg:w-[27rem] lg:shrink-0">
              <RecipeTile cuisine={recipe.cuisine} className="h-52 w-full rounded-hero lg:h-72" />
              <Link
                to="/recipes"
                aria-label={t('recipes.detail.back')}
                className="absolute left-3 top-3 inline-flex size-11 items-center justify-center rounded-full bg-white text-ink lg:hidden"
              >
                <ChevronLeftIcon size={22} />
              </Link>
              <HeartButton
                title={recipe.title}
                saved={saved}
                onToggle={() => toggleSave(recipe)}
                className="absolute right-3 top-3 rounded-full bg-white"
              />
              {isBest ? (
                <span className="absolute bottom-3 left-3 rounded-chip bg-navy px-3 py-1.5 text-sm font-semibold text-white">
                  {t('recipes.detail.bestTonight')}
                </span>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <h1 className="font-wordmark text-[2rem] leading-tight [overflow-wrap:anywhere] lg:text-[3.25rem]">
                {recipe.title}
              </h1>
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-secondary lg:text-lg">
                <span className="inline-flex items-center gap-1.5">
                  <ClockIcon size={18} />
                  {t('recipes.minutes', { count: recipe.minutes })}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <UsersIcon size={18} />
                  {t('recipes.detail.serves', { count: servings })}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <LeafIcon size={18} />
                  {t(`recipes.diets.${recipe.diet}`)}
                </span>
                <span className="rounded-chip px-2.5 py-0.5 text-sm font-semibold text-ink bordered">
                  {cuisineName(t, recipe.cuisine)}
                </span>
              </p>
              {match.saves.length > 0 ? (
                <div className="flex flex-col gap-2 rounded-card bg-shelf p-4">
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
              {/* RCP-6 web actions; mobile has the sticky bar below. */}
              <div className="hidden flex-wrap gap-3 lg:flex">{actions}</div>
            </div>
          </header>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
            {/* RCP-3 */}
            <section aria-labelledby="ingredients" className="rounded-hero bg-white bordered">
              <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
                <h2 id="ingredients" className="text-2xl lg:text-[1.75rem]">
                  {t('recipes.detail.ingredients')}
                </h2>
                <QuantityStepper
                  label={t('recipes.detail.servings')}
                  name={t('recipes.detail.servingsName')}
                  value={servings}
                  onChange={setServings}
                  min={1}
                  max={20}
                />
              </div>
              <p className="px-5 text-sm text-secondary">
                {t('recipes.haveOf', { have: match.have, total: match.total })}
              </p>
              <ul className="mt-2 flex flex-col">
                {match.recipe.ingredients.map((ing, i) => {
                  const u = usedBy.get(ing);
                  const m = missing.get(ing);
                  const note = u
                    ? u.daysLeft <= 0
                      ? t('recipes.detail.expiresToday')
                      : t('recipes.detail.have')
                    : m
                      ? m.state === 'claimed' || m.state === 'on_list'
                        ? t('recipes.detail.onList')
                        : t('recipes.detail.missing')
                      : ing.basic
                        ? t('recipes.detail.basic')
                        : assumed.has(ing)
                          ? t('recipes.detail.assumed')
                          : t('recipes.detail.optional');
                  const swapped = swapFor(ing.name);
                  const urgent = (u && u.daysLeft <= 0) || !!m;
                  return (
                    <li
                      key={`${ing.name}-${i}`}
                      data-testid="ingredient"
                      className="flex min-h-14 items-center gap-3 border-t-2 border-line px-5 py-2"
                    >
                      <span
                        aria-hidden="true"
                        className={cx(
                          'flex size-6 shrink-0 items-center justify-center rounded-full',
                          u
                            ? 'bg-sage text-olive-dark'
                            : m
                              ? 'border-2 border-terra text-terra'
                              : 'bg-shelf text-slate',
                        )}
                      >
                        {u ? (
                          <CheckIcon size={14} strokeWidth={3} />
                        ) : m ? (
                          <CartIcon size={12} />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        {ing.amount !== null || ing.unit ? (
                          <span className="font-semibold">{`${amountText(ing)} `}</span>
                        ) : null}
                        <span>{ing.name}</span>
                        <span
                          className={cx(
                            'block text-xs font-semibold',
                            urgent ? 'text-terra-dark' : 'text-secondary',
                          )}
                        >
                          {swapped
                            ? `${t('chat.swapped', { from: swapped.from.toLowerCase() })} · `
                            : ''}
                          {note}
                        </span>
                      </span>
                      {m && (m.state === 'missing' || m.state === 'ran_out') && canWrite ? (
                        <button
                          type="button"
                          onClick={() => void addMissing(ing, recipe)}
                          aria-label={t('recipes.addToListLabel', { name: ing.name })}
                          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-button px-3 font-semibold text-navy bordered"
                        >
                          <PlusIcon size={16} />
                          {t('recipes.detail.addToList').replace('+ ', '')}
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-col gap-3 p-5 pt-3 empty:hidden">
                {canWrite ? (
                  <SwapSuggestion recipe={recipe} session={session} match={match} data={data} />
                ) : null}
                {swaps.length > 0 || update ? (
                  <SessionChanges recipeId={recipe.id} swaps={swaps} update={update} />
                ) : null}
              </div>
            </section>

            {/* RCP-5 */}
            <section
              aria-labelledby="steps"
              id="recipe-steps"
              tabIndex={-1}
              className="flex flex-col gap-3 outline-none"
            >
              <h2 id="steps" className="text-2xl lg:text-[1.75rem]">
                {t('recipes.detail.steps')}
              </h2>
              {servings !== recipe.servings && !update?.steps ? (
                <p className="text-sm text-secondary">
                  {t('recipes.detail.scaledNote', { count: servings, original: recipe.servings })}
                </p>
              ) : null}
              <ol className="flex flex-col gap-4">
                {session.steps.map((step, i) => (
                  <li
                    key={i}
                    data-testid="step"
                    className="flex flex-col overflow-hidden rounded-hero bg-white bordered lg:flex-row lg:items-stretch lg:gap-5 lg:p-4"
                  >
                    <StepIllustration
                      step={step}
                      className="h-40 rounded-none lg:h-auto lg:w-40 lg:shrink-0 lg:rounded-card"
                    />
                    <div className="flex min-w-0 flex-col gap-2 p-4 lg:p-0">
                      <h3 className="flex items-center gap-2 font-ui text-lg font-semibold">
                        <span
                          aria-hidden="true"
                          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-navy text-sm text-white"
                        >
                          {i + 1}
                        </span>
                        <span className="sr-only">{`${t('recipes.detail.step', { n: i + 1 })}: `}</span>
                        {step.title}
                      </h3>
                      <p>{step.text}</p>
                      {step.timerSeconds ? (
                        <TimerButton
                          recipeId={recipe.id}
                          recipeTitle={recipe.title}
                          step={i}
                          stepTitle={step.title}
                          seconds={step.timerSeconds}
                        />
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
        {/* RCP-8 chat: a side panel on wide screens (Figma web 17). */}
        {canWrite ? (
          <aside className="sticky top-6 hidden max-h-[calc(100dvh-3rem)] flex-col rounded-hero bg-white p-5 bordered xl:flex">
            {chat(true, 'min-h-0 flex-1')}
          </aside>
        ) : null}
      </div>

      {/* RCP-6 mobile sticky actions, above the bottom nav. */}
      <div className="fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 flex gap-3 border-t-2 border-line bg-cream px-4 py-3 lg:hidden [&>*]:flex-1">
        {actions}
      </div>

      <BottomSheet open={chatOpen} title={t('chat.title')} onClose={() => setChatOpen(false)}>
        {chat(false, 'pb-2')}
      </BottomSheet>

      {making ? (
        <MadeThisSheet
          open
          onClose={() => setMaking(false)}
          recipe={recipe}
          used={match.used.filter((u) => !u.ingredient.basic)}
          doc={doc}
          pantryId={data.pantry.id}
          homeListId={data.pantry.homeListId}
          userId={me.user.id}
          today={data.today}
        />
      ) : null}
    </article>
  );
}

const NO_SWAPS: Swap[] = [];

/** RCP-4: ask AI once for the first thing missing; show the card only when it found a swap. */
function SwapSuggestion({
  recipe,
  session,
  match,
  data,
}: {
  recipe: Recipe;
  session: Recipe;
  match: RecipeMatch;
  data: ReturnType<typeof usePantryRecipes>;
}) {
  const swaps = useCookSession((s) => s.swaps[recipe.id]) ?? NO_SWAPS;
  const addSwap = useCookSession((s) => s.addSwap);
  const first = match.missing.find((m) => m.state === 'missing' || m.state === 'ran_out');
  const missing = first?.ingredient.name ?? null;
  const key = missing ? `${recipe.id}|${missing.toLowerCase()}` : '';
  // Asked once per recipe and missing item this session (also cached on the API).
  const answered = useCookSession((s) => key in s.swapAnswers);
  const result = useCookSession((s) => s.swapAnswers[key] ?? null);
  const setSwapAnswer = useCookSession((s) => s.setSwapAnswer);
  const pantry = useMemo(
    () => [...new Set(data.items.filter((i) => i.status === 'active').map((i) => i.name))],
    [data.items],
  );
  useEffect(() => {
    if (!missing || !data.online || answered) return;
    let live = true;
    void aiSwap({
      pantryId: data.pantry.id,
      recipe: session,
      missing,
      pantry: pantry.slice(0, 120),
    }).then((answer) => {
      if (live) setSwapAnswer(key, answer);
    });
    return () => {
      live = false;
    };
    // Ask once per recipe and missing item; later pantry changes don't re-ask.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, data.online, answered]);

  if (!missing || !result?.swap) return null;
  const applied = swaps.some((s) => s.to.toLowerCase() === result.swap!.toLowerCase());
  return (
    <SwapCard
      missing={missing}
      swap={{ ...result, swap: result.swap }}
      applied={applied}
      onUse={() => addSwap(recipe.id, { from: missing, to: result.swap!, amount: result.amount })}
    />
  );
}

/** What changed for this session (swaps, an AI update), with a way back to the original. */
function SessionChanges({
  recipeId,
  swaps,
  update,
}: {
  recipeId: string;
  swaps: readonly Swap[];
  update: RecipeUpdate | null;
}) {
  const { t } = useTranslation();
  const reset = useCookSession((s) => s.resetChanges);
  const what = [
    ...swaps.map((s) => `${s.to.toLowerCase()} for ${s.from.toLowerCase()}`),
    ...(update ? [update.summary] : []),
  ].join(', ');
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-shelf p-3 text-sm">
      <p>{t('chat.changed', { what })}</p>
      <button
        type="button"
        onClick={() => reset(recipeId)}
        className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-navy"
      >
        <RefreshIcon size={16} />
        {t('chat.reset')}
      </button>
    </div>
  );
}
