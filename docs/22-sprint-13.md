# 22 — Sprint 13

## Theme: the playgrounds, which nobody has audited

> **Three places in this project invite you to do something. Two of them are
> focusable from the keyboard and do nothing when you press a key, and the
> third has a control with no name at all.**

## The verdict, first

**P1 is not a polish ticket, it is a defect**, and it is the reason to run this
sprint. The rest are the ordinary unevenness of a surface that has never been
looked at on purpose — `/make/` has had no sprint of its own, ever.

## What shipped — ✅

| ticket | | |
| --- | --- | --- |
| P1 | a keyboard path into every playground | ✅ |
| P2 | extend the checks to `/make/` | ✅ |
| P3 | tell people what the sandbox does | ✅ |
| P4 | the sandbox figure filling its canvas | ✅ **61% → 83%** |
| P5 | `recurrence` should say what it found | **already did — see below** |
| P6 | look at all three defaults | ✅ **found two more bugs** |

### Two of this plan's findings were false, and my probe was why

**`/make/` does not have an unnamed control.** The dark toggle is wrapped in
`<label class="dark">…dark</label>` — an implicit label — and the browser
computes its name correctly. My probe only looked at `label[for=]` and
`textContent`, so it invented the defect. Real count: **zero unnamed controls on
either page.** The check now uses Playwright's `ariaSnapshot`, i.e. the
browser's own name computation, rather than my guess at label wiring.

**`recurrence` does report a count** — *"20 more copies in view"*. My probe read
`[data-meter]`; that scene uses `[data-readout]`. P5 was answering a question
nobody had.

Both errors came from one hand-rolled probe that guessed at selectors and at
name resolution. **A measurement is only evidence if the instrument is
checked**, and mine was not — which is the same lesson as every harness bug in
this project, arriving from the other direction.

The half of P2 that survives is the real half: the a11y, fill and trap checks
only ever ran on the piece. `/make/` passing them anyway was luck, not evidence.

### P1 was exactly as bad as it looked

| | before | after |
| --- | --- | --- |
| repeat | focusable, no key handling | arrows walk the 31 candidate slides |
| recurrence | focusable, no key handling | arrows move the selection, Enter picks |
| /make/ | not focusable, pointer-only | focusable; arrows pan, `+`/`-` zoom |

One vocabulary across all three, the way `docs/06` fixes the gesture vocabulary:
**arrows move, Enter commits, `+`/`-` zoom.** The smoke check now enforces the
rule as binary — *operable, or not focusable, no third state*.

`repeat`'s keyboard path is not free movement: there are only 31 candidate
slides and they are already enumerated, so arrows are a cursor over that list.
Pressing right twice from the default walks it to a perfect alignment —
`"nothing lands"` → `"every tile landed"`.

### P6 found two bugs, which is what P6 was for

**The sandbox opened white inside a dark page.** `dark` defaulted to `false`
regardless of the reader's theme, so a phone in dark mode got a glaring white
canvas — broken-looking before it is a choice. It now defaults to the system
preference and stays a real control, because the tiling is a picture someone may
print. A design carried in the URL still wins: that was somebody's decision.

**The sandbox did not re-fit on resize.** A tiling filling **96%** of the width
in portrait fell to **44%** after a rotation and stayed there. The canvas
resizes; the view did not. Fixed with an opt-in `refitOnResize` — opt-in because
the hierarchy drives its own zoom per stage and the continuum fits once
deliberately, and neither may have that taken back. Asserted, on the dimension
that should be full in either orientation.

### And the fill defect was everywhere it had not been checked

Sprint 11 fixed it for the scroll scenes. It was still present in every
playground, because none of them was in that sprint's scope:

| | before | after |
| --- | --- | --- |
| /make/, desktop | 61% wide | **83%** |
| repeat, desktop | 52% wide | **88%** |
| recurrence, desktop | 53% wide | **88%** |

Same cause each time — a landscape canvas holding a square tiling — and for the
hands-on scenes the same fix as sprint 11: the HUD moves beside the figure at
desktop, which is what actually narrows the canvas. The threshold now runs on
all five figures and both pages.

## Measured before planning

### The hands-on scenes cannot be used without a pointer

| | canvas focusable | keyboard changes anything |
| --- | --- | --- |
| repeat | **yes** (`tabindex="0"`) | **no** |
| recurrence | **yes** (`tabindex="0"`) | **no** |
| /make/ | no | no |

`repeat` and `recurrence` are the two scenes sprint 10 deliberately kept
hands-on, on the argument that *the reader's own hands* are the point. Measured,
that argument has a hole in it: **the hands have to be holding a mouse.** Drag
the copy, tap to pick a patch — both are pointer-only, and the scroll-driven
scenes are the ones that are keyboard-operable, because their slider survived.

Being `tabindex="0"` with no key handling is **worse than not being focusable**.
A keyboard user tabs into the figure, gets a focus ring, presses every key they
can think of, and nothing happens. It advertises an interaction it does not have.

### `/make/` has a control with no accessible name — and nothing was checking

```
input[checkbox] #-  → *** NO ACCESSIBLE NAME ***
```

That is the dark-mode toggle. The smoke check does assert *"every control has an
accessible name"* — and it passes, because **that assertion only ever runs on the
piece.** `/make/` gets functional tests (it renders, it exports SVG, the URL
round-trips) and no accessibility tests at all.

A green check that does not cover a page is the same failure as the screenshot
harness only shooting a phone: **blind by construction, and reporting success.**

### `/make/` never says what it can do

| | |
| --- | --- |
| words on the page | **53** |
| mentions of drag, pinch, zoom or tap | **0** |
| `touch-action` on the canvas | `none` |

So the canvas claims every touch gesture and tells nobody. On a phone you can pan
and pinch a tiling and would never find out. The one slider that changes the tile
count is labelled **"how much"**.

### The sandbox figure fills 61% of its canvas

| | canvas | figure fills |
| --- | --- | --- |
| phone | 378×531 | 96% wide × 67% tall |
| desktop | 830×522 | **61% wide** × 96% tall |

This is exactly the defect sprint 11 measured and fixed on the piece — a
landscape canvas holding a square tiling — and `/make/` was not part of that
sprint, so it still has it. The `MIN_FILL` threshold that now guards the piece
does not run here either.

### `recurrence` offers one action two ways and reports nothing

Prompt: *"Tap anywhere — the same patch will be somewhere else too."* Plus a
button: *"Pick a patch."* Two affordances, one action. And its meter is **empty**
— `repeat` tells you *"31% land · 4/31 slides tried"*, while `recurrence` shows a
patch, highlights its echoes, and never says how many it found.

## Tickets

### P1. A keyboard path into every playground — **L**

The defect above, fixed properly rather than by removing `tabindex`.

- **repeat** — arrow keys nudge the copy between candidate shifts. There are only
  31 of them and they are already enumerated, so this is a cursor over a list,
  not free movement.
- **recurrence** — arrows move the selection, Enter picks. The scene already has
  a `choose(seed)` taking an index.
- **/make/** — the canvas becomes focusable *and* operable: arrows pan, `+`/`-`
  zoom. Or, if that reads as clutter, make pan and zoom genuinely optional and
  drop `tabindex` — **but decide, rather than leaving a focus ring on a dead
  element.**

Every playground must end the sprint either operable from a keyboard or not
focusable. No third state.

---

### P2. Extend the checks to the page they never covered — **M**

- The dark toggle gets a name.
- **The a11y assertions run on `/make/` too**, not only the piece.
- `MIN_FILL` runs on `/make/` too.
- The trap test runs on `/make/` too — its canvas takes `touch-action: none` on a
  1.1-viewport page, which is exactly the geometry that strands a phone reader.

The rule this sprint should leave behind: **a check that runs on one page is a
check that is lying about the others.**

---

### P3. Tell people what the sandbox does — **S**

Not a tutorial. A line that says the canvas can be dragged and pinched, and a
label better than "how much" — it sets how many tiles, so it should say so.

The tile count already appears in the header, far from the slider that changes
it. Put the number where the hand is.

---

### P4. The sandbox figure, filling its canvas — **S**

Sprint 11's fix, applied to the page that missed it: a canvas shaped like the
thing inside it. Target the same **≥70%** and let P2's threshold enforce it.

---

### P5. `recurrence` should say what it found — **M**

One affordance, not two. And a meter: the scene's entire claim is *"this exact
patch occurs again, and not far away"* — so it should say **how many times**, the
way `repeat` says how many slides you have tried. A count is the difference
between a reader who saw some highlights and one who has been shown a fact.

---

### P6. Look at all three, on a phone, in both themes — **S**

The last sprint's real bug was found by a person looking at a screenshot, not by
23 assertions. This ticket is: render every playground at phone and desktop,
light and dark, and **look at them** — with the specific question *"does the
default state look intentional?"*, which is the question that found the last one.

## Not in this sprint

- **New capability.** No new colour schemes, no new export formats, no spectre.
  This is about the three surfaces that already exist being finished.
- **Converting `repeat` or `recurrence` to scroll.** Settled twice. P1 is the
  answer to "not everyone can drag", not scroll-driving them.

## Definition of done

1. Every playground is keyboard-operable, or is not focusable. Asserted.
2. No control anywhere lacks an accessible name — checked on **every** page.
3. `/make/`'s figure fills ≥70% of its canvas width, checked.
4. `recurrence` reports a count.
5. Someone has looked at all three defaults, on a phone, in both themes.
