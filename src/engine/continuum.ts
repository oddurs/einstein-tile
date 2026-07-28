/**
 * `Tile(a,b)` — the hat is one shape in a continuous family.
 *
 * Every edge of the hat has one of two lengths. Replace those two lengths with
 * free parameters and you get a one-parameter family (up to scale) of
 * combinatorially identical polygons: `Tile(1,√3)` is the hat, `Tile(√3,1)` is
 * the turtle, and essentially every member tiles the plane aperiodically in
 * exactly the same way. There is not one einstein. There are infinitely many.
 *
 * ## Why the family exists at all
 *
 * The hat has 14 edges — 8 short, 6 long. (As a simple polygon it has 13
 * vertices; one of them is a straight 180°, and that edge is two short ones.)
 *
 * Measured: **the unit vectors of the short edges sum to zero, and the long
 * ones sum to zero, independently.** Closure therefore imposes no relation
 * between the two lengths, so the polygon closes for *every* (a, b) — including
 * the degenerate ends, where one length reaches zero.
 *
 * ## Why deforming a whole tiling is well-defined
 *
 * Less obvious, and the reason this file is a graph walk rather than a formula.
 * A lattice vector does not decompose uniquely into short and long steps, so
 * "scale the short part by a" is not meaningful on its own.
 *
 * It becomes meaningful because of the closure fact above. Walking the edges of
 * any single tile returns you to where you started having used a set of short
 * steps summing to zero and a set of long steps summing to zero — so the two
 * counts are unchanged by going around a tile. Tiles generate every cycle in a
 * simply-connected patch, so the short/long decomposition of a path is
 * **path-independent**, and propagating positions tile by tile is consistent no
 * matter which route the walk takes.
 *
 * ## Exactness
 *
 * A deformed tiling is *not* on the half-Eisenstein lattice — only the hat's own
 * parameters put it there. So this is a float path, deliberately separate from
 * `patch.ts`. It exists to draw with, and nothing here should be used to decide
 * adjacency or overlap; the exact engine still owns those questions.
 */

import { type Eis, key, toX, toY } from './eisenstein.js';
import { HAT_VERTICES, type Tile } from './patch.js';
import { apply } from './isometry.js';
import type { Point } from './render.js';

/** The hat's own edge lengths, in the engine's units. */
export const SHORT = 0.5;
export const LONG = Math.sqrt(3) / 2;

/** One edge of the canonical 14-edge outline. */
interface Edge {
  /** Index into the 14-vertex outline. */
  readonly from: number;
  readonly to: number;
  /** Unit direction. */
  readonly ux: number;
  readonly uy: number;
  readonly long: boolean;
}

/**
 * The hat's outline as 14 vertices rather than 13.
 *
 * The straight vertex is reinstated by splitting the one double-length edge, so
 * that every edge carries exactly one length parameter.
 */
export const OUTLINE_14: readonly Eis[] = (() => {
  const out: Eis[] = [];
  const n = HAT_VERTICES.length;
  for (let i = 0; i < n; i++) {
    const p = HAT_VERTICES[i]!;
    const q = HAT_VERTICES[(i + 1) % n]!;
    out.push(p);
    // The one edge of length 1 is two short edges with a straight join.
    const len = Math.hypot(toX(q) - toX(p), toY(q) - toY(p));
    if (Math.abs(len - 2 * SHORT) < 1e-9) {
      out.push({ a: (p.a + q.a) / 2, b: (p.b + q.b) / 2 });
    }
  }
  return out;
})();

/** The 14 edges, with direction and length class. */
export const EDGES: readonly Edge[] = OUTLINE_14.map((p, i) => {
  const q = OUTLINE_14[(i + 1) % OUTLINE_14.length]!;
  const dx = toX(q) - toX(p);
  const dy = toY(q) - toY(p);
  const len = Math.hypot(dx, dy);
  return {
    from: i,
    to: (i + 1) % OUTLINE_14.length,
    ux: dx / len,
    uy: dy / len,
    long: Math.abs(len - LONG) < 1e-9,
  };
});

/**
 * The outline of `Tile(a,b)`, centred on its own centroid.
 *
 * Directions are the hat's; only the lengths change. Centring keeps the shape
 * from wandering as the parameters move, which matters when it is being dragged.
 */
export function tileOutline(a: number, b: number): Point[] {
  const pts: Point[] = [];
  let x = 0;
  let y = 0;
  for (const e of EDGES) {
    pts.push({ x, y });
    const len = e.long ? b : a;
    x += e.ux * len;
    y += e.uy * len;
  }
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  cx /= pts.length;
  cy /= pts.length;
  return pts.map((p) => ({ x: p.x - cx, y: p.y - cy }));
}

/** A tile of a deformed tiling: its outline, in place. */
export interface DeformedTile {
  readonly points: Point[];
  readonly tile: Tile;
}

/**
 * Deform a whole patch to `Tile(a,b)`.
 *
 * Positions are propagated by breadth-first walk across shared vertices. Every
 * tile's outline is laid out from its own edge lengths, then translated so that
 * one already-placed vertex lands where the walk says it should — which is
 * consistent for the reason argued at the top of this file.
 *
 * Tiles not reachable from the seed are dropped rather than guessed at; a patch
 * from `buildPatch` is connected, so in practice none are.
 */
export function deform(tiles: readonly Tile[], a: number, b: number): DeformedTile[] {
  if (!tiles.length) return [];

  // Each tile's 14 vertices in the *undeformed* tiling, as exact lattice keys.
  // Shared vertices are shared keys, which is what stitches the walk together.
  const latticeVerts = tiles.map((t) => OUTLINE_14.map((v) => apply(t.iso, v)));

  // Local outlines: the deformed shape each tile will wear, before placement.
  // Reflected tiles traverse their outline the other way round, so their local
  // vertex i must correspond to the same lattice vertex i.
  const local = tiles.map((t) => {
    const base = tileOutline(a, b);
    // Rebuild in the tile's own frame by matching two known vertices later;
    // here we only need the shape, oriented like the tile.
    return orientLike(base, t);
  });

  const placed: (Point | null)[] = tiles.map(() => null);
  // Where each lattice vertex has ended up, once anything has fixed it.
  const anchored = new Map<string, Point>();
  // Which tiles touch a given lattice vertex.
  const touching = new Map<string, number[]>();
  latticeVerts.forEach((vs, i) => {
    for (const v of vs) {
      const k = key(v);
      const list = touching.get(k);
      if (list) list.push(i);
      else touching.set(k, [i]);
    }
  });

  const place = (index: number, offset: Point) => {
    placed[index] = offset;
    latticeVerts[index]!.forEach((v, j) => {
      const k = key(v);
      if (!anchored.has(k)) {
        const p = local[index]![j]!;
        anchored.set(k, { x: p.x + offset.x, y: p.y + offset.y });
      }
    });
  };

  place(0, { x: 0, y: 0 });
  const queue = [0];

  while (queue.length) {
    const current = queue.shift()!;
    for (const v of latticeVerts[current]!) {
      for (const next of touching.get(key(v)) ?? []) {
        if (placed[next]) continue;
        // Anchor `next` on the first vertex it shares with anything placed.
        const j = latticeVerts[next]!.findIndex((w) => anchored.has(key(w)));
        if (j < 0) continue;
        const target = anchored.get(key(latticeVerts[next]![j]!))!;
        const own = local[next]![j]!;
        place(next, { x: target.x - own.x, y: target.y - own.y });
        queue.push(next);
      }
    }
  }

  const out: DeformedTile[] = [];
  tiles.forEach((tile, i) => {
    const offset = placed[i];
    if (!offset) return;
    out.push({
      tile,
      points: local[i]!.map((p) => ({ x: p.x + offset.x, y: p.y + offset.y })),
    });
  });
  return out;
}

/**
 * Rotate and reflect a canonical outline into a tile's own orientation.
 *
 * The isometry's linear part is what we need; its translation is supplied by
 * the walk instead, so it is dropped here.
 */
function orientLike(points: readonly Point[], tile: Tile): Point[] {
  const theta = (tile.iso.rot * Math.PI) / 3;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return points.map((p) => {
    // Reflection is across the x-axis, matching `conj` in the exact engine.
    const x = p.x;
    const y = tile.iso.reflected ? -p.y : p.y;
    return { x: c * x - s * y, y: s * x + c * y };
  });
}
