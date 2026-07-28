/**
 * The view transform, as pure functions so it can be tested without a canvas.
 *
 * Two coordinate systems:
 *
 *  - **world** — the engine's, y growing *upward* (`toY` returns +√3·b/4)
 *  - **screen** — CSS pixels, y growing *downward*
 *
 * so the mapping carries a y-flip:
 *
 *     sx = tx + scale·wx
 *     sy = ty − scale·wy
 *
 * Getting that flip wrong produces a patch that renders and pans correctly but
 * is mirrored — which, for a tiling whose reflected tiles are the whole point,
 * would be a subtle and embarrassing bug. Hence the round-trip tests.
 */

export interface View {
  /** CSS pixels per world unit. */
  readonly scale: number;
  /** Screen position, in CSS pixels, of the world origin. */
  readonly tx: number;
  readonly ty: number;
}

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export const MIN_SCALE = 0.05;
export const MAX_SCALE = 4000;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function toScreen(view: View, wx: number, wy: number): { x: number; y: number } {
  return { x: view.tx + view.scale * wx, y: view.ty - view.scale * wy };
}

export function toWorld(view: View, sx: number, sy: number): { x: number; y: number } {
  return { x: (sx - view.tx) / view.scale, y: -(sy - view.ty) / view.scale };
}

export function pan(view: View, dx: number, dy: number): View {
  return { scale: view.scale, tx: view.tx + dx, ty: view.ty + dy };
}

/**
 * Zoom by `factor` about the screen point (cx, cy), which stays pinned to the
 * same world point. Respects the scale clamp — if the clamp bites, the applied
 * factor shrinks accordingly rather than letting the anchor drift.
 */
export function zoomAt(view: View, factor: number, cx: number, cy: number): View {
  const next = clamp(view.scale * factor, MIN_SCALE, MAX_SCALE);
  const applied = next / view.scale;
  return {
    scale: next,
    tx: cx - (cx - view.tx) * applied,
    ty: cy - (cy - view.ty) * applied,
  };
}

/** Scale and centre so `bounds` fits the viewport with a fractional margin. */
export function fitView(
  bounds: Bounds,
  cssWidth: number,
  cssHeight: number,
  padding = 0.06,
): View {
  const w = Math.max(bounds.maxX - bounds.minX, 1e-9);
  const h = Math.max(bounds.maxY - bounds.minY, 1e-9);
  const usable = 1 - 2 * padding;
  const scale = clamp(
    Math.min((cssWidth * usable) / w, (cssHeight * usable) / h),
    MIN_SCALE,
    MAX_SCALE,
  );
  const mx = (bounds.minX + bounds.maxX) / 2;
  const my = (bounds.minY + bounds.maxY) / 2;
  return {
    scale,
    tx: cssWidth / 2 - scale * mx,
    ty: cssHeight / 2 + scale * my,
  };
}
