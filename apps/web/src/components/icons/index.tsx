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

export { Icon };
export type { IconProps };
