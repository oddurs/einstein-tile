/**
 * Measure the typography, rather than remember it.
 *
 * Two numbers, both of which have already been wrong in this project:
 *
 * **Measure**, in characters. Reported as content width over the width of `0`,
 * which is what `ch` means. Counting rendered lines instead — the obvious
 * approach — gives nonsense for short paragraphs, and a fixed `rem` width had
 * silently drifted to 82 characters before anyone measured it.
 *
 * **Rag**: the standard deviation of line lengths within a paragraph, as a
 * percentage of the measure. This is the thing TeX minimises across a whole
 * paragraph and a browser only approximates line by line, so it is the number
 * to watch when arguing about `text-wrap: pretty` or anything beyond it.
 *
 *   npm run type            # report
 *   npm run type -- --strict  # exit non-zero if a measure leaves 45–75
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, readdir, access } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { homedir } from 'node:os';

const PORT = 4392;
const BASE = '/einstein-tile';
const ROOT = new URL('../dist/', import.meta.url).pathname;
const STRICT = process.argv.includes('--strict');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

function serve() {
  const server = createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (path.startsWith(BASE)) path = path.slice(BASE.length);
      if (path.endsWith('/')) path += 'index.html';
      if (path === '') path = '/index.html';
      const file = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ''));
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((r) => server.listen(PORT, () => r(server)));
}

const exists = (p) => access(p).then(() => true, () => false);
async function launch() {
  try {
    return await chromium.launch();
  } catch (err) {
    if (!/Executable doesn't exist/.test(err.message)) throw err;
    const cache = join(homedir(), 'Library/Caches/ms-playwright');
    const found = [];
    for (const dir of await readdir(cache).catch(() => [])) {
      const p = join(cache, dir, 'chrome-headless-shell-mac-arm64/chrome-headless-shell');
      if (await exists(p)) found.push({ rev: Number(dir.split('-').pop()), p });
    }
    found.sort((a, b) => b.rev - a.rev);
    if (!found[0]) throw err;
    return chromium.launch({ executablePath: found[0].p });
  }
}

/** Roles that are running prose, and so have to sit in the comfortable band. */
const PROSE = new Set(['body', 'lead', 'takeaway', 'caption']);
const [MIN, MAX] = [45, 75];

const server = await serve();
const browser = await launch();
let failures = 0;

for (const [label, width] of [
  ['phone', 412],
  ['tablet', 834],
  ['desktop', 1440],
]) {
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}${BASE}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);

  const rows = await page.evaluate(() => {
    const chOf = (el) => {
      const s = document.createElement('span');
      s.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
      s.textContent = '0'.repeat(100);
      const cs = getComputedStyle(el);
      s.style.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}`;
      el.appendChild(s);
      const w = s.getBoundingClientRect().width / 100;
      s.remove();
      return w;
    };

    /**
     * Rag: how uneven the right edge is. Measured from the actual client rects
     * of the text, one per line, ignoring the last line — which is short by
     * design and would swamp the statistic.
     */
    const ragOf = (el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const rects = [...range.getClientRects()].filter((r) => r.width > 1);
      if (rects.length < 3) return null;
      const lines = rects.slice(0, -1).map((r) => r.width);
      const mean = lines.reduce((a, b) => a + b, 0) / lines.length;
      const sd = Math.sqrt(
        lines.reduce((a, b) => a + (b - mean) ** 2, 0) / lines.length,
      );
      return { lines: rects.length, rag: +((sd / mean) * 100).toFixed(1) };
    };

    const pick = (sel, role) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const inner =
        el.getBoundingClientRect().width -
        parseFloat(cs.paddingLeft) -
        parseFloat(cs.paddingRight);
      return {
        role,
        px: +parseFloat(cs.fontSize).toFixed(1),
        lh: +(parseFloat(cs.lineHeight) / parseFloat(cs.fontSize)).toFixed(2),
        measure: Math.round(inner / chOf(el)),
        ...(ragOf(el) ?? {}),
        face: cs.fontFamily.split(',')[0].replace(/["']/g, ''),
      };
    };

    return [
      pick('h1', 'display'),
      pick('.standfirst', 'lead'),
      pick('h2', 'section'),
      pick('.prose p', 'body'),
      pick('.takeaway', 'takeaway'),
      pick('.hud-prompt', 'caption'),
    ].filter(Boolean);
  });

  console.log(`\n${label} — ${width}px`);
  for (const r of rows) {
    const inBand = r.measure >= MIN && r.measure <= MAX;
    const flag = !PROSE.has(r.role) ? '' : inBand ? '  ok' : `  ← ${r.measure > MAX ? 'long' : 'short'}`;
    if (PROSE.has(r.role) && !inBand && width >= 834) failures++;
    console.log(
      `  ${r.role.padEnd(9)} ${String(r.px).padStart(5)}px  lh ${r.lh}  ${String(r.measure).padStart(3)}ch` +
        `${r.rag !== undefined ? `  rag ${String(r.rag).padStart(4)}%` : '          '}${flag}`,
    );
  }
  await context.close();
}

const face = 'STIX Two Text';
console.log(`\nface: ${face} · band ${MIN}–${MAX}ch · rag is line-length spread, lower is calmer`);

await browser.close();
server.close();

if (STRICT && failures) {
  console.error(`\n${failures} prose measure(s) outside ${MIN}–${MAX}ch above phone width`);
  process.exitCode = 1;
}
