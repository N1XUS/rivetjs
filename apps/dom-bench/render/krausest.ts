// Rendering-cost breakdown of the krausest suite: per benchmark and lane, main-thread self time of
// script / style / layout / prepaint / paint / composite inside the krausest duration window (click
// EventDispatch -> next Commit, krausest/timeline.ts computeCPU), at the requested CPU slowdowns.
// Usage: node apps/dom-bench/render/krausest.ts [--dist apps/dom-bench/dist/krausest] [--lanes rivet,vanilla]
//   [--benchmarks 01,02,...] [--iterations 7] [--cpu 1,4] [--chrome <path>] [--out file.json]
// Lanes interleave per iteration; medians printed. Holds the bench lock per benchmark.
import { chromium, type Browser } from "playwright";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { loadavg } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { startKrausestServer } from "../krausest/server.ts";
import { computeCPU, type TraceEvent } from "../krausest/timeline.ts";
import { cpuBenchmarks } from "../krausest/benchmarks.ts";
import { withBenchLock } from "../bench-lock.ts";
import { median } from "../../../scripts/bench/shared.ts";
import { BUCKETS, mainThread, phases, rendering, type Phases } from "./phases.ts";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : args[i + 1]!;
};
const dist = resolve(option("dist", resolve(here, "../dist/krausest")));
const lanes = option("lanes", "rivet,vanilla").split(",");
const iterations = Number(option("iterations", "7"));
const rates = option("cpu", "1,4").split(",").map(Number);
const select = option("benchmarks", "01,02,03,04,05,06,07,08,09").split(",");
const chrome = option("chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
const out = option("out", "");

const launch = () =>
  chromium.launch({
    executablePath: existsSync(chrome) ? chrome : undefined,
    headless: true,
    args: ["--window-size=1000,800", "--js-flags=--expose-gc", "--enable-benchmarking"],
  });

async function iteration(browser: Browser, url: string, bench: (typeof cpuBenchmarks)[number], rate: number) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  page.setDefaultTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    const cdp = await page.context().newCDPSession(page);
    await page.goto(url, { waitUntil: "networkidle" });
    await bench.init(page);
    await page.evaluate("window.gc({type:'major',execution:'sync',flavor:'last-resort'})");
    if (rate !== 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    await browser.startTracing(page, {
      screenshots: false,
      categories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "v8", "blink.user_timing"],
    });
    await bench.run(page);
    await sleep(40);
    const raw = JSON.parse((await browser.stopTracing()).toString("utf8")) as { traceEvents?: TraceEvent[] } | TraceEvent[];
    const trace = Array.isArray(raw) ? raw : (raw.traceEvents ?? []);
    if (rate !== 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    if (errors.length) throw Error(errors.join("\n"));
    const cpu = computeCPU(trace);
    const click = trace.find((e) => e.name === "EventDispatch" && e.args?.data?.type === "click" && e.ts === cpu.tsStart)!;
    const p = phases(trace, click.pid, mainThread(trace, click.pid), cpu.tsStart, cpu.tsEnd);
    return { duration: cpu.duration, ...p };
  } finally {
    await page.context().close();
  }
}

const server = await startKrausestServer(dist);
const browser = await launch();
const results: Record<string, Record<string, Record<string, number>>> = {};
const loads: number[] = [];
const fmt = (p: Record<string, number>) =>
  `dur ${p.duration!.toFixed(2)} | script ${p.script!.toFixed(2)} style ${p.style!.toFixed(2)} layout ${p.layout!.toFixed(2)} prepaint ${p.prepaint!.toFixed(2)} paint ${p.paint!.toFixed(2)} comp ${p.composite!.toFixed(2)} | render ${p.render!.toFixed(2)} | els ${p.styleElements} objs ${p.layoutObjects}`;
try {
  for (const bench of cpuBenchmarks.filter((b) => select.some((s) => b.id.startsWith(s))))
    for (const rate of rates)
      await withBenchLock(`render ${bench.id} ${rate}x`, async () => {
        loads.push(loadavg()[0]!);
        const samples: Record<string, (Phases & { duration: number })[]> = Object.fromEntries(lanes.map((l) => [l, []]));
        for (let i = 0; i < iterations; i++)
          for (let k = 0; k < lanes.length; k++) {
            const lane = lanes[(k + i) % lanes.length]!;
            samples[lane]!.push(await iteration(browser, `${server.url}/${lane}/index.html`, bench, rate));
          }
        const key = `${bench.id}@${rate}x`;
        results[key] = {};
        for (const lane of lanes) {
          const list = samples[lane]!;
          const m: Record<string, number> = {};
          for (const f of ["duration", "total", ...BUCKETS, "styleElements", "layoutObjects"] as const) m[f] = median(list.map((x) => x[f] as number));
          m.render = median(list.map((x) => rendering(x)));
          results[key]![lane] = m;
          console.log(`${key.padEnd(26)} ${lane.padEnd(10)} ${fmt(m)}`);
        }
      });
} finally {
  await browser.close();
  await server.close();
}
if (out) {
  await mkdir(dirname(resolve(out)), { recursive: true });
  await writeFile(resolve(out), JSON.stringify({ chrome: browser.version(), iterations, rates, load1: loads, results }, null, 2) + "\n");
}
