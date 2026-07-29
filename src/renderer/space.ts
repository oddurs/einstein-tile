/**
 * Space, radius and motion — decided, rather than accumulated.
 *
 * Sprint 8 gave type a ratio. Sprint 12 gave colour semantic roles and a test
 * that fails when a scene invents one. Everything *between* the type and the
 * colour was still whatever each rule needed on the day it was written:
 *
 * | | the piece | the sandbox |
 * | --- | --- | --- |
 * | distinct spacing values | **24** | **12 more**, a different set |
 * | card radius | 16px | **14px** |
 * | transition durations | 240ms, 400ms, 90ms | none at all |
 *
 * Twenty-four values across `rem`, `px`, `vh` and `dvh` with no relationship
 * between them, and two pages that had quietly disagreed about how round a card
 * is. None of it is visible on its own. Together it is the difference between a
 * page that was designed and a page that was assembled.
 *
 * ## The scale
 *
 * A **1.5 ratio from 0.5rem**, exactly — every step is the one before it times
 * the ratio, with no rounding anywhere.
 *
 * The first draft rounded the top two steps to 2.5 and 3.75 because they are
 * numbers a person would type, and `test/space.test.ts` failed: 2.5 ÷ 1.6875 is
 * **1.481**, so the scale did not actually follow the ratio it claimed. Nobody
 * types these — `spaceCSS()` emits them — so the rounding bought nothing and
 * cost the one property worth asserting. Six steps is enough: measured, the two
 * pages between them used 36 values to express about six distinct intentions.
 *
 * `flow` is the exception and is deliberately not on the scale — it is the gap
 * between a paragraph and the next, which belongs to the *type*, not to the
 * spacing system, and is therefore expressed in `em` so it tracks the text it
 * separates.
 */

/** The ratio. Stated so it can be argued with, like `RATIO` in `type.ts`. */
export const SPACE_RATIO = 1.5;

/**
 * Six steps, in rem.
 *
 * Named for what they separate rather than by number, because `--space-3` tells
 * you nothing at the call site and `--space-gutter` tells you everything.
 */
export const SPACE = {
  /** Inside a control, around a label. */
  tight: 0.5,
  /** Between related controls in a row. */
  snug: 0.75,
  /** Inside a panel; between a figure and its caption. */
  cosy: 1.125,
  /** Between blocks in a column. */
  gutter: 1.6875,
  /** Between a figure and the prose around it. */
  section: 2.53125,
  /** Between one scene and the next. */
  chapter: 3.796875,
} as const;

/**
 * Corner radii.
 *
 * Three, and they nest: a control inside a panel must be *less* round than the
 * panel, or the curves fight. The two pages had 16px and 14px for the same
 * card, which is not a design decision, it is a typo with a long life.
 */
export const RADIUS = {
  /** Buttons, inputs, small chips. */
  control: 9,
  /** Cards, stages, panels. */
  panel: 15,
  /** Pills and tracks. */
  full: 999,
} as const;

/**
 * Motion.
 *
 * Two durations, because the piece only ever does two things: acknowledge an
 * input, and change what is on screen. And one easing curve — a gentle
 * ease-out, since everything here is a thing arriving rather than leaving.
 *
 * Every one of these is overridden to `none` under `prefers-reduced-motion`, in
 * one place, so a new transition cannot forget to honour it.
 */
export const MOTION = {
  /** A control responding to a press or a hover. */
  quick: 120,
  /** Content changing: a beat cross-fading, a cue leaving. */
  settle: 260,
  /** Curve. Things arrive. */
  ease: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
} as const;

const rem = (n: number) => `${Number(n.toFixed(4))}rem`;

/** The custom properties, ready to inline. */
export const spaceCSS = (): string =>
  [
    ...Object.entries(SPACE).map(([name, value]) => `--space-${name}: ${rem(value)};`),
    ...Object.entries(RADIUS).map(([name, value]) => `--radius-${name}: ${value}px;`),
    `--motion-quick: ${MOTION.quick}ms;`,
    `--motion-settle: ${MOTION.settle}ms;`,
    `--motion-ease: ${MOTION.ease};`,
    // The gap between paragraphs belongs to the type, so it is set in `em` and
    // tracks whatever size the text is.
    `--flow: 1.1em;`,
  ].join('\n    ');
