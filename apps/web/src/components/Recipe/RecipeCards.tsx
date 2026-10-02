import type { MissingIngredient, RankedRecipe } from '@shelf-life/ranking';
import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { cx } from '../../lib/cx';
import { cuisineName, type RecipeNote } from '../../features/recipes/text';
import { Button } from '../Button/Button';
import {
  CartIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  EmptyJarIcon,
  PlusIcon,
  PotIcon,
  SparkIcon,
} from '../icons';
import { RecipeTile } from './RecipeTile';
import { SavesChips } from './SavesChips';

function Meta({ r, className }: { r: RankedRecipe; className?: string }) {
  const { t } = useTranslation();
  return (
    <p className={cx('flex items-center gap-1.5 text-sm text-secondary', className)}>
      <ClockIcon size={16} />
      {t('recipes.meta', { minutes: r.recipe.minutes, cuisine: cuisineName(t, r.recipe.cuisine) })}
      {r.recipe.source === 'ai' ? (
        <span className="ml-1 inline-flex items-center gap-1 rounded-chip bg-periwinkle px-2 py-0.5 text-xs font-semibold text-ink">
          <SparkIcon size={12} />
          {t('recipes.aiBadge')}
        </span>
      ) : null}
    </p>
  );
}

/**
 * REC-3 rank #1 card: rank tile "Best match", recipe name (Agbalumo), time and cuisine, "Why
 * #1", Saves chips, Cook this, the first missing ingredient with Add to list, "You have X of Y".
 */
export function RecipeHeroCard({
  ranked,
  why,
  saveButton,
  onAddMissing,
}: {
  ranked: RankedRecipe;
  why: string;
  saveButton: ReactNode;
  onAddMissing: (m: MissingIngredient) => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const r = ranked.recipe;
  const toBuy = ranked.missing.filter((m) => m.state === 'missing' || m.state === 'ran_out');
  return (
    <article
      aria-labelledby={titleId}
      data-testid="recipe-hero"
      className="flex gap-4 rounded-hero border-2 border-navy bg-white p-5 lg:gap-8 lg:p-7"
    >
      <span
        aria-hidden="true"
        className="flex size-16 shrink-0 flex-col items-center justify-center rounded-[1.125rem] bg-periwinkle font-display text-[2.5rem] leading-none text-navy lg:size-32 lg:text-[5rem]"
      >
        1
        <span className="mt-1 font-ui text-[0.6875rem] font-semibold text-ink lg:text-sm">
          {t('recipes.best')}
        </span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 lg:flex lg:items-baseline lg:gap-4">
            <h2
              id={titleId}
              className="font-wordmark text-[1.625rem] leading-tight [overflow-wrap:anywhere] lg:text-[2.5rem]"
            >
              <span className="sr-only">{`1. ${t('recipes.best')}: `}</span>
              {r.title}
            </h2>
            <Meta r={ranked} className="mt-1 shrink-0" />
          </div>
          {saveButton}
        </div>
        <p className="text-base text-ink lg:text-lg">{why}</p>
        {ranked.saves.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">{t('recipes.saves')}</span>
            <SavesChips saves={ranked.saves} />
          </div>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-3 max-lg:flex-col max-lg:items-stretch">
          <Button asChild>
            <Link to={`/recipes/${encodeURIComponent(r.id)}`}>
              <PotIcon size={20} />
              {t('recipes.cookThis')}
            </Link>
          </Button>
          {toBuy.length > 0 ? (
            <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-button bg-cream px-4 py-1 bordered">
              <span className="text-sm text-ink">
                {t('recipes.missing', {
                  names: toBuy.map((m) => m.ingredient.name.toLowerCase()).join(', '),
                })}
              </span>
              <button
                type="button"
                onClick={() => onAddMissing(toBuy[0]!)}
                aria-label={t('recipes.addToListLabel', { name: toBuy[0]!.ingredient.name })}
                className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-navy"
              >
                <PlusIcon size={18} />
                {t('recipes.addToList')}
              </button>
            </div>
          ) : null}
          <p className="text-sm text-secondary">
            {t('recipes.haveOf', { have: ranked.have, total: ranked.total })}
          </p>
        </div>
      </div>
    </article>
  );
}

const noteIcons = {
  ok: <CheckIcon size={16} />,
  claimed: <CartIcon size={16} />,
  out: <EmptyJarIcon size={16} />,
  missing: <PlusIcon size={16} />,
};

/** REC-4 runner-up row: rank circle, name, meta, saves chips, one-line note, Cook this. */
export function RecipeRow({
  ranked,
  rank,
  note,
}: {
  ranked: RankedRecipe;
  rank: number;
  note: RecipeNote;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const r = ranked.recipe;
  return (
    <li
      aria-labelledby={titleId}
      data-testid="recipe-row"
      className="flex items-center gap-4 border-line p-4 lg:grid lg:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_auto] lg:gap-6 lg:p-6 [&:not(:first-child)]:border-t-2"
    >
      <span
        aria-hidden="true"
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-shelf font-display text-2xl text-ink lg:size-14 lg:text-[2rem]"
      >
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <h3
          id={titleId}
          className="font-wordmark text-lg leading-tight [overflow-wrap:anywhere] lg:text-[1.625rem]"
        >
          <span className="sr-only">{`${rank}. `}</span>
          {r.title}
        </h3>
        <Meta r={ranked} className="mt-0.5" />
        <p className="text-sm text-secondary lg:hidden">
          {ranked.saves.length > 0
            ? `${t('recipes.savesCount', { count: ranked.saves.length })} · `
            : ''}
          {note.text}
        </p>
      </div>
      <div className="hidden items-start gap-2 lg:flex">
        {ranked.saves.length > 0 ? (
          <>
            <span className="pt-1.5 text-sm font-semibold">{t('recipes.saves')}</span>
            <SavesChips saves={ranked.saves} />
          </>
        ) : null}
      </div>
      <p
        className={cx(
          'hidden items-center gap-2 text-sm lg:flex',
          note.tone === 'out' ? 'text-terra-dark' : 'text-ink',
        )}
      >
        {noteIcons[note.tone]}
        {note.text}
      </p>
      <Link
        to={`/recipes/${encodeURIComponent(r.id)}`}
        aria-label={t('recipes.cookThisLabel', { title: r.title })}
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-button border-2 border-navy bg-white font-semibold text-navy lg:px-5"
      >
        <span className="hidden lg:inline">{t('recipes.cookThis')}</span>
        <ChevronRightIcon size={22} className="lg:hidden" />
      </Link>
    </li>
  );
}

/** SAV-4 saved recipe card: tile, name, time and cuisine, a status chip, the heart. */
export function SavedRecipeCard({
  ranked,
  status,
  saveButton,
}: {
  ranked: RankedRecipe;
  status: ReactNode;
  saveButton: ReactNode;
}) {
  const { t } = useTranslation();
  const r = ranked.recipe;
  return (
    <li
      data-testid="saved-recipe"
      className="relative flex items-center gap-4 rounded-card bg-white p-3 bordered"
    >
      <RecipeTile cuisine={r.cuisine} className="size-20 lg:size-24" />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <h3 className="font-wordmark text-lg leading-tight [overflow-wrap:anywhere]">
          <Link
            to={`/recipes/${encodeURIComponent(r.id)}`}
            className="after:absolute after:inset-0 after:content-['']"
          >
            {r.title}
          </Link>
        </h3>
        <p className="text-sm text-secondary">
          {t('recipes.meta', { minutes: r.minutes, cuisine: cuisineName(t, r.cuisine) })}
        </p>
        {status}
      </div>
      <div className="relative z-10">{saveButton}</div>
    </li>
  );
}
