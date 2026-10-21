// Mount-only A/B of the large-DOM lanes (built by build.ts): lanes interleaved per sample, a fresh context per lane per
// sample, warm-up mount + dispose, then (as run.ts) Performance.enable + a forced GC + one yielded macrotask before the
// timed mount.
// Usage: node apps/dom-bench/mount-quick.ts [--lanes rivet,rivet-base,solid-stable] [--rows 1000,5000] [--samples 15]
//   [--warm 1] [--gc 1|0] [--yield 1|0] [--perf 1|0] [--idle <ms>] [--flags "<v8 flags>"] [--gc-trace] [--out file.json]
// --gc 0 drops the forced GC; --yield 0 restores the pre-2026-10-21 protocol (timed mount right after the GC, where V8's
// incremental-marking finalization delay can land inside a 5000-row mount: docs/benchmarks/2026-10-20-dom-mount.md).
// --gc-trace adds `--trace-incremental-marking --trace-gc` and counts, per lane, V8's "Delaying GC via stack guard"
// decisions inside the timed mount, bracketed by minor GCs (`--expose-gc`) in the task before it and right after the
// mount (renderer stdout to a file through a wrapper script, one browser per lane per sample: diagnostic only, time
// with the default mode).
import type { Browser } from "playwright";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { loadavg, tmpdir } from "node:os";
import { join } from "node:path";
import { startServer } from "./server.ts";
import { hostElements } from "./metrics.ts";
import { withBenchLock } from "./bench-lock.ts";
import { median } from "../../scripts/bench/shared.ts";
const arg = (k: string, d: string) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1]! : d);
const lanes = arg("--lanes", "rivet,solid-stable").split(","),
  rows = arg("--rows", "1000").split(",").map(Number),
  samples = Number(arg("--samples", "15")),
  warm = Number(arg("--warm", "1")),
  out = arg("--out", ""),
  gc = arg("--gc", "1") === "1",
  yieldTask = arg("--yield", "1") === "1",
  rewarm = arg("--rewarm", "1") === "1",
  perf = arg("--perf", "1") === "1",
  idle = Number(arg("--idle", "0")),
  gcTrace = process.argv.includes("--gc-trace");
const flags = [arg("--flags", ""), gcTrace ? "--trace-incremental-marking --trace-gc --expose-gc" : ""].filter(Boolean).join(" ");
let shell = "";
if (gcTrace) {
  // Playwright's debug log names the launched binary (headless shell); read it once, keep it off the console.
  process.env.DEBUG = "pw:browser";
  const write = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((chunk: string | Uint8Array, ...rest: never[]) => {
    const text = String(chunk);
    if (!text.includes("pw:browser")) return write(chunk, ...rest);
    shell ||= text.match(/<launching> (\S+)/)?.[1] ?? "";
    return true;
  }) as typeof process.stderr.write;
}
const { chromium } = await import("playwright");
const args = flags ? [`--js-flags=${flags}`] : [];
const server = await startServer();
let browser: Browser = await chromium.launch({ args });
const version = browser.version();
// gc-trace: the renderer's stdout (V8 traces) goes to a file through a wrapper script. A pipe drops lines (non-blocking
// writes, ~250 KB of marking steps per 5000-row mount) and only a browser exit flushes the block buffer, so this mode
// launches one browser per lane per sample.
const traceDir = gcTrace ? await mkdtemp(join(tmpdir(), "rivet-gc-trace-")) : "";
const traceLog = join(traceDir, "renderer.log"),
  wrapper = join(traceDir, "chrome.sh");
if (gcTrace) {
  await browser.close();
  if (!shell) throw Error("gc-trace: launched browser binary not found in the Playwright log");
  await writeFile(wrapper, `#!/bin/sh\nexec "${shell}" "$@" > "${traceLog}"\n`, { mode: 0o755 });
}
const launch = () => chromium.launch({ args, ...(gcTrace ? { executablePath: wrapper } : {}) });
if (gcTrace) browser = await launch();
const res: Record<string, Record<number, number[]>> = {};
const trace: Record<string, Record<number, { delayed: number; notDelayed: number; mountMarkCompacts: number }>> = {};
const loads: number[] = [];
/** Lines of the page isolate between the minor GC (`gc()` = "testing") issued just before the timed mount task and the first one issued inside it right after the mount. */
function timedWindow(lines: string[]) {
  const marker = (l: string) => l.includes("Scavenge") && l.includes("testing");
  const isolate = lines.find(marker)?.match(/^\[(\d+:0x[0-9a-f]+)/)?.[1];
  const own = lines.filter((l) => isolate && l.startsWith(`[${isolate}`));
  const start = own.findIndex(marker),
    end = own.findIndex((l, i) => i > start && marker(l));
  if (start < 0 || end < 0) throw Error("gc-trace: GC markers not found in the renderer log");
  return own.slice(start + 1, end);
}
try {
  await withBenchLock("dom-mount quick", async () => {
    for (const r of rows)
      for (let s = 0; s < samples; s++) {
        loads.push(loadavg()[0]!);
        for (let o = 0; o < lanes.length; o++) {
          const lane = lanes[(o + s) % lanes.length]!;
          const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
          const page = await context.newPage();
          await page.goto(`${server.url}/${lane}`);
          await page.waitForFunction(() => window.bench);
          if (!(await page.evaluate(() => crossOriginIsolated))) throw Error("not COI");
          const cdp = await context.newCDPSession(page);
          if (perf) await cdp.send("Performance.enable", { timeDomain: "threadTicks" });
          const cycle = (n: number) =>
            page.evaluate(
              async ({ r, n }) => {
                for (let i = 0; i < n; i++) {
                  window.bench.mount(r);
                  window.bench.dispose();
                }
                void document.body.getBoundingClientRect();
                await new Promise((y) => requestAnimationFrame(() => requestAnimationFrame(y)));
              },
              { r, n },
            );
          await cycle(warm);
          // As run.ts: forced GC (baseline heap) after the warm-up, one unforced re-warm cycle (heap limits grown again, so
          // no marking cycle starts inside the timed mount), then one macrotask.
          if (gc) await cdp.send("HeapProfiler.collectGarbage");
          if (rewarm) await cycle(1);
          if (yieldTask) await page.evaluate(() => new Promise((y) => setTimeout(y, 0)));
          if (idle) await page.evaluate((ms) => new Promise((y) => setTimeout(y, ms)), idle);
          // gc-trace start marker: a minor GC (young generation only) in its own task.
          if (gcTrace) await page.evaluate(() => (globalThis as unknown as { gc(o: object): void }).gc({ type: "minor" }));
          const ms = await page.evaluate(
            ({ r, gcTrace }) => {
              const b = performance.now();
              window.bench.mount(r);
              const t = performance.now() - b;
              // gc-trace: a minor GC in the same task marks the end of the timed mount; the rest only pads the
              // renderer's stdout block buffer so the marker reaches the file before the browser exits.
              if (gcTrace) for (let i = 0; i < 80; i++) (globalThis as unknown as { gc(o: object): void }).gc({ type: "minor" });
              return t;
            },
            { r, gcTrace },
          );
          await page.evaluate((elements) => {
            if (document.querySelectorAll("#host *").length !== elements) throw Error("size");
            window.bench.dispose();
          }, hostElements(r));
          ((res[lane] ??= {})[r] ??= []).push(ms);
          if (gcTrace) {
            await browser.close();
            const lines = timedWindow((await readFile(traceLog, "utf8")).split("\n")),
              count = (re: RegExp) => lines.filter((l) => re.test(l)).length,
              t = ((trace[lane] ??= {})[r] ??= { delayed: 0, notDelayed: 0, mountMarkCompacts: 0 });
            t.delayed += count(/Delaying GC via stack guard, avg/);
            t.notDelayed += count(/Not delaying GC via stack guard, avg/);
            t.mountMarkCompacts += count(/Mark-Compact/);
            if (process.env.GC_TRACE_DUMP) console.log(`--- ${lane} ${r} ${ms.toFixed(1)} ms\n${lines.join("\n")}`);
            browser = await launch();
          } else await context.close();
        }
      }
  });
} finally {
  await browser.close();
  await server.close();
  if (traceDir) await rm(traceDir, { recursive: true, force: true });
}
for (const r of rows) {
  const base = median(res[lanes[0]!]![r]!);
  for (const l of lanes) {
    const a = res[l]![r]!,
      sorted = [...a].sort((x, y) => x - y),
      t = trace[l]?.[r];
    console.log(
      `${r} ${l.padEnd(16)} median ${median(a).toFixed(2)} ms  (${sorted[0]!.toFixed(2)}–${sorted.at(-1)!.toFixed(2)})  q1–q3 ${sorted[Math.floor(a.length / 4)]!.toFixed(2)}–${sorted[Math.floor((3 * a.length) / 4)]!.toFixed(2)}  vs ${lanes[0]} ${((median(a) / base - 1) * 100).toFixed(1)}%` +
        (t ? `  [gc-trace in ${a.length} mounts: delayed ${t.delayed}, not delayed ${t.notDelayed}, mark-compacts ${t.mountMarkCompacts}]` : ""),
    );
  }
}
console.log(`load1 during run: ${Math.min(...loads).toFixed(1)}–${Math.max(...loads).toFixed(1)}; browser ${version}`);
if (out) await writeFile(out, JSON.stringify({ lanes, rows, samples, warm, gc, rewarm, yield: yieldTask, browser: version, loads, res, trace }, null, 2));
