import type { ReactNode, SVGProps } from 'react';

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  /** Rendered size in px (converted to rem so icons scale with text size). */
  size?: number;
  /** Stroke width; SRS 4.4 uses 2, active nav icons use 2.4. */
  strokeWidth?: number;
  /** Accessible name. Omit for decorative icons (the default). */
  title?: string;
};

/** Base for all icons: 24 px grid, round caps and joins, currentColor (SRS 4.4). */
export function Icon({
  size = 24,
  strokeWidth = 2,
  title,
  viewBox = '0 0 24 24',
  children,
  style,
  ...rest
}: IconProps & { children: ReactNode }) {
  const rem = `${size / 16}rem`;
  return (
    <svg
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: rem, height: rem, flexShrink: 0, ...style }}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}
