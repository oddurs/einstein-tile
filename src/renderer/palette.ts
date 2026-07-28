/**
 * ⚠️ PLACEHOLDER PALETTE — ticket A3 replaces this.
 *
 * Enough to see the tiling and prove the renderer works. It is deliberately
 * restrained rather than designed, and it does **not** yet satisfy the
 * accessibility requirement in docs/06 §4: the 12-hue orientation scheme is
 * pure hue rotation, which is exactly the thing that fails for the ~8% of men
 * with red-green colour vision deficiency.
 *
 * A3 must add a lightness-varying alternative and run a CVD simulation before
 * any of this is considered shippable. Do not build on these values.
 */

import type { ColourScheme, Tile } from '../engine/index.js';
import { colourKey } from '../engine/index.js';

export interface Palette {
  readonly background: string;
  readonly stroke: string;
  /** Stroke width in CSS pixels, constant on screen regardless of zoom. */
  readonly strokeWidth: number;
  fill(key: number | string): string;
}

const METATILE_FILLS: Record<string, string> = {
  H: '#c2603f',
  T: '#3f6ec2',
  P: '#5fa86b',
  F: '#d8a33c',
};

export function makePalette(scheme: ColourScheme, dark: boolean): Palette {
  const background = dark ? '#12131a' : '#faf9f6';
  const stroke = dark ? 'rgba(0,0,0,0.55)' : 'rgba(30,28,26,0.5)';
  const lum = dark ? 46 : 62;

  return {
    background,
    stroke,
    strokeWidth: 0.75,
    fill(key) {
      switch (scheme) {
        case 'orientation':
          // 12 hues. Placeholder, and an accessibility problem — see above.
          return `hsl(${(Number(key) * 360) / 12} 52% ${lum}%)`;
        case 'metatile':
          return METATILE_FILLS[String(key)] ?? '#888';
        case 'reflection':
          return key === 1
            ? dark
              ? '#e0623f'
              : '#d4553a'
            : dark
              ? '#2f3550'
              : '#cfd4e4';
      }
    },
  };
}

export function tileColourKey(tile: Tile, scheme: ColourScheme): number | string {
  return colourKey(tile, scheme);
}
