/**
 * The hat, the four metatiles, and the substitution rule table.
 *
 * INTERNAL. All data transcribed from isohedral/hatviz (Craig S. Kaplan,
 * BSD 3-clause), which is the reference implementation accompanying
 * Smith, Myers, Kaplan & Goodman-Strauss, "An aperiodic monotile" (2023).
 *
 * Do not hand-edit the numbers. They are not guessable and a single wrong digit
 * produces a tiling that looks plausible and is wrong.
 */

import {
  type Affine,
  type Vec,
  HR3,
  hexPt,
  matchTwo,
  mul,
  pt,
  transPt,
  ttrans,
} from './affine.js';

/** Which of the five roles a hat plays in its metatile. `H1` is the reflected one. */
export type HatKind = 'H' | 'H1' | 'T' | 'P' | 'F';

/** The four metatiles of the hat substitution system. */
export type MetaLabel = 'H' | 'T' | 'P' | 'F';

/**
 * The hat, as 13 vertices on the hexagonal lattice.
 *
 * Note these are `hexPt` integers, which is precisely why the whole system is
 * exactly representable. The tile is drawn at half this scale (the metatile
 * outlines below are at 2×), so in half-lattice integer coordinates the
 * numerators are exactly these (x, y) pairs.
 */
export const HAT_OUTLINE: readonly Vec[] = [
  hexPt(0, 0),
  hexPt(-1, -1),
  hexPt(0, -2),
  hexPt(2, -2),
  hexPt(2, -1),
  hexPt(4, -2),
  hexPt(5, -1),
  hexPt(4, 0),
  hexPt(3, 0),
  hexPt(2, 2),
  hexPt(0, 3),
  hexPt(0, 2),
  hexPt(-1, 2),
];

/** The same 13 vertices as exact half-lattice integer pairs. */
export const HAT_OUTLINE_EXACT: readonly (readonly [number, number])[] = [
  [0, 0],
  [-1, -1],
  [0, -2],
  [2, -2],
  [2, -1],
  [4, -2],
  [5, -1],
  [4, 0],
  [3, 0],
  [2, 2],
  [0, 3],
  [0, 2],
  [-1, 2],
];

/** A node in the substitution hierarchy: either a single hat, or a metatile. */
export type Geom =
  | { readonly type: 'hat'; readonly kind: HatKind; readonly shape: readonly Vec[] }
  | {
      readonly type: 'meta';
      readonly label: MetaLabel;
      readonly shape: readonly Vec[];
      readonly children: readonly Child[];
    };

export interface Child {
  readonly T: Affine;
  readonly geom: Geom;
}

function hat(kind: HatKind): Geom {
  return { type: 'hat', kind, shape: HAT_OUTLINE };
}

const H_HAT = hat('H');
const H1_HAT = hat('H1');
const T_HAT = hat('T');
const P_HAT = hat('P');
const F_HAT = hat('F');

function meta(label: MetaLabel, shape: readonly Vec[], children: Child[]): Geom {
  return { type: 'meta', label, shape, children };
}

// ---------------------------------------------------------------------------
// Level 0: the four metatiles, each expressed directly in hats.
// ---------------------------------------------------------------------------

const H_OUTLINE: readonly Vec[] = [
  pt(0, 0),
  pt(4, 0),
  pt(4.5, HR3),
  pt(2.5, 5 * HR3),
  pt(1.5, 5 * HR3),
  pt(-0.5, HR3),
];

export const H_INIT: Geom = meta('H', H_OUTLINE, [
  {
    T: matchTwo(HAT_OUTLINE[5]!, HAT_OUTLINE[7]!, H_OUTLINE[5]!, H_OUTLINE[0]!),
    geom: H_HAT,
  },
  {
    T: matchTwo(HAT_OUTLINE[9]!, HAT_OUTLINE[11]!, H_OUTLINE[1]!, H_OUTLINE[2]!),
    geom: H_HAT,
  },
  {
    T: matchTwo(HAT_OUTLINE[5]!, HAT_OUTLINE[7]!, H_OUTLINE[3]!, H_OUTLINE[4]!),
    geom: H_HAT,
  },
  {
    // the one reflected hat: mirror, then rotate 120°, then translate
    T: mul(
      ttrans(2.5, HR3),
      mul([-0.5, -HR3, 0, HR3, -0.5, 0], [0.5, 0, 0, 0, -0.5, 0]),
    ),
    geom: H1_HAT,
  },
]);

const T_OUTLINE: readonly Vec[] = [pt(0, 0), pt(3, 0), pt(1.5, 3 * HR3)];

export const T_INIT: Geom = meta('T', T_OUTLINE, [
  { T: [0.5, 0, 0.5, 0, 0.5, HR3], geom: T_HAT },
]);

const P_OUTLINE: readonly Vec[] = [
  pt(0, 0),
  pt(4, 0),
  pt(3, 2 * HR3),
  pt(-1, 2 * HR3),
];

export const P_INIT: Geom = meta('P', P_OUTLINE, [
  { T: [0.5, 0, 1.5, 0, 0.5, HR3], geom: P_HAT },
  {
    T: mul(
      ttrans(0, 2 * HR3),
      mul([0.5, HR3, 0, -HR3, 0.5, 0], [0.5, 0, 0, 0, 0.5, 0]),
    ),
    geom: P_HAT,
  },
]);

const F_OUTLINE: readonly Vec[] = [
  pt(0, 0),
  pt(3, 0),
  pt(3.5, HR3),
  pt(3, 2 * HR3),
  pt(-1, 2 * HR3),
];

export const F_INIT: Geom = meta('F', F_OUTLINE, [
  { T: [0.5, 0, 1.5, 0, 0.5, HR3], geom: F_HAT },
  {
    T: mul(
      ttrans(0, 2 * HR3),
      mul([0.5, HR3, 0, -HR3, 0.5, 0], [0.5, 0, 0, 0, 0.5, 0]),
    ),
    geom: F_HAT,
  },
]);

// ---------------------------------------------------------------------------
// The substitution rule table.
// ---------------------------------------------------------------------------

/**
 * 29 placements forming one inflation patch. Entries are:
 *
 *   [label]                        — seed, placed at the identity
 *   [n, edge, label, newEdge]      — butt `label`'s edge `newEdge` against
 *                                    edge `edge` of already-placed child `n`
 *   [nP, eP, nQ, eQ, label, edge]  — place `label` spanning two existing children
 *
 * Only 22 of the 29 end up inside a supertile; the other 7 exist to pin the
 * geometry and belong to neighbouring supertiles.
 */
export type Rule =
  | readonly [MetaLabel]
  | readonly [number, number, MetaLabel, number]
  | readonly [number, number, number, number, MetaLabel, number];

export const RULES: readonly Rule[] = [
  ['H'],
  [0, 0, 'P', 2],
  [1, 0, 'H', 2],
  [2, 0, 'P', 2],
  [3, 0, 'H', 2],
  [4, 4, 'P', 2],
  [0, 4, 'F', 3],
  [2, 4, 'F', 3],
  [4, 1, 3, 2, 'F', 0],
  [8, 3, 'H', 0],
  [9, 2, 'P', 0],
  [10, 2, 'H', 0],
  [11, 4, 'P', 2],
  [12, 0, 'H', 2],
  [13, 0, 'F', 3],
  [14, 2, 'F', 1],
  [15, 3, 'H', 4],
  [8, 2, 'F', 1],
  [17, 3, 'H', 0],
  [18, 2, 'P', 0],
  [19, 2, 'H', 2],
  [20, 4, 'F', 3],
  [20, 0, 'P', 2],
  [22, 0, 'H', 2],
  [23, 4, 'F', 3],
  [23, 0, 'F', 3],
  [16, 0, 'P', 2],
  [9, 4, 0, 2, 'T', 2],
  [4, 0, 'F', 3],
];

/** Which patch children become the children of each new supertile. */
export const SUPERTILE_CHILDREN: Readonly<Record<MetaLabel, readonly number[]>> = {
  H: [0, 9, 16, 27, 26, 6, 1, 8, 10, 15],
  P: [7, 2, 3, 4, 28],
  F: [21, 20, 22, 23, 24, 25],
  T: [11],
};

export { transPt };
