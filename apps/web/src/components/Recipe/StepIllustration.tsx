import type { RecipeStep } from '@shelf-life/shared';
import { cx } from '../../lib/cx';

export const SCENES = [
  'pan',
  'pot',
  'bowl',
  'board',
  'tray',
  'blender',
  'wok',
  'plate',
  'toast',
  'rest',
] as const;
export type Scene = (typeof SCENES)[number];

/** First match wins: the most specific cooking words first. */
const KEYWORDS: [Scene, RegExp][] = [
  ['blender', /\b(blend|blitz|purée|puree|pulse|smooth)/i],
  ['wok', /\b(stir-fry|stir fry|wok|toss .* high heat)/i],
  ['tray', /\b(oven|roast|bake|grill|broil|tray|°c)/i],
  ['toast', /\b(toast|tortilla|quesadilla|flip|crisp|griddle)/i],
  ['pot', /\b(boil|simmer|soup|stock|pot|pressure|lentil|dal|rice|pasta|noodle)/i],
  ['rest', /\b(rest|soak|cover and|marinate|chill|leave it)/i],
  ['board', /\b(chop|slice|dice|cut|grate|trim|peel|prep|mince)/i],
  ['bowl', /\b(mix|whisk|stir in|beat|combine|bowl|dress|season)/i],
  ['pan', /\b(fry|sizzle|sear|saut|pan|heat the oil|melt|wilt|brown|soften)/i],
  ['plate', /\b(serve|plate|top with|garnish|finish|eat)/i],
];

/** The scene for a step, from its title and text ("Wilt the spinach in a pan" → pan). */
export function sceneFor(step: Pick<RecipeStep, 'title' | 'text'>): Scene {
  for (const [scene, re] of KEYWORDS) if (re.test(step.title)) return scene;
  for (const [scene, re] of KEYWORDS) if (re.test(step.text)) return scene;
  return 'bowl';
}

/** Palette per scene: design tokens only. */
const NAVY = 'var(--navy)';
const APRICOT = 'var(--apricot)';
const SAGE = 'var(--sage)';
const OLIVE = 'var(--olive)';
const TERRA = 'var(--terra)';
const WHITE = 'var(--white)';
const SHELF = 'var(--shelf)';
const PERI = 'var(--periwinkle)';

const steam = (x: number, y: number) => (
  <path
    d={`M${x} ${y}c0-5 5-5 5-10s-5-5-5-10M${x + 12} ${y}c0-5 5-5 5-10s-5-5-5-10`}
    stroke={NAVY}
    strokeWidth="3"
    strokeLinecap="round"
    fill="none"
    opacity="0.6"
  />
);
const greens = (pts: [number, number][]) =>
  pts.map(([x, y], i) => (
    <ellipse
      key={i}
      cx={x}
      cy={y}
      rx="6"
      ry="3.5"
      fill={OLIVE}
      transform={`rotate(${i * 50} ${x} ${y})`}
    />
  ));

const art: Record<Scene, JSX.Element> = {
  pan: (
    <>
      <circle cx="68" cy="62" r="34" fill={NAVY} />
      <rect x="100" y="57" width="44" height="10" rx="5" fill={NAVY} />
      {greens([
        [58, 52],
        [74, 58],
        [62, 72],
        [80, 70],
        [70, 46],
      ])}
    </>
  ),
  pot: (
    <>
      {steam(62, 30)}
      <rect x="36" y="46" width="72" height="50" rx="10" fill={NAVY} />
      <rect x="28" y="44" width="88" height="8" rx="4" fill={NAVY} />
      <rect x="44" y="56" width="56" height="6" rx="3" fill={APRICOT} opacity="0.8" />
    </>
  ),
  bowl: (
    <>
      <path d="M30 56h84a42 30 0 0 1-84 0Z" fill={WHITE} stroke={NAVY} strokeWidth="4" />
      <ellipse cx="72" cy="56" rx="38" ry="7" fill={SAGE} />
      <path d="M96 30 82 58" stroke={NAVY} strokeWidth="5" strokeLinecap="round" />
      <circle cx="60" cy="56" r="3" fill={OLIVE} />
      <circle cx="74" cy="54" r="3" fill={OLIVE} />
    </>
  ),
  board: (
    <>
      <rect
        x="22"
        y="44"
        width="92"
        height="50"
        rx="10"
        fill={APRICOT}
        stroke={NAVY}
        strokeWidth="3"
      />
      <rect x="40" y="58" width="22" height="22" rx="4" fill={TERRA} />
      <rect x="66" y="64" width="16" height="16" rx="4" fill={OLIVE} />
      <path d="M96 24 118 58" stroke={NAVY} strokeWidth="6" strokeLinecap="round" />
      <path d="M118 58 126 70" stroke={SHELF} strokeWidth="6" strokeLinecap="round" />
    </>
  ),
  tray: (
    <>
      <rect x="24" y="34" width="96" height="62" rx="8" fill={NAVY} />
      <rect x="32" y="42" width="80" height="34" rx="4" fill={APRICOT} />
      <circle cx="48" cy="58" r="7" fill={TERRA} />
      <circle cx="68" cy="56" r="7" fill={OLIVE} />
      <circle cx="90" cy="60" r="7" fill={TERRA} />
      <circle cx="40" cy="86" r="4" fill={APRICOT} />
      <circle cx="56" cy="86" r="4" fill={APRICOT} />
    </>
  ),
  blender: (
    <>
      <path d="M50 24h44l-6 52H56Z" fill={PERI} stroke={NAVY} strokeWidth="4" />
      <path d="M54 50h36l-3 26H57Z" fill={SAGE} />
      <rect x="48" y="76" width="48" height="22" rx="6" fill={NAVY} />
      <circle cx="72" cy="87" r="4" fill={WHITE} />
    </>
  ),
  wok: (
    <>
      {steam(62, 26)}
      <path d="M26 50h92a46 34 0 0 1-92 0Z" fill={NAVY} />
      <rect x="114" y="46" width="24" height="8" rx="4" fill={NAVY} />
      {greens([
        [52, 52],
        [68, 56],
        [86, 52],
      ])}
      <circle cx="78" cy="58" r="4" fill={TERRA} />
      <circle cx="60" cy="58" r="4" fill={APRICOT} />
    </>
  ),
  plate: (
    <>
      <ellipse cx="72" cy="64" rx="50" ry="30" fill={WHITE} stroke={NAVY} strokeWidth="4" />
      <ellipse cx="72" cy="64" rx="32" ry="18" fill={APRICOT} />
      {greens([
        [62, 58],
        [80, 62],
        [70, 70],
      ])}
      <circle cx="88" cy="56" r="4" fill={TERRA} />
    </>
  ),
  toast: (
    <>
      <circle cx="68" cy="62" r="34" fill={NAVY} />
      <rect x="100" y="57" width="44" height="10" rx="5" fill={NAVY} />
      <path d="M44 62a24 24 0 0 1 48 0Z" fill={APRICOT} />
      <path d="M50 58h36" stroke={TERRA} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
    </>
  ),
  rest: (
    <>
      <rect x="36" y="54" width="72" height="42" rx="10" fill={NAVY} />
      <path d="M30 54a42 22 0 0 1 84 0Z" fill={PERI} stroke={NAVY} strokeWidth="4" />
      <rect x="66" y="26" width="12" height="8" rx="3" fill={NAVY} />
      <circle cx="116" cy="34" r="14" fill={WHITE} stroke={NAVY} strokeWidth="3" />
      <path d="M116 26v8l6 4" stroke={NAVY} strokeWidth="3" strokeLinecap="round" fill="none" />
    </>
  ),
};

/**
 * RCP-5 step illustration (no photos): one of ten kitchen scenes in the app's palette, picked
 * from the step's wording. Decorative: the step text says everything.
 */
export function StepIllustration({
  step,
  className,
}: {
  step: Pick<RecipeStep, 'title' | 'text'>;
  className?: string;
}) {
  const scene = sceneFor(step);
  return (
    <span
      aria-hidden="true"
      data-scene={scene}
      className={cx('flex items-center justify-center rounded-card bg-apricot/60', className)}
    >
      <svg viewBox="0 0 144 112" className="h-full max-h-40 w-full">
        {art[scene]}
      </svg>
    </span>
  );
}
