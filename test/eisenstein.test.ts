import { describe, expect, it } from 'vitest';
import {
  add,
  conj,
  eis,
  equals,
  fromXY,
  rot60,
  rot60k,
  sub,
  toX,
  toY,
} from '../src/engine/eisenstein.js';

const SAMPLES = [eis(0, 0), eis(1, 0), eis(0, 1), eis(5, -1), eis(-3, 7), eis(12, 12)];

describe('half-Eisenstein arithmetic', () => {
  it('rotating six times by 60° is the identity', () => {
    for (const p of SAMPLES) {
      expect(rot60k(p, 6)).toEqual(p);
    }
  });

  it('rot60 agrees with a float rotation', () => {
    for (const p of SAMPLES) {
      const r = rot60(p);
      const c = Math.cos(Math.PI / 3);
      const s = Math.sin(Math.PI / 3);
      expect(toX(r)).toBeCloseTo(c * toX(p) - s * toY(p), 12);
      expect(toY(r)).toBeCloseTo(s * toX(p) + c * toY(p), 12);
    }
  });

  it('conjugation is an involution and negates y', () => {
    for (const p of SAMPLES) {
      expect(conj(conj(p))).toEqual(p);
      expect(toX(conj(p))).toBeCloseTo(toX(p), 12);
      expect(toY(conj(p))).toBeCloseTo(-toY(p), 12);
    }
  });

  it('add and sub are inverse', () => {
    for (const p of SAMPLES) {
      for (const q of SAMPLES) {
        expect(equals(sub(add(p, q), q), p)).toBe(true);
      }
    }
  });

  it('fromXY round-trips every sample exactly', () => {
    for (const p of SAMPLES) {
      expect(fromXY(toX(p), toY(p))).toEqual(p);
    }
  });

  it('fromXY rejects a point that is off the lattice', () => {
    expect(() => fromXY(0.1234, 0.5678)).toThrow(/not on the half-Eisenstein lattice/);
  });

  it('fromXY tolerates float noise well below the lattice spacing', () => {
    const p = eis(5, -1);
    expect(fromXY(toX(p) + 1e-10, toY(p) - 1e-10)).toEqual(p);
  });
});
