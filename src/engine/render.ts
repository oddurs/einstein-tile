/**
 * The float boundary: exact lattice data in, drawing coordinates out.
 *
 * This is the only place tiles become floats. Everything upstream is integer,
 * so there is no accumulated drift to render — a patch at level 6 is as sharp
 * as one at level 1.
 */

import { type Eis, toX, toY } from './eisenstein.js';
import { orientation } from './isometry.js';
import { type Tile } from './patch.js';
import { vertices } from './patch.js';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export function toPoint(p: Eis): Point {
  return { x: toX(p), y: toY(p) };
}

/** A tile's outline in drawing coordinates, ready for `ctx.moveTo`/`lineTo`. */
export function polygon(tile: Tile): Point[] {
  return vertices(tile).map(toPoint);
}

/**
 * Colour keys. Each scheme teaches something specific, per docs/06 §5 —
 * never colour randomly.
 */
export type ColourScheme = 'orientation' | 'metatile' | 'reflection';

/**
 * The value a colour scheme keys on.
 *
 *  - `orientation` → 0–11, exposing the rotational structure
 *  - `metatile`    → the innermost metatile label, exposing the hierarchy
 *  - `reflection`  → 0 unreflected / 1 reflected, exposing the φ⁴ ratio
 *
 * Callers map these to actual colours. Note the accessibility constraint in
 * docs/06 §4: a 12-hue orientation palette needs a lightness-varying
 * alternative to be usable by colourblind readers.
 */
export function colourKey(tile: Tile, scheme: ColourScheme): number | string {
  switch (scheme) {
    case 'orientation':
      return orientation(tile.iso);
    case 'metatile':
      return tile.path.at(-1) ?? tile.kind;
    case 'reflection':
      return tile.iso.reflected ? 1 : 0;
  }
}

/** Axis-aligned bounds of a set of points, for fitting a patch to a viewport. */
export function bounds(points: readonly Point[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}
