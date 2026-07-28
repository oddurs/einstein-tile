import { describe, expect, it } from 'vitest';
import { toX, toY } from '../src/engine/eisenstein.js';
import { boundaryLoops, groupByAncestor, signedArea2 } from '../src/engine/hull.js';
import { buildPatch, vertices } from '../src/engine/patch.js';
import { polygon, type Point } from '../src/engine/render.js';

function signedShoelace(pts: readonly Point[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

const shoelace = (pts: readonly Point[]): number => Math.abs(signedShoelace(pts));

/**
 * Net enclosed area of a hull. Outer loops wind counter-clockwise and holes
 * clockwise, so signed areas must be *summed* — taking the absolute value of
 * each loop would add a hole instead of subtracting it.
 */
const hullArea = (loops: readonly (readonly { a: number; b: number }[])[]): number =>
  Math.abs(loops.reduce((sum, l) => sum + signedShoelace(toPoints(l)), 0));

const toPoints = (loop: readonly { a: number; b: number }[]): Point[] =>
  loop.map((p) => ({ x: toX(p), y: toY(p) }));

describe('exact boundary hulls', () => {
  it('wraps a single tile in its own outline', () => {
    const tile = buildPatch(0).tiles[0]!;
    const loops = boundaryLoops([tile]);
    expect(loops.length).toBe(1);
    // The hat is a 13-gon; the hull recovers exactly its corners, because
    // collinear subdivision points are simplified away again.
    expect(loops[0]!.length).toBe(13);
    expect(shoelace(toPoints(loops[0]!))).toBeCloseTo(shoelace(polygon(tile)), 9);
  });

  it('gives a hull whose area equals the tiles it contains — exactly', () => {
    // This is the exact replacement for the Monte Carlo coverage test: if the
    // tiles overlapped or left a gap, hull area would not equal n × hat area.
    for (const level of [0, 1, 2, 3]) {
      const patch = buildPatch(level);
      const hatArea = shoelace(polygon(patch.tiles[0]!));
      expect(hullArea(boundaryLoops(patch.tiles))).toBeCloseTo(
        hatArea * patch.tiles.length,
        6,
      );
    }
  });

  it('produces one closed loop for a simply-connected patch', () => {
    expect(boundaryLoops(buildPatch(2).tiles).length).toBe(1);
  });

  it('winds tile polygons consistently despite reflections', () => {
    // Reflected hats are wound the other way; if the hull code did not
    // normalise, shared edges would double up in the same direction and the
    // "appears twice" test would break. Prove both windings really occur.
    const tiles = buildPatch(2).tiles;
    const areas = tiles.map((t) => signedArea2(vertices(t)));
    expect(areas.some((a) => a > 0)).toBe(true);
    expect(areas.some((a) => a < 0)).toBe(true);
    // ...and that the hull is still a single clean loop.
    expect(boundaryLoops(tiles).length).toBe(1);
  });

  it('handles a group containing reflected tiles only', () => {
    const tiles = buildPatch(3).tiles.filter((t) => t.iso.reflected);
    expect(tiles.length).toBeGreaterThan(10);
    const loops = boundaryLoops(tiles);
    // Reflected hats are scattered, so this is many disjoint single tiles.
    expect(loops.length).toBe(tiles.length);
  });

  it('returns nothing for an empty set', () => {
    expect(boundaryLoops([])).toEqual([]);
  });
});

describe('groupByAncestor', () => {
  it('puts everything in one group at depth 0', () => {
    const patch = buildPatch(3);
    expect(groupByAncestor(patch.tiles, 0).size).toBe(1);
  });

  it('splits into more groups as depth increases', () => {
    const patch = buildPatch(3);
    const sizes = [0, 1, 2, 3].map((d) => groupByAncestor(patch.tiles, d).size);
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]!).toBeGreaterThan(sizes[i - 1]!);
    }
  });

  it('never loses or duplicates a tile', () => {
    const patch = buildPatch(3);
    for (const d of [0, 1, 2, 3]) {
      const groups = groupByAncestor(patch.tiles, d);
      const total = [...groups.values()].reduce((n, g) => n + g.length, 0);
      expect(total).toBe(patch.tiles.length);
    }
  });

  it('gives every group a hull whose area matches its tiles', () => {
    // The property scene 5 depends on: each metatile instance is a solid,
    // gap-free region, so its outline is meaningful to draw.
    const patch = buildPatch(3);
    const hatArea = shoelace(polygon(patch.tiles[0]!));
    for (const depth of [1, 2, 3]) {
      for (const [k, tiles] of groupByAncestor(patch.tiles, depth)) {
        expect(hullArea(boundaryLoops(tiles)), `group ${k} at depth ${depth}`)
          .toBeCloseTo(hatArea * tiles.length, 6);
      }
    }
  });

  it('separates sibling metatiles that share a label', () => {
    // Regression: grouping on the label path merged distinct metatile
    // instances, which showed up as one "group" whose hull was several
    // disjoint loops. Identity lives in the index trail, not the labels.
    const patch = buildPatch(3);
    const groups = groupByAncestor(patch.tiles, 1);
    const labels = [...groups.values()].map((g) => g[0]!.path[1]);
    expect(groups.size).toBeGreaterThan(new Set(labels).size);
    for (const [k, tiles] of groups) {
      expect(boundaryLoops(tiles).length, `group ${k} should be one region`).toBe(1);
    }
  });

  it('clamps depth beyond the hierarchy instead of throwing', () => {
    const patch = buildPatch(2);
    expect(groupByAncestor(patch.tiles, 99).size).toBe(
      groupByAncestor(patch.tiles, 2).size,
    );
  });
});
