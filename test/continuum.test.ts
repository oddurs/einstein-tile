import { describe, expect, it } from 'vitest';
import { key } from '../src/engine/eisenstein.js';
import { apply } from '../src/engine/isometry.js';
import {
  EDGES,
  LONG,
  OUTLINE_14,
  SHORT,
  deform,
  tileOutline,
} from '../src/engine/continuum.js';
import { buildPatch } from '../src/engine/patch.js';
import { polygon, type Point } from '../src/engine/render.js';

const area = (p: readonly Point[]): number => {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length]!;
    s += p[i]!.x * q.y - q.x * p[i]!.y;
  }
  return Math.abs(s) / 2;
};

/** Every (a, b) the scene can reach, plus the degenerate ends. */
const FAMILY: [number, number, string][] = [
  [SHORT, LONG, 'hat'],
  [LONG, SHORT, 'turtle'],
  [0.7, 0.7, 'Tile(1,1)'],
  [0.5, 0.05, 'near-chevron'],
  [0.05, 0.9, 'near-comet'],
  [0.31, 0.77, 'arbitrary'],
];

describe('the shape of the family', () => {
  it('has 14 edges once the straight vertex is reinstated', () => {
    expect(OUTLINE_14.length).toBe(14);
    expect(EDGES.length).toBe(14);
  });

  it('uses exactly two lengths — 8 short and 6 long', () => {
    expect(EDGES.filter((e) => e.long).length).toBe(6);
    expect(EDGES.filter((e) => !e.long).length).toBe(8);
  });

  it('closes for every (a, b), because each length class sums to zero', () => {
    // This is *why* the family exists: closure imposes no relation between the
    // two lengths, so every member is a valid polygon.
    const sum = (long: boolean) =>
      EDGES.filter((e) => e.long === long).reduce(
        (acc, e) => ({ x: acc.x + e.ux, y: acc.y + e.uy }),
        { x: 0, y: 0 },
      );
    for (const long of [false, true]) {
      const s = sum(long);
      expect(Math.hypot(s.x, s.y)).toBeLessThan(1e-12);
    }
  });

  it('produces a closed polygon at every parameter, degenerate ends included', () => {
    for (const [a, b, name] of [...FAMILY, [0.5, 0, 'chevron'], [0, 0.5, 'comet']] as [
      number,
      number,
      string,
    ][]) {
      const pts = tileOutline(a, b);
      expect(pts.length, name).toBe(14);
      let x = 0;
      let y = 0;
      for (const e of EDGES) {
        x += e.ux * (e.long ? b : a);
        y += e.uy * (e.long ? b : a);
      }
      expect(Math.hypot(x, y), `${name} must close`).toBeLessThan(1e-12);
    }
  });

  it('gives the hat and the turtle their published areas', () => {
    // Both are Tile(1,√3) up to swap; the turtle is the larger.
    expect(area(tileOutline(SHORT, LONG))).toBeCloseTo(3.4641, 4);
    expect(area(tileOutline(LONG, SHORT))).toBeCloseTo(4.3301, 4);
  });
});

describe('deforming a whole tiling', () => {
  const patch = buildPatch(2);

  it('reproduces the real geometry at the hat’s own parameters', () => {
    const d = deform(patch.tiles, SHORT, LONG);
    expect(d.length).toBe(patch.tiles.length);
    for (let i = 0; i < 20; i++) {
      expect(area(d[i]!.points)).toBeCloseTo(area(polygon(patch.tiles[i]!)), 9);
    }
  });

  it('places every tile — the walk reaches the whole patch', () => {
    for (const [a, b, name] of FAMILY) {
      expect(deform(patch.tiles, a, b).length, name).toBe(patch.tiles.length);
    }
  });

  it('keeps every tile congruent to every other', () => {
    for (const [a, b, name] of FAMILY) {
      const areas = deform(patch.tiles, a, b).map((t) => area(t.points));
      const first = areas[0]!;
      for (const x of areas) expect(Math.abs(x - first), name).toBeLessThan(1e-9);
    }
  });

  it('stays a tiling: tiles sharing a vertex agree on where it is', () => {
    // The invariant that matters. If two tiles disagreed about a shared vertex,
    // the deformation would have torn a gap or forced an overlap. Agreement is
    // also the empirical form of the path-independence argument in the module
    // comment — the walk's route cannot affect the answer.
    for (const [a, b, name] of FAMILY) {
      const seen = new Map<string, Point>();
      let worst = 0;
      let shared = 0;
      for (const { tile, points } of deform(patch.tiles, a, b)) {
        OUTLINE_14.forEach((v, j) => {
          const k = key(apply(tile.iso, v));
          const p = points[j]!;
          const prev = seen.get(k);
          if (prev) {
            shared++;
            worst = Math.max(worst, Math.hypot(prev.x - p.x, prev.y - p.y));
          } else seen.set(k, p);
        });
      }
      expect(shared, `${name} should share many vertices`).toBeGreaterThan(500);
      expect(worst, `${name} vertex disagreement`).toBeLessThan(1e-9);
    }
  });

  it('deforms continuously — a small parameter step moves tiles a little', () => {
    // The scene drags this parameter, so it must not jump.
    const centre = (ts: ReturnType<typeof deform>) =>
      ts.map((t) => {
        let x = 0;
        let y = 0;
        for (const p of t.points) {
          x += p.x;
          y += p.y;
        }
        return { x: x / t.points.length, y: y / t.points.length };
      });
    const at = (a: number) => centre(deform(patch.tiles, a, LONG));
    const A = at(0.5);
    const B = at(0.51);
    let worst = 0;
    for (let i = 0; i < A.length; i++) {
      worst = Math.max(worst, Math.hypot(A[i]!.x - B[i]!.x, A[i]!.y - B[i]!.y));
    }
    expect(worst).toBeGreaterThan(0);
    expect(worst).toBeLessThan(1);
  });

  it('returns nothing for an empty patch', () => {
    expect(deform([], SHORT, LONG)).toEqual([]);
  });
});
