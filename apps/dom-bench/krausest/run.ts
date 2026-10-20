// krausest-style (js-framework-benchmark, keyed) suite runner for locally built lanes.
// Usage: node apps/dom-bench/krausest/run.ts [--dist apps/dom-bench/dist/krausest] [--lanes rivet,vanilla]
//   [--benchmarks all|cpu|mem|startup|01_run1k,...] [--iterations 15] [--mem-iterations 3] [--startup-iterations 5]
//   [--headed] [--chrome <path>] [--no-throttle] [--out .artifacts/krausest/<stamp>]
// Rules follow webdriver-ts (commit in published.json): real Chrome, --js-flags=--expose-gc --enable-benchmarking,
// window 1000x800, fresh tab per iteration, warmups per benchmark, forced major GC before tracing, CPU slowdown
// 4x for 03/04/05/09 and 2x for 06, duration = click EventDispatch start -> end of the next Commit (timeline.ts),
// memory = performance.measureUserAgentSpecificMemory() after forced GC. Lanes interleave per iteration.
// Takes the bench lock per benchmark (RIVET_BENCH_LOCK=none when the caller already holds it).
import { chromium, type Browser, type Page } from "playwright";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { arch, cpus, platform, totalmem } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { startKrausestServer } from "./server.ts";
import { computeCPU, JS_EVENTS, PAINT_EVENTS, unionWithin, type TraceEvent } from "./timeline.ts";
import { withBenchLock } from "../bench-lock.ts";
import { compareToPublished, formatComparison, type SuiteResults } from "./compare.ts";
import { cpuBenchmarks, exists, memBenchmarks, type CPUBench, type MemBench } from "./benchmarks.ts";
import { median } from "../../../scripts/bench/shared.ts";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : args[i + 1]!;
};
const dist = resolve(option("dist", resolve(here, "../dist/krausest")));
const lanes = option("lanes", "rivet,vanilla").split(",");
const iterations = Number(option("iterations", "15"));
const memIterations = Number(option("mem-iterations", "3"));
const startupIterations = Number(option("startup-iterations", "5"));
const chrome = option("chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
const throttle = !flag("no-throttle");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const out = resolve(option("out", `.artifacts/krausest/${stamp}`));


const select = option("benchmarks", "all");
const wants = (id: string, kind: "cpu" | "mem" | "startup") =>
  select === "all" || select === kind || select.split(",").some((s) => id === s || id.startsWith(s + "_") || (s.length <= 2 && id.startsWith(s)));

const launch = () =>
  chromium.launch({
    executablePath: existsSync(chrome) ? chrome : undefined,
    headless: !flag("headed"),
    args: ["--window-size=1000,800", "--js-flags=--expose-gc", "--enable-benchmarking"],
  });
const newPage = async (browser: Browser) => {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  page.setDefaultTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return { page, errors };
};
const forceGC = (page: Page) => page.evaluate("window.gc({type:'major',execution:'sync',flavor:'last-resort'})");
const stats = (values: number[]) => ({ n: values.length, median: median(values), mean: values.reduce((a, b) => a + b, 0) / values.length, min: Math.min(...values), max: Math.max(...values), values });
const traceEvents = (buffer: Buffer): TraceEvent[] => {
  const json = JSON.parse(buffer.toString("utf8")) as { traceEvents?: TraceEvent[] } | TraceEvent[];
  return Array.isArray(json) ? json : json.traceEvents ?? [];
};

async function cpuIteration(browser: Browser, url: string, bench: CPUBench) {
  const { page, errors } = await newPage(browser);
  try {
    const cdp = await page.context().newCDPSession(page);
    await page.goto(url, { waitUntil: "networkidle" });
    await bench.init(page);
    await forceGC(page);
    if (throttle && bench.slowdown) await cdp.send("Emulation.setCPUThrottlingRate", { rate: bench.slowdown });
    await browser.startTracing(page, { screenshots: false, categories: ["blink.user_timing", "devtools.timeline", "disabled-by-default-devtools.timeline"] });
    await bench.run(page);
    await sleep(40);
    const trace = traceEvents(await browser.stopTracing());
    if (throttle && bench.slowdown) await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    if (errors.length) throw Error(errors.join("\n"));
    const cpu = computeCPU(trace);
    return {
      total: cpu.duration,
      script: unionWithin(trace, JS_EVENTS, cpu.tsStart, cpu.tsEnd, true),
      paint: unionWithin(trace, PAINT_EVENTS, cpu.tsStart, cpu.tsEnd, false),
      layouts: cpu.layouts,
    };
  } finally {
    await page.context().close();
  }
}

async function memIteration(browser: Browser, url: string, bench: MemBench) {
  const { page, errors } = await newPage(browser);
  try {
    await page.goto(url, { waitUntil: "networkidle" });
    if (!(await page.evaluate(() => crossOriginIsolated))) throw Error("page is not cross-origin isolated");
    await bench.init(page);
    await bench.run(page);
    await forceGC(page);
    await sleep(40);
    const bytes = (await page.evaluate("performance.measureUserAgentSpecificMemory()") as { bytes: number }).bytes;
    if (errors.length) throw Error(errors.join("\n"));
    return bytes / 1024 / 1024;
  } finally {
    await page.context().close();
  }
}

/** Startup: unthrottled first paint (krausest 43) plus Lighthouse-style metrics under 4x CPU slowdown. */
async function startupIteration(browser: Browser, url: string) {
  const fp = await (async () => {
    const { page } = await newPage(browser);
    try {
      await page.goto(url, { waitUntil: "networkidle" });
      await exists("#run")(page);
      return await page.evaluate(() => performance.getEntriesByName("first-paint")[0]?.startTime ?? NaN);
    } finally {
      await page.context().close();
    }
  })();
  const { page, errors } = await newPage(browser);
  try {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    let bytes = 0;
    cdp.on("Network.loadingFinished", (event) => (bytes += event.encodedDataLength));
    if (throttle) await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.addInitScript(() => {
      const w = window as unknown as { __ready?: number };
      const check = () => {
        if (w.__ready === undefined && document.getElementById("run")) w.__ready = performance.now();
      };
      new MutationObserver(check).observe(document, { childList: true, subtree: true });
    });
    await browser.startTracing(page, {
      screenshots: false,
      categories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "loading", "v8", "v8.execute", "blink.user_timing"],
    });
    await page.goto(url, { waitUntil: "networkidle" });
    await exists("#run")(page);
    await sleep(500);
    const trace = traceEvents(await browser.stopTracing());
    if (throttle) await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    const timing = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      return {
        ready: Math.max((window as unknown as { __ready: number }).__ready, nav.domContentLoadedEventEnd),
        fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? NaN,
        timeOrigin: performance.timeOrigin,
      };
    });
    if (errors.length) throw Error(errors.join("\n"));
    // Renderer main thread of this page: the thread that parsed our document.
    const parse = trace.find((e) => e.name === "ParseHTML" && JSON.stringify(e.args ?? {}).includes(url));
    if (!parse) throw Error("ParseHTML for the page not found in trace");
    const main = trace.filter((e) => e.pid === parse.pid && e.tid === parse.tid);
    const navStart = trace.find((e) => e.name === "navigationStart" && e.pid === parse.pid)?.ts ?? main.find((e) => e.name === "ResourceSendRequest")?.ts ?? parse.ts;
    const fcpTs = navStart + timing.fcp * 1000;
    const longTasks = main.filter((e) => e.name === "RunTask" && e.ph === "X" && (e.dur ?? 0) > 50_000);
    const lastLong = longTasks.filter((e) => e.ts + e.dur! > fcpTs).at(-1);
    const ciTs = Math.max(fcpTs, lastLong ? lastLong.ts + lastLong.dur! : 0);
    const bootNames = ["EvaluateScript", "v8.evaluateModule", "v8.compile", "v8.compileModule", "v8.parseOnBackground", "FunctionCall", "RunMicrotasks", "V8.Execute"];
    return {
      firstPaint: fp,
      ready: timing.ready,
      consistentlyInteractive: (ciTs - navStart) / 1000,
      scriptBootup: unionWithin(main, bootNames, navStart, ciTs, false),
      totalBytes: bytes,
    };
  } finally {
    await page.context().close();
  }
}

const manifest = JSON.parse(await readFile(resolve(dist, "manifest.json"), "utf8")) as SuiteResults["manifest"];
for (const lane of lanes) if (!manifest.lanes[lane]) throw Error(`Lane ${lane} not built in ${dist}`);
const server = await startKrausestServer(dist);
const browser = await launch();
const results: SuiteResults = {
  suite: "krausest-keyed",
  started: new Date().toISOString(),
  environment: { chrome: browser.version(), headless: !flag("headed"), throttle, platform: platform(), arch: arch(), cpu: cpus()[0]?.model, cpuCount: cpus().length, totalMemoryBytes: totalmem(), node: process.version },
  options: { lanes, iterations, memIterations, startupIterations, benchmarks: select },
  manifest,
  cpu: {},
  memory: {},
  startup: {},
  size: Object.fromEntries(lanes.map((lane) => [lane, { "41_size-uncompressed": manifest.lanes[lane]!.uncompressedBytes / 1024, "42_size-compressed": manifest.lanes[lane]!.brotliBytes / 1024 }])),
};
const save = async () => {
  await mkdir(out, { recursive: true });
  await writeFile(resolve(out, "results.json"), JSON.stringify(results, null, 2) + "\n");
};
const url = (lane: string) => `${server.url}/${lane}/index.html`;
try {
  for (const bench of cpuBenchmarks.filter((b) => wants(b.id, "cpu")))
    await withBenchLock(`krausest ${bench.id}`, async () => {
      const samples: Record<string, { total: number[]; script: number[]; paint: number[] }> = Object.fromEntries(lanes.map((l) => [l, { total: [], script: [], paint: [] }]));
      const n = iterations + bench.additionalRuns;
      for (let i = 0; i < n; i++)
        for (let k = 0; k < lanes.length; k++) {
          const lane = lanes[(k + i) % lanes.length]!;
          const r = await cpuIteration(browser, url(lane), bench);
          samples[lane]!.total.push(r.total);
          samples[lane]!.script.push(r.script);
          samples[lane]!.paint.push(r.paint);
        }
      results.cpu[bench.id] = Object.fromEntries(lanes.map((l) => [l, { total: stats(samples[l]!.total), script: stats(samples[l]!.script), paint: stats(samples[l]!.paint) }]));
      console.log(`${bench.id.padEnd(24)} ` + lanes.map((l) => `${l} ${median(samples[l]!.total).toFixed(1)} ms`).join("  "));
      await save();
    });
  for (const bench of memBenchmarks.filter((b) => wants(b.id, "mem")))
    await withBenchLock(`krausest ${bench.id}`, async () => {
      const samples: Record<string, number[]> = Object.fromEntries(lanes.map((l) => [l, []]));
      for (let i = 0; i < memIterations; i++)
        for (let k = 0; k < lanes.length; k++) {
          const lane = lanes[(k + i) % lanes.length]!;
          samples[lane]!.push(await memIteration(browser, url(lane), bench));
        }
      results.memory[bench.id] = Object.fromEntries(lanes.map((l) => [l, stats(samples[l]!)]));
      console.log(`${bench.id.padEnd(24)} ` + lanes.map((l) => `${l} ${median(samples[l]!).toFixed(2)} MB`).join("  "));
      await save();
    });
  if (wants("startup", "startup"))
    await withBenchLock("krausest startup", async () => {
      const samples: Record<string, Record<string, number[]>> = Object.fromEntries(lanes.map((l) => [l, {}]));
      for (let i = 0; i < startupIterations; i++)
        for (let k = 0; k < lanes.length; k++) {
          const lane = lanes[(k + i) % lanes.length]!;
          for (const [metric, value] of Object.entries(await startupIteration(browser, url(lane)))) (samples[lane]![metric] ??= []).push(value);
        }
      results.startup = Object.fromEntries(lanes.map((l) => [l, Object.fromEntries(Object.entries(samples[l]!).map(([m, v]) => [m, stats(v)]))]));
      for (const l of lanes) console.log(`startup ${l}: ` + Object.entries(results.startup[l]!).map(([m, s]) => `${m} ${s.median.toFixed(1)}`).join("  "));
      await save();
    });
  results.finished = new Date().toISOString();
  results.comparison = compareToPublished(results);
  await save();
  console.log("\n" + formatComparison(results.comparison));
  console.log(`\nResults: ${resolve(out, "results.json")}`);
} finally {
  await browser.close();
  await server.close();
}
