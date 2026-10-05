import { matchRecipe } from '@shelf-life/ranking';
import { TEXT_SIZES } from '@shelf-life/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  SparkIcon,
} from '../../components/icons';
import { StepIllustration } from '../../components/Recipe/StepIllustration';
import { TimerButton } from '../../components/Recipe/TimerButton';
import { PageSkeleton } from '../../components/Skeleton/Skeleton';
import { MadeThisSheet } from '../../features/cooking/MadeThisSheet';
import { TimerHost } from '../../features/cooking/TimerHost';
import { useRecipe } from '../../features/recipes/useRecipe';
import { usePantryRecipes } from '../../features/recipes/useRecipes';
import { cx } from '../../lib/cx';
import { useMe } from '../../lib/session';
import { useReceipts } from '../../lib/sync/useDocs';
import { useUiSettings } from '../../stores/uiSettings';
import { useSessionRecipe } from '../../features/cooking/useSessionRecipe';
import { RecipeChat } from '../../features/cooking/RecipeChat';
import { BottomSheet } from '../../components/BottomSheet/BottomSheet';

/** RCP-7: keep the screen on while cooking (Wake Lock API), again after coming back to the tab. */
function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let live = true;
    const request = async () => {
      try {
        if (document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
        const next = await navigator.wakeLock.request('screen');
        if (live) lock = next;
        else void next.release();
      } catch {
        // Not allowed (battery saver, unsupported): cooking still works.
      }
    };
    void request();
    const onVisible = () => void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      live = false;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, []);
}

/**
 * Cook-along (SRS 6.15 RCP-7, Figma mobile 16): one step per screen with a progress bar, large
 * text, the step's timer, Back / Next step, a text size button and the screen kept on. The last
 * step leads to "All done" and "I made this". Full screen, no app nav. The AI chat sheet joins in
 * Milestone 7b.
 */
export function CookPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const load = useRecipe(id);
  const data = usePantryRecipes();
  const me = useMe();
  const { doc } = useReceipts(data.pantry.id);
  const recipe = load.state === 'ready' ? load.recipe : null;
  const session = useSessionRecipe(recipe);
  const [chatOpen, setChatOpen] = useState(false);
  const textSize = useUiSettings((s) => s.textSize);
  const setTextSize = useUiSettings((s) => s.setTextSize);
  const [making, setMaking] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useWakeLock();

  const total = session.recipe?.steps.length ?? 0;
  // ?step=N is 1-based; total + 1 is the "All done" screen.
  const step = Math.min(Math.max(1, Number(params.get('step')) || 1), total + 1);
  const go = (n: number) => setParams({ step: String(n) }, { replace: true });

  // Move focus to the new step's heading so screen readers read it (A11Y).
  const ready = load.state === 'ready' && data.status !== 'loading';
  useEffect(() => headingRef.current?.focus(), [step, ready]);

  const match = useMemo(
    () =>
      session.recipe ? matchRecipe(session.recipe, data.items, data.listItems, data.today) : null,
    [session.recipe, data.items, data.listItems, data.today],
  );

  if (load.state === 'loading' || data.status === 'loading') return <PageSkeleton />;
  if (!recipe || !match)
    return (
      <main id="main" className="mx-auto w-full max-w-3xl page-x py-8">
        <h1 className="sr-only">{t('cook.along.title')}</h1>
        <EmptyState
          title={t('recipes.detail.notFound')}
          body=""
          action={
            <Button asChild>
              <Link to="/recipes">{t('recipes.detail.back')}</Link>
            </Button>
          }
        />
      </main>
    );

  const done = step > total;
  const steps = match.recipe.steps;
  const current = done ? null : steps[step - 1]!;
  const recipeHref = `/recipes/${encodeURIComponent(recipe.id)}`;
  const nextSize = TEXT_SIZES[(TEXT_SIZES.indexOf(textSize) + 1) % TEXT_SIZES.length]!;

  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-5 page-x pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5"
    >
      <TimerHost />
      <header className="flex items-center gap-3">
        <Link
          to={recipeHref}
          aria-label={t('cook.along.exit')}
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-white bordered"
        >
          <CloseIcon size={22} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {t('cook.along.progress', { n: Math.min(step, total), total, title: recipe.title })}
          </p>
          <div
            role="progressbar"
            aria-label={t('cook.along.title')}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={Math.min(step, total)}
            aria-valuetext={t('cook.along.progress', {
              n: Math.min(step, total),
              total,
              title: recipe.title,
            })}
            className="mt-1.5 flex gap-1.5"
          >
            {steps.map((_, i) => (
              <span
                key={i}
                className={cx('h-2 flex-1 rounded-chip', i < step ? 'bg-navy' : 'bg-line')}
              />
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setTextSize(nextSize)}
          aria-label={`${t('cook.along.textSize')}: ${t(`textSize.${textSize}`)}`}
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-white font-semibold bordered"
        >
          <span aria-hidden="true">Aa</span>
        </button>
      </header>

      {current ? (
        <>
          <StepIllustration step={current} className="h-44 lg:h-56" />
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-[2rem] leading-tight outline-none lg:text-[2.75rem]"
          >
            <span className="sr-only">{`${t('recipes.detail.step', { n: step })}: `}</span>
            {current.title}
          </h1>
          <p className="text-[1.375rem] leading-normal lg:text-2xl">{current.text}</p>
          {current.timerSeconds ? (
            <TimerButton
              recipeId={recipe.id}
              recipeTitle={recipe.title}
              step={step - 1}
              stepTitle={current.title}
              seconds={current.timerSeconds}
              large
            />
          ) : null}
        </>
      ) : (
        <>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-[2rem] leading-tight outline-none lg:text-[2.75rem]"
          >
            {t('cook.along.doneTitle')}
          </h1>
          <p className="text-xl">{t('cook.along.doneBody', { title: recipe.title })}</p>
          {data.pantry.canEdit ? (
            <Button icon={<CheckIcon size={20} />} onClick={() => setMaking(true)}>
              {t('cook.made.open')}
            </Button>
          ) : null}
        </>
      )}

      <div className="mt-auto flex gap-3 pt-4 [&>*]:flex-1">
        <Button
          variant="secondary"
          icon={<ChevronLeftIcon size={20} />}
          disabled={step <= 1}
          onClick={() => go(step - 1)}
        >
          {t('cook.along.back')}
        </Button>
        {done ? (
          <Button variant="secondary" onClick={() => navigate(recipeHref)}>
            {t('cook.along.exit')}
          </Button>
        ) : (
          <Button onClick={() => go(step + 1)}>
            {step === total ? t('cook.along.finish') : t('cook.along.next')}
            <ChevronRightIcon size={20} />
          </Button>
        )}
      </div>
      {data.pantry.canEdit ? (
        <Button
          variant="ghost"
          icon={<SparkIcon size={20} />}
          onClick={() => setChatOpen(true)}
          className="self-center"
        >
          {t('chat.open')}
        </Button>
      ) : null}
      <p className="text-center text-sm text-secondary">{t('cook.along.awake')}</p>

      {/* RCP-8 chat during cook-along (Figma 16): knows the current step. */}
      <BottomSheet open={chatOpen} title={t('chat.title')} onClose={() => setChatOpen(false)}>
        <RecipeChat
          base={recipe}
          recipe={match.recipe}
          servings={session.servings}
          step={done ? null : step}
          data={data}
          showTitle={false}
          className="pb-2"
        />
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
    </main>
  );
}
