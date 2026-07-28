/**
 * The hat as 8 kites — an exact overlap predicate.
 *
 * The hat is a *polykite*: 8 kites of the [3.4.6.4] Laves tiling, the grid you
 * get by cutting every hexagon of a hex grid into 6 kites. Decomposing a
 * placement into its kites turns *"do these two hats overlap?"* into a
 * set-intersection over 8 integer cells — exact, no geometry, no tolerances.
 *
 * That is what scene 3 needs: legal placements are the ones whose kites are
 * disjoint from everything already on the board.
 *
 * ## How the grid was pinned down
 *
 * A kite has area √3/4, so a hexagon (6 kites) has circumradius 1 and hexagon
 * centres form an **index-12 sublattice** of the half-Eisenstein lattice —
 * spanned by (2,2) and (−2,4), i.e. the points with both coordinates even and
 * `(b − a)` divisible by 6.
 *
 * Searching every lattice point for kites inside the canonical hat returns 96 —
 * exactly 12× too many, confirming the index. Filtering to a single coset leaves
 * an exact 8-kite tiling, and six of the twelve cosets do that. The choice among
 * those six is arbitrary, because the sublattice is invariant under the point
 * group — `rot60(2,2) = (−2,4)` and `conj(2,2) = (4,−2)` are both in it — so this
 * is the natural one, with a hexagon at the tile's origin.
 *
 * ## Alignment is relative, not absolute
 *
 * Kites decide overlap only for placements sharing one grid. The requirement is
 * *not* that hexagon centres land in the sublattice itself — they generally
 * don't. Measured over a level-3 patch, all 3,468 transformed centres land in a
 * single coset, but it is the (0,4) coset, not (0,0): the canonical hat at the
 * identity is simply not one of the placements a tiling uses.
 *
 * So what matters is that two placements agree, and `hexCoset` names which of
 * the 12 they belong to. `KiteIndex` pins the coset of its first placement and
 * rejects any later one that disagrees — for those, kites cannot decide overlap,
 * and a loud failure beats a silently wrong "no overlap".
 *
 * (An earlier check asserted absolute membership and rejected every real tile.
 * A probe that only counted *distinct* kite IDs had missed this: distinctness
 * follows from the map being a bijection and says nothing about alignment.)
 */

import { type Eis, add, conj, eis, rot60k } from './eisenstein.js';
import type { Isometry } from './isometry.js';
import type { Tile } from './patch.js';

/** A kite cell: hexagon centre plus which of the hexagon's 6 kites. */
export interface Kite {
  readonly centre: Eis;
  /** 0–5, counter-clockwise. */
  readonly index: number;
}

/**
 * The canonical hat's 8 kites, as (hexagon centre, kite index).
 *
 * Derived, not invented — see the module comment. Three hexagons contribute:
 * four kites from the one at the origin, two each from (2,2) and (4,−2).
 */
export const HAT_KITES: readonly Kite[] = [
  { centre: eis(0, 0), index: 0 },
  { centre: eis(0, 0), index: 1 },
  { centre: eis(0, 0), index: 4 },
  { centre: eis(0, 0), index: 5 },
  { centre: eis(2, 2), index: 3 },
  { centre: eis(2, 2), index: 4 },
  { centre: eis(4, -2), index: 1 },
  { centre: eis(4, -2), index: 2 },
];

/** One kite's outline, relative to its hexagon centre, at index 0. */
const KITE_SHAPE_0: readonly Eis[] = [eis(0, 0), eis(1, 1), eis(2, 0), eis(2, -1)];

/**
 * Which of the 12 cosets of the hexagon sublattice this point belongs to.
 *
 * The quotient of the lattice by the sublattice spanned by (2,2) and (−2,4) is
 * ℤ2 × ℤ6, coordinatised here as `a mod 2` and `(b − a) mod 6`. Two placements
 * share a kite grid exactly when their cosets agree.
 */
export function cosetOf(p: Eis): number {
  return (((p.a % 2) + 2) % 2) * 6 + ((((p.b - p.a) % 6) + 6) % 6);
}

/** The kite-grid coset a placement lives on. */
export function hexCoset(iso: Isometry): number {
  return cosetOf(add(iso.t, rot60k(iso.reflected ? conj(ORIGIN_CENTRE) : ORIGIN_CENTRE, iso.rot)));
}

const ORIGIN_CENTRE = eis(0, 0);

/** The outline of a kite, in exact lattice coordinates. */
export function kiteOutline(kite: Kite): Eis[] {
  return KITE_SHAPE_0.map((p) => add(kite.centre, rot60k(p, kite.index)));
}

/**
 * The 8 kites a placement covers.
 *
 * The kite shape is symmetric under conjugation — `conj({(0,0),(1,1),(2,0),
 * (2,−1)})` is the same set — so reflecting a kite maps index `k` to `−k`, and
 * the full transform of index `k` under an isometry is `rot ± k`.
 */
export function kites(iso: Isometry): Kite[] {
  return HAT_KITES.map(({ centre, index }) => {
    const moved = add(iso.t, rot60k(iso.reflected ? conj(centre) : centre, iso.rot));
    const k = iso.reflected ? iso.rot - index : iso.rot + index;
    return { centre: moved, index: ((k % 6) + 6) % 6 };
  });
}

/** A collision-free key for a kite cell. */
export function kiteKey(kite: Kite): string {
  return `${kite.centre.a},${kite.centre.b},${kite.index}`;
}

/**
 * Do two placements share any area?
 *
 * Throws if they sit on different kite grids, where the question cannot be
 * answered this way.
 */
export function overlaps(a: Isometry, b: Isometry): boolean {
  if (hexCoset(a) !== hexCoset(b)) {
    throw new Error(
      `placements are on different kite grids (coset ${hexCoset(a)} vs ` +
        `${hexCoset(b)}); overlap cannot be decided by kite identity`,
    );
  }
  const seen = new Set(kites(a).map(kiteKey));
  return kites(b).some((k) => seen.has(kiteKey(k)));
}

/**
 * An occupancy index — the board, for placement.
 *
 * Adding and testing are both 8 hash operations, independent of how many tiles
 * are already down.
 */
export class KiteIndex {
  private readonly occupied = new Set<string>();
  /** Pinned by the first placement; every later one must agree. */
  private coset: number | null = null;

  constructor(tiles: readonly Tile[] = []) {
    for (const tile of tiles) this.add(tile.iso);
  }

  get size(): number {
    return this.occupied.size;
  }

  private checkGrid(iso: Isometry): void {
    const c = hexCoset(iso);
    if (this.coset === null) this.coset = c;
    else if (this.coset !== c) {
      throw new Error(
        `placement is on a different kite grid (coset ${c}, board is ` +
          `${this.coset}); overlap cannot be decided by kite identity`,
      );
    }
  }

  /** True if nothing already placed shares area with this placement. */
  isFree(iso: Isometry): boolean {
    this.checkGrid(iso);
    for (const kite of kites(iso)) {
      if (this.occupied.has(kiteKey(kite))) return false;
    }
    return true;
  }

  /** Returns false and changes nothing if the placement would overlap. */
  add(iso: Isometry): boolean {
    this.checkGrid(iso);
    const cells = kites(iso);
    for (const kite of cells) {
      if (this.occupied.has(kiteKey(kite))) return false;
    }
    for (const kite of cells) this.occupied.add(kiteKey(kite));
    return true;
  }

  remove(iso: Isometry): void {
    for (const kite of kites(iso)) this.occupied.delete(kiteKey(kite));
  }

  has(kite: Kite): boolean {
    return this.occupied.has(kiteKey(kite));
  }
}
