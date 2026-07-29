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

import { chromium, webkit, firefox, devices } from 'playwright';
import { createServer } from 'node:http';
import { readFile, readdir, access } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { homedir } from 'node:os';

/**
 * Which engine to drive. WebKit is Safari's, and is the one that matters — the
 * piece arrives by posted link and a large share of those taps are iPhones.
 *   npm run smoke -- --engine=webkit
 */
const ENGINE = (process.argv.find((a) => a.startsWith('--engine=')) ?? '').slice(9) || 'chromium';
const ENGINES = { chromium, webkit, firefox };

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
async function launchBrowser() {
  const engine = ENGINES[ENGINE];
  if (!engine) throw new Error(`unknown engine "${ENGINE}" (chromium | webkit | firefox)`);
  try {
    return await engine.launch();
  } catch (err) {
    if (!/Executable doesn't exist/.test(err.message)) throw err;
    if (ENGINE !== 'chromium') {
      console.error(
        `\n${ENGINE} is not installed. Run:  npx playwright install ${ENGINE}\n` +
          `Until then this engine is UNVERIFIED — see docs/11-sprint-03.md.`,
      );
      throw err;
    }

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
const browser = await launchBrowser();
// devices[] descriptors carry a Chrome user-agent; for other engines take just
// the viewport so the engine reports itself honestly.
const phone = devices['Pixel 7'];
const context = await browser.newContext(
  ENGINE === 'chromium'
    ? { ...phone }
    : { viewport: phone.viewport, deviceScaleFactor: phone.deviceScaleFactor, hasTouch: true, isMobile: true },
);
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

// ── scene 7: the continuum ─────────────────────────────────────────────────
console.log('\nscene "continuum" — behaviour:');
const cont = page.locator('[data-scene="continuum"]');
await cont.scrollIntoViewIfNeeded();
await page.waitForTimeout(700);

const morph = cont.locator('[data-morph]');
const setMorph = async (v) => {
  await morph.evaluate((el, x) => {
    el.value = String(x);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);
  await page.waitForTimeout(220);
};
const readoutOf = () => cont.locator('[data-readout]').textContent().then((t) => t.trim());

await setMorph(0);
if ((await readoutOf()) !== 'the hat') fail(`expected to start on the hat, got "${await readoutOf()}"`);
else pass('starts on the hat');

const atHat = await cont.locator('canvas').screenshot();
await setMorph(1000);
if ((await readoutOf()) !== 'the turtle') fail(`expected the turtle at the far end, got "${await readoutOf()}"`);
else pass('reaches the turtle');

const atTurtle = await cont.locator('canvas').screenshot();
if (Buffer.compare(atHat, atTurtle) === 0) fail('the tiling did not change across the family');
else pass('the tile deforms across the family');

// The view must not re-fit mid-drag: the tiling should deform in place rather
// than appear to swim, or the scene says the wrong thing.
await setMorph(500);
const mid = await cont.locator('canvas').screenshot();
if (Buffer.compare(mid, atHat) === 0 || Buffer.compare(mid, atTurtle) === 0) {
  fail('the midpoint is identical to an end — the slider is not continuous');
} else pass('intermediate shapes exist between the two named ones');

// ── scroll-driven scenes ───────────────────────────────────────────────────
// The screenshot harness once reported "pixel-identical" while being blind to a
// whole failure class by construction. Scroll is exactly such a class: every
// assertion above this line looks at a page standing still.
//
// The last check here is the safety-critical one. A canvas that claims touch
// cannot be pinned at full height without stranding a phone reader, so the
// scroll-driven ones must hand vertical back to the browser. That is not a
// thing to take on trust — it is the failure that traps somebody.
console.log('\nscroll-driven scenes:');

// Two widths, because sprint 11 added a second layout — the beats sit beside
// the figure above 900px — and a check that only ever runs at one width is the
// exact mistake the screenshot harness made with `--measure`.
const SCROLL_WIDTHS = [
  ['phone', 412, 915],
  ['desktop', 1440, 900],
];

/**
 * Minimum share of the canvas width the drawn figure must occupy.
 *
 * This exists because "the figure looks small" was true for a whole sprint and
 * nothing could fail on it. Desktop measured 35% for the continuum and 42% for
 * the hat before the side-by-side layout; the threshold is set below where they
 * now sit so ordinary drift is tolerated and a regression of that size is not.
 */
const MIN_FILL = 62;

for (const [label, vw, vh] of SCROLL_WIDTHS) {
await page.setViewportSize({ width: vw, height: vh });
await page.waitForTimeout(400);
console.log(`\n  at ${label} — ${vw}×${vh}`);

for (const [name, sliderSel, steps] of [
  ['hat', '[data-step]', 4],
  ['hierarchy', '[data-stage]', 5],
  ['continuum', '[data-morph]', null],
]) {
  const result = await page.evaluate(
    async ({ name, sliderSel }) => {
      const section = document.querySelector(`[data-scene="${name}"]`);
      const track = section?.querySelector('[data-track]');
      const stage = section?.querySelector('[data-sticky]');
      const slider = section?.querySelector(sliderSel);
      if (!track || !stage || !slider) return { error: 'markup missing' };
      if (getComputedStyle(stage).position !== 'sticky') return { error: 'stage is not sticky' };

      const top = window.scrollY + track.getBoundingClientRect().top;
      const travel = track.getBoundingClientRect().height - stage.getBoundingClientRect().height;
      if (travel <= 0) return { error: `no travel (${Math.round(travel)}px)` };

      const tops = [];
      const values = [];
      for (let i = 0; i <= 6; i++) {
        // `behavior: instant` matters: the page sets `scroll-behavior: smooth`,
        // so an ordinary scrollTo animates and every sample lands mid-flight.
        window.scrollTo({ top: top + travel * (i / 6), behavior: 'instant' });
        await new Promise((r) => setTimeout(r, 70));
        tops.push(Math.round(stage.getBoundingClientRect().top));
        values.push(Number(slider.value));
      }
      return {
        pinned: new Set(tops.slice(0, 6)).size === 1,
        values,
        lit: section.querySelectorAll('.beat.is-current').length,
        touchAction: getComputedStyle(section.querySelector('canvas')).touchAction,
      };
    },
    { name, sliderSel },
  );

  if (result.error) {
    fail(`${name}: ${result.error}`);
    continue;
  }

  if (!result.pinned) fail(`${name}: the figure does not stay pinned while its track scrolls`);
  else pass(`${name}: the figure pins for the whole travel`);

  const { values } = result;
  const spans = values[0] === 0 && values[values.length - 1] === Number(await page.locator(`[data-scene="${name}"] ${sliderSel}`).getAttribute('max'));
  const monotone = values.every((v, i) => i === 0 || v >= values[i - 1]);
  if (!spans || !monotone) fail(`${name}: scroll does not drive the full range — got [${values}]`);
  else pass(`${name}: scroll drives it end to end [${values}]`);

  if (steps && new Set(values).size > steps) {
    fail(`${name}: ${new Set(values).size} distinct states for ${steps} steps — not snapping`);
  } else if (steps) pass(`${name}: snaps to its ${steps} steps`);

  if (result.lit !== 1) fail(`${name}: ${result.lit} beats lit, expected exactly 1`);
  else pass(`${name}: exactly one beat is current`);

  if (result.touchAction !== 'pan-y') {
    fail(`${name}: canvas touch-action is "${result.touchAction}" — a swipe on it would trap a phone reader`);
  } else pass(`${name}: a vertical swipe on the canvas still scrolls the page`);

  // How much of its own canvas the figure actually uses. Sampled at 75% through
  // the travel, where every scene is showing its fullest state.
  const fill = await page.evaluate(async (name) => {
    const section = document.querySelector(`[data-scene="${name}"]`);
    const canvas = section.querySelector('canvas');
    const { width: W, height: H } = canvas;
    const data = canvas.getContext('2d').getImageData(0, 0, W, H).data;
    const [br, bg, bb] = [data[0], data[1], data[2]];
    let minX = W, maxX = 0;
    for (let y = 0; y < H; y += 2) {
      for (let x = 0; x < W; x += 2) {
        const i = (y * W + x) * 4;
        if (Math.abs(data[i] - br) + Math.abs(data[i + 1] - bg) + Math.abs(data[i + 2] - bb) > 18) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
    }
    return maxX > minX ? Math.round(((maxX - minX) / W) * 100) : 0;
  }, name);

  if (fill < MIN_FILL) fail(`${name}: the figure fills only ${fill}% of its canvas width (min ${MIN_FILL}%)`);
  else pass(`${name}: the figure fills ${fill}% of its canvas width`);
}
}

await page.setViewportSize({ width: 412, height: 915 });
await page.waitForTimeout(300);

// ── the playgrounds are operable without a pointer ─────────────────────────
// `repeat` and `recurrence` set tabindex="0" on their canvases and handled no
// keys at all: a keyboard user tabbed in, got a focus ring, and nothing
// happened. **Focusable with no key handling is worse than not focusable** — it
// advertises an interaction it does not have. So the rule is now binary, and
// this is where it is enforced: operable, or not focusable. No third state.
console.log('\nkeyboard:');

for (const [name, keys] of [
  ['repeat', ['ArrowRight', 'ArrowRight']],
  ['recurrence', ['ArrowRight', 'Enter']],
]) {
  const result = await page.evaluate(
    async ({ name, keys }) => {
      const section = document.querySelector(`[data-scene="${name}"]`);
      const canvas = section.querySelector('canvas');
      canvas.scrollIntoView({ block: 'center', behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 350));
      const state = () => {
        const ctx = canvas.getContext('2d');
        const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let hash = 0;
        for (let i = 0; i < px.length; i += 401) hash = (hash * 31 + px[i]) | 0;
        const read = section.querySelector('[data-readout], [data-meter]');
        return `${hash}|${(read?.textContent ?? '').trim()}`;
      };
      const before = state();
      canvas.focus();
      const focused = document.activeElement === canvas;
      for (const key of keys) {
        canvas.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        await new Promise((r) => setTimeout(r, 200));
      }
      await new Promise((r) => setTimeout(r, 250));
      return { focusable: canvas.tabIndex >= 0, focused, changed: state() !== before };
    },
    { name, keys },
  );

  if (!result.focusable) {
    pass(`${name}: canvas is not focusable, so it promises nothing`);
  } else if (!result.focused) {
    fail(`${name}: canvas has tabindex but will not take focus`);
  } else if (!result.changed) {
    fail(`${name}: canvas is focusable but the keyboard does nothing — it advertises an interaction it does not have`);
  } else {
    pass(`${name}: operable from the keyboard`);
  }
}

// The hands-on scenes were never held to the fill threshold either — they were
// not in sprint 11's scope, and measured 52% and 53% of their canvas width at
// desktop for exactly the same reason /make/ did.
for (const name of ['repeat', 'recurrence']) {
  const fill = await page.evaluate(async (n) => {
    const section = document.querySelector(`[data-scene="${n}"]`);
    section.querySelector('.stage').scrollIntoView({ block: 'center', behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 450));
    const c = section.querySelector('canvas');
    const { width: W, height: H } = c;
    const d = c.getContext('2d').getImageData(0, 0, W, H).data;
    const [br, bg, bb] = [d[0], d[1], d[2]];
    let minX = W, maxX = 0, minY = H, maxY = 0;
    for (let y = 0; y < H; y += 2) {
      for (let x = 0; x < W; x += 2) {
        const i = (y * W + x) * 4;
        if (Math.abs(d[i] - br) + Math.abs(d[i + 1] - bg) + Math.abs(d[i + 2] - bb) > 18) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    return Math.max(((maxX - minX) / W) * 100, ((maxY - minY) / H) * 100);
  }, name);
  if (fill < 80) fail(`${name}: the figure fills only ${Math.round(fill)}% of its canvas`);
  else pass(`${name}: the figure fills ${Math.round(fill)}% of its canvas`);
}

// The hands-on scenes must NOT have been converted: they are capped in height
// and keep their gestures, which is the whole reason they are still hands-on.
for (const name of ['repeat', 'recurrence']) {
  const ta = await page.evaluate(
    (n) => getComputedStyle(document.querySelector(`[data-scene="${n}"] canvas`)).touchAction,
    name,
  );
  if (ta !== 'none') fail(`${name}: touch-action is "${ta}" — it needs drag and pinch`);
  else pass(`${name}: still owns drag and pinch`);
}

// ── budgets ────────────────────────────────────────────────────────────────
// Deliberately not Lighthouse. A score is hard to act on and the tool is heavy
// and flaky in CI; these are the specific things that would actually hurt a
// reader, asserted where they can fail the build. A full Lighthouse audit stays
// a manual step — see docs/11-sprint-03.md.
console.log('\nbudgets:');

const budget = await page.evaluate(() => {
  const paint = performance.getEntriesByType('paint');
  const fcp = paint.find((e) => e.name === 'first-contentful-paint')?.startTime ?? 0;
  const js = performance
    .getEntriesByType('resource')
    .filter((r) => r.name.endsWith('.js'))
    .reduce((n, r) => n + (r.encodedBodySize || r.transferSize || 0), 0);
  return { fcp: Math.round(fcp), js };
});

const FCP_MS = 2500; // docs/06 §6
if (budget.fcp > FCP_MS) fail(`first contentful paint ${budget.fcp}ms > ${FCP_MS}ms`);
else pass(`first contentful paint ${budget.fcp}ms`);

const JS_KB = 120;
const kb = Math.round(budget.js / 1024);
if (kb > JS_KB) fail(`${kb}KB of JavaScript > ${JS_KB}KB budget`);
else pass(`${kb}KB of JavaScript`);

// Every interactive control must have an accessible name. This is the failure
// that quietly makes a page unusable with a screen reader.
const unnamed = await page.evaluate(() =>
  [...document.querySelectorAll('button, input, a')]
    .filter((el) => {
      if (el.hidden || el.closest('[hidden]')) return false;
      const name =
        el.getAttribute('aria-label') ||
        el.textContent?.trim() ||
        (el.labels?.length ? [...el.labels].map((l) => l.textContent).join('') : '') ||
        el.getAttribute('title');
      return !name;
    })
    .map((el) => `${el.tagName.toLowerCase()}${el.type ? `[${el.type}]` : ''}`),
);
if (unnamed.length) fail(`${unnamed.length} control(s) with no accessible name: ${unnamed.join(', ')}`);
else pass('every control has an accessible name');

// The document must be navigable by landmark and heading, not just by eye.
const structure = await page.evaluate(() => ({
  h1: document.querySelectorAll('h1').length,
  h2: document.querySelectorAll('h2').length,
  lang: document.documentElement.lang,
  title: document.title.length,
}));
if (structure.h1 !== 1) fail(`${structure.h1} h1 elements — expected exactly 1`);
else if (!structure.lang) fail('no lang on <html>');
else pass(`document structure: 1 h1, ${structure.h2} h2, lang="${structure.lang}"`);

// ── no JavaScript ──────────────────────────────────────────────────────────
// The prose is the argument and has to survive alone; empty bordered boxes read
// as a broken page rather than a degraded one.
console.log('\nwithout JavaScript:');
const plain = await browser.newContext({
  viewport: phone.viewport,
  javaScriptEnabled: false,
});
const plainPage = await plain.newPage();
await plainPage.goto(`http://localhost:${PORT}${BASE}/`, { waitUntil: 'load' });
await plainPage.waitForTimeout(250);

const visibleStages = await plainPage.$$eval('.stage', (els) =>
  els.filter((e) => e.getBoundingClientRect().height > 2).length);
if (visibleStages) fail(`${visibleStages} empty figure(s) left on the page`);
else pass('empty figures are removed, not left blank');

const proseWords = await plainPage.$$eval(
  '.prose p, .standfirst, .outro p, .takeaway',
  (els) => els.map((e) => e.textContent.trim()).join(' ').split(/\s+/).length,
);
if (proseWords < 400) fail(`only ${proseWords} words survive without JavaScript`);
else pass(`${proseWords} words of prose survive without JavaScript`);
await plain.close();

// ── /make/ — the takeaway ──────────────────────────────────────────────────
// Not part of the piece, but it is the one thing a reader leaves with, and a
// share link that does not reopen the right tiling is worse than no link.
console.log('\nmake:');
// Everything below the functional tests is here because it was NOT here. The
// piece got budget, a11y, fill and trap assertions; `/make/` got "does it
// render" and nothing else — so a green run said nothing about half the
// interactive surface. **A check that runs on one page is lying about the
// others**, and the fact that `/make/` turned out to pass anyway is luck, not
// evidence.
const make = await context.newPage();
const makeProblems = [];
make.on('console', (m) => m.type() === 'error' && makeProblems.push(`console: ${m.text()}`));
make.on('pageerror', (e) => makeProblems.push(`uncaught: ${e.message}`));
await make.goto(`http://localhost:${PORT}${BASE}/make/`, { waitUntil: 'networkidle' });
await make.waitForTimeout(700);

if (makeProblems.length) makeProblems.forEach(fail);
else pass('no console errors or uncaught exceptions');

const madeReadout = () => make.locator('[data-readout]').textContent().then((t) => t.trim());
if (!/tiles/.test(await madeReadout())) fail('nothing rendered');
else pass(`renders (${await madeReadout()})`);

const setRange = async (sel, v) => {
  await make.locator(sel).evaluate((el, x) => {
    el.value = String(x);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);
  await make.waitForTimeout(400);
};
await setRange('[data-level]', 2);
await setRange('[data-shape]', 12);
await make.locator('[data-schemes] button[data-scheme="orientation"]').click();
await make.waitForTimeout(300);
await make.locator('[data-dark]').check();
await make.waitForTimeout(500);

const madeUrl = make.url();
if (!/[?&]d=/.test(madeUrl)) fail('the design is not in the URL');
else pass(`design travels in the URL (${new URL(madeUrl).search})`);

// A share link is only worth having if it reopens the same thing.
const reopened = await context.newPage();
await reopened.goto(madeUrl, { waitUntil: 'networkidle' });
await reopened.waitForTimeout(700);
const same =
  (await reopened.locator('[data-readout]').textContent())?.trim() === (await madeReadout()) &&
  (await reopened.locator('[data-dark]').isChecked()) === true &&
  (await reopened.locator('[data-schemes] button[aria-pressed="true"]').textContent()) === 'rotation';
if (!same) fail('a shared link does not reopen the same tiling');
else pass('a shared link reopens the same tiling');
await reopened.close();

const download = make.waitForEvent('download', { timeout: 9000 }).catch(() => null);
await make.locator('[data-svg]').click();
const file = await download;
if (!file) fail('SVG export produced no download');
else pass(`exports SVG (${file.suggestedFilename()})`);

// Accessible names, computed by the browser rather than by guessing at label
// wiring — the first hand-rolled version of this check reported a false
// positive on a checkbox that was correctly labelled by a wrapping <label>.
{
  const yaml = await make.locator('body').ariaSnapshot();
  const controls = yaml
    .split('\n')
    .map((line) => line.trim().replace(/^- /, ''))
    .filter((line) => /^(checkbox|slider|button|textbox|combobox|link|radio|switch)\b/.test(line));
  const unnamed = controls.filter((line) => !/["\u201c]/.test(line));
  if (!controls.length) fail('no controls found on /make/ — the snapshot is not seeing the page');
  else if (unnamed.length) fail(`/make/: ${unnamed.length} control(s) with no accessible name: ${unnamed.join(', ')}`);
  else pass(`every control on /make/ has an accessible name (${controls.length})`);
}

// The same fill threshold the piece is held to. /make/ measured 61% at desktop
// — a landscape canvas holding a square tiling, the exact defect sprint 11
// fixed on the piece while /make/ sat outside its scope.
{
  // A fresh page at the default design. By this point `make` has had its
  // level, shape and scheme driven all over by the URL round-trip test, and
  // measuring that tells us about a state no reader arrives in.
  const fresh = await context.newPage();
  await fresh.setViewportSize({ width: 1440, height: 900 });
  await fresh.goto(`http://localhost:${PORT}${BASE}/make/`, { waitUntil: 'networkidle' });
  await fresh.waitForTimeout(800);
  const fill = await fresh.evaluate(() => {
    const c = document.querySelector('canvas');
    const { width: W, height: H } = c;
    const d = c.getContext('2d').getImageData(0, 0, W, H).data;
    const [br, bg, bb] = [d[0], d[1], d[2]];
    let minX = W, maxX = 0;
    for (let y = 0; y < H; y += 2) {
      for (let x = 0; x < W; x += 2) {
        const i = (y * W + x) * 4;
        if (Math.abs(d[i] - br) + Math.abs(d[i + 1] - bg) + Math.abs(d[i + 2] - bb) > 18) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
    }
    return maxX > minX ? Math.round(((maxX - minX) / W) * 100) : 0;
  });
  if (fill < MIN_FILL) fail(`/make/: the tiling fills only ${fill}% of its canvas width (min ${MIN_FILL}%)`);
  else pass(`/make/: the tiling fills ${fill}% of its canvas width`);
  await fresh.close();
}

// The trap test, on the page it never ran on. /make/'s canvas takes
// `touch-action: none` on a page barely taller than the viewport, which is
// exactly the geometry that strands a phone reader.
{
  const phone = await context.newPage();
  await phone.setViewportSize({ width: 412, height: 915 });
  await phone.goto(`http://localhost:${PORT}${BASE}/make/`, { waitUntil: 'networkidle' });
  await phone.waitForTimeout(600);
  const room = await phone.evaluate(() => {
    const c = document.querySelector('canvas').getBoundingClientRect();
    return {
      touchAction: getComputedStyle(document.querySelector('canvas')).touchAction,
      canvas: Math.round(c.height),
      viewport: window.innerHeight,
      page: document.documentElement.scrollHeight,
    };
  });
  const share = room.canvas / room.viewport;
  if (room.touchAction === 'none' && share > 0.8) {
    fail(`/make/: the canvas owns touch and covers ${Math.round(share * 100)}% of the viewport — nothing left to scroll with`);
  } else {
    pass(`/make/: ${Math.round(share * 100)}% of the viewport, leaving page to scroll with`);
  }
  await phone.close();
}

// Operable without a pointer, like the scenes in the piece.
{
  const result = await make.evaluate(async () => {
    const c = document.querySelector('canvas');
    const state = () => {
      const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let hash = 0;
      for (let i = 0; i < px.length; i += 401) hash = (hash * 31 + px[i]) | 0;
      return hash;
    };
    const before = state();
    c.focus();
    const focused = document.activeElement === c;
    for (const key of ['ArrowRight', 'ArrowRight', '+']) {
      c.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 150));
    }
    await new Promise((r) => setTimeout(r, 250));
    return { focusable: c.tabIndex >= 0, focused, changed: state() !== before };
  });
  if (!result.focusable) pass('/make/: canvas is not focusable, so it promises nothing');
  else if (!result.changed) fail('/make/: canvas is focusable but the keyboard does nothing');
  else pass('/make/: operable from the keyboard');
}

// A resize must re-frame the picture. The canvas resizes and the view did not,
// so a tiling filling 96% of the width in portrait fell to 44% after a
// rotation and stayed there — a phone turned sideways left the reader looking
// at a small tiling in a large box. Asserted on the dimension that should be
// full: fitting a square into a landscape box is height-limited, and into a
// portrait box is width-limited, so *one* of them must be near full either way.
{
  const rotate = await context.newPage();
  await rotate.setViewportSize({ width: 412, height: 915 });
  await rotate.goto(`http://localhost:${PORT}${BASE}/make/`, { waitUntil: 'networkidle' });
  await rotate.waitForTimeout(700);
  const extent = () =>
    rotate.evaluate(() => {
      const c = document.querySelector('canvas');
      const { width: W, height: H } = c;
      const d = c.getContext('2d').getImageData(0, 0, W, H).data;
      const [br, bg, bb] = [d[0], d[1], d[2]];
      let minX = W, maxX = 0, minY = H, maxY = 0;
      for (let y = 0; y < H; y += 2) {
        for (let x = 0; x < W; x += 2) {
          const i = (y * W + x) * 4;
          if (Math.abs(d[i] - br) + Math.abs(d[i + 1] - bg) + Math.abs(d[i + 2] - bb) > 18) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      return Math.max(((maxX - minX) / W) * 100, ((maxY - minY) / H) * 100);
    });
  const before = await extent();
  await rotate.setViewportSize({ width: 1024, height: 768 });
  await rotate.waitForTimeout(700);
  const after = await extent();
  if (after < 80) fail(`/make/: after a rotation the tiling fills only ${Math.round(after)}% of its box — the view did not re-fit`);
  else pass(`/make/: re-fits on rotation (${Math.round(before)}% → ${Math.round(after)}%)`);
  await rotate.close();
}

// It claims every touch gesture, so it has to say so somewhere.
{
  const tells = await make.evaluate(() => /drag|pinch|zoom|arrow/i.test(document.body.innerText));
  if (!tells) fail('/make/: the canvas owns drag and pinch and the page never mentions either');
  else pass('/make/: the page says what the canvas can do');
}

await make.close();

await browser.close();
server.close();

console.log(failures ? `\nsmoke check FAILED (${failures})` : '\nsmoke check passed');
