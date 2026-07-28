/**
 * Pointer gestures for a canvas: drag to pan, pinch or wheel to zoom.
 *
 * The gesture vocabulary is fixed across every scene and must not vary —
 * **pinch is always zoom, drag is always pan** (docs/06 §4). Discoverability is
 * poor on touch, so consistency is the only affordance we get.
 *
 * Unified PointerEvents, so mouse, touch and stylus share one path.
 *
 * All listeners are **passive**. That is possible because the element sets
 * `touch-action: none` in CSS, which suppresses native scrolling without
 * `preventDefault()`. Non-passive listeners on `touchmove`/`wheel` are a
 * classic source of scroll jank (docs/06 §6) — this avoids them by construction.
 * The one exception is `wheel`, where the browser gives us no CSS equivalent
 * for suppressing page zoom, so it is registered non-passive deliberately.
 */

export interface GestureHandlers {
  /** Drag, in CSS pixels. */
  onPan(dx: number, dy: number): void;
  /** Pinch or wheel. `factor` multiplies scale; (cx, cy) is the CSS-pixel anchor. */
  onZoom(factor: number, cx: number, cy: number): void;
  /** A tap that did not turn into a drag. */
  onTap?(x: number, y: number): void;
}

/** Movement in CSS px beyond which a press stops counting as a tap. */
const TAP_SLOP = 8;

interface Active {
  x: number;
  y: number;
  startX: number;
  startY: number;
  moved: boolean;
}

export function attachGestures(
  el: HTMLElement,
  handlers: GestureHandlers,
): () => void {
  const active = new Map<number, Active>();
  let pinchDist = 0;

  const local = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const twoPointers = (): [Active, Active] | null => {
    if (active.size !== 2) return null;
    const [a, b] = [...active.values()];
    return [a!, b!];
  };

  const onDown = (e: PointerEvent) => {
    const p = local(e);
    active.set(e.pointerId, {
      x: p.x,
      y: p.y,
      startX: p.x,
      startY: p.y,
      moved: false,
    });
    el.setPointerCapture(e.pointerId);
    const pair = twoPointers();
    if (pair) pinchDist = Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
  };

  const onMove = (e: PointerEvent) => {
    const prev = active.get(e.pointerId);
    if (!prev) return;
    const p = local(e);
    const dx = p.x - prev.x;
    const dy = p.y - prev.y;
    prev.x = p.x;
    prev.y = p.y;
    if (Math.hypot(p.x - prev.startX, p.y - prev.startY) > TAP_SLOP) prev.moved = true;

    const pair = twoPointers();
    if (pair) {
      // Pinch: zoom about the midpoint, and pan by the midpoint's own drift so
      // the gesture feels anchored to the fingers rather than to the canvas.
      const dist = Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
      const cx = (pair[0].x + pair[1].x) / 2;
      const cy = (pair[0].y + pair[1].y) / 2;
      if (pinchDist > 0 && dist > 0) handlers.onZoom(dist / pinchDist, cx, cy);
      pinchDist = dist;
      handlers.onPan(dx / 2, dy / 2);
      return;
    }

    handlers.onPan(dx, dy);
  };

  const onUp = (e: PointerEvent) => {
    const a = active.get(e.pointerId);
    active.delete(e.pointerId);
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    if (a && !a.moved && active.size === 0) handlers.onTap?.(a.x, a.y);
    if (active.size < 2) pinchDist = 0;
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault(); // no CSS equivalent for suppressing page zoom
    const r = el.getBoundingClientRect();
    // deltaMode 1 is lines, 2 is pages; normalise both to something pixel-ish.
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
    handlers.onZoom(
      Math.exp((-e.deltaY * unit) / 400),
      e.clientX - r.left,
      e.clientY - r.top,
    );
  };

  el.addEventListener('pointerdown', onDown, { passive: true });
  el.addEventListener('pointermove', onMove, { passive: true });
  el.addEventListener('pointerup', onUp, { passive: true });
  el.addEventListener('pointercancel', onUp, { passive: true });
  el.addEventListener('wheel', onWheel, { passive: false });

  return () => {
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', onUp);
    el.removeEventListener('wheel', onWheel);
  };
}
