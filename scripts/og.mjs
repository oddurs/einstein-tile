/**
 * Generate the share image from the engine.
 *
 * The link is the whole distribution mechanism (docs/06 §3), so the card should
 * be the actual tiling rather than a stock graphic — drawn by the same code that
 * draws the piece, from the same palette, so it cannot drift from what a reader
 * finds when they arrive.
 *
 * Built as SVG in Node and rasterised with Playwright, which is already a dev
 * dependency for the smoke check. The result is committed to `public/`, because
 * GitHub Pages only runs `astro build` and cannot regenerate it.
 *
 * Usage: npm run og
 */

import { chromium } from 'playwright';
import { readdir, access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { buildPatch } from '../src/engine/patch.ts';
import { polygon } from '../src/engine/render.ts';
import { groupByAncestor } from '../src/engine/hull.ts';
import { METATILE, SURFACE } from '../src/renderer/palette.ts';

const W = 1200;
const H = 630;
const LEVEL = 4;
/** Group depth to colour by — deep enough to look intricate, shallow enough to read. */
const DEPTH = 2;

const patch = buildPatch(LEVEL);

// Colour by metatile group, which is the piece's own visual signature and the
// one scheme that shows the hierarchy at a glance.
const colourOf = new Map();
for (const [, tiles] of groupByAncestor(patch.tiles, DEPTH)) {
  const label = tiles[0].path[DEPTH] ?? 'H';
  for (const tile of tiles) colourOf.set(tile, METATILE.light[label]);
}

const polys = patch.tiles.map((t) => ({ pts: polygon(t), fill: colourOf.get(t) }));
const xs = polys.flatMap((p) => p.pts.map((q) => q.x));
const ys = polys.flatMap((p) => p.pts.map((q) => q.y));
const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];

// Fill the card generously and let the tiling bleed off every edge, so it reads
// as a piece of an endless floor rather than as a specimen on a slide.
const scale = Math.max(W / (maxX - minX), H / (maxY - minY)) * 1.5;
const cx = (minX + maxX) / 2;
const cy = (minY + maxY) / 2;
const project = (p) => [
  (W / 2 + (p.x - cx) * scale).toFixed(1),
  (H / 2 - (p.y - cy) * scale).toFixed(1),
];

const shapes = polys
  .map(({ pts, fill }) => {
    const d = pts.map(project).map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('');
    return `<path d="${d}Z" fill="${fill}"/>`;
  })
  .join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${SURFACE.light}"/>
  <g stroke="rgba(26,26,25,0.30)" stroke-width="0.7" stroke-linejoin="round">${shapes}</g>
  <rect width="${W}" height="${H}" fill="url(#veil)"/>
  <defs>
    <linearGradient id="veil" x1="0" y1="0" x2="0.75" y2="0.35">
      <stop offset="0.18" stop-color="${SURFACE.light}" stop-opacity="0.97"/>
      <stop offset="0.72" stop-color="${SURFACE.light}" stop-opacity="0.05"/>
    </linearGradient>
  </defs>
  <text x="72" y="300" font-family="Georgia, 'Times New Roman', serif" font-size="86" fill="#1a1a19">A shape that</text>
  <text x="72" y="392" font-family="Georgia, 'Times New Roman', serif" font-size="86" fill="#1a1a19">never repeats</text>
  <text x="76" y="232" font-family="system-ui, sans-serif" font-size="22" letter-spacing="3.4" fill="rgba(26,26,25,0.55)">THE EINSTEIN TILE</text>
  <text x="76" y="452" font-family="system-ui, sans-serif" font-size="25" fill="rgba(26,26,25,0.62)">One tile. An endless floor. No repeat, ever.</text>
</svg>`;

const exists = (p) => access(p).then(() => true, () => false);
async function launch() {
  try {
    return await chromium.launch();
  } catch (err) {
    if (!/Executable doesn't exist/.test(err.message)) throw err;
    const cache = join(homedir(), 'Library/Caches/ms-playwright');
    const found = [];
    for (const dir of await readdir(cache).catch(() => [])) {
      const p = join(dir, 'chrome-headless-shell-mac-arm64/chrome-headless-shell');
      if (await exists(join(cache, p))) found.push({ rev: Number(dir.split('-').pop()), p: join(cache, p) });
    }
    found.sort((a, b) => b.rev - a.rev);
    if (!found[0]) throw err;
    return chromium.launch({ executablePath: found[0].p });
  }
}

const browser = await launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.setContent(
  `<body style="margin:0">${svg}</body>`,
  { waitUntil: 'load' },
);
await mkdir(new URL('../public/', import.meta.url).pathname, { recursive: true });
const out = new URL('../public/og.png', import.meta.url).pathname;
await page.screenshot({ path: out });
await browser.close();

console.log(`wrote ${out} (${W}x${H}) from ${patch.tiles.length} tiles`);
