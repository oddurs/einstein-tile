# 09 — Sprint 1

## Goal

> **A deployable page where scenes 3 and 5 work on a real phone.**

Those are the two scenes [07](07-scope.md) marks *don't cut*. They are also the
two biggest risks in the project. If they land and playtest well, the rest of the
MVP is assembly. If they don't, we learn it now rather than after building six
other scenes around them.

## The reasoning behind this shape

The engine is currently **ahead of the app**, and that's the wrong way round.
There are no pixels yet, so every further design decision is being made blind.
More engine work in isolation compounds risk: we'd be building features whose
required shape we're guessing at.

So this sprint is a **thin vertical slice**, not a layer. It deliberately leaves
engine capabilities unbuilt (continuum, patch matching, hulls) in favour of
getting the two load-bearing interactions in front of humans.

Sequencing note: **scene 5 needs no new engine work** — `Tile.path` already
carries the ancestry, and [08](08-engine.md) established that tinting by ancestor
is the right approach anyway. So the load-bearing scene can be de-risked *first*,
in parallel with the hard engine work that scene 3 needs.

## Tickets

### 0. Version control — **S** — ✅ done

`git init`, initial commit on `main` (`6197977`, 26 files). The hatviz BSD-3
provenance and the arXiv reference are recorded in the commit message, not only
in doc comments.

Remote: **github.com/oddurs/einstein-tile**, public. Going public brought the
BSD-3 obligation live, so `LICENSE` (MIT), `THIRD-PARTY-NOTICES.md` (the hatviz
copyright notice, retained as the licence requires) and a root `README.md` are
in place.

Sprint tracking lives in this file, not Linear. The only Linear team is the Sava
company workspace and this is a side project, so it stays out of there.

---

### E1. Kite decomposition + exact overlap predicate — **M**

Derive each hat's **8 constituent kites** in exact lattice coordinates, giving
every kite a canonical integer ID.

This is the keystone piece. With it, *"do two hats overlap?"* becomes a
set-intersection on 8 integer IDs — exact, allocation-free, no geometry, no
tolerances. It unlocks three separate things:

- legal-move enumeration (E2)
- true metatile hulls (deferred, but the same primitive)
- an exact area/coverage test to replace the Monte Carlo one in `patch.test.ts`

**Done when:** every tile in `buildPatch(4)` maps to 8 kite IDs; the 7,921 tiles
yield exactly 63,368 distinct IDs (proving no overlap, exactly, replacing the
statistical test).

---

### E2. Legal-move enumeration — **L**

Given a patch and an exposed edge, return every legal placement of a new hat.

Use **local matching, not the substitution.** Enumerate candidate translations
that butt a new tile against the exposed edge, across all 12 orientations, and
keep those whose kite set is disjoint from the existing patch (E1).

This distinction is the whole pedagogical point. Local matching admits placements
that are legal *now* but cannot extend to a full tiling — which is exactly the
trap scene 3 needs. Deriving moves from the substitution would only ever offer
correct moves, and the user could never fail. **The failure has to be reachable.**

**Done when:** enumeration around a single hat returns a stable, deduplicated set;
placements from a real patch are always included; and a scripted greedy walk can
reach a dead end.

*Highest-uncertainty ticket in the sprint. If it slips, scene 3 slips.*

---

### A1. App shell + deploy — **S** — ✅ done

Astro 7 at the repo root; the engine moved to `src/engine/` (via `git mv`, so
history survives) to leave `src/pages/` free for Astro. One static page, 12 KB of
JS. `.github/workflows/deploy.yml` runs typecheck → test → build → Pages on push
to `main`.

`base: '/einstein-tile'` is set for project-site deployment, so the dev URL is
`localhost:4321/einstein-tile/` — bare `/` 404s. Every in-page URL must go
through `import.meta.env.BASE_URL` rather than a root-absolute path.

*Original ticket text:*

Astro, TypeScript, one page, canvas island, static build, deploy on push from
`oddurs/einstein-tile`. No CMS, no router, no backend ([07](07-scope.md)).

The repo is public, so **GitHub Pages is now viable** and is the zero-setup
option. Cloudflare Pages remains the better pick if this gets posted somewhere
and spikes — Pages has a soft 100 GB/month bandwidth guideline, Cloudflare
doesn't meter. Either works; decide at wiring time.

**Done when:** a URL exists that someone can open on a phone.

---

### A2. Canvas renderer — **M** — ✅ done

`src/renderer/` — `gestures.ts`, `view.ts`, `renderer.ts`, plus a placeholder
`palette.ts` that A3 replaces. Verified in headless Chromium at a Pixel 7
viewport (`npm run smoke`): no console errors, canvas backed at dpr 2.625, 1,281
distinct colours sampled, drag pans, and the page does not scroll during a drag
— which is the real test of the passive-listener + `touch-action: none` contract.

Two things worth remembering:

- **The view transform is a pure, tested module.** The y-flip (engine y grows up,
  canvas y grows down) would otherwise produce a patch that renders and pans
  perfectly while being silently *mirrored* — on a tiling whose reflected tiles
  are the whole point, a bad bug to ship. 9 tests cover round-trip, zoom
  anchoring, clamping and fit.
- **Stroke width is constant on screen at any zoom**, because `lineWidth` is set
  in world units and the transform scales by `scale`. Stroke visibility
  therefore keys on *tile* screen size, not stroke width. Got this wrong first
  time; the wrong version hid outlines when zoomed out for no reason.

*Original ticket text:*

Framework-agnostic module consuming the engine: draw a patch, devicePixelRatio
handling, pan and drag, pinch-zoom, resize. Canvas 2D — no WebGL this sprint
([06 §6](06-webapp-design.md)).

Gesture vocabulary is fixed and must not vary between scenes: **pinch = zoom,
drag = pan, always.**

**The performance idea: merge by colour.** Tiles are grouped by colour key and
merged into one `Path2D` per colour, rebuilt only when the patch or scheme
changes. A frame is then a handful of `fill()` calls — twelve for the
orientation scheme — rather than one per tile. Per-frame cost is therefore
independent of tile count: panning 7,921 tiles costs what panning 25 costs.

**Done when:** a level-4 patch renders and pans smoothly at 60fps on a mid-range
Android.

---

### A3. Palette + theming — **M**

The three colour schemes from [06 §5](06-webapp-design.md) — by orientation, by
metatile, by reflection — plus light/dark from day one.

**The colourblind constraint is part of this ticket, not a follow-up.** A 12-hue
orientation wheel is unusable for ~8% of men, so ship a lightness-varying
alternative alongside it. Load the `dataviz` skill before picking values.

**Done when:** all three schemes work in both themes and pass a simulated
protanopia/deuteranopia check.

---

### S1. Scene 5 — the hierarchy — **M**

The load-bearing scene. Pinch to zoom out; metatile groupings tint in by ancestor
depth, level 1, then 2, then 3. Scrubbable, with a stepped alternative for
`prefers-reduced-motion`.

Group on `Tile.path`; **do not stroke `MetaInstance.scaffold`** — see the warning
in [08](08-engine.md).

**Done when:** a person who doesn't like maths can, unprompted, say something like
"the tiles group into bigger copies of themselves". That sentence is the MVP's
success test.

---

### S2. Scene 3 — try to break it — **L**

Tap an exposed edge → ghost tiles appear in every legal orientation → tap to
commit. No free drag ([06 §4](06-webapp-design.md)). Includes the scroll gate:
the reader cannot continue until they've attempted a repeat.

**Done when:** placement is comfortable one-thumbed on a phone, and reaching a
dead end feels like the tiling's fault rather than the interface's.

---

### X1. Mobile + perf harness — **M**

Runs alongside everything else, not at the end.

- `window.innerHeight` handling for the address-bar `vh` trap
- passive listeners on `touchstart` / `touchmove` / `wheel`
- perf budget in CI: FCP < 2.5s throttled, 60fps scroll, Lighthouse > 90
- no memory growth across a full read-through
- **testing on a real mid-range Android**, not just a simulator

---

### X2. Playtest round — **S**

Five people, at least three of whom don't enjoy maths. Watch, don't explain.

The one question that matters: *afterwards, can they say why it can't repeat?*

Case's finding is the thing to watch for — people skim and learn nothing, which
is what the scene 3 gate exists to prevent. Verify the gate actually works.

## Sequencing

```
0 ──┬─ A1 ── A2 ──┬── A3 ──┬── S1 ──┐
    │              │        │        ├── X2
    └─ E1 ── E2 ───┴────────┴── S2 ──┘
                    X1 runs throughout
```

Two tracks after ticket 0. The app track reaches a rendered scene 5 without
waiting on the engine track; the engine track's E2 is the long pole and feeds
only scene 2. If E2 slips, **ship S1 and playtest it alone** — it still answers
the most important question.

## Explicitly not in this sprint

Scenes 0, 1, 2, 4, 6, 7. The sandbox. Export and share links. WebGL. The
`Tile(a,b)` continuum. True metatile hulls. Patch matching. Copywriting beyond
placeholder. Localization.

Several of these are cheap and tempting. They are also exactly the
adjacent-interesting work [07](07-scope.md#the-adjudication-rule) warns about.
The sprint answers one question — *do the two load-bearing scenes work?* — and
nothing else earns a place until it's answered.

## Definition of done

1. A URL that works on a phone.
2. Scenes 3 and 5 playable there.
3. Five playtests run, notes written.
4. A go/no-go on the arc in [06 §3](06-webapp-design.md), informed by evidence
   rather than by this document.
