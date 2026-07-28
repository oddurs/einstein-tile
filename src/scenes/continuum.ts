/**
 * Scene 7 — not one shape, but a family.
 *
 * *One sentence: the shape you have been looking at is one point on a
 * continuous family, and every point on it works.*
 *
 * The last surprise, and it is carried entirely by one slider. The reader has
 * spent the whole piece with a single specific polygon; this reveals that the
 * polygon was never the special thing.
 *
 * ## What the scene has to protect
 *
 * That it stays **recognisably the same tiling**. If it read as morphing into a
 * different pattern the point would invert — the claim is that the arrangement
 * is unchanged and only the proportions move. So:
 *
 *  - the view never re-fits mid-drag, or the tiling would appear to swim;
 *  - colours are keyed to each tile's orientation and never recomputed, so a
 *    tile keeps its colour throughout;
 *  - the two named members are marked on the track, so the reader can find the
 *    shape they already know and see that it is just a position on a dial.
 */

import {
  LONG,
  SHORT,
  buildPatch,
  deform,
  orientation,
  tileOutline,
  type DeformedTile,
  type Point,
} from '../engine/index.js';
import { ORIENTATION_ACCESSIBLE } from '../renderer/palette.js';
import { TileRenderer } from '../renderer/renderer.js';
import { bind } from './scene.js';

/** Small enough that a whole deformation fits in one frame while dragging. */
const LEVEL = 2;

/**
 * The slider runs 0…1 over the family. The hat and the turtle are the two
 * points a reader can be told about, so they get the ends — the interesting
 * shapes are between them, and the degenerate members sit outside this range
 * deliberately (docs/07 stops before the chevron and the comet).
 */
const A_AT = (t: number) => SHORT + (LONG - SHORT) * t;
const B_AT = (t: number) => LONG + (SHORT - LONG) * t;

const HAT_T = 0;
const TURTLE_T = 1;

const CAPTIONS = [
  'The hat. Drag, and every edge stretches — but the arrangement will not move.',
  'Every edge is stretching or shrinking — but nothing has moved apart, and nothing overlaps.',
  'Halfway. A shape with no name, and it tiles exactly like the others.',
  'Still going.',
  'The turtle. A different shape, tiling in exactly the same arrangement.',
] as const;

export function mountContinuumScene(root: HTMLElement): () => void {
  const el = bind(root, {
    canvas: '[data-canvas]',
    slider: '[data-morph]',
    caption: '[data-caption]',
    readout: '[data-readout]',
  }, 'continuum scene');
  const canvas = el.canvas as HTMLCanvasElement;
  const slider = el.slider as HTMLInputElement;
  const caption = el.caption;
  const readout = el.readout;


  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const theme = () => (media.matches ? 'dark' : 'light');

  const renderer = new TileRenderer(canvas, { dark: media.matches });
  const tiles = buildPatch(LEVEL).tiles;

  slider.min = '0';
  slider.max = '1000';
  slider.step = '1';
  slider.value = '0';

  /** Colour by orientation, fixed once — a tile must keep its colour throughout. */
  const fills = tiles.map((tile) => {
    const ramp = ORIENTATION_ACCESSIBLE[theme()];
    return ramp[orientation(tile.iso) % 12]!;
  });

  const figuresFor = (deformed: DeformedTile[]) =>
    deformed.map((d, i) => ({ points: d.points, fill: fills[i]! }));

  /**
   * Fit once, against the largest member the slider can reach, and never again.
   * Re-fitting per frame would make the tiling appear to swim under the drag
   * rather than deform in place, which is precisely the wrong impression.
   */
  let fitted = false;

  const show = (t: number) => {
    const deformed = deform(tiles, A_AT(t), B_AT(t));
    renderer.setFigures(figuresFor(deformed), !fitted);
    if (!fitted) {
      // Leave headroom for the turtle, which is the bigger of the two ends.
      renderer.zoomTo(renderer.getView().scale * 0.78);
      fitted = true;
    }
    caption.textContent = CAPTIONS[Math.min(Math.floor(t * 4.999), CAPTIONS.length - 1)]!;
    readout.textContent =
      t <= 0.001 ? 'the hat' : t >= 0.999 ? 'the turtle' : 'no name';
  };

  const onInput = () => show(slider.valueAsNumber / 1000);
  const onTheme = () => {
    renderer.setAppearance({ dark: media.matches });
    const ramp = ORIENTATION_ACCESSIBLE[theme()];
    tiles.forEach((tile, i) => {
      fills[i] = ramp[orientation(tile.iso) % 12]!;
    });
    onInput();
  };

  slider.addEventListener('input', onInput);
  media.addEventListener('change', onTheme);

  show(HAT_T);

  return () => {
    slider.removeEventListener('input', onInput);
    media.removeEventListener('change', onTheme);
    renderer.destroy();
  };
}

export { HAT_T, TURTLE_T, tileOutline, type Point };
