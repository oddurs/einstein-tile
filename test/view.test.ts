import { describe, expect, it } from 'vitest';
import {
  MAX_SCALE,
  MIN_SCALE,
  fitView,
  pan,
  toScreen,
  toWorld,
  zoomAt,
  type View,
} from '../src/renderer/view.js';

const VIEWS: View[] = [
  { scale: 1, tx: 0, ty: 0 },
  { scale: 12.5, tx: -340, ty: 220 },
  { scale: 0.4, tx: 1000, ty: -50 },
];

const WORLD = [
  { x: 0, y: 0 },
  { x: 3, y: -7 },
  { x: -120.25, y: 44.5 },
];

describe('view transform', () => {
  it('round-trips world → screen → world', () => {
    for (const v of VIEWS) {
      for (const p of WORLD) {
        const s = toScreen(v, p.x, p.y);
        const back = toWorld(v, s.x, s.y);
        expect(back.x).toBeCloseTo(p.x, 9);
        expect(back.y).toBeCloseTo(p.y, 9);
      }
    }
  });

  it('flips y — world up is screen down', () => {
    const v: View = { scale: 2, tx: 100, ty: 100 };
    const origin = toScreen(v, 0, 0);
    const above = toScreen(v, 0, 10);
    expect(above.y).toBeLessThan(origin.y);
    expect(above.x).toBe(origin.x);
  });

  it('pans by exactly the screen delta', () => {
    const v = VIEWS[1]!;
    const moved = pan(v, 25, -40);
    const before = toScreen(v, 3, 3);
    const after = toScreen(moved, 3, 3);
    expect(after.x - before.x).toBeCloseTo(25, 9);
    expect(after.y - before.y).toBeCloseTo(-40, 9);
    expect(moved.scale).toBe(v.scale);
  });

  it('keeps the anchor point fixed while zooming', () => {
    for (const v of VIEWS) {
      for (const factor of [0.5, 1.1, 3]) {
        const cx = 411;
        const cy = 289;
        const anchorWorld = toWorld(v, cx, cy);
        const zoomed = zoomAt(v, factor, cx, cy);
        const anchorAfter = toScreen(zoomed, anchorWorld.x, anchorWorld.y);
        expect(anchorAfter.x).toBeCloseTo(cx, 6);
        expect(anchorAfter.y).toBeCloseTo(cy, 6);
      }
    }
  });

  it('clamps scale without letting the anchor drift', () => {
    const cx = 200;
    const cy = 150;
    for (const [start, factor] of [
      [MIN_SCALE, 0.001],
      [MAX_SCALE, 1000],
    ] as const) {
      const v: View = { scale: start, tx: 10, ty: 20 };
      const anchorWorld = toWorld(v, cx, cy);
      const zoomed = zoomAt(v, factor, cx, cy);
      expect(zoomed.scale).toBeGreaterThanOrEqual(MIN_SCALE);
      expect(zoomed.scale).toBeLessThanOrEqual(MAX_SCALE);
      const after = toScreen(zoomed, anchorWorld.x, anchorWorld.y);
      expect(after.x).toBeCloseTo(cx, 6);
      expect(after.y).toBeCloseTo(cy, 6);
    }
  });

  it('zooming in then out by the same factor is the identity', () => {
    const v = VIEWS[2]!;
    const there = zoomAt(v, 2.5, 300, 400);
    const back = zoomAt(there, 1 / 2.5, 300, 400);
    expect(back.scale).toBeCloseTo(v.scale, 9);
    expect(back.tx).toBeCloseTo(v.tx, 6);
    expect(back.ty).toBeCloseTo(v.ty, 6);
  });

  it('fits bounds centred in the viewport', () => {
    const bounds = { minX: -10, minY: -4, maxX: 30, maxY: 16 };
    const v = fitView(bounds, 800, 600, 0.05);
    const centre = toScreen(v, (bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2);
    expect(centre.x).toBeCloseTo(400, 6);
    expect(centre.y).toBeCloseTo(300, 6);
  });

  it('fits entirely inside the viewport, margin included', () => {
    const bounds = { minX: -10, minY: -4, maxX: 30, maxY: 16 };
    const [w, h, padding] = [800, 600, 0.05];
    const v = fitView(bounds, w, h, padding);
    const corners = [
      toScreen(v, bounds.minX, bounds.minY),
      toScreen(v, bounds.maxX, bounds.maxY),
    ];
    for (const c of corners) {
      expect(c.x).toBeGreaterThanOrEqual(w * padding - 1e-6);
      expect(c.x).toBeLessThanOrEqual(w * (1 - padding) + 1e-6);
      expect(c.y).toBeGreaterThanOrEqual(h * padding - 1e-6);
      expect(c.y).toBeLessThanOrEqual(h * (1 - padding) + 1e-6);
    }
  });

  it('handles a degenerate (zero-area) bounds without producing NaN', () => {
    const v = fitView({ minX: 5, minY: 5, maxX: 5, maxY: 5 }, 400, 400);
    expect(Number.isFinite(v.scale)).toBe(true);
    expect(Number.isFinite(v.tx)).toBe(true);
    expect(Number.isFinite(v.ty)).toBe(true);
  });
});
