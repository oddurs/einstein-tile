/**
 * Scene 3 — "slide it over itself".
 *
 * ## What went wrong before
 *
 * The first version let a reader place hats by hand and hoped the point would
 * emerge. It didn't: nothing in it ever asked you to make the pattern *repeat*,
 * so there was no goal, no test, and no moment of failure — just a sandbox with
 * a lesson's title on it. A reader tried it and said, correctly, that they
 * didn't get it.
 *
 * ## The idea
 *
 * Stop explaining and let the mechanic *be* the definition.
 *
 * A pattern repeats exactly when you can **slide a copy of it onto itself and
 * have everything land**. That is the textbook definition of periodic, and it is
 * also something a thumb can do. So: here is a copy, drag it around, watch what
 * lands.
 *
 * The scene is in two acts, and the first act is what makes the second mean
 * anything:
 *
 *  1. **A hexagon floor.** Drag, and it clicks — every hexagon lands on a
 *     hexagon, the whole overlap lights up. *That* is what repeating looks like.
 *  2. **The hat tiling.** Drag anywhere at all. A handful of tiles land by
 *     coincidence; the rest never do. There is no slide that works, and the
 *     reader has just spent thirty seconds failing to find one.
 *
 * No paragraph is doing the teaching here. The reader's own hand is.
 */

import {
  type Eis,
  type Piece,
  type Point,
  alignment,
  bestAlignment,
  candidateShifts,
  buildPatch,
  eis,
  hexPatch,
  polygon,
  toX,
  toY,
} from '../engine/index.js';
import { METATILE, REFLECTION } from '../renderer/palette.js';
import { TileRenderer, type Overlay } from '../renderer/renderer.js';

type Act = 'hexagons' | 'hats';

const COPY = {
  hexagons: {
    title: 'A floor that repeats',
    idle: 'Drag the pale copy. Find a spot where every tile lands on a tile.',
    close: 'Almost — nudge it.',
    perfect: 'It clicks. Every tile lands on a tile — that is what “repeats” means.',
  },
  hats: {
    title: 'Now the same shape as before',
    idle: 'Same game — but these are the only slides that could ever work. Try them.',
    close: 'A few landed by luck. Keep looking.',
    perfect: 'It clicks.',
  },
} as const;

const CLOSING =
  'None of them work. Not one — and not on a bigger floor either, however far you go. That is what “never repeats” means.';

export function mountRepeatScene(root: HTMLElement): () => void {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]');
  const title = root.querySelector<HTMLElement>('[data-title]');
  const prompt = root.querySelector<HTMLElement>('[data-prompt]');
  const meter = root.querySelector<HTMLElement>('[data-meter]');
  const bar = root.querySelector<HTMLElement>('[data-bar]');
  const next = root.querySelector<HTMLButtonElement>('[data-next]');
  const reset = root.querySelector<HTMLButtonElement>('[data-reset]');
  if (!canvas || !title || !prompt || !meter || !bar || !next || !reset) {
    throw new Error('repeat scene: missing required elements');
  }

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const theme = () => (media.matches ? 'dark' : 'light');

  let act: Act = 'hexagons';
  let pieces: Piece[] = [];
  /**
   * The opening slide. Two things it must not be.
   *
   * Not zero: the identity maps every tiling onto itself, so the scene would
   * open by announcing "every tile landed" — the opposite of the lesson.
   *
   * And not a hexagon lattice vector either: (6,6) is one, so opening there
   * left act 1 already solved and stole the reader's discovery. (3,1) has an
   * odd first coordinate, so it is outside the hexagon sublattice and both acts
   * start genuinely unaligned.
   */
  const START: Eis = eis(3, 1);
  let shift: Eis = START;
  /**
   * The un-snapped drag position.
   *
   * Snapping on every pointer-move and then measuring the next move *from the
   * snapped point* traps the copy: small deltas never escape the current
   * candidate's basin, so the copy sticks and the reader cannot move it at all.
   * The raw position accumulates freely; snapping only decides what is scored
   * and drawn.
   */
  let raw = { x: 0, y: 0 };
  /**
   * Every slide that could possibly be a period, for this tiling.
   *
   * Dragging snaps to these. It makes the copy feel magnetic, and — the real
   * reason — it means the reader is walking the *complete* set of candidates
   * rather than sampling a grid. Every failure they see is a candidate
   * eliminated.
   */
  let candidates: Eis[] = [];
  /** Distinct slides the reader has tried, so "never" is earned before it is said. */
  const tried = new Set<string>();

  const renderer = new TileRenderer(canvas, { dark: media.matches });

  const colours = () => {
    const t = theme();
    return {
      base: t === 'dark' ? '#38414d' : '#ccd3da',
      copyFill: t === 'dark' ? 'rgba(120,175,225,0.22)' : 'rgba(70,130,190,0.20)',
      copyStroke: t === 'dark' ? 'rgba(150,195,240,0.75)' : 'rgba(45,95,150,0.6)',
      landed: METATILE[t].P,
      landedStroke: t === 'dark' ? 'rgba(240,250,255,0.9)' : 'rgba(10,45,80,0.75)',
      miss: REFLECTION[t].mirrored,
    };
  };

  const loadAct = (which: Act) => {
    act = which;
    shift = START;
    raw = { x: toX(START), y: toY(START) };
    tried.clear();
    pieces =
      which === 'hexagons'
        ? hexPatch(4)
        : buildPatch(2).tiles.map((tile) => ({
            anchor: tile.iso.t,
            form: `${tile.iso.rot}${tile.iso.reflected ? 'm' : 'r'}`,
            points: polygon(tile),
          }));

    candidates = candidateShifts(pieces);
    const c = colours();
    renderer.setFigures(
      pieces.map((p) => ({ points: p.points, fill: c.base })),
      true,
    );
    title.textContent = COPY[which].title;
    next.hidden = which === 'hats';
    next.textContent = 'Now try the hat →';
    draw();
  };

  const shifted = (p: Piece): Point[] => {
    const dx = toX(shift);
    const dy = toY(shift);
    return p.points.map((q) => ({ x: q.x + dx, y: q.y + dy }));
  };

  const draw = () => {
    const c = colours();
    const result = alignment(pieces, shift);
    const overlays: Overlay[] = [];

    const landed = new Set(result.matched);
    const copy: Point[][] = [];
    const hits: Point[][] = [];
    for (const [i, piece] of pieces.entries()) {
      (landed.has(i) ? hits : copy).push(shifted(piece));
    }

    overlays.push({ loops: copy, fill: c.copyFill, stroke: c.copyStroke, width: 1.2 });
    if (hits.length) {
      overlays.push({
        loops: hits,
        fill: c.landed,
        stroke: c.landedStroke,
        width: 1.4,
      });
    }
    renderer.setOverlays(overlays);

    // The identity is not a slide: it matches everything by definition and
    // tells the reader nothing.
    const isSlide = shift.a !== 0 || shift.b !== 0;
    const pct = isSlide ? Math.round(result.fraction * 100) : 0;
    bar.style.width = `${pct}%`;
    bar.dataset.perfect = String(result.perfect);

    const text = COPY[act];
    if (!isSlide) {
      meter.textContent = 'slide it somewhere';
      prompt.textContent = text.idle;
      return;
    }
    const landedText = result.perfect
      ? 'every tile landed'
      : result.count === 0
        ? 'nothing lands'
        : `${pct}% land`;
    // Showing the candidate set's size turns "I couldn't find one" into "there
    // are only this many, and I have seen most of them" — which is the
    // difference between a reader who is unconvinced and one who is convinced.
    meter.textContent =
      act === 'hats'
        ? `${landedText} · ${Math.min(tried.size, candidates.length)}/${candidates.length} slides tried`
        : landedText;

    if (result.perfect) {
      prompt.textContent = text.perfect;
      if (act === 'hexagons') next.hidden = false;
      return;
    }

    // Only draw the conclusion once the reader has genuinely hunted, so it reads
    // as something they found rather than something asserted at them. This has
    // to sit outside the partial-match branch: most hat slides land *nothing*,
    // so gating on a partial match meant the conclusion never appeared.
    if (act === 'hats' && tried.size >= 4) {
      prompt.textContent = CLOSING;
      return;
    }
    prompt.textContent = result.fraction > 0.5 ? text.close : text.idle;
  };

  // Dragging moves the copy, not the view — the copy is the thing the scene is
  // about, and direct manipulation of a visible object reads differently from
  // panning empty space. Pinch still zooms.
  renderer.onDragWorld = (dx, dy) => {
    raw = { x: raw.x + dx, y: raw.y + dy };
    // Snap to the nearest *candidate period*, not to the raw lattice: most
    // lattice points cannot be a period at all, so snapping to them made the
    // hexagon floor feel broken — a reader had to hit one point in twelve to
    // see it click.
    shift = nearestCandidate(raw.x, raw.y, candidates) ?? shift;
    // Count distinct positions, not pointer moves: a single drag fires dozens of
    // moves, which would have the scene declaring "no slide ever works" before
    // the reader had really tried one.
    tried.add(`${shift.a},${shift.b}`);
    draw();
  };

  const onNext = () => loadAct('hats');
  const onReset = () => {
    if (act === 'hats') {
      // Show the reader the best slide that exists, so "never" is a measured
      // claim rather than a matter of how hard they happened to try.
      const best = bestAlignment(pieces, 10);
      shift = best.shift;
      raw = { x: toX(shift), y: toY(shift) };
      for (let i = 0; i < 11; i++) tried.add(`seen-${i}`);
      draw();
      prompt.textContent = `${CLOSING} The very best any slide manages here is ${Math.round(best.alignment.fraction * 100)}%.`;
    } else {
      shift = START;
      raw = { x: toX(START), y: toY(START) };
      draw();
    }
  };
  const onTheme = () => {
    renderer.setDark(media.matches);
    loadAct(act);
  };

  next.addEventListener('click', onNext);
  reset.addEventListener('click', onReset);
  media.addEventListener('change', onTheme);

  loadAct('hexagons');

  return () => {
    next.removeEventListener('click', onNext);
    reset.removeEventListener('click', onReset);
    media.removeEventListener('change', onTheme);
    renderer.destroy();
  };
}

/** The candidate slide nearest a Cartesian position. */
function nearestCandidate(x: number, y: number, candidates: readonly Eis[]): Eis | null {
  let best: Eis | null = null;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = Math.hypot(toX(c) - x, toY(c) - y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
