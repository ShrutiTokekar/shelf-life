// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8');
const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));

/** SRS 4.1 color tokens. If the spec changes, update both. */
const SRS_COLORS: Record<string, string> = {
  cream: '#fffbf3',
  shelf: '#f6f0e3',
  white: '#ffffff',
  line: '#e9e1d0',
  periwinkle: '#c8cfed',
  navy: '#4d5c9f',
  ink: '#2b3360',
  slate: '#555c80',
  sage: '#c0d3b4',
  olive: '#7a8567',
  'olive-dark': '#46512f',
  apricot: '#ffe2a8',
  'apricot-lid': '#edb35a',
  'apricot-border': '#f1ce8e',
  'apricot-dark': '#6b3a00',
  peach: '#f1d7bf',
  'terra-light': '#f6d3c8',
  terra: '#b5553f',
  'terra-dark': '#7e2e1c',
  'out-lid': '#b7bcd6',
  'sage-border': '#afc4a1',
  'peach-dark': '#6e4424',
  'list-navy': '#4d5c9f',
  'list-olive': '#7a8567',
  'list-amber': '#d9962e',
  'list-terra': '#b5553f',
  'list-gray': '#8a8fa8',
};

function tokenValue(name: string): string | undefined {
  return new RegExp(`--${name}:\\s*([^;]+);`).exec(rootBlock)?.[1]?.trim().toLowerCase();
}

describe('tokens.css', () => {
  it.each(Object.entries(SRS_COLORS))('SRS 4.1 --%s is %s', (name, hex) => {
    expect(tokenValue(name)).toBe(hex);
  });

  it('SRS 4.1 high contrast swaps slate to ink and borders to slate', () => {
    const hc = css.slice(css.indexOf(":root[data-contrast='high']"));
    expect(hc).toMatch(/--slate:\s*#2b3360/i);
    expect(hc).toMatch(/--border-color:\s*#555c80/i);
  });

  it('A11Y-6 text sizes are 100 / 115 / 130%', () => {
    expect(css).toMatch(/data-text-size='default'\]\s*{\s*font-size:\s*100%/);
    expect(css).toMatch(/data-text-size='large'\]\s*{\s*font-size:\s*115%/);
    expect(css).toMatch(/data-text-size='largest'\]\s*{\s*font-size:\s*130%/);
  });

  it('SRS 4.2 font roles: Agbalumo wordmark, Abril Fatface display, Fredoka UI', () => {
    expect(tokenValue('font-wordmark')).toMatch(/^'agbalumo'/);
    expect(tokenValue('font-display')).toMatch(/^'abril fatface'/);
    expect(tokenValue('font-ui')).toMatch(/^'fredoka'/);
  });
});
