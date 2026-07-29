# 20 — Sprint 11

## Theme: the piece is scrolled, but only the phone was designed

> **Sprint 10 built the mechanism. It built it once, for a narrow column, and
> then used it at every width.**

## The verdict, first

**One ticket is clearly worth doing and is backed by a hard number. The rest are
judgement, and should be treated as such.** The honest position is at the end,
under *What this sprint cannot do*.

## Measured before planning

### Desktop shows a figure in a third of its own canvas

Content bounding box as a share of the canvas, sampled at 75% through each
scene's travel:

| | phone 370×458 | desktop 950×450 |
| --- | --- | --- |
| hat | 88% wide × 71% tall | **42%** wide × 88% tall |
| continuum | 74% wide × 59% tall | **35%** wide × 73% tall |
| hierarchy | 99% × 100% | 100% × 100% |

**The continuum figure uses 35% of the width it is given on a desktop.** The
canvas is 950×450 — an aspect of 2.1:1 — and the tiling it draws is roughly
square, so two thirds of the box is background. The phone is fine, because the
phone is what the layout was designed for and a 370×458 box is nearly square
already.

Meanwhile the page leaves **224px of gutter on each side at 1440, and 464px at
1920**, because `article` is capped at 992px. So the desktop reader gets a
figure that is too small, in a canvas that is too wide, on a page with unused
room on both sides.

### The mechanism itself is sound and does not need touching

Frame-to-frame gaps through 120 frames of continuous scrolling in the continuum:

| median | p95 | max |
| --- | --- | --- |
| 8.3ms | 8.9ms | 9.4ms |

No jank, nothing dropped. **Nothing in this sprint should touch `scroll.ts`.**

### The seam between the two modes is unmarked

Sprint 10's S5 shipped only half of itself. The "do not convert `repeat` and
`recurrence`" half was correct and holds. The other half — *make the handoff
explicit* — was never built, and the contrast is now sharper than when it was
written:

| | height | figure | gestures |
| --- | --- | --- | --- |
| hat, hierarchy, continuum | ~3.3 viewports | pinned, 50dvh | none |
| repeat, recurrence | ~1.3 viewports | in flow, 62dvh | drag + pinch |

A reader scrolls through three scenes where the figure holds still and the
argument moves, then hits one where the figure scrolls away like an ordinary
image and expects to be touched. Nothing announces that. **A change of mode with
no signal reads as a bug**, and this one lands immediately after the piece has
spent three scenes teaching a different set of rules.

## Tickets

### T1. Desktop: the beats beside the figure — **L**

The one ticket a number demands. Above roughly 900px, put the pinned figure and
its beats side by side instead of stacked:

- the figure takes the left, and gets to be **near-square and taller** — a
  canvas the shape of the thing it is drawing;
- the beats take the right, in their own column, still pinned, still
  cross-fading;
- the section may bleed wider than `article`'s 992px, because the gutters are
  sitting there unused and a figure is not prose that needs a measure.

**Success is a number, not a judgement:** the continuum figure should fill
**≥70% of its canvas width** at 1440, the same neighbourhood the phone already
achieves. Measure it the same way, with `scripts/ink.mjs` promoted out of the
scratchpad so the number can be re-checked rather than remembered.

The phone layout does not change. It was measured and it is right.

---

### T2. Give the hands-on scenes an arrival — **M**

Finish S5's other half. When the rules change, say so — in the design, not in a
tooltip.

`repeat` and `recurrence` should read as *a different kind of room*: something
that marks the transition, a figure that plainly invites hands rather than
scrolling, and prose that hands over deliberately. The existing prompts already
say "Try it" and "Point at any patch"; the problem is that nothing prepares the
reader to be addressed that way.

**What this must not become:** a modal, an overlay, a tutorial, or a "tap to
begin" gate. The reader arrives mid-scroll and must be able to keep scrolling
past without ever touching anything.

---

### T3. The hook has to earn the scroll — **S**

Scene 1 is 658px of decorative canvas behind the title and does nothing with the
scroll at all — in a piece that is now **14.8 viewports** long and asks for
sustained scrolling almost immediately after.

It is the only place a reader decides whether to continue, and it currently makes
no case. Small, cheap, and the highest-leverage pixels on the page.

---

### T4. Entry and exit — **S**

A pinned figure currently appears at full strength the instant its track begins
and vanishes the instant it ends. The first and last beat therefore get less
attention than the ones in the middle, which is backwards — the last beat of each
scene is the one carrying the conclusion.

Give each track a little runway at both ends so the figure settles before the
first beat and holds after the last. This is `--beat-travel`-adjacent tuning, in
CSS, on the numbers sprint 10 deliberately kept in one place.

---

### T5. Where am I — **S**

14.8 viewports with no sense of position. Not a scroll-jacking navigation and not
a table of contents: something quiet that says how far through the argument you
are, so the length feels intended rather than endless.

**Cut this first if the sprint runs long.** It treats a symptom of length; T1 and
T4 treat the length itself.

---

### T6. Guardrails, extended to the width that was never checked — **M**

The scroll assertions from sprint 10 run at one viewport. That is precisely the
mistake the screenshot harness made with `--measure`: a check that is blind by
construction reports green about the thing it cannot see.

- Every scroll assertion runs at **desktop as well as phone**.
- The ink measurement becomes a checked-in script with a **threshold**, so
  "the figure fills its canvas" is a build failure rather than an opinion.
- Reduced motion is asserted at desktop too, where T1 introduces a second
  layout that also has to degrade.
- The trap test stays exactly as it is. It is the one that protects a person.

## Not in this sprint

- **`scroll.ts` itself.** Measured at 8.3ms median with no dropped frames. It
  works; leave it alone.
- **Converting `repeat` or `recurrence`.** Settled in sprint 10, for a reason
  that has not changed: they are where the reader's hands go.
- Parallax or scroll-linked animation on prose, `scroll-snap` between scenes, and
  any scrollytelling library. All three were rejected before and none of the
  reasons have expired.

## What this sprint cannot do

**T1 is backed by a measurement. T2 through T5 are taste**, and they are taste
about a reading experience that **no human has yet had** — the gap `docs/12`
has flagged since sprint 1, and the same gap that made the last two pieces of
real feedback ("I didn't really get it", "the spaces feel out of whack") worth
more than any sprint I planned unprompted.

If there is a choice between shipping T5 and watching one person scroll this on
a phone, the second is worth more. The sprint should be read with that in mind.

## Definition of done

1. The continuum figure fills ≥70% of its canvas width at 1440, measured.
2. Desktop reads as designed for, not as a stretched phone.
3. Arriving at a hands-on scene feels deliberate.
4. Every scroll assertion runs at two widths, and the ink threshold can fail.
5. Nothing in `scroll.ts` changed.
