# 19 — Sprint 10

## Theme: the scroll becomes the instrument

> **Three of the five scenes are already a function of one number. Scroll is one
> number. Those three should be driven by it — and the other two must not be.**

## The verdict, first

**Worth doing, but not as a rebuild.** A uniform scrollytelling conversion would
damage the piece. A hybrid is a clear gain, and the measurements say exactly
where the line falls.

## Measured before planning

### The piece is nine viewports of near-misses

| | phone 412×915 | desktop 1440×900 |
| --- | --- | --- |
| page height | 8,207px — **9.0 viewports** | 7,753px — 8.6 viewports |
| stages | 45% of the scroll | 47% |
| controls in stages | 7 | 7 |

Per scene, phone:

| scene | section | stage | prose |
| --- | --- | --- | --- |
| hat | 1277px | 710 | 503 |
| repeat | 1245px | 761 | 420 |
| recurrence | 1162px | 706 | 392 |
| hierarchy | 1124px | 740 | 319 |
| continuum | 1224px | 740 | 420 |

**Every scene is ~1.3 viewports.** That is the worst length a scene can be. The
stage is 710–760px of a 915px phone viewport — 78% — so when the figure is fully
visible there is a sliver of prose, and when you read the prose the figure has
left. The argument and its evidence are never on screen together, anywhere, at
any width. That is the actual defect, and it is not a defect of taste.

### Three scenes are already scalar; two are not

Read from the scene modules rather than assumed:

| scene | driven by | shape |
| --- | --- | --- |
| **hat** | `show(step)`, `[data-step]` | 4 discrete steps |
| **hierarchy** | `show(index)`, `[data-stage]` | 5 discrete stages |
| **continuum** | `show(t)`, `[data-morph]` | **continuous, t ∈ [0,1]** |
| repeat | nudge / next / reset / tap a candidate | a *choice* |
| recurrence | pick a seed, then pan and zoom | *exploration* |

The first three are `f(number) → picture`. Scroll position is a number. The
mapping is not a metaphor; it is the same type.

### Scrubbing cost — the thing that decides feasibility

40 evenly-spaced values through each control, measured to the next frame, on a
412px viewport:

| scene | median | p95 | max |
| --- | --- | --- | --- |
| hat | 8.3ms | 9.3 | 9.4 |
| continuum | 8.3ms | 8.9 | **9.1** |
| hierarchy | 8.4ms | **111.8** | **185.7** |

**Continuum and hat already scrub at 60fps.** Continuum is the strongest
candidate in the piece: a thousand-step continuous range that redraws in 8ms.

**Hierarchy stalls up to 185ms** on some stage transitions — a quarter-second
freeze mid-scroll, which is exactly the jank that makes scrollytelling feel
broken. It cannot be scroll-driven until that is fixed.

## The mobile tension, named

`docs/06` §4 caps stages at 62dvh for a stated reason: every renderer calls
`attachGestures`, which requires `touch-action: none`, and a full-bleed canvas
that owns touch **swallows vertical scrolling and strands a phone reader**. That
is why the piece is not already a showpiece.

**The resolution is that the two requirements were never actually in conflict —
they belong to different scenes.** `touch-action: none` buys drag and pinch. A
scroll-driven scene does not need drag or pinch, *because scroll is the input*.
So:

- **Scroll-driven scenes** — `touch-action: pan-y`. The canvas keeps horizontal
  gestures if it wants them and never eats a vertical swipe. Impossible to trap.
- **Hands-on scenes** — `touch-action: none`, unchanged, still capped in height
  with ordinary page above and below.

The cap exists to protect the reader from the gesture handler. Remove the gesture
handler's claim on vertical, and the cap can go.

## Tickets

### S1. The sticky stage — **M**

One primitive: a figure that pins while its section scrolls past, reporting
progress 0→1 across its travel. Everything else is built on it.

- `position: sticky`, height ~54dvh on phone, pinned to the top of a section
  whose height sets the travel distance.
- Prose scrolls in the space beneath it, so **the figure and the sentence it is
  evidence for are finally on screen together** — the defect the measurements
  found.
- Progress from one `IntersectionObserver`-gated `scroll` listener, passive,
  reading `getBoundingClientRect()` and writing in `requestAnimationFrame`.
  Never `preventDefault`.
- Integrates with `stage.ts`'s existing lazy mount rather than replacing it.

**The rules that keep this from becoming the bad version of the genre**, stated
here so they are testable later: scroll speed is never altered, the reader is
never held, a fast flick reaches the end of the piece, and nothing is *only*
available at one scroll offset.

---

### S2. The continuum, scrubbed — **S**

The pure win, and the one to build first. `show(t)` takes t ∈ [0,1]; sticky
progress *is* t. The hat breathes into the turtle and back under your thumb, at
8ms a frame, with no control at all.

If only one ticket ships, this is the one — it is the piece's most beautiful
figure and it currently sits behind a slider that most readers will never drag.

---

### S3. The hat, assembled — **S**

Four steps, so progress snaps to quarters with a short eased transition between
them. The kites gather into the hat as you scroll: the assembly *happens* rather
than waiting to be requested.

Discrete, so it needs snapping — the risk is a figure that sits half-way between
two states and reads as a bug rather than a stage. Snap, then ease.

---

### S4. Make hierarchy scrubbable, or leave it alone — **M**

The 185ms stall must go first. It is almost certainly per-stage work done on
demand; the fix is to build all five stages once at mount and let `show()` be a
lookup. Budget: **p95 under 16ms**, measured the same way as above.

**If it will not come under 16ms, this ticket ends with the slider intact and the
result written down.** A 185ms hitch mid-scroll is worse than a slider, and the
zoom-out is the piece's biggest moment — better a moment that works.

---

### S5. Leave `repeat` and `recurrence` hands-on, and make the handoff explicit — **S**

**This is a ticket about not building something**, and it is the one that keeps
the sprint honest.

`repeat` was redesigned in sprint 6 *specifically* because a reader said "I tried
scene 3 and I didn't really get it" — and the fix was to make you personally
slide a copy and watch it fail, over a complete set of 31 candidate periods.
Driving that from scroll would take the doing away and hand back the watching.
**It would re-break the thing that feedback fixed.** The same holds for
`recurrence`, where the point is that *you* go looking.

So these two keep `touch-action: none`, keep their height cap, and gain only a
clear signal that the mode has changed — that here you are meant to use your
hands. Reaching a scene that behaves differently should feel like arriving
somewhere, not like a bug.

---

### S6. Guardrails, and a harness that can see scroll — **M**

The screenshot harness was once blind to a whole failure class by construction.
Do not repeat that.

- **`prefers-reduced-motion`** — scroll-driving is motion coupled to input. The
  sliders are **not deleted**; under reduced motion they are the interface, and
  the sticky behaviour is off.
- **Keyboard** — the sliders are also the keyboard path, and remain focusable
  and operable. Scroll-driven must never be the *only* way to reach a state.
- **No-JS** — 719 words of prose must still survive, unchanged.
- **The harness** must shoot each scene at several scroll offsets, not just at
  rest, or it cannot see anything this sprint does.
- **A trap test**: on a phone viewport, a vertical swipe starting *on the canvas*
  must move the page. This is the failure that would strand a reader, so it gets
  an explicit assertion.

## The cost to state plainly

Sticky scenes need scroll distance to spend. Three converted scenes at ~2
viewports of travel each takes the piece from **9 viewports to roughly 13**,
which sits badly beside `docs/07`'s standing principle that *the piece should
feel slightly too short*.

The defence — and it should be checked against a real reader, not assumed — is
that **scroll distance in a sticky scene is not reading distance**. The word
count does not move: it stays at 719. The reader is turning a crank, not wading
through more prose. If it nonetheless feels long, the travel distances are one
number per scene and can be cut without touching anything else.

## Not in this sprint

Scroll-linked animation on the *prose* (fades, reveals, parallax). It is the
cheap signifier of the genre and it costs a reader legibility for nothing. The
figures move because they are the argument; the text stays still because it is.

Also not: `scroll-snap` between scenes. It fights fast readers and breaks
find-in-page.

## Definition of done

1. The figure and the prose that explains it are visible together, at 412px.
2. Continuum and the hat are driven by scroll, at a measured p95 under 16ms.
3. A vertical swipe starting on any canvas always scrolls the page — asserted.
4. Reduced motion and keyboard reach every state without scrolling.
5. Hierarchy is either under 16ms or still a slider, with the number recorded.
6. `repeat` and `recurrence` still put the reader's hands on the thing.
