/**
 * Renderer preview harness.
 *
 * Temporary. Its only job is to make ticket A2 verifiable — a patch on screen
 * that pans and zooms on a phone. Scenes S1 and S2 replace it; nothing should
 * grow to depend on it, and the controls here are not a design.
 */

import { buildPatch, type ColourScheme, type Patch } from '../engine/index.js';
import { TileRenderer } from './renderer.js';

const SCHEMES: ColourScheme[] = ['orientation', 'metatile', 'reflection'];

export function mountPreview(root: HTMLElement): () => void {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]');
  const levelInput = root.querySelector<HTMLInputElement>('[data-level]');
  const schemeSelect = root.querySelector<HTMLSelectElement>('[data-scheme]');
  const fitButton = root.querySelector<HTMLButtonElement>('[data-fit]');
  const readout = root.querySelector<HTMLElement>('[data-readout]');
  if (!canvas || !levelInput || !schemeSelect || !fitButton || !readout) {
    throw new Error('preview: missing required elements');
  }

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const renderer = new TileRenderer(canvas, {
    scheme: 'orientation',
    dark: media.matches,
  });

  const cache = new Map<number, Patch>();
  const patchFor = (level: number): Patch => {
    let p = cache.get(level);
    if (!p) {
      p = buildPatch(level);
      cache.set(level, p);
    }
    return p;
  };

  const load = (level: number) => {
    const t0 = performance.now();
    const patch = patchFor(level);
    renderer.setPatch(patch);
    const ms = performance.now() - t0;
    readout.textContent = `${patch.tiles.length.toLocaleString()} tiles · ${ms.toFixed(0)} ms`;
  };

  const onLevel = () => load(Number(levelInput.value));
  const onScheme = () => renderer.setScheme(schemeSelect.value as ColourScheme);
  const onFit = () => renderer.fit();
  const onTheme = (e: MediaQueryListEvent) => renderer.setDark(e.matches);

  levelInput.addEventListener('input', onLevel);
  schemeSelect.addEventListener('change', onScheme);
  fitButton.addEventListener('click', onFit);
  media.addEventListener('change', onTheme);

  schemeSelect.replaceChildren(
    ...SCHEMES.map((s) => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      return opt;
    }),
  );

  load(Number(levelInput.value));

  return () => {
    levelInput.removeEventListener('input', onLevel);
    schemeSelect.removeEventListener('change', onScheme);
    fitButton.removeEventListener('click', onFit);
    media.removeEventListener('change', onTheme);
    renderer.destroy();
  };
}
