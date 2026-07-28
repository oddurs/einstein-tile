/**
 * The type scale and the measure.
 *
 * ## The scale
 *
 * Every size comes from one ratio applied to one base. The ratio here is the
 * **major third, 1.25** — chosen because the piece has few levels (body, lead,
 * two heading sizes, two small sizes) and a larger ratio pulls a display size
 * away from the text too violently on a phone, where the headline already has
 * to survive a 412px column.
 *
 * What matters more than the number is that it is *stated*. Before this the
 * sizes were seven unrelated `clamp()` expressions, which is not a scale but a
 * set of opinions.
 *
 * ## The measure
 *
 * Line length is a count of characters, so it is set in `ch` and the font is
 * left to decide how wide that is. It had been `34rem` — a round CSS number,
 * which measures the wrong thing: change the typeface and a fixed rem width
 * silently becomes a different number of characters.
 *
 * 66 for body text is where a LaTeX book sits, and near the middle of the
 * 45–75 band that reading research keeps landing on. Roles that are not
 * running prose get their own counts: a standfirst can afford to be wider
 * because it is short, a caption should be narrower because it sits beside a
 * figure and is read in glances.
 */

/**
 * The typeface: **Computer Modern**, self-hosted, 21 KB.
 *
 * Knuth drew it for TeX, and it is the reason a LaTeX document is recognisable
 * across a room. That recognition *is* the brief here, and it is why the first
 * attempt failed: STIX Two Text was the defensible choice — commissioned by
 * scientific publishers, excellent on screen — and a reader looked at it and
 * saw nothing had changed. Defensible is not the same as asked for.
 *
 * Shipped as CMU Serif (Computer Modern Unicode), subsetted from 392 KB to
 * **21 KB** — less than half what STIX cost — by keeping only the characters
 * this piece actually sets: Latin, curly quotes, dashes, and a handful of
 * symbols.
 *
 * The known cost is real: Computer Modern's hairlines were drawn for print at
 * high resolution, and it is a lighter colour on screen than a face designed
 * for it. Accepted deliberately. If it proves thin in use, Knuth's *Concrete*
 * — the heavier cut he drew for *Concrete Mathematics* — is the same skeleton
 * with more weight.
 */
export const FACE_STACK = `'CMU Serif', ui-serif, Georgia, 'Times New Roman', serif`;

/**
 * Normalise the fallback's x-height to the webfont's, so the swap does not
 * reflow. The number is STIX's measured x-height per em.
 */
export const FACE_ADJUST = 0.43;

export const fontCSS = (base: string): string =>
  ['roman:normal:400', 'italic:italic:400']
    .map((spec) => {
      const [file, style, weight] = spec.split(':');
      return [
        '@font-face {',
        `    font-family: 'CMU Serif';`,
        `    src: url('${base}/fonts/cmu-serif-${file}.woff2') format('woff2');`,
        `    font-style: ${style};`,
        `    font-weight: ${weight};`,
        // Show the fallback immediately and swap: the text is the content, and
        // nobody should wait on a typeface to start reading.
        `    font-display: swap;`,
        `    unicode-range: U+0000-00FF, U+0131, U+2000-206F, U+2074, U+20AC, U+2122, U+2212;`,
        '  }',
      ].join('\n  ');
    })
    .join('\n  ');

/**
 * Correct Computer Modern's interword space for the web.
 *
 * This is the one thing about CM that reads as wrong on a web page, and it is
 * not a flaw in the face — it is TeX's spacing model arriving without TeX.
 * `cmr10` declares an interword space of **0.333em**, but it also declares
 * 0.167em of stretch and **0.111em of shrink**, and TeX routinely spends that
 * shrink while justifying. The nominal space is a starting point, not the
 * space you actually see in a LaTeX document.
 *
 * A browser setting ragged-right never shrinks anything, so it renders the
 * full 0.333em every time. Measured against the faces this replaced, as a
 * ratio of space to x-height — which is what the eye judges, since a wide
 * space beside a small x-height is what a river is made of:
 *
 * | | space | space ÷ x-height |
 * | --- | --- | --- |
 * | Georgia | 0.241em | 0.501 |
 * | Times New Roman | 0.250em | 0.559 |
 * | **CMU Serif, uncorrected** | 0.333em | **0.773** |
 *
 * Taking 0.09em back lands the space at 0.243em — a ratio of 0.564, within a
 * percent of Times — and stays *inside* the 0.111em that cmr10 itself says is
 * available. So this is not overriding Knuth; it is spending the shrink he
 * budgeted, because the thing that would otherwise spend it is not here.
 */
export const FACE_WORD_SPACING = '-0.09em';

/** Major third. Stated so it can be argued with. */
export const RATIO = 1.25;

/**
 * Body size in rem at the small end and the large end of the viewport.
 *
 * The large end is 1.25rem rather than 1.1875 because Computer Modern's
 * x-height is **0.431em** against STIX's 0.473 — so at an identical specified
 * size it renders about 9% smaller to the eye, and CM was drawn for 10pt on
 * paper besides. Only the large end moves: on a phone the column is bounded by
 * the viewport rather than by `--measure`, so growing the type there would buy
 * optical size by spending characters per line, which is the wrong trade at
 * the width that can least afford it.
 */
const BASE = { min: 1.0625, max: 1.25 } as const;

const step = (n: number, at: number) => at * RATIO ** n;

/**
 * A fluid size, `n` steps from the base.
 *
 * Interpolates between the small-viewport and large-viewport values across the
 * same span for every step, so the whole scale expands together rather than
 * each size having its own private breakpoint behaviour.
 */
export function size(n: number): string {
  const min = step(n, BASE.min);
  const max = step(n, BASE.max);
  // Solve for the vw coefficient across a 400px→1400px span.
  const slope = ((max - min) * 16) / (1400 - 400);
  const intercept = min - (slope * 400) / 16;
  return `clamp(${min.toFixed(4)}rem, ${intercept.toFixed(4)}rem + ${(slope * 100).toFixed(4)}vw, ${max.toFixed(4)}rem)`;
}

/** Line height falls as size rises — large type needs proportionally less. */
export function leading(n: number): number {
  if (n >= 5) return 1.02;
  if (n >= 4) return 1.04;
  if (n >= 3) return 1.1;
  if (n >= 2) return 1.16;
  if (n >= 1) return 1.34;
  if (n <= -1) return 1.5;
  return 1.62;
}

/** Measures, in characters, per role. */
export const MEASURE = {
  /** Running prose. A LaTeX book sits near here. */
  body: 66,
  /** Short and larger, so it can run wider without tiring. */
  lead: 52,
  /** Beside a figure, read in glances. */
  caption: 58,
} as const;

const rule = (name: string, n: number) =>
  `--type-${name}: ${size(n)};\n    --leading-${name}: ${leading(n)};`;

/** The custom properties, ready to inline. */
export const typeCSS = (base = ''): string =>
  [
    fontCSS(base),
    ':root {',
    `    --face: ${FACE_STACK};`,
    `    --face-adjust: ${FACE_ADJUST};`,
    `    --face-word-spacing: ${FACE_WORD_SPACING};`,
    // Step 5, not 4. The piece opens on a headline that has to carry a page,
    // and a major third from body reaches only ~46px — restrained past the
    // point of being quiet. A scale need not use every rung.
    `    ${rule('display', 5)}`,
    `    ${rule('title', 3)}`,
    `    ${rule('section', 2)}`,
    `    ${rule('lead', 1)}`,
    `    ${rule('body', 0)}`,
    `    ${rule('small', -1)}`,
    `    ${rule('fine', -2)}`,
    `    --measure: ${MEASURE.body}ch;`,
    `    --measure-lead: ${MEASURE.lead}ch;`,
    `    --measure-caption: ${MEASURE.caption}ch;`,
    '  }',
  ].join('\n  ');
