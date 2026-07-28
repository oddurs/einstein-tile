/**
 * The 12 symmetries of the hexagonal lattice, as exact integer data.
 *
 * Empirically, every hat placement produced by the substitution is one of these
 * — 6 rotations × optional reflection — with no exceptions across 2.5M tiles.
 * So a placement needs no matrix, just (rot, reflected, translation).
 *
 *     apply(iso, p) = t + ω^rot · (reflected ? conj(p) : p)
 *
 * Reflection is applied first, then rotation, then translation.
 */

import { type Eis, add, conj, rot60k, ORIGIN } from './eisenstein.js';

export interface Isometry {
  /** Rotation in units of 60°, always normalised to 0–5. */
  readonly rot: number;
  /** Whether the tile is mirrored. Hat tilings require both. */
  readonly reflected: boolean;
  /** Translation, exact. */
  readonly t: Eis;
}

export const IDENTITY: Isometry = { rot: 0, reflected: false, t: ORIGIN };

export function isometry(rot: number, reflected: boolean, t: Eis): Isometry {
  return { rot: ((rot % 6) + 6) % 6, reflected, t };
}

export function apply(iso: Isometry, p: Eis): Eis {
  return add(iso.t, rot60k(iso.reflected ? conj(p) : p, iso.rot));
}

/**
 * Compose two isometries: `compose(f, g)` applies g first, then f.
 *
 * Derivation, writing R for conjugation:
 *   f(g(p)) = t_f + ω^rf · R_f( t_g + ω^rg · R_g(p) )
 *
 * If f is not reflected this is t_f + ω^rf·t_g + ω^(rf+rg)·R_g(p).
 * If f is reflected, conj(ω^rg · R_g(p)) = ω^(−rg) · (R_g ? p : conj p), so the
 * rotation subtracts and the reflection flag flips.
 */
export function compose(f: Isometry, g: Isometry): Isometry {
  if (!f.reflected) {
    return {
      rot: (f.rot + g.rot) % 6,
      reflected: g.reflected,
      t: add(f.t, rot60k(g.t, f.rot)),
    };
  }
  return {
    rot: (((f.rot - g.rot) % 6) + 6) % 6,
    reflected: !g.reflected,
    t: add(f.t, rot60k(conj(g.t), f.rot)),
  };
}

/**
 * Orientation index 0–11, for colour-by-orientation.
 * Unreflected orientations are 0–5, reflected are 6–11.
 */
export function orientation(iso: Isometry): number {
  return iso.rot + (iso.reflected ? 6 : 0);
}

/** Two placements coincide iff all three components match. */
export function isoKey(iso: Isometry): string {
  return `${iso.rot}${iso.reflected ? 'm' : 'r'}${iso.t.a},${iso.t.b}`;
}
