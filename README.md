# einstein-tile

An interactive explainer for the **einstein tile** — the aperiodic monotile found
by David Smith in 2022 and proved aperiodic by Smith, Myers, Kaplan &
Goodman-Strauss in 2023.

> One ordinary-looking shape can cover an infinite floor, and the pattern can
> never repeat — and here is *why* it can't.

**Status:** early. The tiling engine works and is tested; the web app doesn't
exist yet. See [`docs/09-sprint-01.md`](docs/09-sprint-01.md) for what's next.

## The engine

`src/` is a framework-agnostic TypeScript library with no dependencies, no DOM
and no rendering. It produces **exact** tile placements — integers, not floats.

```ts
import { buildPatch, polygon, colourKey } from './src/index.js';

const patch = buildPatch(4);        // 7,921 hats
for (const tile of patch.tiles) {
  const pts = polygon(tile);        // 13 vertices, drawing coordinates
  const hue = colourKey(tile, 'orientation');
}
```

Tiles live on the half-Eisenstein lattice ℤ[ω] at half scale, where
ω = e^(iπ/3). Because ω² = ω − 1, rotation by 60° is `(a,b) ↦ (−b, a+b)` and
reflection is `(a,b) ↦ (a+b, −b)` — both exact integer operations. So a patch at
substitution level 6 is positioned as precisely as one at level 1, with no
accumulated drift.

The substitution itself has to run in floating point (the metatile scaffold
polygons are genuinely irrational), after which every hat is snapped back onto
the lattice with an *asserted* 1e-6 tolerance — against an observed residual of
~1e-10. Details and measurements in [`docs/08-engine.md`](docs/08-engine.md).

| Level | Tiles | Build | Polygons |
| --- | --- | --- | --- |
| 4 | 7,921 | 3 ms | 7 ms |
| 5 | 54,289 | 13 ms | 40 ms |
| 6 | 372,100 | 74 ms | 230 ms |

```
npm install
npm run dev        # Astro dev server
npm test           # unit tests (engine + view transform)
npm run typecheck
npm run smoke      # build, then verify in headless Chromium at a phone viewport
```

`npm run smoke` needs browsers once: `npx playwright install chromium`. It
asserts from real pixels and real events — the canvas is backed at
devicePixelRatio, it isn't blank, dragging pans it, and the page never scrolls
while you drag. Compiling is not evidence that a canvas draws anything.

## Docs

The `docs/` directory is the substance of this repo so far.

| | |
| --- | --- |
| [01 History](docs/01-history.md) | The einstein problem, 1961–2022 |
| [02 The hat](docs/02-the-hat.md) | `Tile(a,b)`, metatiles, the two proofs |
| [03 The spectre](docs/03-the-spectre.md) | Chirality and the 2023 follow-up |
| [04 Implementation](docs/04-implementation.md) | Algorithms and prior art |
| [05 Frontier](docs/05-frontier.md) | 2024–2026 research, open questions |
| [06 Webapp design](docs/06-webapp-design.md) | Pedagogy, narrative, mobile UX, stack |
| [07 Scope](docs/07-scope.md) | What this teaches, and what it refuses to |
| [08 Engine](docs/08-engine.md) | Exact-arithmetic design and measurements |
| [09 Sprint 1](docs/09-sprint-01.md) | Current plan |
| [References](docs/references.md) | Annotated bibliography |

## Credits

The hat and the spectre were discovered and proved by **David Smith, Joseph
Samuel Myers, Craig S. Kaplan and Chaim Goodman-Strauss** —
[*An aperiodic monotile*](https://arxiv.org/abs/2303.10798) and
[*A chiral aperiodic monotile*](https://arxiv.org/abs/2305.17743), both in
*Combinatorial Theory* 4 (2024).

The substitution data and float geometry in `src/internal/` are ported from
Craig Kaplan's [hatviz](https://github.com/isohedral/hatviz) under BSD 3-clause.
See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## Licence

MIT — see [LICENSE](LICENSE). Third-party terms in
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) must be retained in
redistributions.
