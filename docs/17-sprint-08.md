# 17 — Sprint 8

## Theme: LaTeX's craft, not its costume

> **Take what TeX actually got right about setting text, and leave behind what
> makes a page announce "this is a paper".**

## The tension, stated first

LaTeX is the reference here, and it comes with two separable things.

**Its craft** is genuine and largely unmatched on the web: a measure chosen by
character count rather than by round numbers, paragraphs broken as whole
paragraphs instead of line by line, figures that sit correctly in running text,
spacing derived from the type rather than from a designer's guesses.

**Its costume** is numbered sections, dense margins, theorem environments,
Computer Modern's hairlines. On a page for a general reader, that costume says
*this is not for you* — which is the exact opposite of what
[07](07-scope.md) asks this piece to do.

So: the craft, not the costume. Every ticket below should survive the question
*"would this help someone who does not read papers?"*

## Measured before planning

Line length, measured properly in `ch` (content width over the width of `0`),
not by counting lines:

| | phone 412 | tablet 834 | desktop 1440 |
| --- | --- | --- | --- |
| body | 32ch | 47ch | 47ch |
| takeaway | 32ch | 49ch | 49ch |
| standfirst | 28ch | 42ch | 42ch |

**47ch is short.** The comfortable band is 45–75; a LaTeX book sits around 66.
The measure is currently `34rem` — a round CSS number, which is the wrong *unit*
for the job. Line length is a count of characters, so it should be set in
characters and let the font decide the width.

Everything is also **one weight, one style, one family** — `ui-serif` falling
back to Georgia. No italic is ever used. The scale is a set of unrelated
`clamp()`s rather than a ratio.

### The bug this measurement found

`--measure` had stopped being defined at all. It lived in the `:root` block that
sprint 7 replaced with `rootCSS()`, and `tokens.ts` never emitted it — so
desktop prose ran to **82ch** for a while. Fixed, and the screenshot harness now
shoots desktop as well as phone, because it reported "pixel-identical" while
being blind to this by construction.

Measuring something I believed was fine is what turned it up.

## Tickets

### Y1. A typeface in the lineage — **M**

The system serif is doing nothing wrong and nothing for us. The candidates that
matter are the ones academic publishing actually uses:

- **Latin Modern** — the direct descendant of Knuth's Computer Modern. The
  authentic answer, and the hairlines are punishing on screen at text sizes.
- **STIX Two Text** — designed for scientific publishing, sturdy on screen.
- **Libertinus Serif** — the Linux Libertine successor, everywhere in papers.
- **Source Serif 4** — real optical sizes, made for screens.

Decide by looking, not by reputation, and **measure the cost**: the JavaScript
budget is 120 KB and we sit at 32 KB, but a font is a render-blocking request in
a way JS is not. Subset to the characters the piece actually uses — it is ~720
words — and hold FCP under the 2.5s budget the smoke check already enforces.

If no candidate beats the system stack once subsetted and measured, **say so and
keep Georgia.** That is a real possible outcome.

---

### Y2. A measure set in characters — **S**

Move from `34rem` to a `ch`-based measure, target ~66 for body text, and let
each role state its own count: a standfirst can run wider, a caption narrower.

This is the single highest-value change on the page and costs nothing.

---

### Y3. A scale with a reason — **S**

Replace the unrelated `clamp()`s with one ratio and derive every size from it.
Any ratio defensible in a sentence will do; that it is *stated* matters more
than which one.

---

### Y4. Figures, and the rest of the OpenType work — **M**

The piece is full of numbers — 20,426, eight, thirteen, one in eight, 46%. They
are currently whatever the font defaults to.

- **Old-style figures in running prose**, where they belong; they sit in the
  line instead of shouting.
- **Tabular lining figures in the readouts**, which change value in place and
  must not jitter. (`tabular-nums` is already used in places — make it a rule.)
- Ligatures on in text, off in the UI chrome.
- Real italic, once there is one, for the shape names.

---

### Y5. Break paragraphs like TeX — **M**

**The most distinctive thing about LaTeX output**, and the least known. Browsers
break greedily, line by line; TeX minimises badness across the whole paragraph,
which is why its rags look calm and a browser's do not.

`text-wrap: pretty` is the standards-track approximation and costs one
declaration — start there, and measure whether it does anything.

Then the playground part: for the handful of paragraphs that matter most — the
standfirst, the takeaways — try an actual Knuth–Plass pass. It is a
well-specified dynamic program and the piece is short enough to afford it. If it
does not visibly beat `text-wrap: pretty`, **throw it away and record the
result**; a negative finding, measured, is a real outcome.

---

### Y6. Hold the line — **S**

Everything sprint 3 and 7 established: viewports, no-JS, budgets, a11y, and the
screenshot diff — which this time is *expected* to change, so the shots become a
before/after record rather than a pass/fail.

Also: the typography measurement above should become a script, so line length is
checked rather than remembered. That is the same lesson as `--measure`.

## Not in this sprint

Numbered sections, marginal notes, theorem environments, a maths renderer.
[07](07-scope.md) puts equations and notation off the page entirely, and none of
this changes that.

## Definition of done

1. Body text reads at a defensible measure at every width.
2. Every size comes from one stated ratio.
3. Numbers behave: old-style in prose, tabular where they change.
4. A decision on the typeface with the measurement that justifies it — including
   "we kept the system stack".
5. Line length is checked by a script, not remembered.
