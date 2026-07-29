/**
 * `/make/` — something to take away.
 *
 * The piece ends and the reader leaves with nothing. This is the one place they
 * can make something that is theirs, keep it, and post it.
 *
 * ## Three knobs, deliberately
 *
 * How much, what colour, what shape. The temptation with a sandbox is a control
 * panel; the goal is one good picture. [07](07-scope.md) warns that
 * adjacent-interesting additions are individually defensible and collectively
 * fatal, and a fourth knob is how that starts.
 *
 * It is also **not part of the piece** — the narrative page is untouched apart
 * from a single link in the outro. The three-minute read keeps its shape.
 *
 * ## No new engine code
 *
 * Everything here is assembly: `buildPatch` for the tiling, the validated
 * palettes from sprint 1, `deform` for the shape. That was set as a tripwire in
 * the sprint plan — if this had needed invention, the scope had drifted.
 */

import {
  LONG,
  SHORT,
  buildPatch,
  colourKey,
  deform,
  polygon,
  type ColourScheme,
  type Point,
  type Tile,
} from '../engine/index.js';
import { makePalette, SURFACE, TILE_STROKE } from '../renderer/palette.js';
import { TileRenderer } from '../renderer/renderer.js';
import { bind } from './scene.js';

export interface Design {
  /** Substitution depth, 2–5. */
  level: number;
  /** 0 = the hat, 1 = the turtle, anywhere between is a shape with no name. */
  shape: number;
  scheme: ColourScheme;
  dark: boolean;
}

const DEFAULT: Design = { level: 3, shape: 0, scheme: 'metatile', dark: false };

/**
 * Depth stops at 4 — 7,921 tiles.
 *
 * Level 5 is 54,289 tiles, and deforming that many costs ~490ms, roughly two
 * seconds on a throttled phone. A knob that hangs the page is worse than a knob
 * that isn't there, and 7,921 hats is already dense at export size.
 */
const LEVELS = [2, 3, 4] as const;

/**
 * The shape knob is deliberately coarse.
 *
 * The continuum *scene* animates smoothly, because watching the morph is its
 * whole point. Here you are choosing a shape you like, not watching it move —
 * so twelve stops make each change a deliberate pick, and cap the recompute
 * count during a drag instead of firing one per pixel.
 */
const SHAPE_STOPS = 12;
const SCHEMES: ColourScheme[] = ['metatile', 'orientation', 'reflection'];
const SCHEME_LABEL: Record<ColourScheme, string> = {
  metatile: 'clusters',
  orientation: 'rotation',
  reflection: 'mirrors',
};

/**
 * State in the URL, short enough to paste in a sentence.
 *
 * Three numbers and a flag do not need a backend, and [07](07-scope.md) rules
 * one out anyway. The format is readable on purpose — a link someone can look
 * at and guess the meaning of is friendlier than an opaque blob.
 */
export function encode(d: Design): string {
  return `${d.level}.${Math.round(d.shape * 100)}.${d.scheme}${d.dark ? '.d' : ''}`;
}

export function decode(raw: string | null): Design {
  if (!raw) return { ...DEFAULT };
  const [level, shape, scheme, dark] = raw.split('.');
  const n = Number(level);
  const s = Number(shape);
  return {
    level: LEVELS.includes(n as (typeof LEVELS)[number]) ? n : DEFAULT.level,
    shape: Number.isFinite(s) ? Math.min(Math.max(s / 100, 0), 1) : DEFAULT.shape,
    scheme: SCHEMES.includes(scheme as ColourScheme)
      ? (scheme as ColourScheme)
      : DEFAULT.scheme,
    dark: dark === 'd',
  };
}

interface Figure {
  points: Point[];
  fill: string;
}

/**
 * Geometry, cached by (level, shape).
 *
 * Colour and dark mode do not move a single vertex, so recomputing the tiling
 * when they change is pure waste — and at level 4 that waste is a fifth of a
 * second of frozen page.
 */
const geometryCache = new Map<string, { points: Point[] }[]>();

function geometryFor(level: number, shape: number): { points: Point[] }[] {
  const cacheKey = `${level}:${shape.toFixed(4)}`;
  const hit = geometryCache.get(cacheKey);
  if (hit) return hit;

  const tiles = buildPatch(level).tiles;
  // At the hat's own parameters there is nothing to deform, and `polygon` is
  // an order of magnitude cheaper than walking the tiling.
  const points =
    shape <= 1e-9
      ? tiles.map((t) => ({ points: polygon(t) }))
      : deform(tiles, SHORT + (LONG - SHORT) * shape, LONG + (SHORT - LONG) * shape).map(
          (d) => ({ points: d.points }),
        );
  geometryCache.set(cacheKey, points);
  return points;
}

/** The design, resolved into polygons. The one place shape and colour meet. */
function build(design: Design): { figures: Figure[]; tiles: readonly Tile[] } {
  const tiles = buildPatch(design.level).tiles;
  const palette = makePalette(design.scheme, { dark: design.dark });
  const geometry = geometryFor(design.level, design.shape);
  return {
    tiles,
    figures: geometry.map((g, i) => ({
      points: g.points,
      fill: palette.fill(colourKey(tiles[i]!, design.scheme)),
    })),
  };
}

/** An SVG of the design — the format anyone cutting or printing one needs. */
export function toSVG(design: Design, size = 2000): string {
  const { figures } = build(design);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const f of figures) {
    for (const p of f.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  const pad = (maxX - minX) * 0.02;
  const w = maxX - minX + pad * 2;
  const h = maxY - minY + pad * 2;
  const scale = size / Math.max(w, h);
  // y is flipped: the engine's y grows upward, SVG's grows down.
  const at = (p: Point) =>
    `${((p.x - minX + pad) * scale).toFixed(2)},${((maxY - p.y + pad) * scale).toFixed(2)}`;

  const body = figures
    .map((f) => `<polygon points="${f.points.map(at).join(' ')}" fill="${f.fill}"/>`)
    .join('');
  const surface = design.dark ? SURFACE.dark : SURFACE.light;
  const stroke = TILE_STROKE[design.dark ? 'dark' : 'light'];

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w * scale)}" ` +
    `height="${Math.round(h * scale)}" viewBox="0 0 ${w * scale} ${h * scale}">` +
    `<rect width="100%" height="100%" fill="${surface}"/>` +
    `<g stroke="${stroke}" stroke-width="${(scale * 0.012).toFixed(2)}" ` +
    `stroke-linejoin="round">${body}</g></svg>`
  );
}

function download(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function mountMake(root: HTMLElement): () => void {
  const el = bind(root, {
    canvas: '[data-canvas]',
    levelInput: '[data-level]',
    shapeInput: '[data-shape]',
    schemeBox: '[data-schemes]',
    darkToggle: '[data-dark]',
    readout: '[data-readout]',
    svgButton: '[data-svg]',
    pngButton: '[data-png]',
    shareButton: '[data-share]',
  }, 'make');
  const canvas = el.canvas as HTMLCanvasElement;
  const levelInput = el.levelInput as HTMLInputElement;
  const shapeInput = el.shapeInput as HTMLInputElement;
  const schemeBox = el.schemeBox;
  const darkToggle = el.darkToggle as HTMLInputElement;
  const readout = el.readout;
  const svgButton = el.svgButton as HTMLButtonElement;
  const pngButton = el.pngButton as HTMLButtonElement;
  const shareButton = el.shareButton as HTMLButtonElement;


  let design = decode(new URLSearchParams(location.search).get('d'));
  // Tighter than the default 6%: this is a picture someone may post or print,
  // so it should fill its frame rather than float in it.
  const renderer = new TileRenderer(canvas, { dark: design.dark, padding: 0.02 });

  // One radio per scheme, built from the list so the two cannot drift apart.
  const buttons = SCHEMES.map((scheme) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = SCHEME_LABEL[scheme];
    b.dataset.scheme = scheme;
    b.setAttribute('aria-pressed', String(scheme === design.scheme));
    b.addEventListener('click', () => {
      design.scheme = scheme;
      sync();
      draw();
    });
    schemeBox.append(b);
    return b;
  });

  const sync = () => {
    levelInput.value = String(LEVELS.indexOf(design.level as (typeof LEVELS)[number]));
    shapeInput.value = String(Math.round(design.shape * SHAPE_STOPS));
    darkToggle.checked = design.dark;
    for (const b of buttons) {
      b.setAttribute('aria-pressed', String(b.dataset.scheme === design.scheme));
    }
    // Keep the address bar current without adding history entries — a reader
    // dragging a slider should not have to press back forty times to leave.
    history.replaceState(null, '', `?d=${encode(design)}`);
  };

  const draw = () => {
    const { figures, tiles } = build(design);
    renderer.setAppearance({ dark: design.dark });
    renderer.setFigures(figures, true);
    const shape =
      design.shape <= 0.01 ? 'the hat' : design.shape >= 0.99 ? 'the turtle' : 'no name';
    readout.textContent = `${tiles.length.toLocaleString()} tiles · ${shape}`;
  };

  const onLevel = () => {
    design.level = LEVELS[levelInput.valueAsNumber] ?? DEFAULT.level;
    sync();
    draw();
  };
  const onShape = () => {
    design.shape = shapeInput.valueAsNumber / SHAPE_STOPS;
    sync();
    draw();
  };
  const onDark = () => {
    design.dark = darkToggle.checked;
    sync();
    draw();
  };

  const stem = () => `einstein-${encode(design).replace(/\./g, '-')}`;

  const onSVG = () => {
    download(`${stem()}.svg`, new Blob([toSVG(design)], { type: 'image/svg+xml' }));
  };

  const onPNG = () => {
    // Re-render offscreen at export size rather than scaling the visible canvas,
    // so the result is genuinely high-resolution instead of an enlargement.
    const size = 2000;
    const off = document.createElement('canvas');
    off.width = size;
    off.height = size;
    const ctx = off.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    const svg = new Blob([toSVG(design, size)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svg);
    img.onload = () => {
      off.width = img.width || size;
      off.height = img.height || size;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      off.toBlob((blob) => blob && download(`${stem()}.png`, blob), 'image/png');
    };
    img.src = url;
  };

  const onShare = async () => {
    const url = `${location.origin}${location.pathname}?d=${encode(design)}`;
    try {
      await navigator.clipboard.writeText(url);
      shareButton.textContent = 'Link copied';
    } catch {
      // Clipboard can be refused; the URL is already in the address bar, so say so.
      shareButton.textContent = 'It’s in the address bar';
    }
    setTimeout(() => {
      shareButton.textContent = 'Copy link';
    }, 2000);
  };

  levelInput.min = '0';
  levelInput.max = String(LEVELS.length - 1);
  levelInput.step = '1';
  shapeInput.min = '0';
  shapeInput.max = String(SHAPE_STOPS);
  shapeInput.step = '1';

  levelInput.addEventListener('input', onLevel);
  shapeInput.addEventListener('input', onShape);
  darkToggle.addEventListener('change', onDark);
  svgButton.addEventListener('click', onSVG);
  pngButton.addEventListener('click', onPNG);
  shareButton.addEventListener('click', onShare);

  sync();
  draw();

  return () => {
    levelInput.removeEventListener('input', onLevel);
    shapeInput.removeEventListener('input', onShape);
    darkToggle.removeEventListener('change', onDark);
    svgButton.removeEventListener('click', onSVG);
    pngButton.removeEventListener('click', onPNG);
    shareButton.removeEventListener('click', onShare);
    renderer.destroy();
  };
}
