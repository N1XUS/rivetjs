// Record a CDP CPU profile, a Chrome Performance trace, a heap snapshot and DOM counters for one lane + operation.
// Usage:
//   node apps/dom-bench/trace.ts --suite dom --lane rivet --op mount|update1|update10|update100|dispose [--rows 5000]
//   node apps/dom-bench/trace.ts --suite krausest --lane rivet --op 01_run1k|05_swap1k|... [--throttle]
//   common: [--dist <dir>] [--out <dir>] [--no-heap] [--chrome <path>] [--lock]
// dom suite: --dist defaults to apps/dom-bench/dist (lanes rivet, react, solid, solid-stable from build.ts);
//   operations use the window.bench adapter contract (mount/update/dispose) only.
// krausest suite: --dist defaults to apps/dom-bench/dist/krausest (krausest/build.ts); operations are the
//   krausest init/run steps (DOM contract only). Default browser: real Chrome, as the suite runs it.
// Output dir (default .artifacts/perf-night/traces/<suite>-<lane>-<op>[-<rows>]): profile.cpuprofile,
//   trace.json.gz (open in DevTools Performance panel), heap.heapsnapshot (after the operation), meta.json.
// Analyse/diff with: node apps/dom-bench/trace-report.ts <dir> [<other-dir> ...]
import { chromium, type CDPSession, type Page } from "playwright";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { startServer } from "./server.ts";
import { startKrausestServer } from "./krausest/server.ts";
import { cpuBenchmarks } from "./krausest/benchmarks.ts";
import { selectFields } from "./metrics.ts";
import { withBenchLock } from "./bench-lock.ts";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : args[i + 1]!;
};
const suite = option("suite", "dom");
const lane = option("lane", "rivet");
const op = option("op", suite === "dom" ? "mount" : "01_run1k");
const rows = Number(option("rows", "5000"));
if (suite !== "dom" && suite !== "krausest") throw Error("--suite must be dom or krausest");
const dist = resolve(option("dist", suite === "dom" ? resolve(here, "dist") : resolve(here, "dist/krausest")));
const out = resolve(option("out", `.artifacts/perf-night/traces/${suite}-${lane}-${op}${suite === "dom" ? `-${rows}` : ""}`));
const chrome = option("chrome", suite === "krausest" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "");
const TRACE_CATEGORIES = [
  "devtools.timeline",
  "disabled-by-default-devtools.timeline",
  "disabled-by-default-devtools.timeline.frame",
  "disabled-by-default-devtools.timeline.stack",
  "v8.execute",
  "v8",
  "disabled-by-default-v8.gc",
  "disabled-by-default-v8.cpu_profiler",
  "blink.user_timing",
  "loading",
];

const counters = async (cdp: CDPSession) => {
  const dom = await cdp.send("Memory.getDOMCounters");
  const heap = await cdp.send("Runtime.getHeapUsage");
  return { ...dom, heapUsedBytes: heap.usedSize, heapTotalBytes: heap.totalSize };
};
const gc = async (cdp: CDPSession) => {
  await cdp.send("HeapProfiler.collectGarbage");
};

async function heapSnapshot(cdp: CDPSession, file: string) {
  const stream = createWriteStream(file);
  const onChunk = ({ chunk }: { chunk: string }) => stream.write(chunk);
  cdp.on("HeapProfiler.addHeapSnapshotChunk", onChunk);
  await cdp.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false, captureNumericValue: false });
  cdp.off("HeapProfiler.addHeapSnapshotChunk", onChunk);
  await new Promise<void>((yes) => stream.end(yes));
}

/** Prepare the page; return the measured operation (performed between profiler/trace start and stop). */
async function prepare(page: Page, url: string): Promise<() => Promise<void>> {
  if (suite === "dom") {
    await page.goto(`${url}/${lane}`);
    await page.waitForFunction(() => window.bench);
    // Same warm-up as run.ts: one mount/dispose cycle first.
    await page.evaluate((rows) => {
      window.bench.mount(rows);
      window.bench.dispose();
    }, rows);
    const percent = /^update(\d+)$/.exec(op)?.[1];
    if (op !== "mount") {
      await page.evaluate((rows) => window.bench.mount(rows), rows);
      // Three warm-up updates, as run.ts does before sampling.
      if (percent) {
        const indices = selectFields(rows * 10, Number(percent));
        await page.evaluate((indices) => [1, 2, 3].forEach((r) => window.bench.update(indices, r)), indices);
      }
    }
    const action =
      op === "mount" ? "mount" : percent ? "update" : op === "dispose" ? "dispose" : null;
    if (!action) throw Error(`Unknown dom op ${op}; use mount, update1, update10, update100, dispose`);
    const argsFor = action === "mount" ? [rows] : action === "update" ? [selectFields(rows * 10, Number(percent)), 4] : [];
    return async () => {
      await page.evaluate(
        ({ action, argsFor }) => {
          performance.mark("op-start");
          (window.bench[action as "mount"] as (...a: unknown[]) => void)(...argsFor);
          performance.mark("op-end");
          void document.body.getBoundingClientRect().height;
          return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        },
        { action, argsFor },
      );
    };
  }
  const bench = cpuBenchmarks.find((b) => b.id === op || b.id.startsWith(op));
  if (!bench) throw Error(`Unknown krausest op ${op}; known: ${cpuBenchmarks.map((b) => b.id).join(", ")}`);
  await page.goto(`${url}/${lane}/index.html`, { waitUntil: "networkidle" });
  await bench.init(page);
  return async () => {
    await bench.run(page);
    await sleep(40);
  };
}

async function main() {
  const server = suite === "dom" ? await startServer(0, dist) : await startKrausestServer(dist);
  const browser = await chromium.launch({
    executablePath: chrome && existsSync(chrome) ? chrome : undefined,
    args: ["--js-flags=--expose-gc", "--enable-benchmarking", "--window-size=1000,800"],
  });
  try {
    const context = await browser.newContext({ viewport: suite === "dom" ? { width: 1280, height: 720 } : { width: 1000, height: 800 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.setDefaultTimeout(120000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const cdp = await context.newCDPSession(page);
    const operation = await prepare(page, server.url);
    await gc(cdp);
    const before = await counters(cdp);
    const bench = suite === "krausest" ? cpuBenchmarks.find((b) => b.id === op || b.id.startsWith(op)) : undefined;
    const slowdown = flag("throttle") && bench?.slowdown ? bench.slowdown : 0;
    if (slowdown) await cdp.send("Emulation.setCPUThrottlingRate", { rate: slowdown });
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: 100 });
    await browser.startTracing(page, { screenshots: false, categories: TRACE_CATEGORIES });
    await cdp.send("Profiler.start");
    const started = Date.now();
    await operation();
    const wallMs = Date.now() - started;
    const { profile } = await cdp.send("Profiler.stop");
    const trace = await browser.stopTracing();
    if (slowdown) await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    const afterNoGc = await counters(cdp);
    await gc(cdp);
    const after = await counters(cdp);
    if (errors.length) throw Error(errors.join("\n"));
    await mkdir(out, { recursive: true });
    await writeFile(resolve(out, "profile.cpuprofile"), JSON.stringify(profile));
    await writeFile(resolve(out, "trace.json.gz"), gzipSync(trace));
    if (!flag("no-heap")) await heapSnapshot(cdp, resolve(out, "heap.heapsnapshot"));
    const bundle = suite === "dom" ? resolve(dist, `${lane}.js`) : resolve(dist, lane, "main.js");
    const bytes = await readFile(bundle);
    const meta = {
      suite,
      lane,
      op,
      rows: suite === "dom" ? rows : undefined,
      cpuSlowdown: slowdown || 1,
      recorded: new Date().toISOString(),
      chrome: browser.version(),
      bundle: { path: bundle, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") },
      wallMsIncludingInstrumentation: wallMs,
      counters: { before, afterNoGc, after },
      delta: {
        nodes: after.nodes - before.nodes,
        jsEventListeners: after.jsEventListeners - before.jsEventListeners,
        documents: after.documents - before.documents,
        heapUsedBytes: after.heapUsedBytes - before.heapUsedBytes,
      },
      note: "Profiler (100us sampling) and tracing run together: absolute times include instrumentation overhead; compare traces recorded the same way only.",
    };
    await writeFile(resolve(out, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
    console.log(`${out}\n  nodes +${meta.delta.nodes}, listeners +${meta.delta.jsEventListeners}, heap +${(meta.delta.heapUsedBytes / 1048576).toFixed(1)} MiB`);
  } finally {
    await browser.close();
    await server.close();
  }
}

if (flag("lock")) await withBenchLock(`trace ${suite} ${lane} ${op}`, main);
else await main();
