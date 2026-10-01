import logoStackedUrl from '../../../../../assets/logo/logo-stacked.svg';
import { cx } from '../../lib/cx';

export type WordmarkProps = {
  /** Font size in px (SRS 4.2: 28–38). Converted to rem. */
  size?: number;
  /** Keep the logo at `size` px whatever the text size (tight spots like the mobile top bar). */
  fixed?: boolean;
  className?: string;
};

/**
 * Inline wordmark (desktop header): "Shelf" periwinkle with a navy offset shadow, "Life" sage with
 * an olive shadow (SRS 4.2, section 7). The visible text is decorative; the label is "Shelf Life".
 */
export function Wordmark({ size = 38, fixed = false, className }: WordmarkProps) {
  const unit = (px: number) => (fixed ? `${px}px` : `${px / 16}rem`);
  const offset = `${unit((3 / 38) * size)} ${unit((4 / 38) * size)} 0`;
  return (
    <span
      role="img"
      aria-label="Shelf Life"
      className={cx('inline-block whitespace-nowrap font-wordmark leading-none', className)}
      style={{ fontSize: unit(size) }}
    >
      <span
        aria-hidden="true"
        className="text-periwinkle"
        style={{ textShadow: `${offset} var(--navy)` }}
      >
        Shelf
      </span>{' '}
      <span
        aria-hidden="true"
        className="text-sage"
        style={{ textShadow: `${offset} var(--olive)` }}
      >
        Life
      </span>
    </span>
  );
}

/** Stacked logo from the Figma Components board (Logo/Stacked), used on Welcome (WEL-1). */
export function LogoStacked({ className }: { className?: string }) {
  return (
    <img
      src={logoStackedUrl}
      alt="Shelf Life"
      width={440}
      height={320}
      className={cx('h-auto w-full max-w-[22rem]', className)}
    />
  );
}
