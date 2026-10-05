import { useId } from 'react';
import { cx } from '../../lib/cx';

/**
 * On/off switch (SRS 7, Figma toggles): a button with `role="switch"`, labeled by its visible
 * label and described by the hint. The whole row is the 44 px+ target.
 */
export function Switch({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const labelId = useId();
  const hintId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={hint ? hintId : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 w-full items-center justify-between gap-4 py-2 text-left disabled:opacity-60"
    >
      <span className="min-w-0">
        <span id={labelId} className="block font-semibold text-ink">
          {label}
        </span>
        {hint ? (
          <span id={hintId} className="block text-sm text-secondary">
            {hint}
          </span>
        ) : null}
      </span>
      <span
        aria-hidden="true"
        className={cx(
          'relative inline-flex h-8 w-14 shrink-0 items-center rounded-chip border-2 transition-colors motion-reduce:transition-none',
          checked ? 'border-navy bg-navy' : 'border-slate bg-periwinkle',
        )}
      >
        <span
          className={cx(
            'absolute size-6 rounded-full bg-white transition-transform motion-reduce:transition-none',
            checked ? 'translate-x-[1.625rem]' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  );
}
