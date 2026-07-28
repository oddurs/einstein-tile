/**
 * Exact arithmetic on the half-Eisenstein lattice.
 *
 * Every vertex of every hat, at every substitution level, lies exactly on this
 * lattice — verified empirically against hatviz's float construction out to
 * 2.5M tiles, where the deviation was 3e-10 (pure float accumulation) against a
 * lattice spacing of 1. See docs/08-engine.md.
 *
 * A point is stored as the integer pair (a, b) denoting the complex number
 *
 *     (a + b·ω) / 2        where ω = e^(iπ/3) = 1/2 + i·√3/2
 *
 * so in Cartesian terms
 *
 *     x = (2a + b) / 4
 *     y = b·√3 / 4
 *
 * ω is a primitive 6th root of unity satisfying ω² = ω − 1, which makes
 * rotation by 60° and reflection exact integer operations.
 */

/** A point on the half-Eisenstein lattice. Integer fields; never fractional. */
export interface Eis {
  readonly a: number;
  readonly b: number;
}

export const ORIGIN: Eis = { a: 0, b: 0 };

export function eis(a: number, b: number): Eis {
  return { a, b };
}

export function add(p: Eis, q: Eis): Eis {
  return { a: p.a + q.a, b: p.b + q.b };
}

export function sub(p: Eis, q: Eis): Eis {
  return { a: p.a - q.a, b: p.b - q.b };
}

export function negate(p: Eis): Eis {
  return { a: -p.a, b: -p.b };
}

export function equals(p: Eis, q: Eis): boolean {
  return p.a === q.a && p.b === q.b;
}

/**
 * Rotate by 60° (multiply by ω).
 * (a + bω)·ω = aω + bω² = aω + b(ω − 1) = −b + (a + b)ω
 */
export function rot60(p: Eis): Eis {
  return { a: -p.b, b: p.a + p.b };
}

/** Rotate by k·60°. k is taken mod 6, negatives allowed. */
export function rot60k(p: Eis, k: number): Eis {
  let r = p;
  const n = ((k % 6) + 6) % 6;
  for (let i = 0; i < n; i++) r = rot60(r);
  return r;
}

/**
 * Complex conjugation — reflection across the x-axis.
 * conj(ω) = 1 − ω, so a + bω ↦ (a + b) − bω
 */
export function conj(p: Eis): Eis {
  return { a: p.a + p.b, b: -p.b };
}

/** Cartesian x. Float — use only when emitting geometry. */
export function toX(p: Eis): number {
  return (2 * p.a + p.b) / 4;
}

/** Cartesian y. Float — use only when emitting geometry. */
export function toY(p: Eis): number {
  return (p.b * Math.sqrt(3)) / 4;
}

/** A collision-free string key, for maps and sets. */
export function key(p: Eis): string {
  return `${p.a},${p.b}`;
}

/**
 * Snap a Cartesian point onto the lattice.
 *
 * The float construction is exact to within ~1e-10 while the lattice spacing is
 * 1, so rounding recovers the intended integers with a colossal safety margin.
 * `tolerance` is asserted, not assumed: a violation means the geometry is not
 * what we believe it is, and we want that to fail loudly rather than render a
 * subtly wrong tiling.
 */
export function fromXY(x: number, y: number, tolerance = 1e-6): Eis {
  const bf = (4 * y) / Math.sqrt(3);
  const af = (4 * x - bf) / 2;
  const a = Math.round(af);
  const b = Math.round(bf);
  const err = Math.max(Math.abs(af - a), Math.abs(bf - b));
  if (err > tolerance) {
    throw new Error(
      `point (${x}, ${y}) is not on the half-Eisenstein lattice ` +
        `(nearest is (${a}, ${b}), off by ${err.toExponential(3)})`,
    );
  }
  return { a, b };
}
