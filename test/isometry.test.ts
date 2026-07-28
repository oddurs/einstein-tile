import { describe, expect, it } from 'vitest';
import { eis, toX, toY } from '../src/engine/eisenstein.js';
import { apply, compose, isometry, orientation } from '../src/engine/isometry.js';

const ISOS = [
  isometry(0, false, eis(0, 0)),
  isometry(1, false, eis(3, -2)),
  isometry(5, false, eis(-1, 4)),
  isometry(0, true, eis(2, 2)),
  isometry(3, true, eis(-5, 1)),
  isometry(4, true, eis(7, 0)),
];

const POINTS = [eis(0, 0), eis(1, 0), eis(0, 1), eis(4, -2), eis(-3, 5)];

describe('hexagonal isometries', () => {
  it('compose(f, g) applies g first, then f', () => {
    for (const f of ISOS) {
      for (const g of ISOS) {
        const fg = compose(f, g);
        for (const p of POINTS) {
          expect(apply(fg, p)).toEqual(apply(f, apply(g, p)));
        }
      }
    }
  });

  it('composition is associative', () => {
    for (const f of ISOS) {
      for (const g of ISOS) {
        for (const h of ISOS) {
          const left = compose(compose(f, g), h);
          const right = compose(f, compose(g, h));
          for (const p of POINTS) {
            expect(apply(left, p)).toEqual(apply(right, p));
          }
        }
      }
    }
  });

  it('preserves distance', () => {
    const dist = (p: ReturnType<typeof eis>, q: ReturnType<typeof eis>) =>
      Math.hypot(toX(p) - toX(q), toY(p) - toY(q));
    for (const f of ISOS) {
      for (let i = 0; i < POINTS.length; i++) {
        for (let j = i + 1; j < POINTS.length; j++) {
          const p = POINTS[i]!;
          const q = POINTS[j]!;
          expect(dist(apply(f, p), apply(f, q))).toBeCloseTo(dist(p, q), 12);
        }
      }
    }
  });

  it('assigns each of the 12 symmetries a distinct orientation index', () => {
    const seen = new Set<number>();
    for (let r = 0; r < 6; r++) {
      for (const m of [false, true]) {
        seen.add(orientation(isometry(r, m, eis(0, 0))));
      }
    }
    expect(seen.size).toBe(12);
    expect(Math.min(...seen)).toBe(0);
    expect(Math.max(...seen)).toBe(11);
  });
});
