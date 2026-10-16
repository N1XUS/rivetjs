/** Isolated TLS transport screening. Product servers and fixture assets are never modified. */
import { createServer as createHttpsServer } from 'node:https';
import { createSecureServer } from 'node:http2';
import { Agent, request as httpRequest } from 'node:http';
import { createHash, X509Certificate } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile, access, chmod } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from './serve.ts';
import { items } from './data.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const artifacts = resolve(repo, '.artifacts/http2-bench');
const dist = resolve(repo, 'apps/resume-bench/dist/rivet');
const args = process.argv.slice(2);
const known = new Set(['--repeats', '--conditions', '--scenarios', '--out', '--prepare', '--verify-only']);
for (let i = 0; i < args.length; i++) {
  if (!known.has(args[i])) throw Error('Unknown option: ' + args[i]);
  if (!['--prepare', '--verify-only'].includes(args[i])) {
    if (!args[i + 1] || args[i + 1].startsWith('--')) throw Error('Missing option value');
    i++;
  }
}
const option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const verifyOnly = args.includes('--verify-only');
const repeats = verifyOnly ? 1 : Number(option('--repeats', '5'));
const conditions = verifyOnly ? ['fast'] : option('--conditions', 'fast,slow').split(',');
const scenarios = option('--scenarios', verifyOnly ? 'load,click' : 'load').split(',');
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 10) throw Error('repeats must be 1..10');
if (conditions.some(value => !['fast', 'slow'].includes(value)) || new Set(conditions).size !== conditions.length) throw Error('Invalid conditions');
if (scenarios.some(value => !['load', 'click'].includes(value)) || new Set(scenarios).size !== scenarios.length) throw Error('Invalid scenarios');
const profiles = {
  fast: { latency: 0, downloadThroughput: -1, uploadThroughput: -1, cpu: 1 },
  slow: { latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8, cpu: 4 },
};
const runId = new Date().toISOString().replaceAll(':', '-');
const output = resolve(option('--out', resolve(artifacts, 'runs', runId)));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const exists = async path => access(path).then(() => true, () => false);

async function certificate() {
  const dir = resolve(artifacts, 'certs');
  await mkdir(dir, { recursive: true });
  const keyPath = resolve(dir, 'localhost-key.pem'), certPath = resolve(dir, 'localhost-cert.pem');
  const keyExists = await exists(keyPath), certExists = await exists(certPath);
  if (keyExists !== certExists) throw Error('Incomplete certificate pair; remove only this experiment\'s certs directory and retry');
  if (!keyExists) {
    const config = resolve(dir, 'openssl.cnf');
    await writeFile(config, '[req]\nprompt=no\ndistinguished_name=dn\nx509_extensions=ext\n[dn]\nCN=localhost\n[ext]\nsubjectAltName=DNS:localhost,IP:127.0.0.1\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n');
    const generated = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '7', '-config', config, '-keyout', keyPath, '-out', certPath], { encoding: 'utf8', timeout: 30000 });
    if (generated.status !== 0) throw Error('Local certificate generation failed: ' + generated.stderr);
    await chmod(keyPath, 0o600);
  }
  const [key, cert] = await Promise.all([readFile(keyPath), readFile(certPath)]);
  const parsed = new X509Certificate(cert);
  if (Date.now() >= Date.parse(parsed.validTo)) throw Error('Experiment certificate expired; remove its certs directory and prepare again');
  return { key, cert, fingerprint: parsed.fingerprint256, validTo: parsed.validTo };
}

async function manifest(dir) {
  const files = [];
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const full = resolve(path, entry.name);
      if (entry.isDirectory()) await visit(full);
      else if (entry.isFile()) {
        const bytes = await readFile(full);
        files.push({ path: relative(dir, full).replaceAll('\\', '/'), bytes: bytes.length, sha256: hash(bytes) });
      } else throw Error('Unsupported fixture entry: ' + full);
    }
  }
  await visit(dir);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { sha256: hash(JSON.stringify(files)), files };
}

const hopHeaders = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'proxy-connection', 'te', 'trailer', 'transfer-encoding', 'upgrade']);
function forwarded(headers) {
  const blocked = new Set([...hopHeaders, ...String(headers.connection ?? '').toLowerCase().split(',').map(value => value.trim())]);
  return Object.fromEntries(Object.entries(headers).filter(([name, value]) => !name.startsWith(':') && !blocked.has(name.toLowerCase()) && value !== undefined));
}

async function edge(protocol, tls, upstream, agent) {
  const sockets = new Set(), sessions = new Set(), requests = new Set(), transfers = [];
  const handler = (req, res) => {
    const socket = req.socket;
    const transfer = { path: req.url, method: req.method, protocol: req.httpVersion, alpn: socket.alpnProtocol,
      tls: socket.getProtocol?.(), cipher: socket.getCipher?.().name, bytes: 0, complete: false };
    transfers.push(transfer);
    const headers = forwarded(req.headers);
    headers.host = new URL(upstream).host;
    const pending = httpRequest(new URL(req.url, upstream), { method: req.method, headers, agent }, response => {
      transfer.status = response.statusCode;
      transfer.encoding = response.headers['content-encoding'] ?? 'identity';
      res.writeHead(response.statusCode ?? 502, forwarded(response.headers));
      response.on('data', chunk => { transfer.bytes += chunk.length; });
      response.once('end', () => { transfer.complete = true; });
      response.once('error', error => { transfer.error = error.message; res.destroy(error); });
      response.pipe(res);
    });
    requests.add(pending);
    pending.once('close', () => requests.delete(pending));
    pending.once('error', error => {
      transfer.error = error.message;
      if (!res.destroyed) {
        if (!res.headersSent) res.writeHead(502).end('Upstream failure');
        else res.destroy(error);
      }
    });
    req.once('aborted', () => pending.destroy());
    res.once('close', () => { if (!res.writableFinished) pending.destroy(); });
    res.once('error', () => pending.destroy());
    req.pipe(pending);
  };
  const options = { key: tls.key, cert: tls.cert, minVersion: 'TLSv1.3', maxVersion: 'TLSv1.3' };
  const server = protocol === 'h2'
    ? createSecureServer({ ...options, allowHTTP1: false, settings: { enablePush: false } }, handler)
    : createHttpsServer({ ...options, ALPNProtocols: ['http/1.1'] }, handler);
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
  server.on('session', session => { sessions.add(session); session.once('close', () => sessions.delete(session)); session.on('error', () => {}); });
  server.on('tlsClientError', () => {});
  await new Promise((done, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', done); });
  return {
    url: 'https://127.0.0.1:' + server.address().port, transfers,
    async close() {
      const stopped = new Promise((done, fail) => server.close(error => error ? fail(error) : done()));
      for (const pending of requests) pending.destroy();
      for (const session of sessions) session.destroy();
      for (const socket of sockets) socket.destroy();
      await stopped;
    },
  };
}

async function warm(upstream, agent, files, signal) {
  const warmed = [];
  for (const file of files) {
    const path = '/' + file.path.split('/').map(encodeURIComponent).join('/');
    warmed.push(await new Promise((done, fail) => {
      const req = httpRequest(new URL(path, upstream), { agent, signal, headers: { 'accept-encoding': 'br' } }, response => {
        let bytes = 0;
        response.on('data', chunk => { bytes += chunk.length; });
        response.once('error', fail);
        response.once('end', () => response.statusCode === 200 ? done({ path, bytes, encoding: response.headers['content-encoding'] ?? 'identity' }) : fail(Error('Fixture prewarm failed: ' + path)));
      });
      req.once('error', fail); req.setTimeout(30000, () => req.destroy(Error('Fixture prewarm timed out'))); req.end();
    }));
  }
  return warmed;
}

function browserProbe() {
  const probe = globalThis.__http2probe = { domReady: null, load: null, click: null, count: null };
  addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('#count')?.textContent === '0' && document.querySelector('#filter')?.value === '' && document.querySelectorAll('#rows li').length === 1000) probe.domReady = performance.now();
  }, { once: true });
  addEventListener('load', () => { probe.load = performance.now(); }, { once: true });
  addEventListener('click', event => { if (event.target.closest?.('#inc')) probe.click ??= event.timeStamp; }, true);
}

async function validate(page, count) {
  return page.evaluate(({ expected, count }) => {
    const rows = [...document.querySelectorAll('#rows li')];
    if (rows.length !== expected.length) throw Error('Expected 1000 rows, received ' + rows.length);
    for (let i = 0; i < expected.length; i++) {
      const row = rows[i], item = expected[i], link = row.querySelector('a.open');
      if (row.getAttribute('data-id') !== String(item.id) || !row.classList.contains('row') || link?.textContent !== item.label || link?.getAttribute('href') !== '/item/' + item.id || row.querySelector('button.pick')?.textContent !== 'pick') throw Error('Incorrect fixture row ' + item.id);
    }
    if (document.querySelector('#count')?.textContent !== String(count) || document.querySelector('#filter')?.value !== '' || document.querySelector('#closed')?.textContent !== 'closed') throw Error('Incorrect initial controls');
    return { rows: rows.length, count, filter: '', closed: true };
  }, { expected: items, count });
}

async function trial(browser, protocol, condition, scenario, repeat, tls, upstream, agent, bodies) {
  const proxy = await edge(protocol, tls, upstream, agent);
  let context, page, cdp;
  const loaded = new Map(), errors = [], expectedProtocol = protocol === 'h2' ? 'h2' : 'http/1.1';
  const result = { protocol, condition, scenario, repeat, origin: proxy.url, ok: false, errors };
  try {
    context = await browser.newContext({ ignoreHTTPSErrors: true, serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
    page = await context.newPage();
    page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(45000);
    page.on('pageerror', error => errors.push('page: ' + error.message));
    await context.addInitScript(browserProbe);
    cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    const profile = profiles[condition];
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: profile.latency, downloadThroughput: profile.downloadThroughput, uploadThroughput: profile.uploadThroughput });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });
    cdp.on('Network.responseReceived', event => {
      const response = event.response;
      loaded.set(event.requestId, { url: response.url, type: event.type, status: response.status, protocol: response.protocol,
        mime: response.mimeType, fromCache: response.fromDiskCache || response.fromServiceWorker || false,
        connectionId: response.connectionId, connectionReused: response.connectionReused, timing: response.timing,
        encoding: response.headers['content-encoding'] ?? response.headers['Content-Encoding'] ?? 'identity',
        tls: response.securityDetails?.protocol, cipher: response.securityDetails?.cipher, complete: false });
    });
    cdp.on('Network.loadingFinished', event => {
      const entry = loaded.get(event.requestId);
      if (entry) Object.assign(entry, { complete: true, encodedDataLength: event.encodedDataLength });
    });
    cdp.on('Network.loadingFailed', event => { if (!event.canceled) errors.push('network: ' + event.errorText); });
    const navigation = await page.goto(proxy.url + '/', { waitUntil: 'load' });
    if (navigation?.status() !== 200) throw Error('Document did not return 200');
    result.initialDOM = await validate(page, 0);
    if (scenario === 'click') {
      await page.waitForTimeout(1000);
      await page.evaluate(() => {
        const observer = new MutationObserver(() => {
          if (document.querySelector('#count')?.textContent === '1') {
            __http2probe.count = performance.now(); observer.disconnect();
          }
        });
        observer.observe(document.querySelector('#count'), { childList: true, characterData: true, subtree: true });
      });
      const box = await page.locator('#inc').boundingBox();
      if (!box) throw Error('Counter control has no box');
      // No mouse move or hover dwell: avoid intentionally triggering intent prefetch.
      for (const type of ['mousePressed', 'mouseReleased']) await cdp.send('Input.dispatchMouseEvent', { type, x: box.x + box.width / 2, y: box.y + box.height / 2, button: 'left', clickCount: 1 });
      await page.waitForFunction(() => __http2probe.count !== null);
      await page.waitForTimeout(500);
    } else await page.waitForTimeout(3000);
    result.finalDOM = await validate(page, scenario === 'click' ? 1 : 0);
    result.browser = await page.evaluate(() => ({
      marks: __http2probe,
      navigation: performance.getEntriesByType('navigation')[0]?.toJSON(),
      resources: performance.getEntriesByType('resource').map(entry => entry.toJSON()),
      fcpMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
      observedUntilMs: performance.now(),
      scripts: [...document.scripts].map(script => ({ type: script.type || 'classic', src: script.src || null, async: script.async, defer: script.defer })),
      analyticsEntries: globalThis.__analytics?.length ?? 0,
    }));
    result.responses = [...loaded.values()];
    result.proxyTransfers = structuredClone(proxy.transfers);
    const nav = result.browser.navigation;
    if (nav?.nextHopProtocol !== expectedProtocol) throw Error('Document protocol was ' + nav?.nextHopProtocol);
    if (result.browser.marks.domReady === null) throw Error('Fixture was not complete at DOMContentLoaded');
    for (const entry of result.browser.resources) {
      if (entry.name.startsWith(proxy.url) && entry.nextHopProtocol !== expectedProtocol) throw Error('Asset protocol mismatch: ' + entry.name + ' = ' + entry.nextHopProtocol);
    }
    for (const entry of result.responses) {
      if (!entry.url.startsWith(proxy.url)) throw Error('Unexpected external request: ' + entry.url);
      if (entry.protocol !== expectedProtocol || entry.fromCache) throw Error('Protocol/cache mismatch: ' + entry.url);
      if (entry.status >= 400 && !entry.url.endsWith('/favicon.ico')) throw Error('Asset failed: ' + entry.url);
    }
    for (const transfer of result.proxyTransfers) {
      if (transfer.alpn !== expectedProtocol || transfer.tls !== 'TLSv1.3') throw Error('TLS/ALPN mismatch at proxy');
      if (transfer.error && !transfer.path.endsWith('/favicon.ico')) throw Error('Proxy failure: ' + transfer.error);
      if (transfer.complete && transfer.status === 200) {
        const pathname = new URL(transfer.path, upstream).pathname;
        const expected = bodies.get(pathname === '/' ? '/index.html' : pathname);
        if (!expected || transfer.bytes !== expected.bytes || transfer.encoding !== expected.encoding) throw Error('Upstream encoded payload mismatch: ' + transfer.path);
      }
    }
    result.metrics = {
      fixtureDomReadyMs: result.browser.marks.domReady, loadEventEndMs: nav.loadEventEnd,
      ttfbMs: nav.responseStart - nav.requestStart, navigationResponseEndMs: nav.responseEnd,
      tlsMs: nav.secureConnectionStart > 0 ? nav.connectEnd - nav.secureConnectionStart : null,
      fcpMs: result.browser.fcpMs,
      firstClickMs: scenario === 'click' ? result.browser.marks.count - result.browser.marks.click : null,
      completedResponses: result.responses.filter(entry => entry.complete).length,
      cdpEncodedBytes: result.responses.reduce((sum, entry) => sum + (entry.encodedDataLength ?? 0), 0),
      proxyBodyBytes: result.proxyTransfers.reduce((sum, entry) => sum + entry.bytes, 0),
      unfinishedResponses: result.responses.filter(entry => !entry.complete).length,
    };
    result.ok = errors.length === 0;
  } catch (error) { errors.push(String(error.stack ?? error)); }
  finally {
    await cdp?.detach().catch(() => {});
    await context?.close().catch(() => {});
    await proxy.close();
  }
  return result;
}

const median = values => { const sorted = [...values].sort((a, b) => a - b); return sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2; };
function pairedSummary(runs) {
  const summaries = [];
  for (const condition of conditions) for (const scenario of scenarios) {
    const pairs = Array.from({ length: repeats }, (_, repeat) => ({
      h1: runs.find(run => run.condition === condition && run.scenario === scenario && run.repeat === repeat && run.protocol === 'h1'),
      h2: runs.find(run => run.condition === condition && run.scenario === scenario && run.repeat === repeat && run.protocol === 'h2'),
    })).filter(pair => pair.h1?.ok && pair.h2?.ok);
    const metrics = {};
    for (const key of ['fixtureDomReadyMs', 'loadEventEndMs', 'navigationResponseEndMs', 'ttfbMs', 'fcpMs', 'firstClickMs']) {
      const complete = pairs.filter(pair => Number.isFinite(pair.h1.metrics[key]) && Number.isFinite(pair.h2.metrics[key]));
      if (complete.length) metrics[key] = { h1Median: median(complete.map(pair => pair.h1.metrics[key])), h2Median: median(complete.map(pair => pair.h2.metrics[key])), pairedH2MinusH1Median: median(complete.map(pair => pair.h2.metrics[key] - pair.h1.metrics[key])), pairedDeltas: complete.map(pair => pair.h2.metrics[key] - pair.h1.metrics[key]) };
    }
    summaries.push({ condition, scenario, validPairs: pairs.length, requestedPairs: repeats, metrics });
  }
  return summaries;
}

const tls = await certificate();
if (args.includes('--prepare')) {
  console.log(JSON.stringify({ prepared: true, fingerprint: tls.fingerprint, validTo: tls.validTo }));
} else {
  await access(resolve(dist, 'index.html'));
  await mkdir(output, { recursive: true });
  const fixture = await manifest(dist);
  const sourceFiles = ['apps/resume-bench/serve.ts', 'apps/resume-bench/data.ts', 'apps/resume-bench/run.ts', 'apps/resume-bench/http2.mjs'];
  const sources = Object.fromEntries(await Promise.all(sourceFiles.map(async path => [path, hash(await readFile(resolve(repo, path)))])));
  const report = { purpose: verifyOnly ? 'correctness-only; timings are not performance evidence' : 'paired Rivet-only HTTPS transport screening; no framework ranking',
    runId, lane: 'rivet', repeats, conditions, scenarios, profiles, fixture, sources, node: process.version,
    certificate: { fingerprint: tls.fingerprint, validTo: tls.validTo }, tls: 'TLSv1.3', http2Push: false,
    upstream: 'shared warmed HTTP/1.1 static server; shared keep-alive agent; streaming proxy; unchanged Brotli bytes',
    browserState: 'fresh browser context and fresh edge origin each trial; cache disabled; service workers blocked; ignoreHTTPSErrors true in both arms',
    limits: { runMinutes: 15, navigationMs: 45000, actionMs: 30000 },
    caveats: ['CDP Slow4G is browser network emulation, not packet-level WAN congestion/loss evidence.', 'fixtureDomReadyMs is SSR DOM availability, not proof that every lazy handler is loaded.', 'Load metrics include a fixed 3-second post-load observation window; optional click uses 1-second dwell and 500ms post-click.', 'Five pairs are a screening sample; inspect raw deltas, bytes, request sets and errors before conclusions.'], runs: [] };
  const agent = new Agent({ keepAlive: true, maxSockets: 32, maxFreeSockets: 32 });
  let upstream, browser, stopped = false;
  const controller = new AbortController();
  const stop = () => { stopped = true; controller.abort(Error("Run interrupted or deadline exceeded")); void browser?.close().catch(() => {}); };
  const timeout = setTimeout(stop, 15 * 60000);
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try {
    upstream = await serve(dist);
    report.prewarmed = await warm(upstream.url, agent, fixture.files, controller.signal);
    const bodies = new Map(report.prewarmed.map(file => [file.path, file]));
    browser = await chromium.launch({ headless: true });
    report.browserVersion = browser.version();
    for (const condition of conditions) for (const scenario of scenarios) for (let repeat = 0; repeat < repeats; repeat++) {
      const order = repeat % 2 ? ['h2', 'h1'] : ['h1', 'h2'];
      for (const protocol of order) {
        if (stopped) throw Error('Run interrupted or exceeded 15 minutes');
        const result = await trial(browser, protocol, condition, scenario, repeat, tls, upstream.url, agent, bodies);
        report.runs.push(result);
        await writeFile(resolve(output, 'results.json'), JSON.stringify(report, null, 2));
        console.log(`${condition}/${scenario} pair ${repeat + 1}/${repeats} ${protocol}: ${result.ok ? 'verified' : 'FAILED'}`);
      }
    }
    const after = await manifest(dist);
    if (after.sha256 !== fixture.sha256) throw Error('Fixture build changed during experiment; results invalid');
    report.fixtureUnchanged = true;
    if (!verifyOnly) report.summary = pairedSummary(report.runs);
    report.ok = report.runs.every(run => run.ok);
    if (!report.ok) process.exitCode = 1;
  } catch (error) { report.fatal = String(error.stack ?? error); report.ok = false; process.exitCode = 1; }
  finally {
    clearTimeout(timeout); process.off('SIGINT', stop); process.off('SIGTERM', stop);
    await browser?.close().catch(() => {});
    agent.destroy();
    await upstream?.close();
    await writeFile(resolve(output, 'results.json'), JSON.stringify(report, null, 2));
  }
  console.log('Result: ' + resolve(output, 'results.json'));
}
