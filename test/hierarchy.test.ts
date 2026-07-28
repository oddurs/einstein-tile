import { describe, expect, it } from 'vitest';
import { stageForScale } from '../src/scenes/hierarchy.js';

const STAGES = 6;
const FIT = 10;

describe('stageForScale', () => {
  it('shows the coarsest grouping when the whole patch is in view', () => {
    expect(stageForScale(FIT, FIT, STAGES)).toBe(STAGES - 1);
  });

  it('steps one stage finer per doubling of scale', () => {
    expect(stageForScale(FIT * 2, FIT, STAGES)).toBe(STAGES - 2);
    expect(stageForScale(FIT * 4, FIT, STAGES)).toBe(STAGES - 3);
    expect(stageForScale(FIT * 8, FIT, STAGES)).toBe(STAGES - 4);
  });

  it('never leaves the valid stage range, however far you zoom', () => {
    for (const scale of [1e-6, 0.01, 1, 1e3, 1e9]) {
      const s = stageForScale(scale, FIT, STAGES);
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(STAGES - 1);
    }
  });

  it('is monotonic — zooming in never coarsens the grouping', () => {
    let previous = Infinity;
    for (let octave = -2; octave <= 8; octave += 0.25) {
      const s = stageForScale(FIT * 2 ** octave, FIT, STAGES);
      expect(s).toBeLessThanOrEqual(previous);
      previous = s;
    }
  });

  it('reaches both ends of the range across a realistic zoom sweep', () => {
    const seen = new Set<number>();
    for (let octave = -1; octave <= STAGES + 1; octave += 0.1) {
      seen.add(stageForScale(FIT * 2 ** octave, FIT, STAGES));
    }
    expect(seen.has(0)).toBe(true);
    expect(seen.has(STAGES - 1)).toBe(true);
    // and every stage in between is reachable — no level is skipped
    expect(seen.size).toBe(STAGES);
  });
});
