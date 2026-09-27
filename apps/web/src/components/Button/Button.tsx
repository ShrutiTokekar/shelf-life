import { Slot } from '@radix-ui/react-slot';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../../lib/cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  /** md = 52 px (Figma Button/Primary), sm = 46 px (header Upload receipt). Both ≥ 44 px. */
  size?: ButtonSize;
  icon?: ReactNode;
  fullWidth?: boolean;
  /** Keeps the button's width and sets aria-busy; clicks are ignored while loading. */
  loading?: boolean;
  /** Render the child element (e.g. a router Link) with button styles. */
  asChild?: boolean;
};

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-navy text-white border-navy',
  secondary: 'bg-cream text-navy border-navy',
  ghost: 'bg-transparent text-navy border-transparent',
  danger: 'bg-terra-dark text-white border-terra-dark',
};

const sizes: Record<ButtonSize, string> = {
  md: 'min-h-[3.25rem] px-6 text-[1.0625rem] rounded-button',
  sm: 'min-h-[2.875rem] px-5 text-base rounded-button-sm',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    icon,
    fullWidth = false,
    loading = false,
    asChild = false,
    className,
    children,
    type = 'button',
    disabled,
    onClick,
    ...rest
  },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  const classes = cx(
    'relative inline-flex items-center justify-center gap-2 border-2 font-ui font-semibold leading-tight',
    'min-w-11 py-2 text-center select-none transition-[background-color,border-color,color]',
    'disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed',
    variants[variant],
    sizes[size],
    fullWidth && 'w-full',
    className,
  );

  if (asChild) {
    return (
      <Comp ref={ref} className={classes} {...rest}>
        {children}
      </Comp>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={loading ? (e) => e.preventDefault() : onClick}
      {...rest}
    >
      {/* Content stays in the layout while loading so the width never jumps. */}
      <span className={cx('inline-flex items-center gap-2', loading && 'invisible')}>
        {icon}
        {children}
      </span>
      {loading ? (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        </span>
      ) : null}
    </button>
  );
});
