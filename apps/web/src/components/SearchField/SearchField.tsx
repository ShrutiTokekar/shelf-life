import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '../../lib/cx';
import { CloseIcon, SearchIcon } from '../icons';

export type SearchFieldProps = {
  label: string;
  placeholder?: string;
  onSearch: (query: string) => void;
  clearLabel: string;
  /** Debounce in ms (SRS 7: 150). */
  delay?: number;
  /** Hide the label below 1024 px (it stays the accessible name). Mobile 03 shows only the placeholder. */
  hideLabel?: boolean;
  className?: string;
};

/** Labeled search with clear button and 150 ms debounce (SRS 7, PAN-1). */
export function SearchField({
  label,
  placeholder,
  onSearch,
  clearLabel,
  delay = 150,
  hideLabel = false,
  className,
}: SearchFieldProps) {
  const id = useId();
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const onSearchRef = useRef(onSearch);

  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  useEffect(() => {
    const t = setTimeout(() => onSearchRef.current(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={id}
        className={cx('text-sm font-semibold text-ink', hideLabel && 'sr-only lg:not-sr-only')}
      >
        {label}
      </label>
      <div className="flex min-h-12 items-center gap-2.5 rounded-[0.875rem] border-2 border-slate bg-white pl-3.5 pr-1 focus-within:outline focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-navy">
        <SearchIcon size={20} className="text-slate" />
        <input
          ref={inputRef}
          id={id}
          type="search"
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-base text-ink outline-none placeholder:text-slate [&::-webkit-search-cancel-button]:hidden"
        />
        {value ? (
          <button
            type="button"
            aria-label={clearLabel}
            onClick={() => {
              setValue('');
              onSearchRef.current('');
              inputRef.current?.focus();
            }}
            className="flex size-11 items-center justify-center rounded-xl text-slate"
          >
            <CloseIcon size={20} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
