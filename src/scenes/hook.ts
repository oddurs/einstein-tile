/**
 * Scene 0 — the hook.
 *
 * No interaction, no controls, no explanation. Its entire job is to make a
 * reader think *"…wait, is that repeating?"* and keep scrolling.
 *
 * Tiles fade in over a few seconds in a rough spiral from the centre, which
 * reads as a floor being laid rather than as an animation playing. The order is
 * by distance from the centre, so it grows outward — the same way the reader
 * will later imagine the infinite floor extending.
 *
 * Under `prefers-reduced-motion` the whole patch is drawn at once. The growth is
 * decoration; the tiling is the content, and nobody should have to sit through
 * an effect to see it.
 */

import { buildPatch, polygon, type Point } from '../engine/index.js';
import { ORIENTATION_ACCESSIBLE, SURFACE } from '../renderer/palette.js';
import { TileRenderer } from '../renderer/renderer.js';
import { bind } from './scene.js';

const LEVEL = 4;
const DURATION = 2600;

export function mountHookScene(root: HTMLElement): () => void {
  const canvas = bind(root, { canvas: '[data-canvas]' }, 'hook scene')
    .canvas as HTMLCanvasElement;

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  const theme = () => (media.matches ? 'dark' : 'light');

  const renderer = new TileRenderer(canvas, { dark: media.matches });
  const tiles = buildPatch(LEVEL).tiles;

  // Geometry and draw order are fixed once; the animation only changes how many
  // of them are drawn, so no per-frame allocation happens.
  const shapes: Point[][] = tiles.map((t) => polygon(t));
  const centre = shapes.map((pts) => {
    let x = 0;
    let y = 0;
    for (const p of pts) {
      x += p.x;
      y += p.y;
    }
    return { x: x / pts.length, y: y / pts.length };
  });
  const order = tiles
    .map((_, i) => i)
    .sort((a, b) => Math.hypot(centre[a]!.x, centre[a]!.y) - Math.hypot(centre[b]!.x, centre[b]!.y));

  const fillFor = (index: number): string => {
    const ramp = ORIENTATION_ACCESSIBLE[theme()];
    const tile = tiles[index]!;
    return ramp[(tile.iso.rot + (tile.iso.reflected ? 6 : 0)) % 12]!;
  };

  let frame = 0;
  let start = 0;

  const paint = (count: number) => {
    renderer.setFigures(
      order.slice(0, count).map((i) => ({ points: shapes[i]!, fill: fillFor(i) })),
      false,
    );
  };

  const fit = () => {
    // Fit against the whole patch, not the visible prefix, so the view never
    // jumps as tiles arrive.
    renderer.setFigures(
      order.map((i) => ({ points: shapes[i]!, fill: fillFor(i) })),
      true,
    );
  };

  const step = (now: number) => {
    if (!start) start = now;
    // Ease out: fast at first, settling — a floor being laid, not a progress bar.
    const t = Math.min((now - start) / DURATION, 1);
    const eased = 1 - (1 - t) ** 3;
    paint(Math.max(1, Math.round(eased * order.length)));
    if (t < 1) frame = requestAnimationFrame(step);
  };

  const begin = () => {
    fit();
    if (still.matches) {
      paint(order.length);
      return;
    }
    paint(1);
    start = 0;
    frame = requestAnimationFrame(step);
  };

  const onTheme = () => {
    renderer.setAppearance({ dark: media.matches });
    paint(order.length);
  };
  media.addEventListener('change', onTheme);

  begin();

  return () => {
    if (frame) cancelAnimationFrame(frame);
    media.removeEventListener('change', onTheme);
    renderer.destroy();
  };
}

export { SURFACE };
