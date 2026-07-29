# 23 — Sprint 14

## Theme: the space between things was never decided

> **Sprint 8 gave type a ratio. Sprint 12 gave colour roles and a test. Everything
> in between was still whatever each rule needed on the day it was written.**

## Measured before planning

| | the piece | the sandbox |
| --- | --- | --- |
| distinct spacing values | **24** | **12 more**, a different set |
| card radius | 16px | **14px** |
| transition durations | 240ms, 400ms, 90ms | **none at all** |

Twenty-four values across `rem`, `px`, `vh` and `dvh` with no relationship
between them; two pages that had quietly disagreed about how round a card is;
three transition durations with no curve in common. None of it is visible on its
own. Together it is the difference between a page that was designed and a page
that was assembled.

This is the same finding as sprint 12's four greys, one layer up — and the same
cause. Nothing was wrong. Nothing had been *decided*.

## What shipped

### A scale, in `src/renderer/space.ts`

**1.5 from 0.5rem, exactly.** Six steps, named for what they separate rather
than numbered, because `--space-3` tells you nothing at the call site and
`--space-gutter` tells you everything: `tight`, `snug`, `cosy`, `gutter`,
`section`, `chapter`.

Three radii that **nest** — a control inside a panel must be less round than the
panel, or the curves fight. Two durations and one easing curve, because the piece
only ever does two things: acknowledge an input, and change what is on screen.

`--flow`, the gap between paragraphs, is deliberately **not** on the scale. It
belongs to the type rather than to the layout, so it is set in `em` and tracks
whatever size the text is.

### The test caught my own scale

The first draft rounded the top two steps to 2.5 and 3.75, "numbers a person
would type" — and `test/space.test.ts` failed immediately: **2.5 ÷ 1.6875 =
1.481**, so the scale did not follow the ratio it claimed in its own
documentation. Nobody types those values, `spaceCSS()` emits them, so the
rounding bought nothing and cost the one property worth asserting. Now exact.

That is the second sprint running where the check written to police the codebase
caught the author instead.

### Two regressions surfaced, one of them mine from last sprint

**`npm run type` was a script nobody ran.** Sprint 13 moved the HUD into a side
panel at desktop, which took the prompt's measure from 58ch to **32ch** — well
outside the 45–75 band that script exists to enforce — and every check stayed
green for a whole sprint. Fixed by widening the panel to 27rem *and* setting the
panel prompt one step down (49ch, in band). **`scripts/verify.sh` now runs
`type --strict`**, so it cannot happen again.

The prompt is set smaller; the takeaway never is. Sprint 8 settled that: the
takeaway carries the scene and is de-emphasised by colour and rule, never by
shrinking. A HUD prompt beside a figure is chrome, and chrome may shrink.

**The two pages disagreed about corner radius** — 16px and 14px for the same
card. That is not a design decision, it is a typo with a long life.

### The result should be almost invisible, and is

Replacing 36 values could have restructured every page. Measured, full-page
heights moved by:

| | before | after | |
| --- | --- | --- | --- |
| piece, phone | 13767px | 13728px | **−0.3%** |
| piece, desktop | 13531px | 13510px | −0.2% |
| /make/, phone | 1062px | 1045px | −1.6% |
| /make/, desktop | 1158px | 1141px | −1.5% |

The scale absorbed the accidents without a redesign, which is exactly what
adopting a system should feel like.

## What holds it

`test/space.test.ts`, the ink test's twin: **no page may set spacing, radius or a
transition duration directly.** Viewport units, `calc`, `env` and 1px hairlines
are exempt, because they are doing different jobs. Proven to fail — a stray
`gap: 13px` reds the build.

It also asserts the scale's own properties: ordered, no repeats, follows the
stated ratio, radii nest, quick before settle.

## Not in this sprint

No new visual language. This is the same design, expressed in values that were
chosen rather than accumulated — the point was never to make it look different.

## Definition of done

1. No page sets spacing, radius or motion directly. Asserted, and the assertion
   fails when broken.
2. The scale follows its stated ratio, exactly.
3. Both pages agree on radius.
4. Typography is measured by `verify`, not by remembering to run a script.
5. Page geometry is within a couple of percent of before.
