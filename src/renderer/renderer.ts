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

import type { ColourScheme, Patch, Tile } from '../engine/index.js';
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
  private onTap: RendererOptions['onTap'];

  /** Called after any pan or zoom, so scenes can react to the view. */
  onViewChange: ((view: Readonly<View>) => void) | null = null;

  private colourOverride: ((tile: Tile) => string) | null = null;
  private overlays: { path: Path2D; spec: Overlay }[] = [];

  private view: View = { scale: 1, tx: 0, ty: 0 };
  private dpr = 1;
  private cssWidth = 1;
  private cssHeight = 1;
  private frame = 0;
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
    this.onTap = opts.onTap;
    this.palette = this.buildPalette();

    // Required for passive pointer listeners — see gestures.ts.
    canvas.style.touchAction = 'none';

    this.detachGestures = attachGestures(canvas, {
      onPan: (dx, dy) => {
        this.view = pan(this.view, dx, dy);
        this.viewChanged();
      },
      onZoom: (factor, cx, cy) => {
        this.view = zoomAt(this.view, factor, cx, cy);
        this.viewChanged();
      },
      onTap: (x, y) => this.onTap?.(toWorld(this.view, x, y)),
    });

    this.resizeObserver = new ResizeObserver(() => this.syncSize());
    this.resizeObserver.observe(canvas);
    this.syncSize();
  }

  // -- public API ----------------------------------------------------------

  setPatch(patch: Patch, refit = true): void {
    this.patch = patch;
    this.rebuild();
    if (refit) this.fit();
    else this.requestDraw();
  }

  /** Render a bare tile list — for boards that are built up rather than derived. */
  setTiles(tiles: readonly Tile[], refit = false): void {
    this.setPatch({ level: 0, root: 'H', tiles, metatiles: [] }, refit);
  }

  setScheme(scheme: ColourScheme): void {
    if (scheme === this.scheme) return;
    this.scheme = scheme;
    this.recolour();
  }

  setDark(dark: boolean): void {
    if (dark === this.dark) return;
    this.dark = dark;
    this.recolour();
  }

  setMode(mode: ColourMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.recolour();
  }

  /**
   * Colour tiles with an arbitrary function instead of the current scheme.
   *
   * The returned string is both the colour and the bucket key, so tiles sharing
   * a colour still merge into one path and the per-frame cost stays flat.
   * Pass `null` to fall back to the scheme.
   */
  setColourOverride(fn: ((tile: Tile) => string) | null): void {
    this.colourOverride = fn;
    this.recolour();
  }

  /** Replace the overlay outlines drawn above the tiles. */
  setOverlays(overlays: readonly Overlay[]): void {
    this.overlays = overlays.map((spec) => {
      const path = new Path2D();
      for (const loop of spec.loops) {
        if (loop.length < 2) continue;
        const first = loop[0]!;
        path.moveTo(first.x, first.y);
        for (let i = 1; i < loop.length; i++) path.lineTo(loop[i]!.x, loop[i]!.y);
        path.closePath();
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
    this.cssWidth = cssW;
    this.cssHeight = cssH;
    this.dpr = dpr;
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

    for (const tile of this.patch.tiles) {
      const key = this.colourOverride
        ? this.colourOverride(tile)
        : String(tileColourKey(tile, this.scheme));
      let path = byKey.get(key);
      if (!path) {
        path = new Path2D();
        byKey.set(key, path);
      }
      const pts = polygon(tile);
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
