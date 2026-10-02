import { cx } from '../../lib/cx';

/** Tile colors per cuisine (tokens only). AI cuisines outside the set use the shelf tone. */
const tones: Record<string, string> = {
  south_asian: 'bg-apricot text-apricot-dark',
  mexican: 'bg-terra-light text-terra-dark',
  italian: 'bg-sage text-olive-dark',
  middle_eastern: 'bg-peach text-peach-dark',
  east_asian: 'bg-periwinkle text-navy',
  everyday: 'bg-shelf text-ink',
};

/**
 * Illustrated recipe tile (no photos yet, SRS RCP-1 "illustration placeholder"): a bowl with
 * steam, tinted by cuisine. Decorative: the recipe name is always next to it.
 */
export function RecipeTile({ cuisine, className }: { cuisine: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-cuisine={cuisine}
      className={cx(
        'flex shrink-0 items-center justify-center rounded-card',
        tones[cuisine] ?? 'bg-shelf text-ink',
        className,
      )}
    >
      <svg viewBox="0 0 64 64" className="h-3/5 w-3/5" fill="none" stroke="currentColor">
        <path
          d="M10 32h44a22 22 0 0 1-44 0Z"
          fill="currentColor"
          fillOpacity="0.18"
          strokeWidth="3"
        />
        <path d="M24 54h16" strokeWidth="3" strokeLinecap="round" />
        <path
          d="M24 24c0-4 4-4 4-8s-4-4-4-8M34 24c0-4 4-4 4-8s-4-4-4-8"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="22" cy="38" r="2.5" fill="currentColor" stroke="none" />
        <circle cx="32" cy="41" r="2.5" fill="currentColor" stroke="none" />
        <circle cx="42" cy="38" r="2.5" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}
