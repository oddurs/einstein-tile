/**
 * Colour-vision-deficiency simulation and OKLab distance.
 *
 * Ported from the data-viz skill's `validate_palette.js` so the palette gate
 * runs in **our** CI rather than only in someone's shell. The maths must stay
 * faithful to that source: the ΔE thresholds are calibrated to the
 * Machado–Oliveira–Fernandes (2009) severity-1.0 model specifically, and
 * swapping the simulation model would move borderline pairs and invalidate
 * them.
 *
 * ΔE is Euclidean distance in OKLab, ×100.
 */

export type CvdKind = 'protan' | 'deutan' | 'tritan';

/** Machado, Oliveira & Fernandes (2009), severity 1.0, in linear RGB. */
const MACHADO: Record<CvdKind, number[][]> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

function hexToSrgb(hex: string): [number, number, number] {
  const h = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`not a 6-digit hex colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
}

const toLinear = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

const linear = (hex: string): [number, number, number] =>
  hexToSrgb(hex).map(toLinear) as [number, number, number];

function oklabFromLinear([r, g, b]: [number, number, number]): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function simulate(hex: string, kind: CvdKind): [number, number, number] {
  const [r, g, b] = linear(hex);
  const M = MACHADO[kind];
  const clamp = (c: number) => Math.max(0, Math.min(1, c));
  return [
    clamp(M[0]![0]! * r + M[0]![1]! * g + M[0]![2]! * b),
    clamp(M[1]![0]! * r + M[1]![1]! * g + M[1]![2]! * b),
    clamp(M[2]![0]! * r + M[2]![1]! * g + M[2]![2]! * b),
  ];
}

/** OKLab ΔE ×100. Omit `kind` for unsimulated (normal) vision. */
export function deltaE(a: string, b: string, kind?: CvdKind): number {
  const x = oklabFromLinear(kind ? simulate(a, kind) : linear(a));
  const y = oklabFromLinear(kind ? simulate(b, kind) : linear(b));
  return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/** OKLCH lightness and chroma. */
export function oklch(hex: string): { L: number; C: number } {
  const [L, a, b] = oklabFromLinear(linear(hex));
  return { L, C: Math.hypot(a, b) };
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = linear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Worst ΔE over every pair, minimised across protanopia and deuteranopia. */
export function worstCvdPair(palette: readonly string[]): {
  deltaE: number;
  pair: [string, string];
  kind: CvdKind;
} {
  let worst = { deltaE: Infinity, pair: ['', ''] as [string, string], kind: 'protan' as CvdKind };
  for (let i = 0; i < palette.length; i++) {
    for (let j = i + 1; j < palette.length; j++) {
      for (const kind of ['protan', 'deutan'] as const) {
        const d = deltaE(palette[i]!, palette[j]!, kind);
        if (d < worst.deltaE) worst = { deltaE: d, pair: [palette[i]!, palette[j]!], kind };
      }
    }
  }
  return worst;
}

/** Worst ΔE over every pair under normal vision. */
export function worstNormalPair(palette: readonly string[]): {
  deltaE: number;
  pair: [string, string];
} {
  let worst = { deltaE: Infinity, pair: ['', ''] as [string, string] };
  for (let i = 0; i < palette.length; i++) {
    for (let j = i + 1; j < palette.length; j++) {
      const d = deltaE(palette[i]!, palette[j]!);
      if (d < worst.deltaE) worst = { deltaE: d, pair: [palette[i]!, palette[j]!] };
    }
  }
  return worst;
}
