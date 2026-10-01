import { useTranslation } from 'react-i18next';
import { MinusIcon, PlusIcon } from '../icons';

/**
 * − value + stepper (ADD-2). Buttons are 44 px and say what they change; the value is announced
 * through the labeled group.
 */
export function QuantityStepper({
  label,
  name,
  value,
  onChange,
  min = 1,
  max = 99,
}: {
  label: string;
  /** What is being counted, for the button names ("Less oat milk"). */
  name: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  const { t } = useTranslation();
  const thing = name.trim() || label.toLowerCase();
  return (
    <div
      role="group"
      aria-label={`${label}: ${value}`}
      className="inline-flex min-h-12 items-center rounded-button bg-white bordered"
    >
      <button
        type="button"
        aria-label={t('addSheet.less', { name: thing })}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex size-11 items-center justify-center rounded-xl text-ink disabled:opacity-40"
      >
        <MinusIcon size={20} />
      </button>
      <output aria-live="polite" className="min-w-8 text-center text-lg font-semibold text-ink">
        {value}
      </output>
      <button
        type="button"
        aria-label={t('addSheet.more', { name: thing })}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex size-11 items-center justify-center rounded-xl text-ink disabled:opacity-40"
      >
        <PlusIcon size={20} />
      </button>
    </div>
  );
}
