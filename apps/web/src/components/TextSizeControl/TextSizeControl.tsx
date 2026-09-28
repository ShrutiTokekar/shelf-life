import { TEXT_SIZES, type TextSize } from '@shelf-life/shared';
import { useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from '../../lib/cx';

export type TextSizeControlProps = {
  value: TextSize;
  onChange: (size: TextSize) => void;
  className?: string;
};

// Figma header: three "A"s at 15 / 19 / 23 px. These stay fixed so the control doesn't reflow.
const glyphPx: Record<TextSize, number> = { default: 15, large: 19, largest: 23 };

/** Text size A / A / A (A11Y-6). Radio group: arrow keys move the selection. */
export function TextSizeControl({ value, onChange, className }: TextSizeControlProps) {
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
    const next = (index + delta + TEXT_SIZES.length) % TEXT_SIZES.length;
    onChange(TEXT_SIZES[next]!);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={t('textSize.label')}
      className={cx('inline-flex items-center rounded-xl bg-white bordered', className)}
    >
      {TEXT_SIZES.map((size, i) => {
        const checked = size === value;
        return (
          <button
            key={size}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={t(`textSize.${size}`)}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(size)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cx(
              'flex size-11 items-center justify-center rounded-[0.625rem] font-semibold leading-none',
              checked ? 'bg-periwinkle text-ink' : 'text-ink',
            )}
            style={{ fontSize: `${glyphPx[size]}px` }}
          >
            <span aria-hidden="true">A</span>
          </button>
        );
      })}
    </div>
  );
}
