import type { SwapResult } from '@shelf-life/shared';
import { useTranslation } from 'react-i18next';
import { CheckIcon, SparkIcon } from '../icons';

/**
 * RCP-4 swap suggestion: "No cheddar? Use your paneer", how much, any method change, and
 * "Use it" (this session only). Shown only when AI found a swap in the pantry.
 */
export function SwapCard({
  missing,
  swap,
  applied,
  onUse,
}: {
  missing: string;
  swap: SwapResult & { swap: string };
  applied: boolean;
  onUse: () => void;
}) {
  const { t } = useTranslation();
  return (
    <aside
      aria-label={t('chat.swap.label')}
      className="flex flex-wrap items-start gap-3 rounded-card bg-periwinkle p-4 text-ink"
    >
      <SparkIcon size={20} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1 basis-48">
        <p className="font-semibold">
          {t('chat.swap.title', { missing: missing.toLowerCase(), swap: swap.swap.toLowerCase() })}
        </p>
        <p className="text-sm">
          {[swap.amount, swap.note, swap.adjustments].filter(Boolean).join(' · ')}
        </p>
        <p className="mt-1 text-xs">{t('chat.swap.ai')}</p>
      </div>
      <button
        type="button"
        onClick={onUse}
        disabled={applied}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-button bg-navy px-4 font-semibold text-white disabled:opacity-80"
      >
        {applied ? <CheckIcon size={16} /> : null}
        {applied ? t('chat.swap.used') : t('chat.swap.use')}
      </button>
    </aside>
  );
}
