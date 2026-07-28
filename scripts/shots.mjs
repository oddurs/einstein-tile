/**
 * Screenshot every surface, for before/after comparison.
 *
 * A refactor's entire claim is that behaviour did not change. This exists so
 * that claim can be demonstrated rather than asserted:
 *
 *   npm run shots -- --out before      # then refactor
 *   npm run shots -- --out after --diff before
 *
 * Scenes are captured at a fixed state — not their idle state — because several
 * of them only render anything interesting once a control has moved, and a
 * refactor that broke the *response* to a control while leaving the first frame
 * intact would otherwise slip through.
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, readdir, access, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

const PORT = 4390;
const BASE = '/einstein-tile';
const ROOT = new URL('../dist/', import.meta.url).pathname;
const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const OUT = arg('out', 'shots');
const DIFF = arg('diff', null);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
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

/** Each shot: where to go, and how to put it in a known state. */
const SHOTS = [
  { name: 'lede', path: '/', prepare: async () => {} },
  {
    name: 'hat',
    path: '/',
    scene: 'hat',
    prepare: async (page, sec) => setRange(page, sec, '[data-step]', 3),
  },
  {
    name: 'repeat-hex',
    path: '/',
    scene: 'repeat',
    prepare: async (page, sec) => {
      for (let i = 0; i < 4; i++) await nudge(page, sec, '[data-nudge]');
    },
  },
  {
    name: 'recurrence',
    path: '/',
    scene: 'recurrence',
    prepare: async (page, sec) => nudge(page, sec, '[data-pick]'),
  },
  {
    name: 'hierarchy',
    path: '/',
    scene: 'hierarchy',
    prepare: async (page, sec) => setRange(page, sec, '[data-stage]', 3),
  },
  {
    name: 'continuum',
    path: '/',
    scene: 'continuum',
    prepare: async (page, sec) => setRange(page, sec, '[data-morph]', 600),
  },
  { name: 'make', path: '/make/?d=3.50.metatile', prepare: async () => {} },
];

async function setRange(page, scope, sel, value) {
  const el = scope ? scope.locator(sel) : page.locator(sel);
  await el.evaluate((node, v) => {
    node.value = String(v);
    node.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  await page.waitForTimeout(400);
}
async function nudge(page, scope, sel) {
  await (scope ? scope.locator(sel) : page.locator(sel)).click();
  await page.waitForTimeout(300);
}

const server = await serve();
const browser = await launch();
const context = await browser.newContext({
  viewport: { width: 412, height: 839 },
  deviceScaleFactor: 2,
  // Without this the lede is not reproducible: the hook animates over ~2.6s, so
  // the shot depends on when it was taken and two identical runs disagree. Under
  // reduced motion the patch renders complete and instantly — which makes the
  // comparison meaningful and exercises that path at the same time.
  reducedMotion: 'reduce',
});

const dir = new URL(`../.shots/${OUT}/`, import.meta.url).pathname;
await mkdir(dir, { recursive: true });
const hashes = {};

for (const shot of SHOTS) {
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}${BASE}${shot.path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  const scope = shot.scene ? page.locator(`[data-scene="${shot.scene}"]`) : null;
  if (scope) {
    await scope.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
  }
  await shot.prepare(page, scope);

  const target = scope ?? page;
  const buffer = await target.screenshot();
  await writeFile(join(dir, `${shot.name}.png`), buffer);
  hashes[shot.name] = createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  await page.close();
}

await writeFile(join(dir, 'hashes.json'), `${JSON.stringify(hashes, null, 2)}\n`);
await browser.close();
server.close();

if (!DIFF) {
  console.log(`captured ${SHOTS.length} shots → .shots/${OUT}/`);
  for (const [k, v] of Object.entries(hashes)) console.log(`  ${k.padEnd(14)} ${v}`);
} else {
  const prior = JSON.parse(
    await readFile(new URL(`../.shots/${DIFF}/hashes.json`, import.meta.url).pathname, 'utf8'),
  );
  let changed = 0;
  console.log(`comparing ${OUT} against ${DIFF}:`);
  for (const [k, v] of Object.entries(hashes)) {
    const was = prior[k];
    const same = was === v;
    if (!same) changed++;
    console.log(`  ${same ? '=' : '≠'} ${k.padEnd(14)} ${was ?? '(new)'} → ${v}`);
  }
  console.log(
    changed
      ? `\n${changed} of ${SHOTS.length} surfaces changed — expected zero for a refactor`
      : `\nall ${SHOTS.length} surfaces pixel-identical`,
  );
  process.exitCode = changed ? 1 : 0;
}
