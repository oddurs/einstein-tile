/**
 * The CSS custom properties every page uses, derived from the palette.
 *
 * These were hand-copied into five `<style>` blocks. They had not drifted — but
 * nothing prevented it, and that mattered more than the duplication: every CVD
 * separation and contrast figure in `palette.ts` was computed against exactly
 * these surfaces. A careless edit to one page would have silently invalidated
 * the accessibility work with every test still green.
 *
 * Now there is one source, `SURFACE`, and `test/tokens.test.ts` fails if any
 * page disagrees with it.
 */

import { SURFACE } from './palette.js';
import { spaceCSS } from './space.js';
import { typeCSS } from './type.js';

export interface Tokens {
  readonly bg: string;
  readonly fg: string;
  /** Fallback first, then the `color-mix` refinement — Safari 16.4+. */
  readonly muted: readonly [string, string];
  readonly line: string;
  readonly panel: string;
  readonly accent: string;
  readonly good: string;
}

export const TOKENS: Record<'light' | 'dark', Tokens> = {
  light: {
    bg: SURFACE.light,
    fg: '#1a1a19',
    muted: ['#62615e', `color-mix(in oklab, #1a1a19 62%, ${SURFACE.light})`],
    line: 'rgba(26, 26, 25, 0.14)',
    panel: 'rgba(252, 252, 251, 0.92)',
    accent: '#3eb4f1',
    good: '#1f9d55',
  },
  dark: {
    bg: SURFACE.dark,
    fg: '#f0efec',
    muted: ['#a6a5a1', `color-mix(in oklab, #f0efec 66%, ${SURFACE.dark})`],
    line: 'rgba(240, 239, 236, 0.16)',
    panel: 'rgba(26, 26, 25, 0.92)',
    accent: '#0e97d2',
    good: '#35b26a',
  },
};

const declare = (t: Tokens): string =>
  [
    `--bg: ${t.bg};`,
    `--fg: ${t.fg};`,
    `--muted: ${t.muted[0]};`,
    `--muted: ${t.muted[1]};`,
    `--line: ${t.line};`,
    `--panel: ${t.panel};`,
    `--accent: ${t.accent};`,
    `--good: ${t.good};`,
  ].join('\n    ');

/**
 * The `:root` block, ready to inline into a page's stylesheet.
 *
 * Colour and type are emitted together so a page has exactly one place to pull
 * in, and cannot acquire one while forgetting the other — which is how
 * `--measure` went missing in sprint 7.
 */
export const rootCSS = (base = ''): string =>
  `${typeCSS(base)}\n  ` +
  `:root {\n    ${spaceCSS()}\n    ${declare(TOKENS.light)}\n  }\n` +
  // One place where motion is switched off, so a transition added later cannot
  // forget to honour the preference.
  `  @media (prefers-reduced-motion: reduce) {\n` +
  `    :root { --motion-quick: 0ms; --motion-settle: 0ms; }\n  }\n` +
  `  @media (prefers-color-scheme: dark) {\n` +
  `    :root {\n    ${declare(TOKENS.dark)}\n    }\n  }`;
