import { daysLeft } from '@shelf-life/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button/Button';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { CheckIcon, ChevronLeftIcon, ListIcon, SparkIcon } from '../../components/icons';
import { ProgressBar } from '../../components/ProgressBar/ProgressBar';
import { SavesChips } from '../../components/Recipe/SavesChips';
import { PageSkeleton } from '../../components/Skeleton/Skeleton';
import { usePantryRecipes } from '../../features/recipes/useRecipes';
import { useUiSettings } from '../../stores/uiSettings';

/** ANA-2: "Also in your kitchen" shows the first 7, then "+N more". */
const KITCHEN_SHOWN = 7;
/** Each step's tick, so the progress reads as steps rather than a flash. */
const STEP_MS = 450;

/**
 * AI pantry analysis (SRS 6.8, Figma mobile 07): four steps, what's expiring and what else is in
 * the kitchen, then "See N recipes". Offline or without AI the same steps run on this device
 * with a note (ANA-6).
 */
export function AnalyzePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const data = usePantryRecipes();
  const reduceMotion = useUiSettings((s) => s.reduceMotion);
  const { status, check } = data;
  const [step, setStep] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (status !== 'ready' || started.current) return;
    started.current = true;
    void check(true);
  }, [status, check]);

  const aiBusy = data.phase === 'checking' || data.phase === 'idle';
  // Steps 1–3 tick by; step 4 ("Ranking") finishes when the answer (or fallback) is in.
  useEffect(() => {
    if (status !== 'ready') return;
    if (step >= 4 || (step === 3 && aiBusy)) return;
    const id = window.setTimeout(() => setStep((s) => s + 1), reduceMotion ? 0 : STEP_MS);
    return () => window.clearTimeout(id);
  }, [step, aiBusy, status, reduceMotion]);

  const rescue = data.rescue;
  const rescueIds = useMemo(() => new Set(rescue.map((i) => i.id)), [rescue]);
  const kitchen = useMemo(
    () => [
      ...new Set(
        data.items.filter((i) => i.status === 'active' && !rescueIds.has(i.id)).map((i) => i.name),
      ),
    ],
    [data.items, rescueIds],
  );
  const ranOut = [
    ...new Set(data.items.filter((i) => i.status === 'out').map((i) => i.name.toLowerCase())),
  ].slice(0, 3);
  const activeCount = data.items.filter((i) => i.status === 'active').length;
  const done = step >= 4;
  const count = Math.min(data.ranked.length, 6);
  const steps = ['sort', 'prefs', 'match', 'rank'] as const;

  if (status === 'loading') return <PageSkeleton />;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 page-x pb-8 pt-4 lg:pt-7">
      <Link
        to="/recipes"
        className="-ml-2 inline-flex min-h-11 items-center gap-2 self-start px-2 text-lg font-semibold text-ink"
      >
        <ChevronLeftIcon size={22} />
        {t('recipes.analyze.back')}
      </Link>
      <div>
        <h1 className="text-[2rem] leading-[1.1] lg:text-[3rem]">{t('recipes.analyze.title')}</h1>
        <p className="mt-2 text-secondary">
          {t(data.online ? 'recipes.analyze.body' : 'recipes.analyze.bodyLocal', {
            count: activeCount,
            pantry: data.pantry.name,
          })}
        </p>
      </div>

      {status === 'error' ? (
        <ErrorState message={t('recipes.error')} onRetry={data.retry} />
      ) : (
        <>
          {/* ANA-1 */}
          <section
            aria-labelledby="analysis-status"
            className="flex flex-col gap-3 rounded-hero bg-periwinkle p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h2
                id="analysis-status"
                className="flex items-center gap-2 font-ui text-lg font-semibold"
              >
                <SparkIcon size={22} />
                {done ? t('recipes.analyze.statusDone') : t('recipes.analyze.status')}
              </h2>
              <span className="text-sm font-semibold text-ink">
                {t('recipes.analyze.step', { n: Math.max(1, Math.min(step, 4)) })}
              </span>
            </div>
            <ProgressBar value={(step / 4) * 100} label={t('recipes.analyze.status')} />
            <ol className="flex flex-col gap-2" aria-live="polite">
              {steps.map((key, i) => {
                const complete = step > i;
                return (
                  <li key={key} className="flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className={
                        complete
                          ? 'flex size-5 items-center justify-center rounded-full bg-navy text-white'
                          : 'size-5 rounded-full border-2 border-navy bg-white'
                      }
                    >
                      {complete ? <CheckIcon size={13} strokeWidth={3} /> : null}
                    </span>
                    <span className={complete ? 'text-ink' : 'font-semibold text-ink'}>
                      {t(`recipes.analyze.steps.${key}`)}
                      <span className="sr-only">{complete ? ` (${t('common.done')})` : ''}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* ANA-2 */}
          {rescue.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="font-ui text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-secondary">
                {t('recipes.analyze.expiring')}
              </h2>
              <SavesChips
                max={20}
                saves={rescue.map((item) => ({
                  item,
                  ingredient: { name: item.name, amount: null, unit: null },
                  daysLeft: daysLeft(item, data.today),
                }))}
              />
            </section>
          ) : null}
          {kitchen.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="font-ui text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-secondary">
                {t('recipes.analyze.kitchen')}
              </h2>
              <ul className="flex flex-wrap gap-2">
                {kitchen.slice(0, KITCHEN_SHOWN).map((name) => (
                  <li
                    key={name}
                    className="rounded-chip bg-sage px-3 py-1.5 text-sm font-semibold text-olive-dark"
                  >
                    {name}
                  </li>
                ))}
                {kitchen.length > KITCHEN_SHOWN ? (
                  <li className="rounded-chip bg-white px-3 py-1.5 text-sm font-semibold text-ink bordered">
                    {t('recipes.analyze.more', { count: kitchen.length - KITCHEN_SHOWN })}
                  </li>
                ) : null}
              </ul>
            </section>
          ) : null}

          {/* ANA-3 */}
          {ranOut.length > 0 ? (
            <p className="flex items-start gap-3 rounded-card bg-white p-4 text-sm bordered">
              <ListIcon size={18} className="mt-0.5 shrink-0" />
              {t('recipes.analyze.outOf', { names: ranOut.join(', ') })}
            </p>
          ) : null}

          {/* ANA-4 */}
          <section className="flex flex-col gap-2">
            <h2 className="font-ui text-base font-semibold">{t('recipes.analyze.how')}</h2>
            <ul className="flex flex-col gap-1.5">
              {(t('recipes.analyze.howItems', { returnObjects: true }) as string[]).map((line) => (
                <li key={line} className="flex items-center gap-2 text-sm">
                  <CheckIcon size={16} className="text-olive" />
                  {line}
                </li>
              ))}
            </ul>
          </section>

          {/* ANA-6 */}
          {done && data.phase === 'fallback' ? (
            <p role="status" className="rounded-card bg-shelf p-4 text-sm">
              {t(data.online ? 'recipes.analyze.fallback' : 'recipes.analyze.offline')}
            </p>
          ) : null}

          {/* ANA-5 */}
          <Button
            fullWidth
            disabled={!done}
            aria-busy={!done}
            onClick={() => navigate('/recipes')}
            className="lg:max-w-sm"
          >
            {t('recipes.analyze.see', { count })}
          </Button>
        </>
      )}
    </div>
  );
}
