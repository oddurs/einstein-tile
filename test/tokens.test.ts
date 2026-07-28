/**
 * The pages may not disagree with the validated palette.
 *
 * Every CVD separation and contrast figure in `palette.test.ts` was computed
 * against `SURFACE.light` and `SURFACE.dark` specifically. Before sprint 7 those
 * two colours were hand-copied into five `<style>` blocks, so a careless edit to
 * one page could have silently invalidated the accessibility work while every
 * test stayed green.
 *
 * These tests close that hole. `rootCSS()` is now the only place the surfaces
 * are written for the browser, and the last test here fails if a page starts
 * hard-coding them again.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SURFACE } from '../src/renderer/palette.js';
import { TOKENS, rootCSS } from '../src/renderer/tokens.js';

const PAGES = new URL('../src/pages/', import.meta.url).pathname;

describe('design tokens come from the palette', () => {
  it('takes both surfaces straight from SURFACE', () => {
    expect(TOKENS.light.bg).toBe(SURFACE.light);
    expect(TOKENS.dark.bg).toBe(SURFACE.dark);
  });

  it('emits both themes, with the dark one behind a media query', () => {
    const css = rootCSS();
    expect(css).toContain(SURFACE.light);
    expect(css).toContain(SURFACE.dark);
    expect(css).toContain('prefers-color-scheme: dark');
  });

  it('declares a plain colour before every color-mix', () => {
    // color-mix is Safari 16.4+. Declaring the fallback first is the difference
    // between a muted grey and no colour at all on an older browser.
    for (const theme of ['light', 'dark'] as const) {
      const [fallback, refined] = TOKENS[theme].muted;
      expect(fallback).toMatch(/^#[0-9a-f]{6}$/i);
      expect(refined).toContain('color-mix');
    }
    const css = rootCSS();
    expect(css.indexOf('--muted: #')).toBeLessThan(css.indexOf('--muted: color-mix'));
  });
});

describe('no page hard-codes a surface', () => {
  it('leaves the surfaces to rootCSS() alone', async () => {
    // The regression guard. If someone pastes `--bg: #fcfcfb` back into a page,
    // this fails — and the reason it matters is in the module comment above.
    const files = (await readdir(PAGES)).filter((f) => f.endsWith('.astro'));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = await readFile(join(PAGES, file), 'utf8');
      const declarations = source.match(/--bg:\s*[^;]+;/g) ?? [];
      expect(declarations, `${file} should not declare --bg itself`).toEqual([]);
      for (const surface of [SURFACE.light, SURFACE.dark]) {
        expect(
          source.includes(`--bg: ${surface}`),
          `${file} hard-codes the ${surface} surface`,
        ).toBe(false);
      }
    }
  });

  it('every page pulls in the generated block', async () => {
    const files = (await readdir(PAGES)).filter((f) => f.endsWith('.astro'));
    for (const file of files) {
      const source = await readFile(join(PAGES, file), 'utf8');
      expect(source, `${file} should use rootCSS()`).toContain('rootCSS()');
    }
  });
});
