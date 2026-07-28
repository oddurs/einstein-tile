/**
 * A hexagon floor — the control condition.
 *
 * Scene 3 needs something that visibly *does* repeat, or "it never lines up" has
 * no reference point and reads as a broken toy rather than a property. Hexagons
 * are the obvious choice: everyone recognises them as a floor, and nobody
 * doubts that a floor repeats.
 *
 * Hexagon centres form the index-12 sublattice used by `kites.ts` — spanned by
 * (2,2) and (−2,4) — so this shares the hat's exact lattice and needs no
 * separate coordinate system.
 */

import { type Eis, add, eis, rot60k } from './eisenstein.js';
import type { Piece } from './alignment.js';
import { toPoint } from './render.js';

/** Hexagon vertices, relative to the centre: (2,0) rotated six ways. */
const HEX_VERTICES: readonly Eis[] = Array.from({ length: 6 }, (_, k) =>
  rot60k(eis(2, 0), k),
);

/** The outline of the hexagon centred at `centre`, in exact lattice points. */
export function hexOutline(centre: Eis): Eis[] {
  return HEX_VERTICES.map((v) => add(centre, v));
}

/**
 * A roughly circular patch of hexagons, `rings` rings out from the origin.
 *
 * Every piece shares one `form`, since all hexagons are identical however you
 * turn them — which is exactly why a hexagon floor slides onto itself so easily.
 */
export function hexPatch(rings: number): Piece[] {
  const out: Piece[] = [];
  // Sublattice basis: u = (2,2), v = (-2,4).
  for (let i = -rings; i <= rings; i++) {
    for (let j = -rings; j <= rings; j++) {
      // Keep a hexagonal-ish footprint rather than a rhombus, so the patch has
      // no preferred direction for the reader to read meaning into.
      if (Math.abs(i + j) > rings) continue;
      const centre = eis(2 * i - 2 * j, 2 * i + 4 * j);
      out.push({
        anchor: centre,
        form: 'hex',
        points: hexOutline(centre).map(toPoint),
      });
    }
  }
  return out;
}
