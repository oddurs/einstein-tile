# 16 — Sprint 7

## Theme: make it hold by construction

> **Six sprints of accretion, and nobody has swept. Several things are currently
> true only because I remembered to keep them true.**

## Why this, now

The piece is finished, accurate and hardened. The README now points at the
source with some pride, and calls the engine reusable. So the code is about to
be read, and it has never been tidied.

More than tidiness, though: **some invariants are held by discipline rather than
by construction**, and discipline is what fails quietly.

Evidence, measured before planning:

| | |
| --- | --- |
| `src/engine` | 2,138 lines |
| `src/renderer` | 931 |
| `src/scenes` | 1,878 |
| `src/pages` | 1,454 — of which **892 are `<style>`** |
| `test` | 1,569 |

### Three findings

**1. Two pages are dead and still shipping.** `/scene-3/` and `/scene-5/` were
how scenes shipped in sprint 1. Sprint 2 superseded them with the narrative page
and never removed them. Nothing links to them; they carry 245 lines of
duplicated markup and CSS, and they are built and deployed on every push.

**2. The design tokens are hand-copied into five pages.** They have *not*
drifted — all five still match `palette.ts` `SURFACE` exactly. But nothing
prevents it, and this is not cosmetic: every CVD separation and contrast number
from [sprint 1 A3](09-sprint-01.md) was computed against those exact surfaces.
One careless edit to one page and the accessibility guarantee silently stops
being true, with every test still green.

**3. Seven scenes duplicate the same boilerplate** — `matchMedia`, a `theme()`
helper, the `change` listener, the element-binding guard. Seven copies of the
same eight lines is where the next `data-dark` collision comes from.

Also worth a look: the renderer has grown **18 public methods** — `setPatch`,
`setTiles`, `setFigures`, `setScheme`, `setDark`, `setMode`,
`setColourOverride`, `setOverlays`, and more. Some of that is genuine range;
some is accretion.

## Why this is safe to do now, and would not have been earlier

142 unit tests and 31 browser assertions. A refactor without that is a rewrite
with extra steps; with it, behaviour changes announce themselves. The tests are
the licence for this sprint.

## Tickets

### W1. Delete the dead pages — **S** — ✅ done

`/scene-3/` and `/scene-5/` removed — 334 lines of markup and CSS that nothing
linked to and every push deployed.

**And a third orphan the ticket didn't know about.** `src/scenes/placement.ts`,
299 lines, was the *original* scene 3 — the hand-placement version a reader
tried and did not understand in sprint 5. The redesign replaced it with
`repeat.ts` and left it in the tree, imported by nothing. Found only because W4's
survey of renderer call sites showed a `setTiles` caller that should not have
existed.

*Original ticket text:*

Remove `/scene-3/` and `/scene-5/`. Confirm nothing links them, including the
README and the docs, then delete rather than deprecate.

---

### W2. One source of truth for the surfaces — **M** — ✅ done

`src/renderer/tokens.ts` derives the custom properties from `SURFACE` and emits
them as a generated stylesheet; the pages no longer state a colour.

**The guard was verified by breaking it.** Injecting `--bg: #fcfcfb` into a page
turns the suite red with `make.astro should not declare --bg itself`; removing
it turns it green. A guard that has never failed is decoration, not a guarantee.

*Original ticket text:*

The validated colours live in `palette.ts`. The pages should not restate them.

Generate the CSS custom properties from the palette at build time, and **add a
test that fails if any page's surface disagrees with `palette.ts`**. Turning the
guarantee from "I remembered" into "it cannot be otherwise" is the point of the
ticket; deduplication is the side effect.

---

### W3. Extract the scene boilerplate — **M** — ✅ done

`src/scenes/scene.ts` — `bind()`, `watchTheme()`, `teardown()`.

**Honest accounting: this did not save lines.** Scenes went 1,878 → 2,004 with a
90-line helper, so roughly break-even. The win is structural, and worth stating
plainly rather than dressed up as a reduction:

- the old guards threw *"missing required elements"* without saying which, so a
  typo in a `data-` attribute meant reading the markup to find out; `bind()`
  names them;
- cleanup no longer restates setup as a second list that has to agree with the
  first.

*Original ticket text:*

A small helper for the two things every scene does: bind required elements or
fail loudly, and track the colour scheme. Nothing clever — the scenes should
still read as themselves, only shorter.

---

### W4. Narrow the renderer — **S** — ✅ done

**18 public methods → 11.** A usage survey drove it rather than taste:
`setScheme` and `setMode` had zero callers among the scenes, `setTiles` had one,
and `setDark` had eight — three doors onto one idea. They are now
`setAppearance({ scheme?, dark?, mode? })`, and `setTiles` was inlined at its
single call site.

The ticket said to skip anything that does not make the class easier to hold in
your head, and that ruled out more: `fit` and `getView` look redundant next to
`zoomTo` but each answers a genuinely different question.

*Original ticket text:*

Look honestly at the 18 methods. `setTiles` is a thin wrapper over `setPatch`;
`setScheme`/`setMode`/`setDark` are three doors to one recolour. Merge what is
genuinely one idea, keep what is genuinely three.

Not a rewrite. If a change does not make the class easier to hold in your head,
skip it.

---

### W5. Prove nothing changed — **S** — ✅ done

`npm run shots -- --out before` then `--out after --diff before`. **All seven
surfaces pixel-identical**, against a baseline captured from the stashed
pre-sprint tree.

The harness caught itself first: it disagreed with its own output on the lede,
because the hook animates over ~2.6s and the shot depended on when it was taken.
Capturing under reduced motion made it reproducible — and exercises that path
into the bargain.

*Original ticket text:*

A refactor's whole claim is that behaviour is identical, so the sprint should
end by demonstrating it rather than asserting it: screenshots of every scene
before and after, compared.

## Not in this sprint

New content, the spectre scene, publishing the engine to npm. This is a sweep,
not an addition — and a sweep that grows a feature is how sweeps go wrong.

## Definition of done

1. Nothing dead is deployed.
2. A page cannot disagree with the validated palette without a test failing.
3. No scene restates boilerplate that belongs in one place.
4. Every screenshot matches its pre-refactor twin.
5. 142 tests and 31 assertions still pass, unchanged.
