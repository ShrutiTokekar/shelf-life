import { cx } from '../../lib/cx';

export type AvatarTone = 'periwinkle' | 'peach' | 'sage' | 'apricot';

export type AvatarProps = {
  initial: string;
  /** Member tint. Peach is the default member color; periwinkle is "you" in the header. */
  tone?: AvatarTone;
  /** px, 18–96 (SRS 7). */
  size?: number;
  ring?: boolean;
  /** Provide when the avatar stands alone. Omit when a visible name sits next to it (decorative). */
  label?: string;
  className?: string;
};

const tones: Record<AvatarTone, string> = {
  periwinkle: 'bg-periwinkle text-navy',
  peach: 'bg-peach text-ink',
  sage: 'bg-sage text-olive-dark',
  apricot: 'bg-apricot text-apricot-dark',
};

export function Avatar({
  initial,
  tone = 'peach',
  size = 44,
  ring = false,
  label,
  className,
}: AvatarProps) {
  const clamped = Math.min(96, Math.max(18, size));
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-chip font-semibold leading-none',
        tones[tone],
        ring && 'ring-2 ring-white',
        className,
      )}
      style={{
        width: `${clamped / 16}rem`,
        height: `${clamped / 16}rem`,
        fontSize: `${(clamped * 0.43) / 16}rem`,
      }}
    >
      {initial.charAt(0).toUpperCase()}
    </span>
  );
}
