import { cx } from '../../lib/cx';

/** Determinate progress bar (Figma 04: periwinkle track, navy fill). */
export function ProgressBar({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cx('h-2.5 w-full overflow-hidden rounded-chip bg-periwinkle', className)}
    >
      <div
        className="h-full rounded-chip bg-navy transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
