/**
 * One inflation step of the hat substitution system.
 *
 * INTERNAL, float. Ported from isohedral/hatviz `constructPatch` and
 * `constructMetatiles` (Craig S. Kaplan, BSD 3-clause).
 *
 * Inflation *grows the patch* rather than shrinking the tiles: hats keep their
 * size and the supertiles get bigger, by a linear factor of φ² ≈ 2.618 and a
 * tile-count factor of φ⁴ ≈ 6.854. That direction is what keeps the hats on a
 * fixed lattice — subdividing instead would need a new denominator per level.
 */

import {
  type Affine,
  type Vec,
  IDENT,
  intersect,
  matchTwo,
  padd,
  psub,
  rotAbout,
  transPt,
  trot,
} from './affine.js';
import {
  type Child,
  type Geom,
  type MetaLabel,
  F_INIT,
  H_INIT,
  P_INIT,
  RULES,
  SUPERTILE_CHILDREN,
  T_INIT,
} from './hat-data.js';

export type MetaSet = Readonly<Record<MetaLabel, Geom>>;

export const LEVEL_0: MetaSet = { H: H_INIT, T: T_INIT, P: P_INIT, F: F_INIT };

function shapeOf(g: Geom): readonly Vec[] {
  return g.shape;
}

/** Evaluate vertex `i` of patch child `n`, in patch coordinates. */
function evalChild(children: readonly Child[], n: number, i: number): Vec {
  const ch = children[n]!;
  return transPt(ch.T, shapeOf(ch.geom)[i]!);
}

/** Build the 29-child inflation patch from the current four metatiles. */
function constructPatch(tiles: MetaSet): Child[] {
  const out: Child[] = [];

  for (const r of RULES) {
    if (r.length === 1) {
      out.push({ T: IDENT, geom: tiles[r[0]] });
      continue;
    }

    if (r.length === 4) {
      const [n, edge, label, newEdge] = r;
      const poly = shapeOf(out[n]!.geom);
      const T = out[n]!.T;
      const P = transPt(T, poly[(edge + 1) % poly.length]!);
      const Q = transPt(T, poly[edge]!);
      const nshp = tiles[label];
      const npoly = shapeOf(nshp);
      out.push({
        T: matchTwo(npoly[newEdge]!, npoly[(newEdge + 1) % npoly.length]!, P, Q),
        geom: nshp,
      });
      continue;
    }

    const [nP, eP, nQ, eQ, label, edge] = r;
    const chP = out[nP]!;
    const chQ = out[nQ]!;
    const P = transPt(chQ.T, shapeOf(chQ.geom)[eQ]!);
    const Q = transPt(chP.T, shapeOf(chP.geom)[eP]!);
    const nshp = tiles[label];
    const npoly = shapeOf(nshp);
    out.push({
      T: matchTwo(npoly[edge]!, npoly[(edge + 1) % npoly.length]!, P, Q),
      geom: nshp,
    });
  }

  return out;
}

/**
 * Carve the four new supertiles out of the patch.
 *
 * The outlines here are the one genuinely irrational part of the system — `llc`
 * comes from a line intersection and does not land on the lattice. That is fine:
 * outlines are decoration (they draw the hierarchy in scene 5), while the hat
 * placements they induce remain exactly on the lattice.
 */
function constructMetatiles(patch: readonly Child[]): MetaSet {
  const bps1 = evalChild(patch, 8, 2);
  const bps2 = evalChild(patch, 21, 2);
  const rbps = transPt(rotAbout(bps1, (-2 * Math.PI) / 3), bps2);

  const p72 = evalChild(patch, 7, 2);
  const p252 = evalChild(patch, 25, 2);

  const c62 = evalChild(patch, 6, 2);
  const llc = intersect(bps1, rbps, c62, p72);
  let w = psub(c62, llc);

  const newH: Vec[] = [llc, bps1];
  w = transPt(trot(-Math.PI / 3), w);
  newH.push(padd(newH[1]!, w));
  newH.push(evalChild(patch, 14, 2));
  w = transPt(trot(-Math.PI / 3), w);
  newH.push(psub(newH[3]!, w));
  newH.push(c62);

  const newP: Vec[] = [p72, padd(p72, psub(bps1, llc)), bps1, llc];

  const newF: Vec[] = [
    bps2,
    evalChild(patch, 24, 2),
    evalChild(patch, 25, 0),
    p252,
    padd(p252, psub(llc, bps1)),
  ];

  const AAA = newH[2]!;
  const BBB = padd(newH[1]!, psub(newH[4]!, newH[5]!));
  const CCC = transPt(rotAbout(BBB, -Math.PI / 3), AAA);
  const newT: Vec[] = [BBB, CCC, AAA];

  const build = (label: MetaLabel, shape: Vec[]): Geom => ({
    type: 'meta',
    label,
    shape,
    children: SUPERTILE_CHILDREN[label].map((i) => patch[i]!),
  });

  return {
    H: build('H', newH),
    T: build('T', newT),
    P: build('P', newP),
    F: build('F', newF),
  };
}

/** Apply `n` inflation steps to the base metatiles. */
export function inflate(n: number): MetaSet {
  let tiles = LEVEL_0;
  for (let i = 0; i < n; i++) {
    tiles = constructMetatiles(constructPatch(tiles));
  }
  return tiles;
}
