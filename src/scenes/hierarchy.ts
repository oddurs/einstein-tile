/**
 * Scene 5 — the hierarchy. The load-bearing scene.
 *
 * The reader should leave able to say, in their own words, roughly *"the tiles
 * group into bigger copies of themselves, forever, so there's no block you can
 * stamp out"*. That sentence is the success test in docs/07; everything else in
 * the app is showmanship around it.
 *
 * ## How it works
 *
 * Zooming out coarsens the grouping. Stage 0 is bare tiles; stage 1 outlines the
 * innermost metatiles; each further stage steps one level up the hierarchy until
 * the whole patch is one group. Because the hierarchy is genuinely infinite, the
 * last caption says so rather than pretending the patch is the end of it.
 *
 * Groups are drawn with **true hulls** (`boundaryLoops`), not
 * `MetaInstance.scaffold` — the scaffold does not bound its own tiles and would
 * render visibly broken (docs/08). Tinting alone was the original plan; outlines
 * were added because "four colours changing" does not read as *nesting*, and
 * nesting is the entire point.
 *
 * Stage follows the view scale so the reveal is driven by the reader's own
 * pinch. A slider mirrors it, for people who would rather scrub — and because
 * `prefers-reduced-motion` needs a path that never animates.
 */

import {
  boundaryLoops,
  buildPatch,
  groupByAncestor,
  toX,
  toY,
  type Patch,
  type Tile,
} from '../engine/index.js';
import { METATILE } from '../renderer/palette.js';
import { TileRenderer, type Overlay } from '../renderer/renderer.js';
import { bind } from './scene.js';

/** Patch depth. 4 gives 7,921 tiles — enough hierarchy to be convincing. */
const LEVEL = 4;

/** Captions carry the argument; the visuals only illustrate it. */
const CAPTIONS = [
  'One shape, laid down over and over.',
  'The tiles clump into groups — always the same four kinds.',
  'Those groups clump into bigger groups. The same four kinds again.',
  'And again, larger still. Every level looks like the one below it.',
  'It never stops — so there is no block you could stamp out, at any size. That is why it can never repeat.',
] as const;

interface Stage {
  /** Metatile ancestry depth, or `null` for bare tiles. */
  readonly depth: number | null;
  readonly colourOf: Map<Tile, string>;
  readonly overlay: Overlay;
  readonly groups: number;
}

export interface HierarchyOptions {
  level?: number;
}

export function mountHierarchyScene(
  root: HTMLElement,
  options: HierarchyOptions = {},
): () => void {
  const level = options.level ?? LEVEL;

  const el = bind(root, {
    canvas: '[data-canvas]',
    slider: '[data-stage]',
    caption: '[data-caption]',
    readout: '[data-readout]',
  }, 'hierarchy scene');
  const canvas = el.canvas as HTMLCanvasElement;
  const slider = el.slider as HTMLInputElement;
  const caption = el.caption;
  const readout = el.readout;


  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const theme = () => (media.matches ? 'dark' : 'light');

  const renderer = new TileRenderer(canvas, { dark: media.matches });
  const patch = buildPatch(level);

  let stages = buildStages(patch, level, theme());
  let current = -1;
  /** Guards the slider→zoom→stage feedback loop. */
  let suppressViewChange = false;

  slider.min = '0';
  slider.max = String(stages.length - 1);
  slider.step = '1';

  /**
   * Zoom that corresponds to a stage. Stage 0 sits several octaves in from the
   * fitted view so individual tiles are actually legible — at the fitted scale
   * 7,921 tiles are two pixels each and "one shape, over and over" reads as an
   * undifferentiated blob, which is the opposite of the point.
   */
  const scaleForStage = (i: number): number =>
    fitScale * 2 ** (stages.length - 1 - i);

  const show = (index: number, alsoZoom = false): void => {
    const i = Math.max(0, Math.min(index, stages.length - 1));
    if (alsoZoom) renderer.zoomTo(scaleForStage(i));
    if (i === current) return;
    current = i;
    const stage = stages[i]!;
    // The token lets the renderer cache this stage's merged paths, so revisiting
    // a stage costs nothing instead of rebuilding ~7,900 Path2Ds.
    renderer.setColourOverride(
      (tile) => stage.colourOf.get(tile) ?? '#888',
      `${theme()}:${i}`,
    );
    // Passing the stage's own overlay object (not a copy) lets the renderer
    // reuse its built path.
    renderer.setOverlays(stage.overlay.loops.length ? [stage.overlay] : []);
    caption.textContent = CAPTIONS[Math.min(i, CAPTIONS.length - 1)]!;
    readout.textContent =
      stage.depth === null
        ? `${patch.tiles.length.toLocaleString()} tiles`
        : `${stage.groups.toLocaleString()} group${stage.groups === 1 ? '' : 's'}`;
    if (slider.valueAsNumber !== i) slider.value = String(i);
  };

  renderer.setPatch(patch);
  // Captured after the initial fit: the scale at which the whole patch is
  // visible, which is the coarsest end of the reveal.
  const fitScale = renderer.getView().scale;

  // Zoom drives the reveal: further out, coarser grouping.
  renderer.onViewChange = (view) => {
    if (suppressViewChange) return;
    show(stageForScale(view.scale, fitScale, stages.length));
  };

  // Start at the fine end, zoomed in far enough to see individual tiles.
  show(0, true);

  const onSlider = () => {
    // The slider drives zoom as well as grouping, so scrubbing and pinching
    // move along the *same* one-dimensional reveal rather than disagreeing.
    suppressViewChange = true;
    show(slider.valueAsNumber, true);
    suppressViewChange = false;
  };
  const onTheme = () => {
    renderer.setAppearance({ dark: media.matches });
    stages = buildStages(patch, level, theme());
    const at = current;
    current = -1;
    show(at);
  };

  slider.addEventListener('input', onSlider);
  media.addEventListener('change', onTheme);

  return () => {
    slider.removeEventListener('input', onSlider);
    media.removeEventListener('change', onTheme);
    renderer.destroy();
  };
}

/**
 * Map view scale to a stage.
 *
 * `fitScale` is where the whole patch just fills the viewport, so that is the
 * coarsest end. Each halving of scale steps one stage coarser; each doubling
 * steps finer. Deliberately gentle, so a small pinch doesn't skip a level.
 */
export function stageForScale(
  scale: number,
  fitScale: number,
  stageCount: number,
): number {
  const octaves = Math.log2(scale / fitScale);
  return Math.max(0, Math.min(stageCount - 1, Math.round(stageCount - 1 - octaves)));
}

function buildStages(patch: Patch, level: number, theme: 'light' | 'dark'): Stage[] {
  const stages: Stage[] = [];
  // Stage 0 needs enough contrast against the surface that individual tiles
  // read as tiles, not as one grey mass.
  const plain = theme === 'dark' ? '#4a5c68' : '#aab6bf';
  const hullStroke = theme === 'dark' ? 'rgba(240,239,236,0.85)' : 'rgba(26,26,25,0.8)';

  // Stage 0 — no grouping at all. Establishes "just one shape, repeated".
  const bare = new Map<Tile, string>();
  for (const tile of patch.tiles) bare.set(tile, plain);
  stages.push({
    depth: null,
    colourOf: bare,
    overlay: { loops: [], stroke: hullStroke },
    groups: patch.tiles.length,
  });

  // Then coarsen: innermost metatiles first. Stop at depth 1 — depth 0 is the
  // whole patch as a single group, which teaches nothing and throws away the
  // strongest frame, where the substitution rule itself becomes visible
  // (3 H + 1 T + 3 P + 3 F).
  for (let depth = level; depth >= 1; depth--) {
    const groups = groupByAncestor(patch.tiles, depth);
    const colourOf = new Map<Tile, string>();
    const loops: { x: number; y: number }[][] = [];

    for (const tiles of groups.values()) {
      // Colour by the metatile's *kind* at this depth; identity is carried by
      // the outline, so repeated kinds neighbouring each other still read.
      const label = tiles[0]!.path[depth] ?? 'H';
      const fill = METATILE[theme][label];
      for (const tile of tiles) colourOf.set(tile, fill);
      for (const loop of boundaryLoops(tiles)) {
        loops.push(loop.map((p) => ({ x: toX(p), y: toY(p) })));
      }
    }

    stages.push({
      depth,
      colourOf,
      overlay: { loops, stroke: hullStroke, width: 1.6 },
      groups: groups.size,
    });
  }

  return stages;
}
