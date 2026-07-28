/**
 * The palette gate, enforced in CI.
 *
 * docs/09 ticket A3 requires the schemes to "pass a simulated
 * protanopia/deuteranopia check". A claim in a comment is not a check — these
 * tests re-run the same maths the data-viz validator used to pick the values,
 * so a well-meaning hex tweak that breaks colour-vision safety fails the build.
 *
 * Thresholds are the validator's, and are calibrated to the
 * Machado–Oliveira–Fernandes severity-1.0 model in `helpers/cvd.ts`.
 */

import { describe, expect, it } from 'vitest';
import {
  METATILE,
  ORIENTATION_ACCESSIBLE,
  ORIENTATION_VIVID,
  REFLECTION,
  SURFACE,
  makePalette,
} from '../src/renderer/palette.js';
import { contrast, deltaE, oklch, worstCvdPair, worstNormalPair } from './helpers/cvd.js';

/** OKLab ΔE×100, min(protan, deutan). 8 is target, 6 the absolute floor. */
const CVD_TARGET = 8.0;
/** Worst unsimulated pair. A hard gate in the validator. */
const NORMAL_FLOOR = 15.0;
/** Minimum OKLCH lightness step between adjacent ordinal ramp steps. */
const ORDINAL_MIN_DL = 0.06;
/** End step of an ordinal ramp, WCAG vs its surface. */
const ORDINAL_END_CONTRAST = 2.0;

const THEMES = ['light', 'dark'] as const;

describe('metatile palette (4 categorical, all pairs)', () => {
  for (const theme of THEMES) {
    const colours = Object.values(METATILE[theme]);

    it(`${theme}: separates every pair under protanopia and deuteranopia`, () => {
      const worst = worstCvdPair(colours);
      expect(
        worst.deltaE,
        `${worst.pair[0]} ↔ ${worst.pair[1]} under ${worst.kind}`,
      ).toBeGreaterThanOrEqual(CVD_TARGET);
    });

    it(`${theme}: separates every pair under normal vision`, () => {
      expect(worstNormalPair(colours).deltaE).toBeGreaterThanOrEqual(NORMAL_FLOOR);
    });

    it(`${theme}: has four distinct colours`, () => {
      expect(new Set(colours).size).toBe(4);
    });
  }
});

describe('reflection palette (2, figure/ground)', () => {
  for (const theme of THEMES) {
    const colours = Object.values(REFLECTION[theme]);

    it(`${theme}: the mirrored tiles are unmistakable`, () => {
      // This scheme's whole job is making the ~1-in-8 reflected hats visible,
      // so it should clear the target by a wide margin, not scrape past it.
      expect(worstCvdPair(colours).deltaE).toBeGreaterThan(15);
    });

    it(`${theme}: separates under normal vision`, () => {
      expect(worstNormalPair(colours).deltaE).toBeGreaterThanOrEqual(NORMAL_FLOOR);
    });
  }
});

describe('orientation — accessible mode', () => {
  for (const theme of THEMES) {
    const ramp = ORIENTATION_ACCESSIBLE[theme];
    const rotations = [ramp.slice(0, 6), ramp.slice(6, 12)];

    it(`${theme}: has 12 distinct colours`, () => {
      expect(new Set(ramp).size).toBe(12);
    });

    for (const [i, family] of rotations.entries()) {
      it(`${theme}: rotation ramp ${i} rises monotonically in lightness`, () => {
        const ls = family.map((c) => oklch(c).L);
        for (let k = 1; k < ls.length; k++) expect(ls[k]!).toBeGreaterThan(ls[k - 1]!);
      });

      it(`${theme}: rotation ramp ${i} steps by at least ΔL ${ORDINAL_MIN_DL}`, () => {
        const ls = family.map((c) => oklch(c).L);
        for (let k = 1; k < ls.length; k++) {
          expect(ls[k]! - ls[k - 1]!).toBeGreaterThanOrEqual(ORDINAL_MIN_DL - 1e-9);
        }
      });

      it(`${theme}: rotation ramp ${i} keeps both ends off the surface`, () => {
        for (const end of [family[0]!, family[5]!]) {
          expect(contrast(end, SURFACE[theme])).toBeGreaterThanOrEqual(
            ORDINAL_END_CONTRAST,
          );
        }
      });
    }

    it(`${theme}: chirality is readable under CVD at every rotation`, () => {
      // The point of the decomposition: reflected vs unreflected must never
      // collapse, whichever rotation steps are being compared.
      let worst = Infinity;
      for (const a of rotations[0]!) {
        for (const b of rotations[1]!) {
          worst = Math.min(worst, deltaE(a, b, 'protan'), deltaE(a, b, 'deutan'));
        }
      }
      expect(worst).toBeGreaterThanOrEqual(CVD_TARGET);
    });
  }
});

describe('orientation — vivid mode', () => {
  for (const theme of THEMES) {
    it(`${theme}: has 12 distinct colours`, () => {
      expect(new Set(ORIENTATION_VIVID[theme]).size).toBe(12);
    });
  }

  it('is NOT colour-vision-safe — which is exactly why accessible mode exists', () => {
    // Pinning the known trade-off. If this ever starts passing, the vivid ramp
    // was changed and the two modes may no longer be meaningfully different.
    const worst = worstCvdPair(ORIENTATION_VIVID.light);
    expect(worst.deltaE).toBeLessThan(CVD_TARGET);
  });
});

describe('makePalette', () => {
  it('serves every scheme in both themes and both modes', () => {
    for (const scheme of ['orientation', 'metatile', 'reflection'] as const) {
      for (const dark of [false, true]) {
        for (const mode of ['vivid', 'accessible'] as const) {
          const p = makePalette(scheme, { dark, mode });
          expect(p.background).toBe(dark ? SURFACE.dark : SURFACE.light);
          const keys = scheme === 'metatile' ? ['H', 'T', 'P', 'F'] : [0, 1, 5, 11];
          for (const k of keys) expect(p.fill(k)).toMatch(/^#[0-9a-f]{6}$/i);
        }
      }
    }
  });

  it('only the orientation scheme differs between vivid and accessible', () => {
    // The other two are already CVD-safe, so the toggle correctly leaves them
    // alone. Honesty over the appearance of consistency.
    for (const dark of [false, true]) {
      const vivid = makePalette('metatile', { dark, mode: 'vivid' });
      const safe = makePalette('metatile', { dark, mode: 'accessible' });
      expect(vivid.fill('H')).toBe(safe.fill('H'));

      const o1 = makePalette('orientation', { dark, mode: 'vivid' });
      const o2 = makePalette('orientation', { dark, mode: 'accessible' });
      expect(o1.fill(3)).not.toBe(o2.fill(3));
    }
  });

  it('wraps orientation keys beyond 11 rather than returning undefined', () => {
    const p = makePalette('orientation', { mode: 'accessible' });
    expect(p.fill(12)).toBe(p.fill(0));
    expect(p.fill(13)).toBe(p.fill(1));
  });
});
