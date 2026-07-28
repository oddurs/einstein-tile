import { describe, expect, it } from 'vitest';
import { eis, toX, toY } from '../src/engine/eisenstein.js';
import { isometry } from '../src/engine/isometry.js';
import {
  HAT_KITES,
  KiteIndex,
  cosetOf,
  hexCoset,
  kiteKey,
  kiteOutline,
  kites,
  overlaps,
} from '../src/engine/kites.js';
import { buildPatch, vertices } from '../src/engine/patch.js';
import { polygon, type Point } from '../src/engine/render.js';

const area = (pts: readonly Point[]): number => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
};
const cart = (ps: readonly { a: number; b: number }[]): Point[] =>
  ps.map((p) => ({ x: toX(p), y: toY(p) }));

describe('kite decomposition', () => {
  it('cuts the hat into exactly 8 kites', () => {
    expect(HAT_KITES.length).toBe(8);
  });

  it('gives kites that exactly fill the hat', () => {
    const hatArea = area(cart(vertices(buildPatch(0).tiles[0]!)));
    const total = HAT_KITES.reduce((sum, k) => sum + area(cart(kiteOutline(k))), 0);
    expect(total).toBeCloseTo(hatArea, 9);
  });

  it('gives 8 congruent kites, each a quarter of a hexagon-sixth', () => {
    const areas = HAT_KITES.map((k) => area(cart(kiteOutline(k))));
    for (const a of areas) expect(a).toBeCloseTo(Math.sqrt(3) / 4, 12);
  });

  it('puts the canonical hat’s three hexagons on one grid', () => {
    const cosets = new Set(HAT_KITES.map((k) => cosetOf(k.centre)));
    expect(cosets.size).toBe(1);
  });

  it('coordinatises the quotient as ℤ2 × ℤ6', () => {
    // The sublattice generators must be coset 0; representatives of other
    // classes must not collide.
    expect(cosetOf(eis(0, 0))).toBe(0);
    expect(cosetOf(eis(2, 2))).toBe(0);
    expect(cosetOf(eis(-2, 4))).toBe(0);
    expect(cosetOf(eis(4, -2))).toBe(0);
    const all = new Set<number>();
    for (let a = 0; a < 2; a++) for (let b = 0; b < 6; b++) all.add(cosetOf(eis(a, a + b)));
    expect(all.size).toBe(12);
  });
});

describe('kites under placement', () => {
  it('gives every tile in a patch 8 kites, all distinct', () => {
    for (const level of [0, 1, 2, 3]) {
      const patch = buildPatch(level);
      const seen = new Set<string>();
      for (const tile of patch.tiles) {
        const cells = kites(tile.iso);
        expect(cells.length).toBe(8);
        for (const c of cells) seen.add(kiteKey(c));
      }
      // 8 per tile with no sharing is an exact proof of non-overlap —
      // stronger and faster than the Monte Carlo check in patch.test.ts.
      expect(seen.size).toBe(patch.tiles.length * 8);
    }
  });

  it('preserves kite area under every orientation, reflections included', () => {
    for (let rot = 0; rot < 6; rot++) {
      for (const reflected of [false, true]) {
        const iso = isometry(rot, reflected, eis(2, 2));
        const total = kites(iso).reduce((s, k) => s + area(cart(kiteOutline(k))), 0);
        expect(total).toBeCloseTo(2 * Math.sqrt(3), 9);
      }
    }
  });

  it('agrees with the tile outline it claims to cover', () => {
    // The kites of a placement must sum to that placement's own area, not just
    // to some hat's area — this catches a wrong rot/reflection rule.
    for (const tile of buildPatch(2).tiles.slice(0, 40)) {
      const tileArea = area(polygon(tile));
      const kiteArea = kites(tile.iso).reduce(
        (s, k) => s + area(cart(kiteOutline(k))),
        0,
      );
      expect(kiteArea).toBeCloseTo(tileArea, 9);
    }
  });

  it('puts every tile of a tiling on one shared kite grid', () => {
    // The property the overlap predicate rests on. Note it is *not* coset 0:
    // the canonical hat at the identity is not a placement any tiling uses.
    const cosets = new Set(buildPatch(3).tiles.map((t) => hexCoset(t.iso)));
    expect(cosets.size).toBe(1);
  });

  it('refuses to compare placements on different grids', () => {
    const a = isometry(0, false, eis(0, 0));
    const b = isometry(0, false, eis(1, 0));
    expect(hexCoset(a)).not.toBe(hexCoset(b));
    expect(() => overlaps(a, b)).toThrow(/different kite grids/);
  });
});

describe('overlap predicate', () => {
  it('says a placement overlaps itself', () => {
    const iso = buildPatch(1).tiles[0]!.iso;
    expect(overlaps(iso, iso)).toBe(true);
  });

  it('says no two tiles of a real tiling overlap', () => {
    const tiles = buildPatch(2).tiles;
    for (let i = 0; i < 60; i++) {
      for (let j = i + 1; j < 60; j++) {
        expect(overlaps(tiles[i]!.iso, tiles[j]!.iso)).toBe(false);
      }
    }
  });

  it('detects a deliberately overlapping placement', () => {
    const base = buildPatch(1).tiles[0]!.iso;
    // Shift by one hexagon: stays on the same grid, and must collide, since a
    // hat spans three hexagons.
    const nudged = isometry(base.rot, base.reflected, eis(base.t.a + 2, base.t.b + 2));
    expect(hexCoset(nudged)).toBe(hexCoset(base));
    expect(overlaps(base, nudged)).toBe(true);
  });
});

describe('KiteIndex', () => {
  it('accepts a whole tiling without a single collision', () => {
    const patch = buildPatch(3);
    const index = new KiteIndex();
    for (const tile of patch.tiles) expect(index.add(tile.iso)).toBe(true);
    expect(index.size).toBe(patch.tiles.length * 8);
  });

  it('refuses a colliding placement and leaves itself unchanged', () => {
    const tiles = buildPatch(2).tiles;
    const index = new KiteIndex(tiles);
    const before = index.size;
    expect(index.add(tiles[5]!.iso)).toBe(false);
    expect(index.size).toBe(before);
  });

  it('reports free space correctly, and round-trips add and remove', () => {
    const tiles = buildPatch(1).tiles;
    const index = new KiteIndex(tiles.slice(1));
    expect(index.isFree(tiles[0]!.iso)).toBe(true);
    expect(index.add(tiles[0]!.iso)).toBe(true);
    expect(index.isFree(tiles[0]!.iso)).toBe(false);
    index.remove(tiles[0]!.iso);
    expect(index.isFree(tiles[0]!.iso)).toBe(true);
  });

  it('is built correctly from an existing tile list', () => {
    const patch = buildPatch(2);
    const index = new KiteIndex(patch.tiles);
    expect(index.size).toBe(patch.tiles.length * 8);
    for (const tile of patch.tiles) expect(index.isFree(tile.iso)).toBe(false);
  });
});
