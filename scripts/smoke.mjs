/**
 * Browser smoke check.
 *
 * Compiling is not evidence that a canvas draws anything, so this loads the
 * built site in headless Chromium at a phone viewport and asserts from real
 * pixels and real events. It tests **the narrative page** — the actual product
 * — rather than the scenes in isolation.
 *
 * Usage: npm run smoke   (builds first, serves dist, then checks)
 * Browsers, once: npx playwright install chromium
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
  '.png': 'image/png',
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

let failures = 0;
const fail = (msg) => {
  console.error(`  ✗ ${msg}`);
  failures++;
  process.exitCode = 1;
};
const pass = (msg) => console.log(`  ✓ ${msg}`);

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
await page.waitForTimeout(700);

// ── the page itself ────────────────────────────────────────────────────────
console.log('\nthe page:');
if (problems.length) problems.forEach(fail);
else pass('no console errors or uncaught exceptions');

const heading = (await page.locator('h1').first().textContent())?.trim();
if (!heading) fail('no h1');
else pass(`titled "${heading}"`);

// Every scene that carries meaning must carry it in text as well as in pixels.
// `data-decorative` marks the ones that do not — the hook is aria-hidden
// ornament, and demanding a text alternative for it would be cargo-culting.
const takeaways = await page.locator('.takeaway').count();
const contentScenes = await page.locator('[data-scene]:not([data-decorative])').count();
const decorative = await page.locator('[data-scene][data-decorative]').count();
if (takeaways < contentScenes) {
  fail(`${contentScenes} content scenes but only ${takeaways} takeaways`);
} else {
  pass(`${contentScenes} content scenes each with a takeaway (+${decorative} decorative)`);
}

if (await page.locator('a[href*="preview"]').count()) fail('the dev harness is linked from the piece');
else pass('no developer surface linked from the piece');

// ── each scene renders where it sits ───────────────────────────────────────
for (const name of ['repeat', 'hierarchy']) {
  console.log(`\nscene "${name}":`);
  const section = page.locator(`[data-scene="${name}"]`);
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);

  const sizing = await section.locator('canvas').evaluate((c) => ({
    w: c.width,
    cssW: c.getBoundingClientRect().width,
    dpr: devicePixelRatio,
  }));
  if (Math.abs(sizing.w - Math.round(sizing.cssW * sizing.dpr)) > 1) {
    fail(`canvas not backed at dpr (${sizing.w} vs ${sizing.cssW}x${sizing.dpr})`);
  } else pass(`canvas backed at dpr ${sizing.dpr}`);

  const colours = await section.locator('canvas').evaluate((c) => {
    const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    const seen = new Set();
    for (let i = 0; i < data.length; i += 4 * 97) {
      seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
    }
    return seen.size;
  });
  if (colours < 5) fail(`shows only ${colours} colours — probably blank`);
  else pass(`renders (${colours} colours sampled)`);
}

// ── scene 3: the definition, made testable ─────────────────────────────────
console.log('\nscene "repeat" — behaviour:');
const repeat = page.locator('[data-scene="repeat"]');
await repeat.scrollIntoViewIfNeeded();
await page.waitForTimeout(400);

const meterText = () => repeat.locator('[data-meter]').textContent().then((t) => t.trim());
const promptText = () => repeat.locator('[data-prompt]').textContent().then((t) => t.trim());
// Recompute the box every time: the canvas moves when the act changes and when
// the page reflows, and a stale centre silently drags from the wrong place.
const drag = async (dx, dy) => {
  // Bring it on screen first: a canvas scrolled out of the viewport gives
  // negative coordinates that the mouse simply cannot reach, and the drag
  // silently does nothing.
  await repeat.locator('canvas').scrollIntoViewIfNeeded();
  await page.waitForTimeout(80);
  const box = await repeat.locator('canvas').boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(110);
};

if ((await meterText()).includes('every tile')) {
  fail('opens already aligned — the identity slide is not a slide');
} else pass(`opens unaligned (${await meterText()})`);

if (!(await repeat.locator('[data-next]').isHidden())) {
  fail('the second act is offered before the first is done');
} else pass('the second act stays hidden until the floor clicks');

let clicked = false;
for (const [dx, dy] of [[25, 10], [35, -18], [-22, 28], [45, 15], [12, 40]]) {
  await drag(dx, dy);
  if ((await meterText()).includes('every tile')) { clicked = true; break; }
}
if (!clicked) fail('the hexagon floor never clicked — the control condition is broken');
else pass('hexagon floor clicks into alignment');

await repeat.locator('[data-next]').click();
await page.waitForTimeout(500);

// Prove dragging moves the copy at all...
const beforeDrag = await meterText();
await drag(60, 25);
if ((await meterText()) === beforeDrag) fail('dragging did not change the slide');
else pass('dragging slides the copy');

// ...then step the candidate slides deterministically. Driving this by drag
// geometry made the check fragile — the number of *distinct* slides a fixed
// pixel path visits shifts whenever page height changes, so an unrelated CSS
// fix could turn it red. The nudge button steps one candidate at a time by
// construction, and exercises the keyboard route while it is at it.
let everPerfect = false;
for (let i = 0; i < 10; i++) {
  await repeat.locator('[data-nudge]').click();
  await page.waitForTimeout(70);
  if ((await meterText()).includes('every tile')) everPerfect = true;
}
if (everPerfect) fail('the hat tiling reported a perfect slide — that would be false');
else pass(`hat tiling never aligns (${await meterText()})`);

if (!(await promptText()).startsWith('None of them work')) fail('the conclusion never appeared');
else pass('states the conclusion once the reader has hunted');

// ── scene 5: the hierarchy ─────────────────────────────────────────────────
console.log('\nscene "hierarchy" — behaviour:');
const hier = page.locator('[data-scene="hierarchy"]');
await hier.scrollIntoViewIfNeeded();
await page.waitForTimeout(600);

const captionText = () => hier.locator('[data-caption]').textContent().then((t) => t.trim());
const firstCaption = await captionText();
if (!firstCaption) fail('caption empty at the first stage');
else pass(`first caption: "${firstCaption.slice(0, 44)}…"`);

const beforePix = await hier.locator('canvas').screenshot();
await hier.locator('[data-stage]').evaluate((el) => {
  el.value = el.max;
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(300);
const lastCaption = await captionText();
const afterPix = await hier.locator('canvas').screenshot();

if (lastCaption === firstCaption) fail('caption did not change across stages');
else pass(`last caption: "${lastCaption.slice(0, 44)}…"`);
if (Buffer.compare(beforePix, afterPix) === 0) fail('the grouping did not redraw');
else pass('changing stage redraws the grouping');

await browser.close();
server.close();

console.log(failures ? `\nsmoke check FAILED (${failures})` : '\nsmoke check passed');
