/**
 * @einstein-tile/engine — exact aperiodic hat tilings.
 *
 * Framework-agnostic: no DOM, no canvas, no rendering. Produces exact integer
 * tile placements; callers turn them into pixels.
 *
 * Based on Smith, Myers, Kaplan & Goodman-Strauss, "An aperiodic monotile"
 * (2023). Substitution data ported from isohedral/hatviz, BSD 3-clause.
 */

export {
  type Eis,
  ORIGIN,
  add,
  conj,
  eis,
  equals,
  fromXY,
  key,
  negate,
  rot60,
  rot60k,
  sub,
  toX,
  toY,
} from './eisenstein.js';

export {
  type Isometry,
  IDENTITY,
  apply,
  compose,
  isoKey,
  isometry,
  orientation,
} from './isometry.js';

export {
  type MetaInstance,
  type Patch,
  type Tile,
  HAT_VERTICES,
  buildPatch,
  vertices,
} from './patch.js';

export { boundaryLoops, groupByAncestor, signedArea2 } from './hull.js';

export {
  type Board,
  deadHoles,
  frontier,
  greedyWalk,
  holes,
  legalMoves,
  makeBoard,
  movesAlongStep,
} from './moves.js';

export { type BoundaryStep, boundarySteps } from './hull.js';

export {
  type Kite,
  HAT_KITES,
  KiteIndex,
  cosetOf,
  hexCoset,
  kiteKey,
  kiteOutline,
  kites,
  overlaps,
} from './kites.js';

export {
  type ColourScheme,
  type Point,
  bounds,
  colourKey,
  polygon,
  toPoint,
} from './render.js';

export type { HatKind, MetaLabel } from './internal/hat-data.js';
