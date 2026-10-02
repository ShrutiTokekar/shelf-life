import { CUISINES, DIETS, type Diet } from '@shelf-life/shared';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chip } from '../../components/Chip/Chip';
import { CheckIcon } from '../../components/icons';
import { Select } from '../../components/Select/Select';
import { cuisineName } from './text';
import { useRecipePrefs } from './useRecipes';

const TIMES = ['any', '15', '30', '45', '60'] as const;

/** Split "peanuts, mushrooms" into a clean avoid list. */
export const parseAvoid = (text: string) =>
  [
    ...new Set(
      text
        .split(/[,\n]/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  ].slice(0, 30);

/**
 * PRO-3 "What the AI should know": diet, cuisines, cooking time, ingredients to avoid. Used by
 * both AI suggestions and the on-device ranking (SRS 8.5 hard filters). Saved as you change it,
 * on this device first, so it works offline.
 */
export function RecipePrefsCard() {
  const { t } = useTranslation();
  const { prefs, update } = useRecipePrefs();

  return (
    <section
      aria-labelledby="ai-prefs-heading"
      className="flex flex-col gap-5 rounded-card bg-white p-6 bordered"
    >
      <h2 id="ai-prefs-heading" className="text-2xl">
        {t('profile.ai.title')}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label={t('profile.ai.diet')}
          value={prefs.diet}
          onChange={(v) => update({ diet: v as Diet })}
          options={DIETS.map((d) => ({ value: d, label: t(`profile.ai.diets.${d}`) }))}
        />
        <Select
          label={t('profile.ai.time')}
          value={prefs.maxMinutes === null ? 'any' : String(prefs.maxMinutes)}
          onChange={(v) => update({ maxMinutes: v === 'any' ? null : Number(v) })}
          options={TIMES.map((m) => ({ value: m, label: t(`profile.ai.times.${m}`) }))}
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="font-semibold">{t('profile.ai.cuisines')}</legend>
        <p className="text-sm text-secondary">{t('profile.ai.cuisinesHint')}</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {CUISINES.map((c) => {
            const on = prefs.cuisines.includes(c);
            return (
              <Chip
                key={c}
                selected={on}
                icon={on ? <CheckIcon size={16} /> : undefined}
                onToggle={() =>
                  update({
                    cuisines: on ? prefs.cuisines.filter((x) => x !== c) : [...prefs.cuisines, c],
                  })
                }
              >
                {cuisineName(t, c)}
              </Chip>
            );
          })}
        </div>
      </fieldset>
      <AvoidField
        key={prefs.avoid.join(',')}
        avoid={prefs.avoid}
        onChange={(avoid) => update({ avoid })}
      />
    </section>
  );
}

/** Edited as text; saved on blur. Remounted (via key) when the saved list changes elsewhere. */
function AvoidField({
  avoid,
  onChange,
}: {
  avoid: readonly string[];
  onChange: (avoid: string[]) => void;
}) {
  const { t } = useTranslation();
  const avoidId = useId();
  const hintId = useId();
  const [avoidText, setAvoidText] = useState(avoid.join(', '));
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={avoidId} className="font-semibold">
        {t('profile.ai.avoid')}
      </label>
      <input
        id={avoidId}
        aria-describedby={hintId}
        value={avoidText}
        onChange={(e) => setAvoidText(e.target.value)}
        onBlur={() => {
          const next = parseAvoid(avoidText);
          if (next.join(',') !== avoid.join(',')) onChange(next);
        }}
        className="min-h-12 rounded-button bg-white px-4 text-base bordered"
      />
      <p id={hintId} className="text-sm text-secondary">
        {t('profile.ai.avoidHint')}
      </p>
    </div>
  );
}
