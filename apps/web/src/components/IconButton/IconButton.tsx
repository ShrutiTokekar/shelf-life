import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../../lib/cx';

export type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'children'
> & {
  icon: ReactNode;
  /** Required: becomes the aria-label (SRS 4.4, icon-only buttons must be labeled). */
  label: string;
  variant?: 'outline' | 'ghost' | 'primary';
  /** Extra visual content, e.g. a Badge. Hidden from assistive tech; put counts in `label`. */
  adornment?: ReactNode;
};

const variants = {
  outline: 'bg-white text-ink bordered',
  ghost: 'bg-transparent text-ink border-2 border-transparent',
  primary: 'bg-navy text-white border-2 border-navy',
};

/** 44×44 px minimum (A11Y-3); Figma header tools are 46 px. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, variant = 'outline', adornment, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cx(
        'relative inline-flex size-[2.875rem] min-h-11 min-w-11 items-center justify-center rounded-xl',
        'aria-pressed:bg-periwinkle aria-pressed:text-navy',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {adornment ? <span aria-hidden="true">{adornment}</span> : null}
    </button>
  );
});
