/**
 * Colour, computed rather than chosen.
 *
 * Every value here was produced by search and checked with the data-viz
 * skill's validator (Machado–Oliveira–Fernandes severity-1.0 CVD simulation,
 * OKLab ΔE×100). `test/palette.test.ts` re-runs the same gates in CI, so these
 * numbers cannot silently rot. Do not hand-tune a hex without re-running it.
 *
 * ## The design problem, and what it forced
 *
 * A tiling is an **all-pairs** situation — any tile can neighbour any other —
 * so palettes here face the strict gate, not the adjacent-only one charts use.
 *
 * 1. **Four hues at constant lightness cannot be made CVD-safe.** A sweep of
 *    the reference palette found 2 of 70 four-colour sets passing all-pairs in
 *    both modes, both stuck in the 6–8 warn band. A wider OKLCH sweep at fixed
 *    lightness found *nothing* at ΔE ≥ 8. This is structural: CVD collapses the
 *    red–green axis, leaving roughly one chromatic axis. The fix is to stop
 *    relying on hue alone — CVD preserves **lightness**. Varying lightness
 *    across the four slots reached ΔE 14.7 (light) / 9.0 (dark).
 *
 * 2. **Twelve orientations cannot be twelve hues.** No categorical palette
 *    supports twelve. But 12 = 6 rotations × 2 chiralities, so the accessible
 *    scheme encodes the factors instead: rotation as a 6-step lightness ramp
 *    (ordinal, CVD-preserved), chirality as blue vs ochre (the blue–yellow axis
 *    is the one CVD leaves intact). Cross-family separation is ΔE ≈ 19.
 *
 *    The `vivid` orientation scheme is a 12-hue wheel. It is beautiful, it
 *    encodes the cyclic structure honestly, and it is **not** CVD-safe (worst
 *    pair ΔE 1.1). That is why `accessible` exists and why docs/06 §4 requires
 *    shipping it. Never make vivid the only option.
 *
 * Surfaces are the validator's defaults so the published numbers apply exactly.
 */

import type { ColourScheme, Tile } from '../engine/index.js';
import { colourKey } from '../engine/index.js';

/** `vivid` favours beauty; `accessible` is colour-vision-safe throughout. */
export type ColourMode = 'vivid' | 'accessible';

export interface Surfaces {
  readonly background: string;
  readonly stroke: string;
}

export interface Palette {
  readonly background: string;
  readonly stroke: string;
  /** Stroke width in CSS pixels; constant on screen at every zoom. */
  readonly strokeWidth: number;
  fill(key: number | string): string;
}

export const SURFACE = {
  light: '#fcfcfb',
  dark: '#1a1a19',
} as const;

/** The hairline between neighbouring tiles. Exported because the SVG export
 *  needs the same value the canvas uses, and had been keeping its own copy. */
export const TILE_STROKE = {
  light: 'rgba(26,26,25,0.42)',
  dark: 'rgba(0,0,0,0.5)',
} as const;

// ── metatile: 4 categorical, all-pairs CVD-safe ───────────────────────────
// light worst all-pairs CVD ΔE 14.7 (protan), normal 18.1
// dark  worst all-pairs CVD ΔE  9.0 (deutan), normal 16.1
// Order is H, T, P, F. H is the largest metatile, so it takes the strongest hue.
export const METATILE = {
  light: { H: '#ac3450', T: '#c98f20', P: '#3eb4f1', F: '#6b4aa7' },
  dark: { H: '#b9415b', T: '#ac7400', P: '#0e97d2', F: '#7c5bbb' },
} as const;

// ── reflection: 2, figure/ground ──────────────────────────────────────────
// Reflected hats are only ~1 in 8 (the φ⁴ ratio), and this scheme exists to
// make that visible at a glance — so they get the assertive colour and the
// majority recedes. Separated on lightness as well as hue.
// light CVD ΔE 23.2 · dark CVD ΔE 19.6
export const REFLECTION = {
  light: { plain: '#67a4dd', mirrored: '#aa2e4c' },
  dark: { plain: '#5a96ce', mirrored: '#ae2d4d' },
} as const;

// ── orientation, vivid: 12-hue cyclic wheel ───────────────────────────────
// Deliberately NOT CVD-safe (worst pair ΔE 1.1). Encodes the cyclic structure
// of rotation, which a lightness ramp cannot. Always pair with `accessible`.
export const ORIENTATION_VIVID = {
  light: [
    '#d36c8f', '#d86f5f', '#cd7c2d', '#b28d00', '#889e31', '#4ba964',
    '#00ac95', '#00a7bf', '#2e9bdc', '#728ce5', '#9f7dd8', '#c072b9',
  ],
  dark: [
    '#c66083', '#ca6353', '#c06f1d', '#a68100', '#7c9120', '#3e9c58',
    '#009f89', '#009bb3', '#1a8fcf', '#6780d7', '#9371cb', '#b365ac',
  ],
} as const;

// ── orientation, accessible: 6 lightness steps × 2 chirality hues ─────────
// Each ramp passes every ordinal gate (monotone lightness, adjacent ΔL ≥ 0.06,
// end-step contrast ≥ 2:1, single hue). Index 0–5 is rotation unreflected,
// 6–11 is rotation reflected.
export const ORIENTATION_ACCESSIBLE = {
  light: [
    '#002e61', '#004074', '#0a5288', '#23659c', '#3878b0', '#4c8bc5',
    '#4e1f00', '#603100', '#734300', '#875500', '#9b6800', '#af7b11',
  ],
  dark: [
    '#055085', '#206299', '#3474ac', '#4787c0', '#5a9ad5', '#6dadea',
    '#714100', '#845200', '#976400', '#aa7705', '#be8a29', '#d39d40',
  ],
} as const;

// ── ink: the supporting marks every scene draws ───────────────────────────
/**
 * The colours that are not tile identity.
 *
 * These existed before this block did — as **fourteen one-off `rgba()` values
 * and four different greys**, one set per scene, each a reasonable local choice
 * and collectively the reason the scenes looked like five programs. Measured:
 *
 * | | hat | repeat | recurrence | hierarchy |
 * | --- | --- | --- | --- | --- |
 * | light | `#dde3e8` | `#ccd3da` | `#d3d9de` | `#aab6bf` |
 * | dark | `#2c343d` | `#38414d` | `#333c46` | `#4a5c68` |
 *
 * Averaging those into one grey would have been the wrong fix, because they
 * were doing **two** jobs, not one:
 *
 * - `scaffold` — structure the reader looks *through*. The hat's hexagons are
 *   the workbench, not the subject; they must recede.
 * - `plain` — a tile that *is* the subject but has no identity yet. Stage 0 of
 *   the hierarchy is 7,921 of these, and if they do not separate from the
 *   surface then "one shape, over and over" reads as one grey mass — which is
 *   the opposite of that scene's point.
 *
 * So: two roles, stated, instead of four accidents.
 *
 * `outline` replaces four hand-matched strokes (`hatLine`, `landedStroke`,
 * `echoLine`, `pickLine`) that had already converged — three of the four were
 * `rgba(10,45,80,·)` at different alphas — without anyone noticing they had.
 */
export const INK = {
  light: {
    scaffold: '#dde3e8',
    plain: '#b9c3cc',
    grid: 'rgba(26,26,25,0.22)',
    guide: 'rgba(26,26,25,0.32)',
    ghost: 'rgba(70,130,190,0.20)',
    ghostLine: 'rgba(45,95,150,0.62)',
    outline: 'rgba(12,30,52,0.72)',
  },
  dark: {
    scaffold: '#2c343d',
    plain: '#46525e',
    grid: 'rgba(240,239,236,0.30)',
    guide: 'rgba(240,239,236,0.42)',
    ghost: 'rgba(120,175,225,0.22)',
    ghostLine: 'rgba(150,195,240,0.75)',
    outline: 'rgba(240,248,255,0.88)',
  },
} as const;

/**
 * Stroke weights, so that 1.4 versus 1.5 is a choice and not a coincidence.
 * The scenes used 1, 1.2, 1.4, 1.5 and 1.6 with no rule telling them apart.
 */
export const STROKE_WIDTH = {
  /** Construction lines, seen through. */
  hairline: 1,
  /** A boundary that matters but is not the subject. */
  fine: 1.2,
  /** The thing being pointed at. */
  strong: 1.6,
} as const;

export interface PaletteOptions {
  dark?: boolean;
  mode?: ColourMode;
}

export function makePalette(
  scheme: ColourScheme,
  { dark = false, mode = 'accessible' }: PaletteOptions = {},
): Palette {
  const theme = dark ? 'dark' : 'light';

  return {
    background: SURFACE[theme],
    stroke: TILE_STROKE[theme],
    strokeWidth: 0.75,
    fill(key) {
      switch (scheme) {
        case 'orientation': {
          const ramp =
            mode === 'vivid' ? ORIENTATION_VIVID[theme] : ORIENTATION_ACCESSIBLE[theme];
          return ramp[Number(key) % 12] ?? ramp[0]!;
        }
        case 'metatile': {
          const table = METATILE[theme];
          return table[String(key) as keyof typeof table] ?? table.H;
        }
        case 'reflection':
          return Number(key) === 1
            ? REFLECTION[theme].mirrored
            : REFLECTION[theme].plain;
      }
    },
  };
}

export function tileColourKey(tile: Tile, scheme: ColourScheme): number | string {
  return colourKey(tile, scheme);
}
