import * as RadixSelect from '@radix-ui/react-select';
import { useId, type ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { CheckIcon, ChevronDownIcon } from '../icons';

export type SelectOption = { value: string; label: string; icon?: ReactNode };

export type SelectProps = {
  label: string;
  options: readonly SelectOption[];
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  className?: string;
  /** A sentence-style picker: small label and the value as a link-styled button (REV-6). */
  inline?: boolean;
};

/** Radix Select with a visible label; shows value + chevron (SRS 7). */
export function Select({
  label,
  options,
  value,
  onChange,
  hint,
  className,
  inline = false,
}: SelectProps) {
  const labelId = useId();
  const hintId = useId();
  const current = options.find((o) => o.value === value);
  return (
    <div
      className={cx(
        inline ? 'flex items-center justify-center gap-1' : 'flex flex-col gap-1.5',
        className,
      )}
    >
      <span
        id={labelId}
        className={inline ? 'text-sm font-medium text-secondary' : 'font-semibold text-ink'}
      >
        {label}
      </span>
      <RadixSelect.Root value={value} onValueChange={onChange}>
        <RadixSelect.Trigger
          aria-labelledby={labelId}
          aria-describedby={hint ? hintId : undefined}
          className={
            inline
              ? 'flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-left text-sm font-semibold text-navy underline underline-offset-4'
              : 'flex min-h-12 items-center justify-between gap-2 rounded-button bg-white px-4 text-left text-base text-ink bordered'
          }
        >
          <span className="flex items-center gap-2">
            {current?.icon}
            <RadixSelect.Value />
          </span>
          <RadixSelect.Icon>
            <ChevronDownIcon size={20} className={inline ? 'text-navy' : 'text-slate'} />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>
        <RadixSelect.Portal>
          <RadixSelect.Content
            position="popper"
            sideOffset={6}
            className="z-[70] max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-card bg-white p-1.5 bordered"
          >
            <RadixSelect.Viewport>
              {options.map((o) => (
                <RadixSelect.Item
                  key={o.value}
                  value={o.value}
                  className="flex min-h-11 cursor-default items-center justify-between gap-3 rounded-xl px-3 text-base text-ink outline-none data-[highlighted]:bg-periwinkle data-[highlighted]:text-ink"
                >
                  <span className="flex items-center gap-2">
                    {o.icon}
                    <RadixSelect.ItemText>{o.label}</RadixSelect.ItemText>
                  </span>
                  <RadixSelect.ItemIndicator>
                    <CheckIcon size={18} />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
      {hint ? (
        <p id={hintId} className="text-sm text-secondary">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
