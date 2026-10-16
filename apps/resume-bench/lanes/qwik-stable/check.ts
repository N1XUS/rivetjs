// Builds the Qwik lane into a temp dir, serves it statically (404 for /item/*), and checks every
// FIXTURE.md behavior in Chromium. Usage: node check.ts
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Browser } from 'playwright';
import { build } from './build.ts';

const laneDir = fileURLToPath(new URL('.', import.meta.url));
const buildRoot = resolve(laneDir, '../../.build/qwik-stable');
await mkdir(resolve(buildRoot, '..'), { recursive: true });
const outDir = await mkdtemp(buildRoot + '-check-');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.css': 'text/css',
};

function serve(root: string): Server {
  return createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url!, 'http://x').pathname);
    if (path.startsWith('/item/')) {
      res.writeHead(404).end('not found');
      return;
    }
    const file = normalize(join(root, path === '/' ? 'index.html' : path));
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
}

const results: { name: string; ok: boolean }[] = [];
function check(name: string, ok: unknown, detail = '') {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
}

let server: Server | undefined;
let browser: Browser | undefined;
try {
  await build(outDir);
  server = serve(outDir);
  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));

  type Phase = 'load' | 'idle' | 'interaction';
  let phase: Phase = 'load';
  const js: Record<Phase, { url: string; bytes: number }[]> = { load: [], idle: [], interaction: [] };
  const docs: string[] = [];
  page.on('request', (r) => r.isNavigationRequest() && docs.push(r.url()));
  page.on('response', async (r) => {
    const url = r.url();
    if (!url.endsWith('.js')) return;
    const p: Phase = phase;
    try {
      js[p].push({ url: url.replace(origin, ''), bytes: (await r.body()).length });
    } catch {}
  });

  await page.goto(origin + '/', { waitUntil: 'load' });
  phase = 'idle';
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  phase = 'interaction';
  const sum = (a: { bytes: number }[]) => a.reduce((n, x) => n + x.bytes, 0);
  const preJs = [...js.load, ...js.idle];

  check('SSR: count starts 0', (await page.textContent('#count')) === '0');
  check('SSR: scrolled starts top', (await page.textContent('#scrolled')) === 'top');
  check('SSR: panel closed', (await page.textContent('#panel')) === 'closed' && (await page.$('#closed')));
  check('SSR: 1000 rows', (await page.locator('#rows > li.row').count()) === 1000);
  check('SSR: canvas not drawn yet', (await page.getAttribute('#chart', 'data-drawn')) === null);

  await page.waitForFunction(() => window.__analytics?.some((e) => e[0] === 'pageview' && e[1] === '/'), null, {
    timeout: 5000,
  });
  check('analytics pageview / at idle', true, JSON.stringify(await page.evaluate(() => window.__analytics)));

  await page.click('#inc');
  await page.waitForFunction(() => document.querySelector('#count')!.textContent === '1');
  check('counter increments', (await page.textContent('#count')) === '1');

  await page.click('#toggle');
  await page.waitForSelector('#open');
  check('toggle opens: open <b>1</b>', (await page.innerHTML('#open')) === 'open <b>1</b>', await page.innerHTML('#panel'));
  await page.click('#inc');
  await page.waitForFunction(() => document.querySelector('#open b')?.textContent === '2');
  check('open region tracks counter', (await page.innerHTML('#open')) === 'open <b>2</b>');
  await page.click('#toggle');
  await page.waitForSelector('#closed');
  check('toggle closes', (await page.$('#open')) === null);

  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForFunction(() => document.querySelector('#scrolled')!.textContent === 'scrolled');
  check('scroll > 100 -> scrolled', true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => document.querySelector('#scrolled')!.textContent === 'top');
  check('scroll back -> top', true);

  await page.locator('#chart').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('#chart')!.getAttribute('data-drawn') === '1', null, {
    timeout: 5000,
  });
  check('canvas drawn when visible', true);
  await page.evaluate(() => window.scrollTo(0, 0));

  await page.fill('#filter', 'golf');
  await page.waitForFunction(() => document.querySelectorAll('#rows > li.row').length === 100);
  const labels = await page.$$eval('#rows a.open', (as) => as.map((a) => a.textContent));
  check('filter golf -> 100 rows', labels.length === 100 && labels.every((l) => /golf/i.test(l)));
  await page.fill('#filter', 'GOLF');
  await page.waitForFunction(() => document.querySelectorAll('#rows > li.row').length === 100);
  check('filter case-insensitive', true);
  await page.fill('#filter', 'golf');

  await page.click('#rows li[data-id="17"] button.pick');
  await page.waitForFunction(() => document.querySelector('#rows li[data-id="17"]')!.classList.contains('sel'));
  check('pick adds sel', (await page.locator('#rows li.sel').count()) === 1);
  await page.click('#rows li[data-id="27"] button.pick');
  await page.waitForFunction(() => document.querySelector('#rows li[data-id="27"]')!.classList.contains('sel'));
  check('pick moves sel', (await page.locator('#rows li.sel').count()) === 1);

  await page.evaluate(() => (window.__noReload = true));
  const docsBefore = docs.length;
  await page.click('#rows li[data-id="7"] a.open');
  await page.waitForSelector('#detail');
  check('row link -> /item/7', new URL(page.url()).pathname === '/item/7');
  check('detail shows label', (await page.textContent('#detail h2')) === 'Row 7 golf');
  check('detail markup', (await page.innerHTML('#detail')) === '<h2>Row 7 golf</h2><a id="back" href="/">back</a>', await page.innerHTML('#detail'));
  check('no document reload (link)', (await page.evaluate(() => window.__noReload)) && docs.length === docsBefore);
  check('list gone on detail', (await page.$('#rows')) === null);
  await page.waitForFunction(() => window.__analytics!.some((e) => e[1] === '/item/7'));
  check('analytics pageview on navigation', true);

  await page.click('#back');
  await page.waitForSelector('#rows');
  check('back link -> /', new URL(page.url()).pathname === '/');
  check('filter preserved (back link)', (await page.inputValue('#filter')) === 'golf' && (await page.locator('#rows > li.row').count()) === 100);
  check('selection preserved', await page.locator('#rows li[data-id="27"]').evaluate((el) => el.classList.contains('sel')));

  await page.click('#rows li[data-id="37"] a.open');
  await page.waitForSelector('#detail');
  check('second nav -> /item/37', new URL(page.url()).pathname === '/item/37');
  await page.goBack();
  await page.waitForSelector('#rows');
  check('browser back -> list', new URL(page.url()).pathname === '/');
  check('filter preserved (browser back)', (await page.inputValue('#filter')) === 'golf' && (await page.locator('#rows > li.row').count()) === 100);
  await page.goForward();
  await page.waitForSelector('#detail');
  check('browser forward -> detail', (await page.textContent('#detail h2')) === 'Row 37 golf');
  check('no document reload (history)', (await page.evaluate(() => window.__noReload)) && docs.length === docsBefore);
  const pv = await page.evaluate(() => window.__analytics!.map((e) => e[1]));
  check('analytics log', pv.join(',') === '/,/item/7,/,/item/37,/,/item/37', JSON.stringify(pv));

  check('no page errors', errors.length === 0, errors.join(' | '));

  console.log('\nJS before interaction on / :');
  for (const x of preJs) console.log(`  ${x.bytes.toString().padStart(7)}  ${x.url}`);
  console.log(`  by load: ${sum(js.load)} B (${js.load.length} files); incl. idle preloads: ${sum(preJs)} B (${preJs.length} files)`);
  console.log(`  loaded during interaction: ${sum(js.interaction)} B (${js.interaction.length} files)`);
} finally {
  await browser?.close();
  server?.close();
  await rm(outDir, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
