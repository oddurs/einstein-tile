/**
 * The exact outline of a set of tiles.
 *
 * Because every tile sits on the half-Eisenstein lattice, a group's boundary is
 * purely combinatorial: walk each tile's edges as *directed* segments, and an
 * edge interior to the group appears exactly twice, once in each direction.
 * Whatever is left unpaired is the boundary. No geometry, no tolerances, no
 * polygon-clipping library.
 *
 * This is what `MetaInstance.scaffold` is not (see docs/08): the scaffold drives
 * the substitution's edge matching and does not bound its own tiles. Use this
 * when you need an outline a reader will look at.
 *
 * Two details make the pairing exact:
 *
 *  1. **Subdivide by gcd.** Hat edges have length 1, √3, or 2 in lattice terms.
 *     The length-2 edge spans two unit steps, so without subdivision it would
 *     T-junction against two unit edges of a neighbour and never pair. Dividing
 *     each edge vector by gcd(|da|, |db|) puts everything on a common
 *     refinement. (A √3 edge is primitive and can only ever meet another √3
 *     edge, so it needs no special handling.)
 *
 *  2. **Normalise winding.** Reflected hats are wound the opposite way round, so
 *     an edge shared between a reflected and an unreflected tile would be
 *     emitted in the *same* direction twice and look like a boundary. Each
 *     tile's winding is therefore checked by exact integer shoelace and
 *     reversed when negative. (The lattice-to-Cartesian map has positive
 *     determinant, so the integer shoelace sign matches the Cartesian one.)
 */

import { type Eis, eis, key } from './eisenstein.js';
import type { Tile } from './patch.js';
import { vertices } from './patch.js';

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

/**
 * Twice the signed area of a lattice polygon, as an exact integer.
 * Positive means counter-clockwise.
 */
export function signedArea2(poly: readonly Eis[]): number {
  let acc = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    acc += p.a * q.b - q.a * p.b;
  }
  return acc;
}

/** A tile's vertices, always counter-clockwise. */
function windCCW(poly: Eis[]): Eis[] {
  return signedArea2(poly) < 0 ? poly.slice().reverse() : poly;
}

/** Every unit step along the polygon, as directed lattice edges. */
function directedEdges(poly: readonly Eis[]): [Eis, Eis][] {
  const out: [Eis, Eis][] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    const da = q.a - p.a;
    const db = q.b - p.b;
    const steps = gcd(da, db);
    const sa = da / steps;
    const sb = db / steps;
    for (let k = 0; k < steps; k++) {
      out.push([eis(p.a + sa * k, p.b + sb * k), eis(p.a + sa * (k + 1), p.b + sb * (k + 1))]);
    }
  }
  return out;
}

/**
 * The boundary of a set of tiles, as closed loops of exact lattice points.
 *
 * Returns one loop per connected boundary component: a simply-connected group
 * yields one, a group with a hole yields two, and a disconnected group yields
 * one per piece. Outer loops run counter-clockwise, holes clockwise, so the
 * usual even-odd or nonzero fill rules do the right thing.
 *
 * Collinear runs are merged, so the result is a minimal vertex list rather than
 * one point per lattice step.
 */
export function boundaryLoops(tiles: readonly Tile[]): Eis[][] {
  const edges = new Map<string, [Eis, Eis]>();

  for (const tile of tiles) {
    for (const [from, to] of directedEdges(windCCW(vertices(tile)))) {
      const forward = `${key(from)}|${key(to)}`;
      const backward = `${key(to)}|${key(from)}`;
      // An interior edge is traversed once in each direction: when we meet the
      // reverse of an edge we already hold, both are interior — drop the pair.
      if (edges.has(backward)) edges.delete(backward);
      else edges.set(forward, [from, to]);
    }
  }

  // Chain the survivors into loops.
  const outgoing = new Map<string, Eis[]>();
  for (const [from, to] of edges.values()) {
    const k = key(from);
    const list = outgoing.get(k);
    if (list) list.push(to);
    else outgoing.set(k, [to]);
  }

  const loops: Eis[][] = [];
  for (const [startKey, firsts] of outgoing) {
    while (firsts.length) {
      const loop: Eis[] = [];
      let fromKey = startKey;
      let next: Eis | undefined = firsts.pop();
      const start = fromKey;

      while (next) {
        loop.push(next);
        const nk = key(next);
        if (nk === start) break;
        const outs = outgoing.get(nk);
        if (!outs || !outs.length) break; // malformed; bail rather than spin
        fromKey = nk;
        next = outs.pop();
      }
      if (loop.length > 2) loops.push(simplify(loop));
    }
  }

  return loops;
}

/** A directed boundary segment, one lattice step long. */
export interface BoundaryStep {
  readonly from: Eis;
  readonly to: Eis;
}

/**
 * Every unpaired directed edge, as single lattice steps — the board's exposed
 * frontier, un-simplified.
 *
 * `boundaryLoops` merges collinear runs, which is right for drawing and wrong
 * for placement: a hat's long edge can abut *two* unit steps of the frontier, so
 * enumerating attachments against merged edges would miss legal moves.
 *
 * Steps run counter-clockwise around occupied area, so the free space is on the
 * right of each one.
 */
export function boundarySteps(tiles: readonly Tile[]): BoundaryStep[] {
  const edges = new Map<string, BoundaryStep>();
  for (const tile of tiles) {
    for (const [from, to] of directedEdges(windCCW(vertices(tile)))) {
      const backward = `${key(to)}|${key(from)}`;
      if (edges.has(backward)) edges.delete(backward);
      else edges.set(`${key(from)}|${key(to)}`, { from, to });
    }
  }
  return [...edges.values()];
}

/** Drop vertices that sit in the middle of a straight run. */
function simplify(loop: readonly Eis[]): Eis[] {
  const n = loop.length;
  const out: Eis[] = [];
  for (let i = 0; i < n; i++) {
    const prev = loop[(i - 1 + n) % n]!;
    const cur = loop[i]!;
    const next = loop[(i + 1) % n]!;
    const cross =
      (cur.a - prev.a) * (next.b - cur.b) - (cur.b - prev.b) * (next.a - cur.a);
    if (cross !== 0) out.push(cur);
  }
  return out.length ? out : loop.slice();
}

/**
 * Group tiles by their metatile ancestor at `depth`, outermost first.
 *
 * `depth` 0 is the root supertile (everything in one group); `patch.level` is
 * the innermost metatile. This is the grouping scene 5 fades in as you zoom out.
 */
export function groupByAncestor(
  tiles: readonly Tile[],
  depth: number,
): Map<string, Tile[]> {
  const groups = new Map<string, Tile[]>();
  for (const tile of tiles) {
    // `trail` ends with the hat's own index inside its metatile, so the
    // deepest *metatile* grouping is one short of its length. Clamping to
    // `trail.length` instead would put every tile in its own group.
    const d = Math.max(0, Math.min(depth, tile.trail.length - 1));
    // Key on the *index* trail, not the label path. Sibling metatiles often
    // share a label, so a label prefix merges distinct instances into one
    // group — which shows up as a "hull" made of several disjoint loops.
    const k = tile.trail.slice(0, d).join('.');
    const list = groups.get(k);
    if (list) list.push(tile);
    else groups.set(k, [tile]);
  }
  return groups;
}
