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

### W1. Delete the dead pages — **S**

Remove `/scene-3/` and `/scene-5/`. Confirm nothing links them, including the
README and the docs, then delete rather than deprecate.

---

### W2. One source of truth for the surfaces — **M**

The validated colours live in `palette.ts`. The pages should not restate them.

Generate the CSS custom properties from the palette at build time, and **add a
test that fails if any page's surface disagrees with `palette.ts`**. Turning the
guarantee from "I remembered" into "it cannot be otherwise" is the point of the
ticket; deduplication is the side effect.

---

### W3. Extract the scene boilerplate — **M**

A small helper for the two things every scene does: bind required elements or
fail loudly, and track the colour scheme. Nothing clever — the scenes should
still read as themselves, only shorter.

---

### W4. Narrow the renderer — **S**

Look honestly at the 18 methods. `setTiles` is a thin wrapper over `setPatch`;
`setScheme`/`setMode`/`setDark` are three doors to one recolour. Merge what is
genuinely one idea, keep what is genuinely three.

Not a rewrite. If a change does not make the class easier to hold in your head,
skip it.

---

### W5. Prove nothing changed — **S**

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
