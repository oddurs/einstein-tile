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

### Y1. A typeface in the lineage — **M** — ✅ done, after being got wrong once

**Computer Modern** (CMU Serif), self-hosted, **21 KB** in two Latin subsets.

#### The first answer was defensible and still wrong

Y1 originally shipped **STIX Two Text**, for the reasons recorded below: a face
scientific publishers commissioned, sturdy on screen, x-height within 2% of
Georgia's. The brief was "inspired by LaTeX", and STIX satisfies a reading of it.

The reader looked at the result and said *I don't see anything having changed* —
which was correct, and was the point. The face was deployed and serving; it just
did not **look like LaTeX**, because looking like LaTeX means Computer Modern and
nothing else. I had optimised for the choice I could defend in a paragraph over
the one that was asked for. The lesson generalises past typography: when a brief
names a recognisable thing, recognisability *is* a requirement, not a preference
to be traded against screen performance.

Computer Modern's known cost — hairlines drawn for print, a lighter colour on
screen — is real and was accepted deliberately.

Subsetted 392 KB → **21 KB**, less than half what STIX cost, and FCP is
unchanged at 20 ms.

#### The correction it needed

CM read as loose on the page, and the reader named it before I did: *the kerning
and the size of spaces feels slightly out of whack*. Kerning was fine — 265 pairs
survived the subset, and `AV` kerns −0.111em against Times' −0.129. The spaces
were not:

| | space | space ÷ x-height |
| --- | --- | --- |
| Georgia | 0.241em | 0.501 |
| Times New Roman | 0.250em | 0.559 |
| **CMU Serif, uncorrected** | 0.333em | **0.773** |

This is not a flaw in the face. It is **TeX's spacing model arriving without
TeX**: `cmr10` declares 0.333em of interword space *plus 0.111em of shrink*, and
TeX spends that shrink routinely while justifying. A browser setting ragged-right
never spends it. `word-spacing: -0.09em` lands the space at 0.243em — Times'
ratio to within a percent, and inside the shrink cmr10 itself budgets.

A second, compounding effect: CM's x-height is **0.431em** against STIX's 0.473,
so `font-size-adjust` dropping from 0.473 to 0.43 made the text render 9% smaller
to the eye at an unchanged specified size. The large end of the scale went
1.1875 → 1.25rem to take it back. **Only the large end**: on a phone the column is
bounded by the viewport rather than by `--measure`, so bigger type there buys
optical size by spending characters per line, at the width that can least afford
it. Phone holds at 44ch; desktop body is 20px at exactly 66ch.

*The original ticket's resolution, kept because the measurements are still the
argument for how the choice was made:*

**STIX Two Text**, self-hosted, 46 KB in two Latin subsets.

Chosen by looking at real sentences at real sizes — a specimen of all four
candidates against Georgia — and then checked with numbers:

| | x-height | `0` width |
| --- | --- | --- |
| Georgia (incumbent) | 0.4814em | 0.6138em |
| **STIX Two Text** | 0.473em | 0.495em |
| Newsreader | 0.512em | 0.600em |
| Source Serif 4 | 0.452em | 0.470em |

STIX is what scientific publishers commissioned so text and mathematics could
be set together, which makes it the honest answer to "inspired by LaTeX". Its
x-height lands within **2%** of Georgia's, so no size compensation was needed
and the fallback swap barely moves.

**Its `0` is 24% narrower than Georgia's** — which is the whole argument for Y2
in one number. Had the measure still been `34rem`, this change would have
silently widened every line by about a dozen characters. Because it is set in
`ch`, the column narrowed and the line length stayed exactly where it was put.

Cost: **FCP 20 ms**, unchanged, because `font-display: swap` never blocks.

**No bold.** The piece used it twice, both times naming a thing for the first
time — which is what italic is for, and what LaTeX's `\emph` does. Dropping the
face saved 28 KB and improved the typography.

*Original ticket text:*

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

### Y2. A measure set in characters — **S** — ✅ done

66ch body, 52ch lead, 58ch caption — hit exactly at tablet and desktop. Phone
reads 44ch, up from 36, purely because the new face is narrower.

The unit change is the point: line length is a count of characters, so a
typeface change should move the *column width*, not the *line length*. It did.

*Original ticket text:*

Move from `34rem` to a `ch`-based measure, target ~66 for body text, and let
each role state its own count: a standfirst can run wider, a caption narrower.

This is the single highest-value change on the page and costs nothing.

---

### Y3. A scale with a reason — **S** — ✅ done

Major third (1.25) from a fluid base, in `src/renderer/type.ts`. Seven unrelated
`clamp()`s became one ratio and one span.

Two departures, both stated in the source: the display size takes step **5**
rather than 4, because a major third from body reaches only ~46px and the piece
opens on a headline that has to carry a page. And the takeaway is set at **body
size, not small** — it carries each scene's argument and is all a reader without
JavaScript gets, so it is de-emphasised by colour and rule, never by shrinking.

*Original ticket text:*

Replace the unrelated `clamp()`s with one ratio and derive every size from it.
Any ratio defensible in a sentence will do; that it is *stated* matters more
than which one.

---

### Y4. Figures, and the rest of the OpenType work — **M** — ✅ done

Old-style proportional figures in running prose; tabular lining figures in the
readouts, which change value in place and must not jitter; ligatures and kerning
on in text.

Georgia happened to default to old-style figures, so this looked right before it
was specified. Stating it is what makes it survive the typeface change — and
STIX does *not* default to them.

*Original ticket text:*

The piece is full of numbers — 20,426, eight, thirteen, one in eight, 46%. They
are currently whatever the font defaults to.

- **Old-style figures in running prose**, where they belong; they sit in the
  line instead of shouting.
- **Tabular lining figures in the readouts**, which change value in place and
  must not jitter. (`tabular-nums` is already used in places — make it a rule.)
- Ligatures on in text, off in the UI chrome.
- Real italic, once there is one, for the shape names.

---

### Y5. Break paragraphs like TeX — **M** — ◐ measured, and **not built**

`text-wrap: pretty` is applied. The Knuth–Plass implementation is not, and the
measurement is why.

`scripts/type.mjs` reports **rag** — the standard deviation of line lengths as a
percentage of the measure, which is precisely the quantity TeX minimises.
Measured across the twelve prose paragraphs at desktop:

| | mean rag |
| --- | --- |
| `text-wrap: pretty` | **2.48%** |
| `text-wrap: auto` | 2.51% |

The line breaks genuinely differ, so `pretty` is doing something — it is just
worth 0.03 points. And the total spread is 2.5%, so a whole-paragraph optimiser
is competing for a fraction of an already-tiny number.

**Why TeX's advantage mostly evaporates here:** it is largest in *justified* text
at *narrow* measures, where a bad break forces visibly ugly word spacing. This
is ragged-right at 66 characters — the easy case, where greedy breaking is
close to optimal already.

A negative result, measured rather than assumed, and cheaper than the dynamic
program would have been.

*Original ticket text:*

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

### Y6. Hold the line — **S** — ✅ done

`npm run type` reports measure, size, leading and rag at three widths, with
`--strict` failing if prose leaves the 45–75ch band above phone size. Line
length is now checked rather than remembered — which is the same lesson
`--measure` taught by going missing.

The token test also had to be relaxed: it asserted on `rootCSS()` exactly, and
pages now pass a base path so the `@font-face` URLs resolve. It was matching a
spelling rather than the call.

*Original ticket text:*

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
