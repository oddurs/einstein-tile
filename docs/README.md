# Einstein Tiles

Research notes on the aperiodic monotile — the "hat" (March 2023) and the "spectre"
(May 2023) — covering the mathematics, the history that led to them, and how to
generate the tilings in code.

An **einstein** is a single shape that tiles the plane but *only* non-periodically.
The name is a pun on German *ein Stein*, "one stone" — nothing to do with Albert.

## Contents

| File | Contents |
| --- | --- |
| [01-history.md](01-history.md) | The einstein problem, 1961–2022: Wang tiles, Penrose, the near-misses |
| [02-the-hat.md](02-the-hat.md) | The hat, the `Tile(a,b)` continuum, metatiles, the two proofs |
| [03-the-spectre.md](03-the-spectre.md) | Chirality, `Tile(1,1)`, the spectre family, hex metatiles |
| [04-implementation.md](04-implementation.md) | Two generation algorithms, coordinates, existing code |
| [05-frontier.md](05-frontier.md) | 2024–2026 results, physics applications, open questions |
| [06-webapp-design.md](06-webapp-design.md) | **Product plan** — pedagogy, narrative arc, mobile UX, visual direction, stack |
| [07-scope.md](07-scope.md) | **Scope** — the one sentence, depth ceilings, what we refuse and why |
| [08-engine.md](08-engine.md) | **Engine** — exact-arithmetic design, verified properties, perf, gotchas |
| [09-sprint-01.md](09-sprint-01.md) | Sprint 1 — the two load-bearing scenes, onto a phone |
| [10-sprint-02.md](10-sprint-02.md) | Sprint 2 — turn working scenes into a piece you can read |
| [11-sprint-03.md](11-sprint-03.md) | Sprint 3 — survives contact: viewports, degradation, CI |
| [13-sprint-04.md](13-sprint-04.md) | Sprint 4 — not one shape but a family: the `Tile(a,b)` continuum |
| [12-verification.md](12-verification.md) | **What is verified and what isn't** — read before trusting green CI |
| [references.md](references.md) | Annotated bibliography with links |

## The 60-second version

- **The problem.** Aperiodic tile *sets* shrank from 20,426 (Berger, 1966) to 2
  (Penrose, 1974) and then stalled for ~50 years. Nobody could get to 1, and nobody
  could prove 1 was impossible.
- **The hat.** David Smith, an amateur, found it in November 2022. With Myers,
  Kaplan and Goodman-Strauss he proved it aperiodic in March 2023. It is a 13-sided
  polykite and it settles the einstein problem — with an asterisk: every hat tiling
  mixes the tile with its mirror image, at a ratio of φ⁴ : 1 ≈ 6.854 : 1.
- **The spectre.** Two months later the same team removed the asterisk. The spectre
  is *strictly chiral*: it tiles aperiodically using translations and rotations
  alone, and admits no periodic tiling even when reflections are allowed.
- **Why it was findable at all.** The decisive idea was not the shape but the
  **continuum**: the hat and the turtle are two points on a one-parameter family
  `Tile(a,b)`, and aperiodicity follows from an incommensurability argument across
  the family. That proof is short and human-checkable, unlike the computer-assisted
  one.

## Status of these notes

Compiled 2026-07-27 from the primary papers and the authors' own project pages.
Numeric claims that popular coverage commonly gets wrong are flagged inline —
see [the reflection ratio](02-the-hat.md#the-reflection-ratio) and the
[caveats on secondary sources](references.md#caveats-on-secondary-sources).
