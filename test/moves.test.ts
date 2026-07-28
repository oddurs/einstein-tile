import { describe, expect, it } from 'vitest';
import { isoKey } from '../src/engine/isometry.js';
import { KiteIndex, overlaps } from '../src/engine/kites.js';
import {
  deadHoles,
  frontier,
  greedyWalk,
  legalMoves,
  makeBoard,
  movesAlongStep,
} from '../src/engine/moves.js';
import { buildPatch } from '../src/engine/patch.js';
import { boundarySteps } from '../src/engine/hull.js';

const singleTile = () => makeBoard([buildPatch(1).tiles[0]!]);

describe('frontier', () => {
  it('exposes one lattice step per unit of a lone tile’s perimeter', () => {
    const steps = frontier(singleTile());
    // The hat's 13 edges have lengths 1, √3 and 2 in lattice terms; the one
    // length-2 edge splits, giving 14 unit steps.
    expect(steps.length).toBe(14);
  });

  it('shrinks relative to tile count as tiles are added', () => {
    const lone = frontier(singleTile()).length;
    const many = frontier(makeBoard(buildPatch(2).tiles)).length;
    expect(many).toBeLessThan(lone * buildPatch(2).tiles.length);
  });
});

describe('legal moves', () => {
  it('offers moves against a single tile', () => {
    const moves = legalMoves(singleTile());
    expect(moves.length).toBeGreaterThan(0);
  });

  it('never offers a move that overlaps the board', () => {
    const board = makeBoard(buildPatch(1).tiles);
    for (const iso of legalMoves(board)) {
      for (const tile of board.tiles) {
        expect(overlaps(iso, tile.iso)).toBe(false);
      }
    }
  });

  it('returns a deduplicated set', () => {
    const moves = legalMoves(singleTile());
    expect(new Set(moves.map(isoKey)).size).toBe(moves.length);
  });

  it('is stable — the same board gives the same moves', () => {
    const a = legalMoves(singleTile()).map(isoKey).sort();
    const b = legalMoves(singleTile()).map(isoKey).sort();
    expect(a).toEqual(b);
  });

  it('re-offers every removed tile that is edge-adjacent to what remains', () => {
    // Completeness against ground truth. A removed tile must be re-offered
    // exactly when it shares a boundary step with the board — tiles that only
    // touch at a point, or float free, correctly are not offered.
    const patch = buildPatch(2);
    const keep = patch.tiles.slice(0, 40);
    const board = makeBoard(keep);
    const offered = new Set(legalMoves(board).map(isoKey));
    const steps = new Set(
      frontier(board).map((s) => `${s.from.a},${s.from.b}|${s.to.a},${s.to.b}`),
    );

    let adjacent = 0;
    for (const tile of patch.tiles.slice(40)) {
      if (!board.index.isFree(tile.iso)) continue;
      // Does this tile run along the frontier? Its own boundary steps, reversed,
      // would appear in the board's frontier.
      const mine = boundarySteps([tile]);
      const touches = mine.some((s) =>
        steps.has(`${s.to.a},${s.to.b}|${s.from.a},${s.from.b}`),
      );
      if (!touches) continue;
      adjacent++;
      expect(offered.has(isoKey(tile.iso)), `tile at ${isoKey(tile.iso)}`).toBe(true);
    }
    expect(adjacent).toBeGreaterThan(5);
  });

  it('offers moves per-edge that are a subset of the whole board’s moves', () => {
    const board = singleTile();
    const all = new Set(legalMoves(board).map(isoKey));
    for (const step of frontier(board)) {
      for (const iso of movesAlongStep(board, step)) {
        expect(all.has(isoKey(iso))).toBe(true);
      }
    }
  });

  it('offers at least one move on every exposed edge of a lone tile', () => {
    const board = singleTile();
    for (const step of frontier(board)) {
      expect(movesAlongStep(board, step).length).toBeGreaterThan(0);
    }
  });

  it('uses more than one orientation — placement is a real choice', () => {
    const orientations = new Set(
      legalMoves(singleTile()).map((m) => `${m.rot}${m.reflected}`),
    );
    expect(orientations.size).toBeGreaterThan(1);
  });

  it('offers reflected placements too', () => {
    // Hat tilings need reflections; if enumeration only produced unreflected
    // tiles the reader could never build a real patch.
    expect(legalMoves(singleTile()).some((m) => m.reflected)).toBe(true);
  });
});

describe('reachable failure', () => {
  it('traps itself: random local play boxes in an unfillable gap', () => {
    // The property scene 3 depends on. Note what failure actually is — not
    // "no moves anywhere", which an open frontier essentially never reaches,
    // but a *pocket* that no hat will ever fit. If this stops happening, the
    // scene has no trap and therefore no lesson.
    let trappedAt: number | null = null;
    for (let seed = 1; seed <= 12 && trappedAt === null; seed++) {
      let s = seed;
      const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000;
      const { placed, trapped } = greedyWalk(
        singleTile(),
        (moves) => moves[Math.floor(rnd() * moves.length)]!,
        25,
      );
      if (trapped.length) trappedAt = placed.length;
    }
    expect(trappedAt, 'random play never trapped itself').not.toBeNull();
  });

  it('does not report a trap on a board that is genuinely fine', () => {
    // A real tiling has no unfillable pockets, by construction.
    expect(deadHoles(makeBoard(buildPatch(2).tiles))).toEqual([]);
  });

  it('never produces an overlapping board while walking', () => {
    const { placed } = greedyWalk(singleTile(), (moves) => moves[0]!, 15);
    const index = new KiteIndex(singleTile().tiles);
    for (const iso of placed) expect(index.add(iso)).toBe(true);
  });

  it('makes progress before it gets stuck', () => {
    const { placed } = greedyWalk(singleTile(), (moves) => moves[0]!, 15);
    expect(placed.length).toBeGreaterThan(3);
  });
});
