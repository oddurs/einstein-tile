/**
 * Public API: build a patch of hats, exactly.
 *
 * The substitution runs in floating point (it has to — see substitution.ts) and
 * every resulting placement is then snapped onto the half-Eisenstein lattice.
 * The snap is checked, not assumed: `fromXY` throws if a point is further than
 * 1e-6 from a lattice site, and observed error is ~1e-10 at 2.5M tiles.
 *
 * After snapping, everything downstream — adjacency, deduplication, patch
 * matching, hashing — is exact integer work with no tolerances anywhere.
 */

import { type Eis, eis, fromXY } from './eisenstein.js';
import { type Isometry, apply, isometry } from './isometry.js';
import { type Affine, transPt } from './internal/affine.js';
import {
  type Geom,
  type HatKind,
  type MetaLabel,
  HAT_OUTLINE,
  HAT_OUTLINE_EXACT,
} from './internal/hat-data.js';
import { inflate } from './internal/substitution.js';

/** A single placed hat. */
export interface Tile {
  /** Which role the hat plays in its metatile. `H1` is the reflected one. */
  readonly kind: HatKind;
  /** Exact placement. */
  readonly iso: Isometry;
  /**
   * Metatile ancestry as labels, outermost first. `path[0]` is the root
   * metatile and `path.length` is `level + 1`. Use this to *colour* by
   * metatile kind.
   */
  readonly path: readonly MetaLabel[];
  /**
   * Ancestry as child indices — `trail[i]` is which child was taken at depth
   * `i`. The final entry is the hat's own index inside its metatile, so
   * `trail.length` is `level + 1` and the deepest *metatile* grouping is
   * `trail.length - 1`. The full trail uniquely identifies the tile.
   *
   * This is the tile's metatile **identity**, and `path` is not: sibling
   * metatiles frequently share a label, so grouping on a label prefix silently
   * merges distinct metatile instances into one. Group on a `trail` prefix.
   */
  readonly trail: readonly number[];
}

/** A metatile instance in the hierarchy. */
export interface MetaInstance {
  readonly label: MetaLabel;
  /** 0 is the root; deeper nodes have higher depth. */
  readonly depth: number;
  /**
   * The metatile's SCAFFOLD polygon — **not** the boundary of its tiles.
   *
   * These polygons exist to drive the substitution's edge-matching, and the
   * substitution is the only thing that should consume them. Measured against
   * the tiles they nominally contain, at level 3, 29% of tile vertices fall
   * outside and 273 of 1156 tiles fall *entirely* outside. Stroking these will
   * look broken.
   *
   * To draw the hierarchy (scene 5), group tiles by `Tile.path` and either
   * tint by ancestor or compute the true union hull. See docs/08-engine.md.
   *
   * Float, because `intersect()` genuinely produces irrational vertices — this
   * is the one part of the system not on the lattice.
   */
  readonly scaffold: readonly { x: number; y: number }[];
}

export interface Patch {
  readonly level: number;
  readonly root: MetaLabel;
  readonly tiles: readonly Tile[];
  readonly metatiles: readonly MetaInstance[];
}

/**
 * Recover the exact isometry from a construction-time affine matrix.
 *
 * Valid only for the transforms this system produces: uniform scale ½ combined
 * with a hexagonal symmetry. Anything else means the port has drifted from the
 * reference, so we fail loudly.
 */
export function isometryFromAffine(T: Affine): Isometry {
  const det = T[0] * T[4] - T[1] * T[3];
  const reflected = det < 0;

  // Both cases put the rotation angle at atan2(T[3], T[0]):
  //   plain     L = s·[cos, −sin; sin,  cos]
  //   reflected L = s·[cos,  sin; sin, −cos]
  const theta = Math.atan2(T[3], T[0]);
  const k = theta / (Math.PI / 3);
  const rot = Math.round(k);
  if (Math.abs(k - rot) > 1e-6) {
    throw new Error(`rotation ${(theta * 180) / Math.PI}° is not a multiple of 60°`);
  }
  if (Math.abs(Math.abs(det) - 0.25) > 1e-6) {
    throw new Error(`expected uniform scale 1/2 (|det| 0.25), got |det| ${Math.abs(det)}`);
  }

  return isometry(rot, reflected, fromXY(T[2], T[5]));
}

/** The hat's 13 vertices, exact, in tile-local coordinates. */
export const HAT_VERTICES: readonly Eis[] = HAT_OUTLINE_EXACT.map(([a, b]) =>
  eis(a, b),
);

/** A tile's 13 vertices, exact, in patch coordinates. */
export function vertices(tile: Tile): Eis[] {
  return HAT_VERTICES.map((v) => apply(tile.iso, v));
}

/**
 * Build a patch by inflating `level` times.
 *
 * Tile counts grow by φ⁴ ≈ 6.854 per level: 4, 25, 169, 1156, 7921, 54289, …
 * (Fibonacci numbers squared). Levels above ~5 are for the desktop sandbox only.
 */
export function buildPatch(level: number, root: MetaLabel = 'H'): Patch {
  if (!Number.isInteger(level) || level < 0) {
    throw new Error(`level must be a non-negative integer, got ${level}`);
  }

  const tiles: Tile[] = [];
  const metatiles: MetaInstance[] = [];
  const geom = inflate(level)[root];

  const walk = (
    node: Geom,
    T: Affine,
    path: MetaLabel[],
    trail: number[],
    depth: number,
  ): void => {
    if (node.type === 'hat') {
      tiles.push({
        kind: node.kind,
        iso: isometryFromAffine(T),
        path: [...path],
        trail: [...trail],
      });
      return;
    }

    metatiles.push({
      label: node.label,
      depth,
      scaffold: node.shape.map((p) => transPt(T, p)),
    });

    path.push(node.label);
    node.children.forEach((ch, i) => {
      trail.push(i);
      walk(ch.geom, mulAffine(T, ch.T), path, trail, depth + 1);
      trail.pop();
    });
    path.pop();
  };

  walk(geom, [1, 0, 0, 0, 1, 0], [], [], 0);
  return { level, root, tiles, metatiles };
}

// Local affine multiply, kept private so callers never touch matrices.
function mulAffine(A: Affine, B: Affine): Affine {
  return [
    A[0] * B[0] + A[1] * B[3],
    A[0] * B[1] + A[1] * B[4],
    A[0] * B[2] + A[1] * B[5] + A[2],
    A[3] * B[0] + A[4] * B[3],
    A[3] * B[1] + A[4] * B[4],
    A[3] * B[2] + A[4] * B[5] + A[5],
  ];
}

export { HAT_OUTLINE };
