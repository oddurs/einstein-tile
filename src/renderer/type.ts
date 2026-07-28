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
 * The typeface.
 *
 * **STIX Two Text**, self-hosted. STIX is the Scientific and Technical
 * Information eXchange — the family commissioned by scientific publishers so
 * that text and mathematics could be set together, which makes it the honest
 * choice for a piece that takes its cue from LaTeX.
 *
 * It was chosen by looking at real sentences at real sizes, and then checked:
 *
 * - **x-height 0.473em against Georgia's 0.4814** — within 2%, so no size
 *   compensation is needed and the swap from the fallback is nearly invisible.
 * - **Its `0` is 24% narrower than Georgia's**, which would have silently
 *   widened every line by a dozen characters had the measure still been set in
 *   `rem`. Because it is set in `ch`, the column simply narrows and the line
 *   length stays where it was put. That is the argument for `ch` in one number.
 *
 * Two faces only, regular and italic — 46 KB. There is no bold: the piece used
 * it twice, both times to name a thing for the first time, which is what italic
 * is for.
 */
export const FACE_STACK = `'STIX Two Text', ui-serif, Georgia, 'Times New Roman', serif`;

/**
 * Normalise the fallback's x-height to the webfont's, so the swap does not
 * reflow. The number is STIX's measured x-height per em.
 */
export const FACE_ADJUST = 0.473;

export const fontCSS = (base: string): string =>
  ['regular:normal:400', 'italic:italic:400']
    .map((spec) => {
      const [file, style, weight] = spec.split(':');
      return [
        '@font-face {',
        `    font-family: 'STIX Two Text';`,
        `    src: url('${base}/fonts/stix-${file}.woff2') format('woff2');`,
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

/** Major third. Stated so it can be argued with. */
export const RATIO = 1.25;

/** Body size in rem at the small end and the large end of the viewport. */
const BASE = { min: 1.0625, max: 1.1875 } as const;

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
