import { describe, expect, it } from 'vitest';
import { alignment, bestAlignment, candidateShifts } from '../src/engine/alignment.js';
import { eis } from '../src/engine/eisenstein.js';
import { hexPatch } from '../src/engine/hexgrid.js';
import { buildPatch } from '../src/engine/patch.js';
import { polygon } from '../src/engine/render.js';
import type { Piece } from '../src/engine/alignment.js';

const hats = (level: number): Piece[] =>
  buildPatch(level).tiles.map((tile) => ({
    anchor: tile.iso.t,
    form: `${tile.iso.rot}${tile.iso.reflected ? 'm' : 'r'}`,
    points: polygon(tile),
  }));

describe('a periodic tiling slides onto itself', () => {
  const hex = hexPatch(3);

  it('matches perfectly under its own lattice vectors', () => {
    // (2,2) and (-2,4) generate the hexagon sublattice.
    for (const shift of [eis(2, 2), eis(-2, 4), eis(4, 4), eis(6, 6)]) {
      expect(alignment(hex, shift).perfect, `shift ${shift.a},${shift.b}`).toBe(true);
    }
  });

  it('does not match under a shift off its lattice', () => {
    expect(alignment(hex, eis(3, 1)).perfect).toBe(false);
    expect(alignment(hex, eis(1, 0)).perfect).toBe(false);
  });

  it('is found perfect by the exhaustive search', () => {
    expect(bestAlignment(hex, 8).alignment.perfect).toBe(true);
  });
});

describe('the hat tiling never slides onto itself', () => {
  const pieces = hats(2);

  it('has no perfect slide anywhere in range — the whole point', () => {
    // Exhaustive over every shift within radius 12. If this ever passes, either
    // the engine is wrong or mathematics is.
    for (let a = -12; a <= 12; a++) {
      for (let b = -12; b <= 12; b++) {
        if (a === 0 && b === 0) continue;
        expect(alignment(pieces, eis(a, b)).perfect, `shift ${a},${b}`).toBe(false);
      }
    }
  });

  it('has no perfect slide among the complete candidate set either', () => {
    // Stronger: a period *must* be one of these, so this rules out every
    // translation in the plane, not just the ones within a radius.
    for (const shift of candidateShifts(pieces)) {
      expect(alignment(pieces, shift).perfect).toBe(false);
    }
  });

  it('still gets partway — order without repetition', () => {
    // Patches do recur, so partial matches are common. That is a true and
    // separate fact, and the scene shows it rather than hiding it.
    const best = bestAlignment(pieces, 10);
    expect(best.alignment.fraction).toBeGreaterThan(0.2);
    expect(best.alignment.perfect).toBe(false);
  });

  it('gets no better with a bigger patch', () => {
    expect(bestAlignment(hats(3), 8).alignment.perfect).toBe(false);
  });
});

describe('candidate slides', () => {
  it('contains every shift that could possibly be a period', () => {
    // A period maps piece 0 onto a piece of the same form, so any shift outside
    // this set fails immediately. Verify by brute force: every shift that
    // matches piece 0 is in the set.
    const pieces = hats(1);
    const set = new Set(candidateShifts(pieces).map((s) => `${s.a},${s.b}`));
    for (let a = -8; a <= 8; a++) {
      for (let b = -8; b <= 8; b++) {
        if (a === 0 && b === 0) continue;
        const result = alignment(pieces, eis(a, b));
        if (result.matched.includes(0)) {
          expect(set.has(`${a},${b}`), `shift ${a},${b} matches piece 0`).toBe(true);
        }
      }
    }
  });

  it('excludes the identity, which matches trivially', () => {
    for (const s of candidateShifts(hats(1))) {
      expect(s.a === 0 && s.b === 0).toBe(false);
    }
  });

  it('is finite and small enough for a reader to exhaust', () => {
    const n = candidateShifts(hats(2)).length;
    expect(n).toBeGreaterThan(5);
    expect(n).toBeLessThan(60);
  });

  it('gives a hexagon floor candidates that do work', () => {
    const hex = hexPatch(3);
    const works = candidateShifts(hex).filter((s) => alignment(hex, s).perfect);
    expect(works.length).toBeGreaterThan(0);
  });
});

describe('alignment scoring', () => {
  it('ignores pieces that slid off the edge', () => {
    // A finite patch always loses its border to a slide; counting those as
    // failures would understate a genuinely periodic tiling.
    const hex = hexPatch(3);
    const far = alignment(hex, eis(2, 2));
    expect(far.perfect).toBe(true);
    expect(far.count).toBeLessThan(hex.length);
  });

  it('reports nothing rather than dividing by zero when fully off the patch', () => {
    const result = alignment(hexPatch(2), eis(400, 400));
    expect(result.count).toBe(0);
    expect(result.fraction).toBe(0);
    expect(result.perfect).toBe(false);
  });
});
