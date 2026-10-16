// One measured process of the render-cache benchmark (spawned by run.ts): imports a production bundle
// (esbuild, `production` condition — no TypeScript loader in the process, so RSS is the app's) and renders
// pages through NodeStreamWriter into a discarding sink. Prints one JSON sample.
//   node --single-threaded-gc --max-semi-space-size=8 child.mjs <bundle.mjs> <mode> <requests> <rounds> <warm>
import { createHash } from "node:crypto";
import { Writable } from "node:stream";
import { getHeapStatistics } from "node:v8";
import { pathToFileURL } from "node:url";

const [bundle, mode, requestsArg, roundsArg, warmArg] = process.argv.slice(2);
const requests = Number(requestsArg),
  rounds = Number(roundsArg),
  warm = Number(warmArg);
const { Page, renderToWriter, NodeStreamWriter, createRenderCache, withRenderCache, doc } = await import(pathToFileURL(bundle).href);
const cache = createRenderCache({ verify: false });
const pool = Array.from({ length: 1000 }, (_, i) => doc(i));
const sink = new Writable({ highWaterMark: 1 << 22, write: (_chunk, _encoding, done) => done() });
// Same harness in every mode ("off" runs the scope too; its wrappers are identity functions). Page() runs
// inside the scope: wrappers read it when called.
const scope = { cache, nonce: "bench-nonce-Zm9vYmFy" };
async function render(i, target = sink) {
  const writer = new NodeStreamWriter(target, { share: false });
  await withRenderCache(scope, () => renderToWriter(Page({ doc: pool[i % pool.length] }), writer));
  await writer.finish();
}
for (let i = 0; i < warm; i++) await render(i);
// HTML of ten fixed documents (cache warm): run.ts checks it is identical across modes.
const hashes = [];
let htmlKB = 0;
for (let i = 0; i < 10; i++) {
  const parts = [];
  await render(i * 37, new Writable({ write: (chunk, _encoding, done) => (parts.push(Buffer.from(chunk)), done()) }));
  const html = Buffer.concat(parts);
  htmlKB = html.length / 1024;
  hashes.push(createHash("sha256").update(html).digest("hex").slice(0, 16));
}
const cpuMs = [],
  wallMs = [],
  allocKB = [];
let next = warm;
for (let r = 0; r < rounds; r++) {
  const a0 = getHeapStatistics().total_allocated_bytes,
    c0 = process.cpuUsage(),
    t0 = performance.now();
  for (let i = 0; i < requests; i++) await render(next++);
  const t1 = performance.now(),
    c1 = process.cpuUsage(c0),
    a1 = getHeapStatistics().total_allocated_bytes;
  cpuMs.push((c1.user + c1.system) / 1000 / requests);
  wallMs.push((t1 - t0) / requests);
  allocKB.push((a1 - a0) / 1024 / requests);
}
process.stdout.write(
  JSON.stringify({
    mode,
    cpuMs,
    wallMs,
    allocKB,
    maxRssMB: process.resourceUsage().maxRSS / 1024,
    heapUsedMB: process.memoryUsage().heapUsed / 1024 / 1024,
    htmlKB,
    hashes,
    cache: mode === "off" ? null : { ...cache.stats },
  }),
);
