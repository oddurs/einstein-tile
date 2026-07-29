/**
 * The ink gate.
 *
 * `palette.ts` has been validated since sprint 1, and the scenes ignored it —
 * fourteen one-off `rgba()` values and four different greys for one idea, each
 * a reasonable local choice, none of them checked by anything.
 *
 * Two kinds of test here, and the first matters more than the second:
 *
 * 1. **No scene may define a colour.** Without this, the consolidation lasts
 *    exactly until the next scene is written — which is precisely how four
 *    greys came to exist. The rule has to outlive the sprint that noticed it.
 *
 * 2. **The ink roles face the same gates the tile palettes do**, including one
 *    pair that had never been checked against each other despite being the one
 *    place the piece asks a reader to distinguish two states by colour.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  INK,
  METATILE,
  REFLECTION,
  STROKE_WIDTH,
  SURFACE,
} from '../src/renderer/palette.js';
import { contrast, deltaE } from './helpers/cvd.js';

const SCENES = new URL('../src/scenes/', import.meta.url).pathname;
const THEMES = ['light', 'dark'] as const;

/**
 * Flatten a translucent ink onto the surface it is drawn over.
 *
 * The ink roles carry alpha, because a construction line that is *seen through*
 * is the entire point of one. So the colour a reader actually sees is the
 * composite, and that — not the nominal value — is what has to pass a contrast
 * gate. Measuring the unflattened value would be measuring a colour nobody
 * ever sees.
 */
function over(ink: string, backdrop: string): string {
  const rgba = ink.match(/rgba?\(([^)]+)\)/);
  if (!rgba) return ink;
  const [r, g, b, a = 1] = rgba[1]!.split(',').map((n) => Number(n.trim()));
  const bg = backdrop.replace(/^#/, '');
  const back = [0, 2, 4].map((i) => parseInt(bg.slice(i, i + 2), 16));
  const mix = [r!, g!, b!].map((c, i) => Math.round(c * a + back[i]! * (1 - a)));
  return `#${mix.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

describe('no scene defines a colour', () => {
  const files = readdirSync(SCENES).filter((f) => f.endsWith('.ts'));

  it('finds the scene sources', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const file of files) {
    it(file, () => {
      const source = readFileSync(join(SCENES, file), 'utf8');
      // Strip block and line comments: the documentation of what these values
      // *used* to be is the point of that documentation, and must not trip it.
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');

      const literals = [
        ...code.matchAll(/#[0-9a-fA-F]{3,8}\b/g),
        ...code.matchAll(/\brgba?\s*\(/g),
        ...code.matchAll(/\bhsla?\s*\(/g),
      ].map((m) => m[0]);

      expect(
        literals,
        `${file} defines colour directly. Colour belongs in palette.ts, where it is validated — ` +
          `add a semantic role to INK rather than a value here.`,
      ).toEqual([]);
    });
  }
});

describe('ink roles', () => {
  /**
   * The one pair a reader must tell apart *by colour alone*.
   *
   * In `repeat`, a tile that landed on a tile is drawn in one colour and a tile
   * that missed in another, and the whole scene is the reader judging which is
   * which. Both colours come from validated palettes — but from *different*
   * ones, so they had never been checked against each other. This is exactly
   * the gap a per-palette check leaves open.
   */
  for (const theme of THEMES) {
    it(`landed vs missed stay distinct under CVD (${theme})`, () => {
      const landed = METATILE[theme].P;
      const missed = REFLECTION[theme].mirrored;
      for (const kind of ['protan', 'deutan', 'tritan'] as const) {
        expect(deltaE(landed, missed, kind), `${kind}`).toBeGreaterThanOrEqual(8);
      }
      expect(deltaE(landed, missed)).toBeGreaterThanOrEqual(15);
    });
  }

  /**
   * `plain` is a tile that is the subject but has no identity yet — 7,921 of
   * them at stage 0 of the hierarchy. If it does not separate from the surface,
   * "one shape, over and over" reads as one grey mass, which is that scene's
   * point inverted.
   */
  for (const theme of THEMES) {
    it(`plain separates from the surface (${theme})`, () => {
      expect(contrast(INK[theme].plain, SURFACE[theme])).toBeGreaterThanOrEqual(1.35);
    });

    it(`scaffold recedes further than plain (${theme})`, () => {
      // Scaffold is looked *through*; plain is looked *at*.
      expect(contrast(INK[theme].scaffold, SURFACE[theme])).toBeLessThan(
        contrast(INK[theme].plain, SURFACE[theme]),
      );
    });

    it(`outline reads against every metatile fill (${theme})`, () => {
      for (const [label, fill] of Object.entries(METATILE[theme])) {
        expect(contrast(over(INK[theme].outline, fill), fill), label).toBeGreaterThanOrEqual(2);
      }
    });
  }

  it('stroke weights are ordered and distinct', () => {
    const { hairline, fine, strong } = STROKE_WIDTH;
    expect(hairline).toBeLessThan(fine);
    expect(fine).toBeLessThan(strong);
  });

  it('every role exists in both themes', () => {
    expect(Object.keys(INK.light).sort()).toEqual(Object.keys(INK.dark).sort());
  });
});
