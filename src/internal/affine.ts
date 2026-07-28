/**
 * Floating-point affine geometry — INTERNAL, construction-time only.
 *
 * This is a faithful port of the helpers in isohedral/hatviz `geometry.js`
 * (Craig S. Kaplan, BSD 3-clause). We reproduce its arithmetic exactly so that
 * our substitution provably agrees with the reference implementation.
 *
 * Nothing here escapes into the public API: every placement this produces is
 * snapped onto the exact lattice (see `fromXY`) before anyone sees it. The
 * substitution needs floats because the metatile outlines involve a genuine
 * line intersection whose result is irrational — but the *hats* always land on
 * the lattice, which is what makes the snap sound.
 *
 * A transform is [a, b, c, d, e, f] meaning
 *     x' = a·x + b·y + c
 *     y' = d·x + e·y + f
 */

export interface Vec {
  readonly x: number;
  readonly y: number;
}

export type Affine = readonly [number, number, number, number, number, number];

export const HR3 = Math.sqrt(3) / 2;
export const IDENT: Affine = [1, 0, 0, 0, 1, 0];

export function pt(x: number, y: number): Vec {
  return { x, y };
}

/** Hexagonal lattice point: x·(1,0) + y·(1/2, √3/2). */
export function hexPt(x: number, y: number): Vec {
  return { x: x + 0.5 * y, y: HR3 * y };
}

export function padd(p: Vec, q: Vec): Vec {
  return { x: p.x + q.x, y: p.y + q.y };
}

export function psub(p: Vec, q: Vec): Vec {
  return { x: p.x - q.x, y: p.y - q.y };
}

export function mul(A: Affine, B: Affine): Affine {
  return [
    A[0] * B[0] + A[1] * B[3],
    A[0] * B[1] + A[1] * B[4],
    A[0] * B[2] + A[1] * B[5] + A[2],
    A[3] * B[0] + A[4] * B[3],
    A[3] * B[1] + A[4] * B[4],
    A[3] * B[2] + A[4] * B[5] + A[5],
  ];
}

export function inv(T: Affine): Affine {
  const det = T[0] * T[4] - T[1] * T[3];
  return [
    T[4] / det,
    -T[1] / det,
    (T[1] * T[5] - T[2] * T[4]) / det,
    -T[3] / det,
    T[0] / det,
    (T[2] * T[3] - T[0] * T[5]) / det,
  ];
}

export function transPt(M: Affine, p: Vec): Vec {
  return { x: M[0] * p.x + M[1] * p.y + M[2], y: M[3] * p.x + M[4] * p.y + M[5] };
}

export function trot(ang: number): Affine {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [c, -s, 0, s, c, 0];
}

export function ttrans(tx: number, ty: number): Affine {
  return [1, 0, tx, 0, 1, ty];
}

export function rotAbout(p: Vec, ang: number): Affine {
  return mul(ttrans(p.x, p.y), mul(trot(ang), ttrans(-p.x, -p.y)));
}

/** Map the unit interval onto the segment p→q. */
export function matchSeg(p: Vec, q: Vec): Affine {
  return [q.x - p.x, p.y - q.y, p.x, q.y - p.y, q.x - p.x, p.y];
}

/** Map segment p1→q1 onto segment p2→q2. Orientation-preserving. */
export function matchTwo(p1: Vec, q1: Vec, p2: Vec, q2: Vec): Affine {
  return mul(matchSeg(p2, q2), inv(matchSeg(p1, q1)));
}

/** Intersection of the lines through p1→q1 and p2→q2. */
export function intersect(p1: Vec, q1: Vec, p2: Vec, q2: Vec): Vec {
  const d = (q2.y - p2.y) * (q1.x - p1.x) - (q2.x - p2.x) * (q1.y - p1.y);
  const uA =
    ((q2.x - p2.x) * (p1.y - p2.y) - (q2.y - p2.y) * (p1.x - p2.x)) / d;
  return { x: p1.x + uA * (q1.x - p1.x), y: p1.y + uA * (q1.y - p1.y) };
}
