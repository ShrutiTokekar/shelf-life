import { LIST_COLORS, type ListColor } from '@shelf-life/shared';
import { useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from '../../lib/cx';
import { CheckIcon } from '../icons';

export type ColorSwatchPickerProps = {
  value: ListColor;
  onChange: (color: ListColor) => void;
  /** id of the visible label element */
  labelledBy: string;
  describedBy?: string;
};

const swatchClass: Record<ListColor, string> = {
  navy: 'bg-list-navy',
  olive: 'bg-list-olive',
  amber: 'bg-list-amber',
  terra: 'bg-list-terra',
  gray: 'bg-list-gray',
};

/** Radio group of list colors; the selected swatch gets a 2 px ink ring and a check (SRS 7). */
export function ColorSwatchPicker({
  value,
  onChange,
  labelledBy,
  describedBy,
}: ColorSwatchPickerProps) {
  const { t } = useTranslation();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(e: KeyboardEvent, index: number) {
    const delta =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + LIST_COLORS.length) % LIST_COLORS.length;
    onChange(LIST_COLORS[next]!);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className="flex flex-wrap gap-3"
    >
      {LIST_COLORS.map((color, i) => {
        const checked = color === value;
        return (
          <button
            key={color}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={t(`colors.${color}`)}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(color)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className="flex size-12 items-center justify-center rounded-chip"
          >
            <span
              aria-hidden="true"
              className={cx(
                'flex size-10 items-center justify-center rounded-chip text-white',
                swatchClass[color],
                checked && 'ring-2 ring-ink ring-offset-2 ring-offset-cream',
              )}
            >
              {checked ? <CheckIcon size={20} strokeWidth={2.5} /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
