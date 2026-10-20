// Mount-only A/B of the large-DOM lanes (built by build.ts): lanes interleaved per sample, a fresh context per lane per
// sample, warm-up mount + dispose, then (as run.ts) Performance.enable + a forced GC before the timed mount.
// Usage: node apps/dom-bench/mount-quick.ts [--lanes rivet,rivet-base,solid-stable] [--rows 1000,5000] [--samples 15]
//   [--warm 1] [--gc 1|0] [--perf 1|0] [--idle <ms>] [--flags "<v8 flags>"] [--out file.json]
// --gc 0 drops the forced GC: V8's incremental-marking finalization delay then no longer lands inside a 5000-row mount
// (docs/benchmarks/2026-10-20-dom-mount.md).
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import { loadavg } from "node:os";
import { startServer } from "./server.ts";
import { withBenchLock } from "./bench-lock.ts";
const arg = (k: string, d: string) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1]! : d);
const lanes = arg("--lanes", "rivet,solid-stable").split(","),
  rows = arg("--rows", "1000").split(",").map(Number),
  samples = Number(arg("--samples", "15")),
  warm = Number(arg("--warm", "1")),
  out = arg("--out", ""),
  gc = arg("--gc", "1") === "1",
  perf = arg("--perf", "1") === "1",
  idle = Number(arg("--idle", "0"));
const server = await startServer(),
  browser = await chromium.launch({ args: arg("--flags", "") ? [`--js-flags=${arg("--flags", "")}`] : [] });
const res: Record<string, Record<number, number[]>> = {};
const loads: number[] = [];
const med = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2;
};
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
          await page.evaluate(
            async ({ r, warm }) => {
              for (let i = 0; i < warm; i++) {
                window.bench.mount(r);
                window.bench.dispose();
              }
              void document.body.getBoundingClientRect();
              await new Promise((y) => requestAnimationFrame(() => requestAnimationFrame(y)));
            },
            { r, warm },
          );
          // As run.ts: forced GC (baseline heap) between the warm-up cycle and the timed mount.
          if (gc) await cdp.send("HeapProfiler.collectGarbage");
          if (idle) await page.evaluate((ms) => new Promise((y) => setTimeout(y, ms)), idle);
          const ms = await page.evaluate((r) => {
            const b = performance.now();
            window.bench.mount(r);
            const t = performance.now() - b;
            if (document.querySelectorAll("#host *").length !== r * 57 + 1) throw Error("size");
            window.bench.dispose();
            return t;
          }, r);
          ((res[lane] ??= {})[r] ??= []).push(ms);
          await context.close();
        }
      }
  });
} finally {
  await browser.close();
  await server.close();
}
for (const r of rows) {
  const base = med(res[lanes[0]!]![r]!);
  for (const l of lanes) {
    const a = res[l]![r]!;
    console.log(
      `${r} ${l.padEnd(16)} median ${med(a).toFixed(2)} ms  (${Math.min(...a).toFixed(2)}–${Math.max(...a).toFixed(2)})  q1–q3 ${[...a].sort((x, y) => x - y)[Math.floor(a.length / 4)]!.toFixed(2)}–${[...a].sort((x, y) => x - y)[Math.floor((3 * a.length) / 4)]!.toFixed(2)}  vs ${lanes[0]} ${((med(a) / base - 1) * 100).toFixed(1)}%`,
    );
  }
}
console.log(`load1 during run: ${Math.min(...loads).toFixed(1)}–${Math.max(...loads).toFixed(1)}`);
if (out) await writeFile(out, JSON.stringify({ lanes, rows, samples, warm, loads, res }, null, 2));
