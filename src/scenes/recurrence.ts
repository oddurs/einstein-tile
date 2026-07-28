/**
 * Scene 4 — order is not randomness.
 *
 * *One sentence: it never repeats, but it isn't random either.*
 *
 * This is the misconception docs/07 says must die. Told that a pattern "never
 * repeats", almost everyone hears *random* — like the digits of π. The truth is
 * the opposite and far stranger: hat tilings are highly ordered. Any patch you
 * can point at occurs again, and again, infinitely often. What never happens is
 * a single slide that carries the *whole* tiling onto itself.
 *
 * It sits directly after scene 3 on purpose. A reader has just watched a large
 * minority of tiles align under the best possible slide and may reasonably have
 * concluded "so it nearly repeats" — or, having seen no slide work, "so it's
 * just a mess".
 * Both readings are wrong in opposite directions, and this scene answers both
 * with the same demonstration: patches recur; the whole thing doesn't.
 *
 * The honesty constraint: what we can *show* is recurrence within one finite
 * patch. That it continues forever is a claim about the infinite tiling, so the
 * copy says so plainly rather than implying the visible count is the whole
 * story.
 */

import {
  buildPatch,
  polygon,
  recurrences,
  toX,
  toY,
  type Eis,
  type Piece,
  type Point,
} from '../engine/index.js';
import { METATILE } from '../renderer/palette.js';
import { TileRenderer, type Overlay } from '../renderer/renderer.js';

/**
 * Deliberately not the biggest patch available.
 *
 * At level 4 a 7-tile selection recurs ~120 times, which sounds better and
 * teaches worse: each copy is a few pixels across, so the reader sees scattered
 * specks and has no way to tell they are *the same shape*. Recognising sameness
 * is the whole mechanism here. Level 3 gives ~24 copies, each big enough to
 * read as a repeat of the one you picked.
 */
const LEVEL = 3;
/** Tiles in a selection. Seven is a patch you can see, and it recurs ~20 times. */
const PATCH = 7;
const MAX_MARKS = 120;

/**
 * Says what will happen, not just what to do.
 *
 * Most readers scroll and never interact, and a bare instruction tells a
 * passive reader nothing at all — they see a command they are not following.
 * Naming the outcome means the scene still lands for someone who never taps.
 */
const IDLE = 'Tap anywhere — the same patch will be somewhere else too.';

export function mountRecurrenceScene(root: HTMLElement): () => void {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]');
  const prompt = root.querySelector<HTMLElement>('[data-prompt]');
  const readout = root.querySelector<HTMLElement>('[data-readout]');
  const pick = root.querySelector<HTMLButtonElement>('[data-pick]');
  if (!canvas || !prompt || !readout || !pick) {
    throw new Error('recurrence scene: missing required elements');
  }

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const theme = () => (media.matches ? 'dark' : 'light');

  const tiles = buildPatch(LEVEL).tiles;
  const pieces: Piece[] = tiles.map((tile) => ({
    anchor: tile.iso.t,
    form: `${tile.iso.rot}${tile.iso.reflected ? 'm' : 'r'}`,
    points: polygon(tile),
  }));
  const centres: Point[] = pieces.map((p) => {
    let x = 0;
    let y = 0;
    for (const q of p.points) {
      x += q.x;
      y += q.y;
    }
    return { x: x / p.points.length, y: y / p.points.length };
  });

  let selection: number[] = [];
  let found: Eis[] = [];

  const renderer = new TileRenderer(canvas, { dark: media.matches });

  const colours = () => {
    const t = theme();
    return {
      base: t === 'dark' ? '#333c46' : '#d3d9de',
      pick: METATILE[t].H,
      pickLine: t === 'dark' ? 'rgba(255,235,240,0.95)' : 'rgba(70,10,25,0.85)',
      echo: METATILE[t].P,
      echoLine: t === 'dark' ? 'rgba(230,245,255,0.7)' : 'rgba(10,45,80,0.55)',
    };
  };

  const shiftPoints = (points: readonly Point[], s: Eis): Point[] => {
    const dx = toX(s);
    const dy = toY(s);
    return points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  };

  const draw = () => {
    const c = colours();
    const overlays: Overlay[] = [];

    if (found.length) {
      // Every other copy, drawn first so the reader's own pick sits on top.
      const echoes: Point[][] = [];
      for (const shift of found.slice(0, MAX_MARKS)) {
        for (const i of selection) echoes.push(shiftPoints(pieces[i]!.points, shift));
      }
      overlays.push({ loops: echoes, fill: c.echo, stroke: c.echoLine, width: 1 });
    }
    if (selection.length) {
      overlays.push({
        loops: selection.map((i) => pieces[i]!.points),
        fill: c.pick,
        stroke: c.pickLine,
        width: 1.6,
      });
    }
    renderer.setOverlays(overlays);

    if (!selection.length) {
      prompt.textContent = IDLE;
      readout.textContent = '';
      return;
    }
    const shown = Math.min(found.length, MAX_MARKS);
    prompt.textContent = found.length
      ? 'The same patch, over and over — and it goes on forever, on a floor with no end. Non-repeating does not mean random.'
      : 'That patch is rare enough not to recur inside this piece of floor. Tap a smaller one.';
    readout.textContent = found.length
      ? `${shown} more cop${shown === 1 ? 'y' : 'ies'} in view`
      : 'none in view';
  };

  /** Select the patch around tile `seed` and find where else it occurs. */
  const choose = (seed: number) => {
    const order = pieces
      .map((_, i) => i)
      .sort(
        (a, b) =>
          Math.hypot(centres[a]!.x - centres[seed]!.x, centres[a]!.y - centres[seed]!.y) -
          Math.hypot(centres[b]!.x - centres[seed]!.x, centres[b]!.y - centres[seed]!.y),
      );
    selection = order.slice(0, PATCH);
    found = recurrences(pieces, selection, MAX_MARKS);
    draw();
  };

  // Keyboard and screen-reader route to what tapping does: walk the tiling a
  // patch at a time. The scene's point must not be pointer-only.
  let cursor = Math.floor(pieces.length / 2);
  const onPick = () => {
    cursor = (cursor + 137) % pieces.length;
    choose(cursor);
  };
  pick.addEventListener('click', onPick);

  renderer.onTap = (world) => {
    // Nearest tile to the tap, then its neighbours: a patch, not a pixel.
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < centres.length; i++) {
      const d = Math.hypot(centres[i]!.x - world.x, centres[i]!.y - world.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) return;
    cursor = best;
    choose(best);
  };

  const onTheme = () => {
    renderer.setDark(media.matches);
    const c = colours();
    renderer.setFigures(
      pieces.map((p) => ({ points: p.points, fill: c.base })),
      false,
    );
    draw();
  };
  media.addEventListener('change', onTheme);

  const c = colours();
  renderer.setFigures(
    pieces.map((p) => ({ points: p.points, fill: c.base })),
    true,
  );
  draw();

  return () => {
    pick.removeEventListener('click', onPick);
    media.removeEventListener('change', onTheme);
    renderer.destroy();
  };
}
