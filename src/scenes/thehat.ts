/**
 * Scene 2 — meet the hat.
 *
 * *One sentence: this is an ordinary shape, and you could have drawn it.*
 *
 * The job is to defuse "mathematicians found a magic shape". A reader who
 * thinks the hat is exotic has no way in; a reader who sees it built out of
 * eight kites off a hexagon grid has one, because they have just watched it
 * happen and nothing surprising occurred.
 *
 * That framing is also true, and it is the best part of the story: the shape
 * had been catalogued before and walked past, because nobody tried to tile
 * with it. Ordinariness is the point, not a simplification of it.
 *
 * Ceilings, per docs/07: the [3.4.6.4] Laves tiling is never named, polykite
 * enumeration never appears, no coordinates reach the screen.
 */

import {
  HAT_KITES,
  hexOutline,
  kiteOutline,
  toPoint,
  type Point,
} from '../engine/index.js';
import { METATILE } from '../renderer/palette.js';
import { TileRenderer, type Overlay } from '../renderer/renderer.js';

/** The three hexagons the hat's kites are cut from. */
const HEXES = [...new Map(HAT_KITES.map((k) => [`${k.centre.a},${k.centre.b}`, k.centre])).values()];

const STEPS = [
  'Start with a floor of hexagons. Ordinary, and it repeats.',
  'Cut each hexagon into six kites.',
  'Now take eight of those kites…',
  '…and that is the whole shape. Nothing exotic: eight kites off a hexagon floor.',
] as const;

const CLOSING =
  'It is called the hat. Shapes like this had been listed in catalogues before and walked straight past — because nobody had tried to tile with one.';

export function mountHatScene(root: HTMLElement): () => void {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]');
  const caption = root.querySelector<HTMLElement>('[data-caption]');
  const slider = root.querySelector<HTMLInputElement>('[data-step]');
  const readout = root.querySelector<HTMLElement>('[data-readout]');
  if (!canvas || !caption || !slider || !readout) {
    throw new Error('hat scene: missing required elements');
  }

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const theme = () => (media.matches ? 'dark' : 'light');

  const renderer = new TileRenderer(canvas, { dark: media.matches });
  let step = 0;

  slider.min = '0';
  slider.max = String(STEPS.length - 1);
  slider.step = '1';
  slider.value = '0';

  const colours = () => {
    const t = theme();
    return {
      hex: t === 'dark' ? '#2c343d' : '#dde3e8',
      hexLine: t === 'dark' ? 'rgba(240,239,236,0.30)' : 'rgba(26,26,25,0.22)',
      kiteLine: t === 'dark' ? 'rgba(240,239,236,0.42)' : 'rgba(26,26,25,0.30)',
      hat: METATILE[t].P,
      hatLine: t === 'dark' ? 'rgba(240,250,255,0.85)' : 'rgba(10,45,80,0.7)',
    };
  };

  const asPoints = (cells: readonly { a: number; b: number }[]): Point[] =>
    cells.map(toPoint);

  const draw = () => {
    const c = colours();

    // The hexagons are the stage and never move; only what is drawn on top of
    // them changes. Keeping them constant is what makes the reader read this as
    // "the hat comes from here" rather than as four unrelated pictures.
    renderer.setFigures(
      HEXES.map((centre) => ({ points: asPoints(hexOutline(centre)), fill: c.hex })),
      step === 0,
    );

    const overlays: Overlay[] = [
      { loops: HEXES.map((h) => asPoints(hexOutline(h))), stroke: c.hexLine, width: 1.5 },
    ];

    // Step 1 onward: show the cuts. Every kite of every hexagon, so the reader
    // sees a grid rather than a shape waiting to be revealed.
    if (step >= 1) {
      const allKites: Point[][] = [];
      for (const centre of HEXES) {
        for (let index = 0; index < 6; index++) {
          allKites.push(asPoints(kiteOutline({ centre, index })));
        }
      }
      overlays.push({ loops: allKites, stroke: c.kiteLine, width: 1 });
    }

    // Step 2: the eight, filled but still visibly separate pieces.
    // Step 3: the same eight, drawn as one outline — the shape.
    if (step >= 2) {
      const chosen = HAT_KITES.map((k) => asPoints(kiteOutline(k)));
      overlays.push({
        loops: chosen,
        fill: c.hat,
        stroke: step >= 3 ? undefined : c.hatLine,
        width: 1.2,
      });
    }

    renderer.setOverlays(overlays);
    caption.textContent = STEPS[step]!;
    readout.textContent =
      step >= 3 ? '13 sides' : step >= 2 ? '8 kites' : step >= 1 ? '6 kites each' : '3 hexagons';
    if (slider.valueAsNumber !== step) slider.value = String(step);
  };

  const show = (next: number) => {
    step = Math.max(0, Math.min(next, STEPS.length - 1));
    draw();
  };

  const onSlider = () => show(slider.valueAsNumber);
  const onTheme = () => {
    renderer.setDark(media.matches);
    draw();
  };
  // Tapping anywhere advances — the same "tap to go on" the rest of the piece
  // uses, and it saves a reader from having to find the slider.
  const onTap = () => show(step >= STEPS.length - 1 ? 0 : step + 1);

  slider.addEventListener('input', onSlider);
  media.addEventListener('change', onTheme);
  renderer.onTap = onTap;

  show(0);

  return () => {
    slider.removeEventListener('input', onSlider);
    media.removeEventListener('change', onTheme);
    renderer.destroy();
  };
}

export { CLOSING };
