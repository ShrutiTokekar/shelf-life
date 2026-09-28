import { Icon, type IconProps } from './Icon';

// Paths come from the Figma Components board / Nav/Bottom v2 (24 px grid unless noted).

export const SunIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
);

export const JarIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 3h8v3H8V3Z" />
    <path d="M7 6h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
    <path d="M5 12h14" />
  </Icon>
);

export const ListIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 6h10M10 12h10M10 18h10" />
    <path d="M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17" />
  </Icon>
);

export const PotIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 11h16v2a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7v-2Z" />
    <path d="M9 8c0-1.5 1-1.5 1-3M14 8c0-1.5 1-1.5 1-3" />
  </Icon>
);

/** Figma draws scan on a 26 px grid. */
export const ScanIcon = (p: IconProps) => (
  <Icon viewBox="0 0 26 26" size={26} strokeWidth={2.17} {...p}>
    <path d="M4.33 8.67V5.42c0-.6.49-1.09 1.09-1.09h3.25M17.33 4.33h3.25c.6 0 1.09.49 1.09 1.09v3.25M21.67 17.33v3.25c0 .6-.49 1.09-1.09 1.09h-3.25M8.67 21.67H5.42c-.6 0-1.09-.49-1.09-1.09v-3.25" />
    <path d="M8.67 9.75h8.66M8.67 13h8.66M8.67 16.25h5.41" />
  </Icon>
);

export const BellIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 16v-5a6 6 0 1 1 12 0v5l2 2H4l2-2Z" />
    <path d="M10 21h4" />
  </Icon>
);

export const ContrastIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 4v16" />
    <path d="M12 4a8 8 0 0 1 0 16V4Z" fill="currentColor" />
  </Icon>
);

export const UploadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 16V4M17 9l-5-5-5 5" />
    <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </Icon>
);

export const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Icon>
);

export const WarnIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </Icon>
);

export const RefreshIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 11a8 8 0 0 0-14.8-4M4 5v4h4" />
    <path d="M4 13a8 8 0 0 0 14.8 4M20 19v-4h-4" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12.5 10 17l9-10" />
  </Icon>
);

export const CloudOffIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 3l18 18" />
    <path d="M8 8a5 5 0 0 0-1 9.9h10.5M20.4 16.2A4 4 0 0 0 17 10h-.3A6 6 0 0 0 10.5 6" />
  </Icon>
);

/**
 * The brand "time arrow" (SRS 4.6): navy bar + arrowhead under the active nav item.
 * `variant="bottom"` is 30×10 (mobile nav), `"header"` is 60×14 (desktop tabs).
 */
export function TimeArrow({
  variant,
  hidden = false,
}: {
  variant: 'bottom' | 'header';
  hidden?: boolean;
}) {
  const [w, h] = variant === 'bottom' ? [30, 10] : [60, 14];
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      style={{
        width: `${w / 16}rem`,
        height: `${h / 16}rem`,
        visibility: hidden ? 'hidden' : 'visible',
      }}
      aria-hidden="true"
      focusable="false"
      className="text-navy"
    >
      {variant === 'bottom' ? (
        <>
          <rect x="0" y="3.5" width="24" height="3" rx="1.5" fill="currentColor" />
          <path
            d="M22 1l7 4-7 4V1Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <rect x="0" y="5" width="50" height="4" rx="2" fill="currentColor" />
          <path
            d="M48 2l10 5-10 5V2Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}

// Pantry icons (Figma 03 / 13). Native viewBoxes are kept; `size` scales them.

export const PlusIcon = (p: IconProps) => (
  <Icon viewBox="0 0 22 22" size={22} {...p}>
    <path d="M11 4.58v12.84M4.58 11h12.84" />
  </Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon viewBox="0 0 20 20" size={20} {...p}>
    <circle cx="9.17" cy="9.17" r="5.83" />
    <path d="M16.67 16.67 13.75 13.75" />
  </Icon>
);

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const EditIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16v4Z" />
    <path d="m13.5 6.5 4 4" />
  </Icon>
);

export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </Icon>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

export const ClockIcon = (p: IconProps) => (
  <Icon viewBox="0 0 18 18" size={18} {...p}>
    <circle cx="9" cy="9" r="6" />
    <path d="M9 6v3l2.25 1.5" />
  </Icon>
);

/** Fresh status and the Produce category share the leaf. */
export const LeafIcon = (p: IconProps) => (
  <Icon viewBox="0 0 18 18" size={18} {...p}>
    <path d="M3.75 14.25c0-6.75 4.5-10.5 11.25-10.5 0 6.75-3.75 11.25-10.5 11.25" />
    <path d="m3.75 14.25 6-6" />
  </Icon>
);

export const EmptyJarIcon = (p: IconProps) => (
  <Icon viewBox="0 0 18 18" size={18} {...p}>
    <path d="M6 2.25h6V4.5H6V2.25Z" />
    <path d="M5.25 4.5h7.5a1.5 1.5 0 0 1 1.5 1.5v8.25a1.5 1.5 0 0 1-1.5 1.5h-7.5a1.5 1.5 0 0 1-1.5-1.5V6a1.5 1.5 0 0 1 1.5-1.5Z" />
  </Icon>
);

export const CartIcon = (p: IconProps) => (
  <Icon viewBox="0 0 16 16" size={16} {...p}>
    <path d="M2.67 3.33H4l1.33 7.34H12l1.33-5.34H4.67" />
    <circle cx="6.67" cy="12.67" r="1" />
    <circle cx="11.33" cy="12.67" r="1" />
  </Icon>
);

export const GridIcon = (p: IconProps) => (
  <Icon viewBox="0 0 18 18" size={18} {...p}>
    <rect x="3" y="3" width="5.25" height="5.25" rx="1.13" />
    <rect x="9.75" y="3" width="5.25" height="5.25" rx="1.13" />
    <rect x="3" y="9.75" width="5.25" height="5.25" rx="1.13" />
    <rect x="9.75" y="9.75" width="5.25" height="5.25" rx="1.13" />
  </Icon>
);

export const MilkIcon = (p: IconProps) => (
  <Icon viewBox="0 0 18 18" size={18} {...p}>
    <path d="M6.75 2.25h4.5V4.5l1.5 2.25v9h-7.5v-9l1.5-2.25V2.25Z" />
    <path d="M5.25 9.75h7.5" />
  </Icon>
);

export const GrainIcon = (p: IconProps) => (
  <Icon viewBox="0 0 18 18" size={18} {...p}>
    <path d="M9 15.75v-9" />
    <path d="M9 6.75c-2.25 0-3-1.5-3-3 1.5 0 3 .75 3 3Zm0 0c2.25 0 3-1.5 3-3-1.5 0-3 .75-3 3Zm0 3.75c-2.25 0-3-1.5-3-3 1.5 0 3 .75 3 3Zm0 0c2.25 0 3-1.5 3-3-1.5 0-3 .75-3 3Z" />
  </Icon>
);

export const SpiceIcon = (p: IconProps) => (
  <Icon viewBox="0 0 18 18" size={18} {...p}>
    <path d="M6.75 2.25h4.5v3h-4.5v-3Z" />
    <path d="M6 5.25h6l.75 10.5h-7.5L6 5.25Z" />
    <path d="M7.5 9h.01M10.5 9h.01M9 11.25h.01" />
  </Icon>
);

export const SnowIcon = (p: IconProps) => (
  <Icon viewBox="0 0 18 18" size={18} {...p}>
    <path d="M9 2.25v13.5M3.15 5.63l11.7 6.75M3.15 12.38l11.7-6.75" />
  </Icon>
);

export const BoxIcon = (p: IconProps) => (
  <Icon viewBox="0 0 18 18" size={18} {...p}>
    <path d="M3 6l6-3 6 3v6l-6 3-6-3V6Z" />
    <path d="M3 6l6 3m0 0 6-3m-6 3v6" />
  </Icon>
);

/** Web 13 uses a fridge glyph on the quantity line. */
export const FridgeIcon = (p: IconProps) => (
  <Icon viewBox="0 0 18 18" size={18} {...p}>
    <rect x="4.5" y="2.25" width="9" height="13.5" rx="1.5" />
    <path d="M4.5 7.5h9M6.75 4.5v1.5M6.75 9.75v1.5" />
  </Icon>
);

export const SparkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />
  </Icon>
);

export const SkipIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="m6.5 6.5 11 11" />
  </Icon>
);

export const FlashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
  </Icon>
);

export const ImageIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="2" />
    <path d="m21 16-5-5-9 9" />
  </Icon>
);

/** In-progress step marker (Figma 04 "dots"). */
export const DotsIcon = (p: IconProps) => (
  <Icon viewBox="0 0 12 12" size={12} {...p}>
    <circle cx="6" cy="6" r="2" fill="currentColor" stroke="none" />
  </Icon>
);

export { Icon };
export type { IconProps };
