import { describe, expect, it } from 'vitest';
import { isoKey, orientation } from '../src/isometry.js';
import { buildPatch, vertices } from '../src/patch.js';
import { bounds, polygon, type Point } from '../src/render.js';

const PHI = (1 + Math.sqrt(5)) / 2;
const PHI4 = PHI ** 4; // 6.8541…

function shoelace(pts: readonly Point[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

function pointInPolygon(pt: Point, poly: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (
      a.y > pt.y !== b.y > pt.y &&
      pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

describe('patch construction', () => {
  it('produces Fibonacci-squared tile counts', () => {
    // 2², 5², 13², 34², 89² — the φ⁴ ≈ 6.854 inflation factor
    const expected = [4, 25, 169, 1156, 7921];
    for (let level = 0; level < expected.length; level++) {
      expect(buildPatch(level).tiles.length).toBe(expected[level]);
    }
  });

  it('rejects a negative or fractional level', () => {
    expect(() => buildPatch(-1)).toThrow();
    expect(() => buildPatch(1.5)).toThrow();
  });

  it('never places two tiles identically', () => {
    const { tiles } = buildPatch(4);
    const keys = new Set(tiles.map((t) => isoKey(t.iso)));
    expect(keys.size).toBe(tiles.length);
  });

  it('records ancestry one label per level', () => {
    for (const level of [0, 1, 3]) {
      const { tiles } = buildPatch(level);
      for (const t of tiles) {
        expect(t.path.length).toBe(level + 1);
        expect(t.path[0]).toBe('H');
      }
    }
  });

  it('reflects exactly the H1 hats', () => {
    // Metatiles are placed by rotation only, so the sole source of reflection
    // is the one mirrored hat inside each H metatile.
    for (const t of buildPatch(4).tiles) {
      expect(t.iso.reflected).toBe(t.kind === 'H1');
    }
  });

  it('converges to the φ⁴ reflection ratio', () => {
    const ratios = [3, 4].map((level) => {
      const { tiles } = buildPatch(level);
      const refl = tiles.filter((t) => t.iso.reflected).length;
      return (tiles.length - refl) / refl;
    });
    // level 3 ≈ 6.864, level 4 ≈ 6.850 — bracketing φ⁴ = 6.8541
    for (const r of ratios) expect(Math.abs(r - PHI4)).toBeLessThan(0.02);
    expect(Math.abs(ratios[1]! - PHI4)).toBeLessThan(Math.abs(ratios[0]! - PHI4) + 0.01);
  });

  it('uses all 12 orientations', () => {
    const seen = new Set(buildPatch(3).tiles.map((t) => orientation(t.iso)));
    expect(seen.size).toBe(12);
  });

  it('tiles without overlapping, and covers its area', () => {
    // Monte Carlo over the bounding box with a fixed seed. Every hat is
    // congruent, so a non-overlapping tiling must cover exactly
    // n × (area of one hat) — this catches both overlaps and gaps.
    const patch = buildPatch(2);
    const polys = patch.tiles.map((t) => polygon(t));
    const all = polys.flat();
    const b = bounds(all);
    const hatArea = shoelace(polys[0]!);

    let seed = 12345;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };

    const N = 40000;
    let covered = 0;
    let maxHits = 0;
    for (let i = 0; i < N; i++) {
      const p = {
        x: b.minX + rnd() * (b.maxX - b.minX),
        y: b.minY + rnd() * (b.maxY - b.minY),
      };
      let hits = 0;
      for (const poly of polys) if (pointInPolygon(p, poly)) hits++;
      if (hits > 0) covered++;
      if (hits > maxHits) maxHits = hits;
    }

    // No sample may ever land in two tiles at once.
    expect(maxHits).toBe(1);

    const boxArea = (b.maxX - b.minX) * (b.maxY - b.minY);
    const estimated = (covered / N) * boxArea;
    const exact = hatArea * patch.tiles.length;
    expect(Math.abs(estimated - exact) / exact).toBeLessThan(0.02);
  });

  it('exposes metatile scaffolds that are explicitly NOT tile boundaries', () => {
    // Locking in a real finding: hatviz's metatile polygons drive the
    // substitution's edge-matching and do not bound their own tiles. If this
    // ever starts passing as a containment check, the semantics changed.
    const patch = buildPatch(3);
    const scaffold = patch.metatiles.find((m) => m.depth === 0)!.scaffold;
    const outside = patch.tiles.filter((t) =>
      polygon(t).every((v) => !pointInPolygon(v, scaffold)),
    );
    expect(outside.length).toBeGreaterThan(0);
  });

  it('keeps every hat congruent to every other', () => {
    const areas = buildPatch(2).tiles.map((t) => shoelace(polygon(t)));
    const first = areas[0]!;
    for (const a of areas) expect(a).toBeCloseTo(first, 12);
  });

  it('stays exactly on the lattice at depth', () => {
    // buildPatch snaps through fromXY, which throws beyond 1e-6 of a lattice
    // site. Reaching level 5 (54,289 tiles) without throwing is the drift test.
    const patch = buildPatch(5);
    expect(patch.tiles.length).toBe(54289);
    for (const v of vertices(patch.tiles.at(-1)!)) {
      expect(Number.isInteger(v.a)).toBe(true);
      expect(Number.isInteger(v.b)).toBe(true);
    }
  });

  it('exposes the metatile hierarchy for every level', () => {
    const patch = buildPatch(3);
    const depths = new Set(patch.metatiles.map((m) => m.depth));
    expect([...depths].sort((x, y) => x - y)).toEqual([0, 1, 2, 3]);
    expect(patch.metatiles.filter((m) => m.depth === 0).length).toBe(1);
  });
});
