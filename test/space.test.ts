/**
 * The spacing gate.
 *
 * Sprint 8 gave type a ratio. Sprint 12 gave colour semantic roles *and a test
 * that fails when a scene invents one*, which is the half that made it last.
 * Everything between them — space, corner radius, motion — was still whatever
 * each rule needed on the day it was written: **24 distinct spacing values in
 * the piece and 12 more in the sandbox**, and two pages that had quietly
 * disagreed about how round a card is (16px against 14px).
 *
 * So this is the ink test's twin. It is not about any single value being wrong;
 * it is about the next one being decided rather than guessed.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MOTION, RADIUS, SPACE, SPACE_RATIO, spaceCSS } from '../src/renderer/space.js';

const PAGES = ['index.astro', 'make.astro'] as const;
const read = (name: string) =>
  readFileSync(new URL(`../src/pages/${name}`, import.meta.url), 'utf8')
    // Comments explain what the values *used* to be; that is their job.
    .replace(/\/\*[\s\S]*?\*\//g, '');

/** Properties that must come from the scale. */
const SPACING = String.raw`(?:margin|padding|gap|column-gap|row-gap)(?:-(?:top|bottom|left|right|inline|block))?`;

describe('space comes from the scale', () => {
  for (const page of PAGES) {
    it(page, () => {
      const source = read(page);
      const offenders: string[] = [];

      for (const match of source.matchAll(new RegExp(`\\b${SPACING}:\\s*([^;{}]+)`, 'g'))) {
        const value = match[1]!.trim();
        // Viewport units are a different job — they scale with the screen, not
        // with the type. `calc`, `max` and `env` compose tokens or handle safe
        // areas. `0` and `auto` are not spacing decisions.
        if (/var\(|calc\(|max\(|min\(|env\(|dvh|vh|vw|%/.test(value)) continue;
        const raw = value
          .split(/\s+/)
          .filter((part) => /^-?[\d.]+(rem|px|em)$/.test(part))
          .filter((part) => !/^-?0(px|rem|em)?$/.test(part))
          // A 1px hairline is a border, not a gap.
          .filter((part) => part !== '1px' && part !== '-1px');
        if (raw.length) offenders.push(`${match[0].trim()}`);
      }

      expect(
        offenders,
        `${page} sets spacing directly. It belongs on the scale in space.ts — ` +
          `add a step if none fits, rather than a value here.`,
      ).toEqual([]);
    });
  }

  it('radius and motion come from tokens too', () => {
    for (const page of PAGES) {
      const source = read(page);
      const radii = [...source.matchAll(/border-radius:\s*([^;{}]+)/g)]
        .map((m) => m[1]!.trim())
        .filter((v) => !v.includes('var('));
      expect(radii, `${page} sets a corner radius directly`).toEqual([]);

      const motion = [...source.matchAll(/transition:\s*([^;{}]+)/g)]
        .map((m) => m[1]!.trim())
        .filter((v) => !v.includes('var(') && !v.includes('none'));
      expect(motion, `${page} sets a transition duration directly`).toEqual([]);
    }
  });
});

describe('the scale itself', () => {
  it('is ordered, with no step repeating another', () => {
    const steps = Object.values(SPACE);
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
    expect(new Set(steps).size).toBe(steps.length);
  });

  it('follows the stated ratio', () => {
    const steps = Object.values(SPACE);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]! / steps[i - 1]!).toBeCloseTo(SPACE_RATIO, 2);
    }
  });

  it('nests radii, so a control is never rounder than its panel', () => {
    expect(RADIUS.control).toBeLessThan(RADIUS.panel);
    expect(RADIUS.panel).toBeLessThan(RADIUS.full);
  });

  it('has one curve and two durations, quick before settle', () => {
    expect(MOTION.quick).toBeLessThan(MOTION.settle);
    expect(MOTION.ease).toMatch(/^cubic-bezier\(/);
  });

  it('emits every token it defines', () => {
    const css = spaceCSS();
    for (const name of Object.keys(SPACE)) expect(css).toContain(`--space-${name}:`);
    for (const name of Object.keys(RADIUS)) expect(css).toContain(`--radius-${name}:`);
    expect(css).toContain('--motion-ease:');
  });
});
