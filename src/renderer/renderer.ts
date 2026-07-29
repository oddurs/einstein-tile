/**
 * Canvas 2D renderer for hat patches.
 *
 * Framework-agnostic: takes a canvas and a `Patch`, knows nothing about Astro,
 * the DOM beyond that canvas, or the narrative.
 *
 * **The performance idea.** Tiles are grouped by colour and merged into one
 * `Path2D` per colour, built once when the patch or scheme changes. A frame is
 * then a handful of `fill()` calls — twelve, for the orientation scheme —
 * instead of one per tile. Panning a 7,921-tile patch costs the same as panning
 * a 25-tile one, because per-frame work is independent of tile count.
 *
 * Canvas 2D throughout. docs/06 §6 holds WebGL in reserve for the deep sandbox;
 * nothing in the narrative scenes needs it.
 */

import type { ColourScheme, Patch, Point, Tile } from '../engine/index.js';
import { polygon } from '../engine/index.js';
import { attachGestures } from './gestures.js';
import {
  makePalette,
  tileColourKey,
  type ColourMode,
  type Palette,
} from './palette.js';
import {
  type Bounds,
  type View,
  fitView,
  pan,
  toWorld,
  zoomAt,
} from './view.js';

export type { View } from './view.js';

export interface RendererOptions {
  scheme?: ColourScheme;
  dark?: boolean;
  /** `accessible` is colour-vision-safe throughout; `vivid` is not. */
  mode?: ColourMode;
  /** Fraction of the smaller viewport dimension left as margin by `fit()`. */
  padding?: number;
  onTap?(world: { x: number; y: number }): void;
  /**
   * Whether the canvas claims pointer gestures. Default true.
   *
   * Claiming them requires `touch-action: none`, which is why a stage is
   * normally capped in height: a full-bleed canvas that owns touch swallows
   * vertical scrolling and strands a phone reader (docs/06 §4).
   *
   * A scroll-driven figure passes `false`. It does not need drag or pinch —
   * **scroll is its input** — so it takes `touch-action: pan-y` instead and can
   * never trap anyone. The height cap exists to protect the reader from the
   * gesture handler; without the handler, the cap is not needed either.
   */
  gestures?: boolean;
  /**
   * Re-fit the view when the canvas changes size. Default false.
   *
   * The canvas resizes but the view does not, so a figure framed for one shape
   * of box keeps its old scale in the new one. Measured in the sandbox: a
   * tiling filling **96%** of the width in portrait fell to **44%** after a
   * rotation, and stayed there. The piece never showed this because its scenes
   * re-fit on every scroll-driven redraw anyway.
   *
   * Opt-in rather than default, because scenes that drive the view deliberately
   * — the hierarchy zooms per stage, the continuum fits once so the tiling does
   * not appear to swim — must not have it taken back from them.
   */
  refitOnResize?: boolean;
}

interface Bucket {
  path: Path2D;
  fill: string;
}

/** An outline drawn over the tiles — group hulls, highlights, ghosts. */
export interface Overlay {
  /** Closed loops in world coordinates. */
  readonly loops: readonly (readonly { x: number; y: number }[])[];
  readonly stroke?: string;
  /** CSS pixels, constant on screen. */
  readonly width?: number;
  readonly fill?: string;
  readonly opacity?: number;
}

export class TileRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly detachGestures: () => void;
  private readonly resizeObserver: ResizeObserver;

  private patch: Patch | null = null;
  private buckets: Bucket[] = [];
  private worldBounds: Bounds = { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  /** Rough linear size of one tile in world units — drives stroke visibility. */
  private tileWorldSize = 1;

  private scheme: ColourScheme;
  private dark: boolean;
  private mode: ColourMode;
  private palette: Palette;
  private padding: number;
  private readonly refitOnResize: boolean;
  private tapOption: RendererOptions['onTap'];

  /** Called after any pan or zoom, so scenes can react to the view. */
  onViewChange: ((view: Readonly<View>) => void) | null = null;
  /**
   * Set to take over dragging: receives the drag in **world** units and the view
   * does not pan. For scenes where the drag moves an object rather than the
   * camera. Pinch-zoom is unaffected.
   */
  onDragWorld: ((dx: number, dy: number) => void) | null = null;
  /** Assignable after construction, for scenes that decide late. */
  onTap: ((world: Point) => void) | null = null;

  private colourOverride: ((tile: Tile) => string) | null = null;
  /**
   * Tile outlines, cached per patch.
   *
   * Recolouring re-buckets tiles but never moves them, and recomputing 7,921
   * polygons costs ~8ms — ~33ms on a throttled phone, which showed up as a p95
   * frame of 66ms when scene 5 crossed a stage boundary. Geometry is therefore
   * computed once per patch and reused by every recolour.
   */
  private geometry: Point[][] = [];
  /**
   * Built buckets, keyed by a caller-supplied colouring token.
   *
   * Scene 5 cycles through five fixed colourings, so without this every stage
   * change rebuilds ~7,900 Path2Ds. Callers that pass a token get O(1) switching
   * after the first visit; callers that don't are unaffected.
   */
  private bucketCache = new Map<string, Bucket[]>();
  private colourToken: string | null = null;
  private readonly overlayCache = new WeakMap<Overlay, Path2D>();
  private overlays: { path: Path2D; spec: Overlay }[] = [];

  private view: View = { scale: 1, tx: 0, ty: 0 };
  private dpr = 1;
  private cssWidth = 1;
  private cssHeight = 1;
  private frame = 0;
  private first = true;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, opts: RendererOptions = {}) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas context unavailable');

    this.canvas = canvas;
    this.ctx = ctx;
    this.scheme = opts.scheme ?? 'orientation';
    this.dark = opts.dark ?? false;
    this.mode = opts.mode ?? 'accessible';
    this.padding = opts.padding ?? 0.06;
    this.refitOnResize = opts.refitOnResize ?? false;
    this.tapOption = opts.onTap;
    this.palette = this.buildPalette();

    // `none` is required for passive pointer listeners — see gestures.ts.
    // `pan-y` hands vertical back to the browser, so the page always scrolls.
    canvas.style.touchAction = opts.gestures === false ? 'pan-y' : 'none';

    const noop = () => {};
    this.detachGestures =
      opts.gestures === false
        ? noop
        : attachGestures(canvas, {
            onPan: (dx, dy) => {
              if (this.onDragWorld) {
                // y is flipped between screen and world.
                this.onDragWorld(dx / this.view.scale, -dy / this.view.scale);
                return;
              }
              this.view = pan(this.view, dx, dy);
              this.viewChanged();
            },
            onZoom: (factor, cx, cy) => {
              this.view = zoomAt(this.view, factor, cx, cy);
              this.viewChanged();
            },
            onTap: (x, y) => {
              const world = toWorld(this.view, x, y);
              this.onTap?.(world);
              this.tapOption?.(world);
            },
          });

    this.resizeObserver = new ResizeObserver(() => this.syncSize());
    this.resizeObserver.observe(canvas);
    this.syncSize();
  }

  // -- public API ----------------------------------------------------------

  setPatch(patch: Patch, refit = true): void {
    this.patch = patch;
    this.geometry = patch.tiles.map((tile) => polygon(tile));
    this.bucketCache.clear();
    this.rebuild();
    if (refit) this.fit();
    else this.requestDraw();
  }

  /**
   * Render arbitrary polygons rather than hats.
   *
   * Lets a scene show a comparison tiling — a hexagon floor, say — through the
   * same pan, zoom and dpr machinery, without pretending it is made of hats.
   * Merged into one path per fill, as tiles are.
   */
  setFigures(
    figures: readonly { points: readonly Point[]; fill: string }[],
    refit = true,
  ): void {
    this.patch = null;
    this.geometry = [];
    this.bucketCache.clear();

    const byFill = new Map<string, Path2D>();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const figure of figures) {
      let path = byFill.get(figure.fill);
      if (!path) {
        path = new Path2D();
        byFill.set(figure.fill, path);
      }
      const pts = figure.points;
      if (!pts.length) continue;
      path.moveTo(pts[0]!.x, pts[0]!.y);
      for (let i = 1; i < pts.length; i++) path.lineTo(pts[i]!.x, pts[i]!.y);
      path.closePath();
      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }

    this.buckets = [...byFill.entries()].map(([fill, path]) => ({ path, fill }));
    this.worldBounds = { minX, minY, maxX, maxY };
    this.tileWorldSize = Math.sqrt(
      Math.max((maxX - minX) * (maxY - minY), 1e-9) / Math.max(figures.length, 1),
    );
    if (refit) this.fit();
    else this.requestDraw();
  }

  /**
   * Change how tiles are coloured.
   *
   * Was three methods — `setScheme`, `setDark`, `setMode` — which were three
   * doors onto one idea: recolour, keeping the geometry. Callers that only
   * flip the theme still write `setAppearance({ dark })`, and the rest is no
   * longer three near-identical guard-and-recolour bodies.
   */
  setAppearance(next: {
    scheme?: ColourScheme;
    dark?: boolean;
    mode?: ColourMode;
  }): void {
    const changed =
      (next.scheme !== undefined && next.scheme !== this.scheme) ||
      (next.dark !== undefined && next.dark !== this.dark) ||
      (next.mode !== undefined && next.mode !== this.mode);
    if (!changed) return;
    if (next.scheme !== undefined) this.scheme = next.scheme;
    if (next.dark !== undefined) this.dark = next.dark;
    if (next.mode !== undefined) this.mode = next.mode;
    this.recolour();
  }

  /**
   * Colour tiles with an arbitrary function instead of the current scheme.
   *
   * The returned string is both the colour and the bucket key, so tiles sharing
   * a colour still merge into one path and the per-frame cost stays flat.
   * Pass `null` to fall back to the scheme.
   */
  setColourOverride(fn: ((tile: Tile) => string) | null, token?: string): void {
    this.colourOverride = fn;
    this.colourToken = token ?? null;
    if (token) {
      const cached = this.bucketCache.get(token);
      if (cached) {
        this.buckets = cached;
        this.requestDraw();
        return;
      }
    }
    this.recolour();
  }

  /**
   * Replace the overlay outlines drawn above the tiles.
   *
   * Built paths are cached by overlay identity, so a scene that hands back the
   * same `Overlay` object pays nothing to redisplay it. Scene 5's finest stage
   * has 442 hull loops, and rebuilding those on every stage change was the
   * remaining frame spike once tile geometry was cached.
   */
  setOverlays(overlays: readonly Overlay[]): void {
    this.overlays = overlays.map((spec) => {
      let path = this.overlayCache.get(spec);
      if (!path) {
        path = new Path2D();
        for (const loop of spec.loops) {
          if (loop.length < 2) continue;
          const first = loop[0]!;
          path.moveTo(first.x, first.y);
          for (let i = 1; i < loop.length; i++) path.lineTo(loop[i]!.x, loop[i]!.y);
          path.closePath();
        }
        this.overlayCache.set(spec, path);
      }
      return { path, spec };
    });
    this.requestDraw();
  }

  /** The current background, so a host page can match its chrome to the canvas. */
  get background(): string {
    return this.palette.background;
  }

  /** Zoom to an absolute scale, keeping the viewport centre fixed. */
  /**
   * Move the view by a screen-space delta — the keyboard's equivalent of a
   * drag, and it goes through the same `pan()` the gesture handler uses so the
   * two can never disagree about what panning means.
   */
  panBy(dx: number, dy: number): void {
    this.view = pan(this.view, dx, dy);
    this.viewChanged();
  }

  zoomTo(scale: number): void {
    const factor = scale / this.view.scale;
    if (!Number.isFinite(factor) || factor === 1) return;
    this.view = zoomAt(this.view, factor, this.cssWidth / 2, this.cssHeight / 2);
    this.requestDraw();
  }

  /** Scale and centre so the whole patch is visible. */
  fit(): void {
    this.view = fitView(this.worldBounds, this.cssWidth, this.cssHeight, this.padding);
    this.requestDraw();
  }

  getView(): Readonly<View> {
    return { ...this.view };
  }

  get tileCount(): number {
    return this.patch?.tiles.length ?? 0;
  }

  destroy(): void {
    this.disposed = true;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.detachGestures();
  }

  requestDraw(): void {
    if (this.disposed || this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  }

  // -- internals -----------------------------------------------------------

  private viewChanged(): void {
    this.requestDraw();
    this.onViewChange?.(this.getView());
  }

  private buildPalette(): Palette {
    return makePalette(this.scheme, { dark: this.dark, mode: this.mode });
  }

  private recolour(): void {
    this.palette = this.buildPalette();
    this.bucketCache.clear();
    this.rebuild();
    this.requestDraw();
  }

  private syncSize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.max(rect.width, 1);
    const cssH = Math.max(rect.height, 1);
    const w = Math.round(cssW * dpr);
    const h = Math.round(cssH * dpr);

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    const changed = this.cssWidth !== cssW || this.cssHeight !== cssH;
    this.cssWidth = cssW;
    this.cssHeight = cssH;
    this.dpr = dpr;
    // `first` guards the initial call, where there is nothing to re-fit yet.
    if (this.refitOnResize && changed && !this.first) {
      this.fit();
      return;
    }
    this.first = false;
    this.requestDraw();
  }

  /** Merge tiles into one Path2D per colour. The whole performance story. */
  private rebuild(): void {
    this.buckets = [];
    if (!this.patch) return;

    const byKey = new Map<string, Path2D>();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const [i, tile] of this.patch.tiles.entries()) {
      const key = this.colourOverride
        ? this.colourOverride(tile)
        : String(tileColourKey(tile, this.scheme));
      let path = byKey.get(key);
      if (!path) {
        path = new Path2D();
        byKey.set(key, path);
      }
      const pts = this.geometry[i] ?? polygon(tile);
      const first = pts[0]!;
      path.moveTo(first.x, first.y);
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i]!;
        path.lineTo(p.x, p.y);
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      if (first.x < minX) minX = first.x;
      if (first.y < minY) minY = first.y;
      if (first.x > maxX) maxX = first.x;
      if (first.y > maxY) maxY = first.y;
      path.closePath();
    }

    this.worldBounds = { minX, minY, maxX, maxY };
    const count = this.patch.tiles.length;
    this.tileWorldSize = Math.sqrt(
      Math.max((maxX - minX) * (maxY - minY), 1e-9) / Math.max(count, 1),
    );
    // Sorted so colour order is stable between rebuilds.
    this.buckets = [...byKey.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true }))
      .map(([key, path]) => ({
        path,
        fill: this.colourOverride ? key : this.palette.fill(numeric(key)),
      }));
    if (this.colourToken) this.bucketCache.set(this.colourToken, this.buckets);
  }

  private draw(): void {
    const { ctx, dpr, view, palette } = this;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (!this.buckets.length) return;

    // World → device, with y flipped.
    ctx.setTransform(
      dpr * view.scale,
      0,
      0,
      -dpr * view.scale,
      dpr * view.tx,
      dpr * view.ty,
    );

    // lineWidth is set in world units and the transform scales by `scale`, so
    // the on-screen stroke is a constant strokeWidth·dpr at every zoom. What
    // does change is tile size: once tiles are only a few pixels across, the
    // outlines swamp the fills and the patch turns to mud. Drop them there.
    ctx.lineJoin = 'round';
    ctx.strokeStyle = palette.stroke;
    ctx.lineWidth = palette.strokeWidth / view.scale;
    const strokeVisible = this.tileWorldSize * view.scale > 5;

    for (const bucket of this.buckets) {
      ctx.fillStyle = bucket.fill;
      ctx.fill(bucket.path);
      if (strokeVisible) ctx.stroke(bucket.path);
    }

    for (const { path, spec } of this.overlays) {
      ctx.globalAlpha = spec.opacity ?? 1;
      if (spec.fill) {
        ctx.fillStyle = spec.fill;
        ctx.fill(path);
      }
      if (spec.stroke !== undefined) {
        ctx.strokeStyle = spec.stroke;
        ctx.lineWidth = (spec.width ?? 2) / view.scale;
        ctx.stroke(path);
      }
      ctx.globalAlpha = 1;
    }
  }
}

function numeric(key: string): number | string {
  const n = Number(key);
  return key !== '' && Number.isFinite(n) ? n : key;
}
