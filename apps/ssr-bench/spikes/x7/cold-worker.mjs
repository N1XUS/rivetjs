// One isolated measurement process (codex server-scale method): warm, then `requests` pages, each consumed as a
// UTF-8 Buffer + SHA-256 inside the timer. Prints JSON: cpu / wall ms per page, bytes, hash, process maxRSS.
// usage: node cold-worker.mjs <page module> <n> <requests> <warm>
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const [file, n, requests, warm] = process.argv.slice(2).map((v, i) => (i ? +v : v));
const { page } = await import(pathToFileURL(resolve(file)).href);
let bytes = 0,
  hash = "";
async function once() {
  const buffer = Buffer.from(await page(n));
  const next = createHash("sha256").update(buffer).digest("hex");
  if (hash && hash !== next) throw new Error("unstable output");
  hash = next;
  bytes = buffer.length;
}
for (let i = 0; i < warm; i++) await once();
const c0 = process.cpuUsage(),
  t0 = performance.now();
for (let i = 0; i < requests; i++) await once();
const wall = performance.now() - t0,
  cpu = process.cpuUsage(c0);
console.log(
  JSON.stringify({ n, cpuMs: (cpu.user + cpu.system) / 1000 / requests, wallMs: wall / requests, bytes, hash, maxRSSKiB: process.resourceUsage().maxRSS }),
);
