/**
 * Sliding a tiling over itself — the definition of "repeats", made testable.
 *
 * A tiling is **periodic** exactly when some translation maps it onto itself.
 * That is not a metaphor for repeating; it *is* repeating. So the honest way to
 * show a reader that something never repeats is to let them try every slide and
 * watch it never land.
 *
 * Everything is on the exact lattice, so "lands exactly" is an integer identity
 * test rather than a tolerance: a piece matches if some piece of the original
 * has the same form and sits at exactly `anchor + shift`.
 */

import { type Eis, add, key } from './eisenstein.js';
import type { Point } from './render.js';

/**
 * One drawable piece of a tiling, reduced to what sliding needs.
 *
 * `form` distinguishes pieces that are congruent-but-differently-placed — for
 * hats it is orientation plus handedness, for a hexagon grid there is only one
 * form. Two pieces coincide under a slide iff their forms match and their
 * anchors differ by exactly the shift.
 */
export interface Piece {
  readonly anchor: Eis;
  readonly form: string;
  readonly points: readonly Point[];
}

const pieceKey = (p: { anchor: Eis; form: string }): string =>
  `${p.form}@${key(p.anchor)}`;

export interface Alignment {
  /** Indices of pieces that land exactly on a piece of the original. */
  readonly matched: number[];
  /** How many pieces landed. */
  readonly count: number;
  /** Of the pieces that could have landed, the fraction that did. */
  readonly fraction: number;
  /** True when the slide maps the tiling onto itself wherever they overlap. */
  readonly perfect: boolean;
}

/**
 * Slide `pieces` by `shift` and see what lands.
 *
 * `fraction` is measured against the pieces that *could* land — those whose
 * shifted anchor is still inside the patch's own anchor set region. A finite
 * patch always loses its edges to the slide, so scoring against every piece
 * would understate a genuinely periodic tiling and make the comparison unfair.
 */
export function alignment(pieces: readonly Piece[], shift: Eis): Alignment {
  const present = new Set(pieces.map(pieceKey));
  const anchors = new Set(pieces.map((p) => key(p.anchor)));

  const matched: number[] = [];
  let candidates = 0;

  for (const [i, piece] of pieces.entries()) {
    const moved = add(piece.anchor, shift);
    // Did this piece land anywhere the original patch actually covers? If not,
    // it slid off the edge and cannot fairly count against the tiling.
    if (!anchors.has(key(moved))) continue;
    candidates++;
    if (present.has(pieceKey({ anchor: moved, form: piece.form }))) matched.push(i);
  }

  return {
    matched,
    count: matched.length,
    fraction: candidates ? matched.length / candidates : 0,
    perfect: candidates > 0 && matched.length === candidates,
  };
}

/**
 * Every slide that could possibly be a period, nearest first.
 *
 * A period must map each piece onto *some* piece of the same form, so if it maps
 * piece 0 anywhere at all, the shift is `anchor_j − anchor_0` for some piece `j`
 * sharing piece 0's form. That makes this list **complete**: any translation not
 * in it fails immediately, on piece 0.
 *
 * Which is a much better thing to hand a reader than an arbitrary grid. They are
 * not sampling slides and finding none that work — they can walk the entire set
 * of slides that could conceivably work, and watch every one of them fail.
 */
export function candidateShifts(pieces: readonly Piece[]): Eis[] {
  const first = pieces[0];
  if (!first) return [];
  const seen = new Set<string>();
  const out: Eis[] = [];
  for (const piece of pieces) {
    if (piece.form !== first.form) continue;
    const shift = { a: piece.anchor.a - first.anchor.a, b: piece.anchor.b - first.anchor.b };
    if (shift.a === 0 && shift.b === 0) continue;
    const k = key(shift);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(shift);
  }
  return out;
}

/**
 * The best slide within `radius` lattice steps, ignoring the zero slide.
 *
 * For a periodic tiling this finds a perfect match. For an aperiodic one it
 * finds the least-bad near miss, which is the number worth showing a reader:
 * *this is as close as it ever gets.*
 */
export function bestAlignment(
  pieces: readonly Piece[],
  radius = 12,
): { shift: Eis; alignment: Alignment } {
  let best = { shift: { a: 0, b: 0 }, alignment: alignment(pieces, { a: 0, b: 0 }) };
  let bestFraction = -1;

  for (let a = -radius; a <= radius; a++) {
    for (let b = -radius; b <= radius; b++) {
      if (a === 0 && b === 0) continue;
      const shift = { a, b };
      const result = alignment(pieces, shift);
      if (result.count === 0) continue;
      if (result.fraction > bestFraction) {
        bestFraction = result.fraction;
        best = { shift, alignment: result };
      }
    }
  }
  return best;
}
