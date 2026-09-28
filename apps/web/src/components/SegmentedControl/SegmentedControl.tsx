import { useRef, type KeyboardEvent } from 'react';
import { cx } from '../../lib/cx';

export type SegmentedOption<T extends string> = { value: T; label: string };

export type SegmentedControlProps<T extends string> = {
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

/** Radio group semantics; arrow keys move the selection (SRS 7). */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
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
    const next = (index + delta + options.length) % options.length;
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx('flex flex-wrap gap-1 rounded-[0.875rem] bg-shelf p-1', className)}
    >
      {options.map((option, i) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cx(
              // Size to the label; at large text sizes the buttons wrap to a second row
              // instead of breaking words (A11Y-6).
              'min-h-11 flex-auto whitespace-nowrap rounded-[0.6875rem] border-2 px-2 text-sm font-semibold leading-tight lg:px-4',
              checked ? 'border-navy bg-white text-navy' : 'border-transparent text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
