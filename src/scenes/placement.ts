/**
 * Scene 3 — try to break it.
 *
 * The reader lays hats by hand and tries to make the pattern repeat. They can't.
 * This is *procedural rhetoric*: they enact the theorem rather than read it, and
 * the failure they hit is lawful rather than a fumble.
 *
 * ## Why tap-to-place, not drag
 *
 * A hat has 13 sides, 12 orientations and needs reflections. Dragging and
 * rotating that with a thumb, on a surface where your finger hides the target,
 * is miserable (docs/06 §4). So placement is a *choice among legal options*.
 *
 * A tap **places a tile straight away** — the best-fitting legal hat near the
 * tap — and the other hats that would also fit stay on screen as ghosts you can
 * tap to swap to. An earlier version showed ghosts first and required a second
 * tap to commit; driving it in a browser showed why that fails: any tap that
 * misses a ghost merely re-queries, so a reader can tap repeatedly and place
 * nothing. Acting immediately and offering the alternatives afterwards gives
 * feedback on every tap while still showing the legal-move set — which is the
 * mathematics, so it is worth showing.
 *
 * ## Two different failures — don't confuse them
 *
 * docs/07 asks this scene to deliver *"you try to make it repeat, you can't"*.
 * That is the lesson. A separate thing also happens: because moves come from
 * local matching, a reader can wall off a **pocket no hat will fit**
 * (`deadHoles`). Related, but not the same claim, and the copy is careful to
 * say only what the pocket actually shows — that fitting locally never promises
 * you can carry on.
 *
 * Measured, one-move-ahead pocket avoidance changes everything: pure random play
 * walls itself in after a median of 6 tiles, which reads as "hats are fiddly"
 * rather than as anything lawful, while always avoiding pockets never traps at
 * all in 80 moves, which removes the phenomenon entirely. So avoidance is a
 * **tiebreak on the auto-pick, not a filter**: a tap makes comfortable progress,
 * and pocket-forming placements stay on offer as ghosts for a reader to choose.
 *
 * **Still missing:** nothing here yet lets a reader *check* whether their patch
 * repeats, so the headline lesson is currently carried by the prompt rather than
 * by the mechanic. That is the top follow-up for this scene, and it wants
 * playtesting before it is built.
 */

import {
  type Isometry,
  type Tile,
  boundaryLoops,
  signedArea2,
  buildPatch,
  deadHoles,
  legalMoves,
  makeBoard,
  polygon,
  toX,
  toY,
  type Board,
  type Point,
} from '../engine/index.js';
import { REFLECTION, SURFACE } from '../renderer/palette.js';
import { TileRenderer, type Overlay } from '../renderer/renderer.js';

/** How far from a tap we will still offer a placement, in world units. */
const REACH = 3.2;
/** Never show more than this many ghosts at once — past a few it reads as mush. */
const MAX_GHOSTS = 4;

const PROMPTS = {
  start: 'Tap just outside the tile to add another one.',
  going: 'Keep going — try to build a block that would repeat.',
  choose: 'Other hats fit there too — tap a faded one to swap.',
  none: 'Nothing fits there. Try closer to the edge of the shape.',
  // Careful with this claim. An unfillable gap is not direct evidence that the
  // tiling never repeats — it demonstrates the thing underneath that, which is
  // that local legality gives you no guarantee about carrying on.
  trapped:
    'Every tile you placed was legal — and now nothing fits that gap. That is the hat’s trap: fitting locally never promises you can keep going. Undo, and try a different one.',
} as const;

function pointInPolygon(pt: Point, poly: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (
      a.y > pt.y !== b.y > pt.y &&
      pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

const asTile = (iso: Isometry): Tile => ({
  kind: 'H',
  iso,
  path: ['H'],
  trail: [0],
});

const loopToPoints = (loop: readonly { a: number; b: number }[]): Point[] =>
  loop.map((p) => ({ x: toX(p), y: toY(p) }));

export function mountPlacementScene(root: HTMLElement): () => void {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-canvas]');
  const prompt = root.querySelector<HTMLElement>('[data-prompt]');
  const count = root.querySelector<HTMLElement>('[data-count]');
  const undoButton = root.querySelector<HTMLButtonElement>('[data-undo]');
  const resetButton = root.querySelector<HTMLButtonElement>('[data-reset]');
  if (!canvas || !prompt || !count || !undoButton || !resetButton) {
    throw new Error('placement scene: missing required elements');
  }

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const theme = () => (media.matches ? 'dark' : 'light');

  const seed = buildPatch(0).tiles[0]!;
  let tiles: Tile[] = [seed];
  /** The alternatives for the most recent placement, minus the one taken. */
  let ghosts: { iso: Isometry; poly: Point[] }[] = [];

  const renderer = new TileRenderer(canvas, {
    dark: media.matches,
    scheme: 'reflection',
    onTap: (world) => onTap(world),
  });

  const board = (): Board => makeBoard(tiles);

  const colours = () => {
    const t = theme();
    return {
      ghostFill: t === 'dark' ? 'rgba(90,150,206,0.30)' : 'rgba(103,164,221,0.35)',
      ghostStroke: t === 'dark' ? 'rgba(140,190,235,0.95)' : 'rgba(40,90,140,0.9)',
      frontier: t === 'dark' ? 'rgba(240,239,236,0.35)' : 'rgba(26,26,25,0.28)',
      trapFill: t === 'dark' ? 'rgba(174,45,77,0.8)' : 'rgba(170,46,76,0.7)',
      trapStroke: REFLECTION[t].mirrored,
    };
  };

  const say = (text: string) => {
    prompt.textContent = text;
  };

  /**
   * Would taking this placement immediately enclose a pocket?
   *
   * Used only to *order* the options, never to remove any. Without it the
   * auto-pick walks into a dead end within a few tiles, which teaches "hats are
   * fiddly" rather than anything true — the reader needs to get somewhere
   * before the tiling bites. Traps stay fully reachable: they are still offered
   * as ghosts, and when every option encloses a pocket one is taken anyway.
   */
  const enclosesPocket = (iso: Isometry): boolean =>
    boundaryLoops([...tiles, asTile(iso)]).some((loop) => signedArea2(loop) < 0);

  const centroid = (poly: readonly Point[]): Point => {
    let x = 0;
    let y = 0;
    for (const p of poly) {
      x += p.x;
      y += p.y;
    }
    return { x: x / poly.length, y: y / poly.length };
  };

  const draw = (refit = false) => {
    renderer.setTiles(tiles, refit);

    const c = colours();
    const overlays: Overlay[] = [];

    // The frontier, drawn faintly and always. Without it a reader has to guess
    // where a hat could possibly go, and most taps land on nothing.
    overlays.push({
      loops: boundaryLoops(tiles).map(loopToPoints),
      stroke: c.frontier,
      width: 1.5,
    });

    const dead = deadHoles(board());
    if (dead.length) {
      overlays.push({
        loops: dead.map(loopToPoints),
        fill: c.trapFill,
        stroke: c.trapStroke,
        width: 3.5,
      });
    }
    if (ghosts.length) {
      overlays.push({
        loops: ghosts.map((g) => g.poly),
        fill: c.ghostFill,
        stroke: c.ghostStroke,
        width: 2,
      });
    }
    renderer.setOverlays(overlays);

    count.textContent = `${tiles.length} tile${tiles.length === 1 ? '' : 's'}`;
    undoButton.disabled = tiles.length <= 1;

    if (dead.length) say(PROMPTS.trapped);
    else if (ghosts.length) say(PROMPTS.choose);
    else if (tiles.length > 2) say(PROMPTS.going);
    else say(PROMPTS.start);
  };

  /** Place `iso`; if `replaceLast`, swap it for the previous placement instead. */
  function place(
    chosen: { iso: Isometry; poly: Point[] },
    alternatives: { iso: Isometry; poly: Point[] }[],
    replaceLast: boolean,
  ): void {
    const base = replaceLast ? tiles.slice(0, -1) : tiles;
    tiles = [...base, asTile(chosen.iso)];
    ghosts = alternatives.filter((c) => c.iso !== chosen.iso).slice(0, MAX_GHOSTS);
    draw();
  }

  function onTap(world: Point): void {
    // Tapping one of the offered alternatives swaps the last tile for it.
    const hit = ghosts.find((g) => pointInPolygon(world, g.poly));
    if (hit) {
      const alternatives = [...ghosts, { iso: tiles.at(-1)!.iso, poly: polygon(tiles.at(-1)!) }];
      place(hit, alternatives, true);
      return;
    }

    // Otherwise: which legal hats could go about here? Tapping open space is far
    // kinder to a thumb than aiming at a 13-gon's edge, and the same gesture
    // always means "put a tile roughly there".
    const all = legalMoves(board()).map((iso) => ({ iso, poly: polygon(asTile(iso)) }));
    const covering = all.filter((c) => pointInPolygon(world, c.poly));

    // Falling back to *nearby* placements keeps a slightly-off tap useful, which
    // matters a lot on a phone. Without it most taps report "nothing fits" and
    // the reader concludes the scene is broken rather than that the tiling is
    // constrained.
    const candidates = covering.length
      ? covering
      : all
          .map((c) => {
            const m = centroid(c.poly);
            return { ...c, d: Math.hypot(m.x - world.x, m.y - world.y) };
          })
          .filter((c) => c.d < REACH)
          .sort((a, b) => a.d - b.d)
          .slice(0, MAX_GHOSTS);

    if (!candidates.length) {
      ghosts = [];
      draw();
      say(PROMPTS.none);
      return;
    }

    // Place one immediately and keep the rest on offer. Options that would
    // wall off a pocket sort last, so the reader makes progress by default.
    const ranked = [...candidates].sort(
      (a, b) => Number(enclosesPocket(a.iso)) - Number(enclosesPocket(b.iso)),
    );
    place(ranked[0]!, ranked, false);
  }

  const onUndo = () => {
    if (tiles.length <= 1) return;
    tiles = tiles.slice(0, -1);
    ghosts = [];
    draw();
  };
  const onReset = () => {
    tiles = [seed];
    ghosts = [];
    draw(true);
  };
  const onTheme = () => {
    renderer.setDark(media.matches);
    draw();
  };

  undoButton.addEventListener('click', onUndo);
  resetButton.addEventListener('click', onReset);
  media.addEventListener('change', onTheme);

  draw(true);
  // Start zoomed out a little, so there is visible room to place into.
  renderer.zoomTo(renderer.getView().scale * 0.35);

  return () => {
    undoButton.removeEventListener('click', onUndo);
    resetButton.removeEventListener('click', onReset);
    media.removeEventListener('change', onTheme);
    renderer.destroy();
  };
}

export { SURFACE, boundaryLoops };
