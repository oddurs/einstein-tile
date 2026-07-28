/**
 * Browser smoke check for the renderer.
 *
 * Compiling is not evidence that a canvas draws anything. This loads the built
 * page in headless Chromium at a phone viewport and asserts, from actual pixels
 * and actual events:
 *
 *   1. no console errors and no uncaught exceptions
 *   2. the canvas is backed at devicePixelRatio, not CSS size
 *   3. the canvas is not blank, and shows several distinct colours
 *   4. a drag changes what's on screen (panning works)
 *   5. the page itself never scrolls — the tiling swallows the gesture
 *
 * Usage: npm run smoke   (builds first, serves dist, then checks)
 */

import { chromium, devices } from 'playwright';
import { createServer } from 'node:http';
import { readFile, readdir, access } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { homedir } from 'node:os';

const PORT = 4319;
const BASE = '/einstein-tile';
const ROOT = new URL('../dist/', import.meta.url).pathname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
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
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exitCode = 1;
}
function pass(msg) {
  console.log(`✓ ${msg}`);
}

const exists = (p) =>
  access(p).then(
    () => true,
    () => false,
  );

/**
 * Playwright pins one exact Chromium build and refuses to start without it.
 * That couples a smoke check to a multi-hundred-megabyte download, which is a
 * bad trade for "does the canvas draw" — so fall back to any build already in
 * the cache. A one-revision skew does not affect what we assert here.
 */
async function launchChromium() {
  try {
    return await chromium.launch();
  } catch (err) {
    if (!/Executable doesn't exist/.test(err.message)) throw err;

    const cache = join(homedir(), 'Library/Caches/ms-playwright');
    const candidates = [];
    for (const dir of await readdir(cache).catch(() => [])) {
      const rev = Number(dir.split('-').pop());
      if (!Number.isFinite(rev)) continue;
      for (const rel of [
        'chrome-headless-shell-mac-arm64/chrome-headless-shell',
        'chrome-headless-shell-mac-x64/chrome-headless-shell',
        'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
      ]) {
        const p = join(cache, dir, rel);
        if (await exists(p)) candidates.push({ rev, p });
      }
    }
    candidates.sort((a, b) => b.rev - a.rev);

    const best = candidates[0];
    if (!best) {
      console.error('No Chromium available. Run: npx playwright install chromium');
      throw err;
    }
    console.log(`(using cached Chromium build ${best.rev})`);
    return chromium.launch({ executablePath: best.p });
  }
}

const server = await serve();
const browser = await launchChromium();
const context = await browser.newContext({ ...devices['Pixel 7'] });
const page = await context.newPage();

const problems = [];
page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
page.on('pageerror', (e) => problems.push(`uncaught: ${e.message}`));

await page.goto(`http://localhost:${PORT}${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

// 1. clean console
if (problems.length) problems.forEach(fail);
else pass('no console errors or uncaught exceptions');

// 2. backing store honours devicePixelRatio
const sizing = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  const r = c.getBoundingClientRect();
  return { w: c.width, h: c.height, cssW: r.width, cssH: r.height, dpr: devicePixelRatio };
});
const expectedW = Math.round(sizing.cssW * sizing.dpr);
if (Math.abs(sizing.w - expectedW) > 1) {
  fail(`canvas backing ${sizing.w}px, expected ~${expectedW}px (dpr ${sizing.dpr})`);
} else {
  pass(`canvas backed at dpr ${sizing.dpr} (${sizing.w}×${sizing.h} for ${sizing.cssW}×${sizing.cssH} css)`);
}

// 3. actually drew something, in more than one colour
const colours = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  const ctx = c.getContext('2d');
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  const seen = new Set();
  for (let i = 0; i < data.length; i += 4 * 97) {
    seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
  }
  return seen.size;
});
if (colours < 5) fail(`canvas shows only ${colours} distinct colours — probably blank`);
else pass(`canvas rendered (${colours} distinct colours sampled)`);

// 4. dragging pans
const before = await page.locator('canvas').screenshot();
const box = await page.locator('canvas').boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 - 90, box.y + box.height / 2 - 60, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(200);
const after = await page.locator('canvas').screenshot();
if (Buffer.compare(before, after) === 0) fail('drag did not change the canvas — panning is broken');
else pass('drag pans the view');

// 5. the page must not scroll: touch-action must swallow the gesture
const scrolled = await page.evaluate(() => window.scrollY);
if (scrolled !== 0) fail(`page scrolled to ${scrolled} during drag — touch-action is not applied`);
else pass('page did not scroll during drag');

// ── scene 5 — the hierarchy ────────────────────────────────────────────────
console.log('\nscene 5:');
const scene = await context.newPage();
const sceneProblems = [];
scene.on('console', (m) => m.type() === 'error' && sceneProblems.push(`console: ${m.text()}`));
scene.on('pageerror', (e) => sceneProblems.push(`uncaught: ${e.message}`));
await scene.goto(`http://localhost:${PORT}${BASE}/scene-5/`, { waitUntil: 'networkidle' });
await scene.waitForTimeout(600);

if (sceneProblems.length) sceneProblems.forEach(fail);
else pass('no console errors or uncaught exceptions');

const sceneColours = await scene.evaluate(() => {
  const c = document.querySelector('canvas');
  const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  const seen = new Set();
  for (let i = 0; i < data.length; i += 4 * 97) seen.add((data[i] << 16) | (data[i+1] << 8) | data[i+2]);
  return seen.size;
});
if (sceneColours < 3) fail(`scene 5 canvas shows only ${sceneColours} colours — probably blank`);
else pass(`renders (${sceneColours} distinct colours sampled)`);

// the caption is the teaching; it must exist and must change with the stage
const slider = scene.locator('[data-stage]');
const caption = scene.locator('[data-caption]');
const first = (await caption.textContent())?.trim() ?? '';
if (!first) fail('caption is empty at stage 0');
else pass(`stage 0 caption present: "${first.slice(0, 48)}…"`);

const beforePixels = await scene.locator('canvas').screenshot();
await slider.evaluate((el) => {
  el.value = el.max;
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await scene.waitForTimeout(250);
const last = (await caption.textContent())?.trim() ?? '';
const afterPixels = await scene.locator('canvas').screenshot();

if (last === first) fail('caption did not change between the first and last stage');
else pass(`final caption differs: "${last.slice(0, 48)}…"`);
if (Buffer.compare(beforePixels, afterPixels) === 0) fail('grouping did not change the canvas');
else pass('changing stage redraws the grouping');

// zoom must drive the stage too — that is the whole interaction
await slider.evaluate((el) => { el.value = '0'; el.dispatchEvent(new Event('input', { bubbles: true })); });
await scene.waitForTimeout(150);
const box2 = await scene.locator('canvas').boundingBox();
await scene.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
await scene.mouse.down(); await scene.mouse.up();          // hand control back to zoom
const zoomedFrom = (await caption.textContent())?.trim();
for (let i = 0; i < 12; i++) await scene.mouse.wheel(0, 240);   // zoom out
await scene.waitForTimeout(300);
const zoomedTo = (await caption.textContent())?.trim();
if (zoomedTo === zoomedFrom) fail('zooming out did not coarsen the grouping');
else pass('zooming out coarsens the grouping');

await browser.close();
server.close();

console.log(process.exitCode ? '\nsmoke check FAILED' : '\nsmoke check passed');
