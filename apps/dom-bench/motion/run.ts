// Motion suite runner (`@rivetjs/motion` plan T14): Chromium (Playwright), cross-origin isolated, fresh page per
// sample, scenarios interleaved (order flips every sample), first sample discarded (warm-up).
//   mount-1000     1000 elements with a static `animate` target: mount script ms (+ forced layout), heap after GC.
//   stagger-1000   1000 staggered entrances (opacity + y, 0.4 s, 2 ms apart): mount script ms, first frame ms,
//                  dropped frames (rAF intervals > 25 ms over 1.2 s), CDP script ms over the run, heap after GC.
//   relayout-1000  1000 items, item 0 expands (every later item moves): rivet masonry house / `layoutDriver`, rivet
//                  CSS grid + `animateLayout`, react `layout` grid, vanilla Motion `animateLayout` grid: trigger → first
//                  frame ms, rect / offset reads, CDP script ms + LayoutCount, dropped frames over 0.7 s.
// node apps/dom-bench/motion/run.ts [--samples 5] [--cpu 4] [--dist <dir>] [--out file.json]
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";
import { startServer } from "../server.ts";
import { withBenchLock } from "../bench-lock.ts";
import type { MotionBench, Scenario } from "./shape.ts";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name: string, fallback: string) => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1]! : fallback);
const samples = Number(arg("samples", "5")),
  cpu = Number(arg("cpu", "4")),
  dist = resolve(arg("dist", resolve(here, "../../../.artifacts/dom-bench/motion/dist")));
const scenarios: { name: string; lane: string; query?: string; scenario: Scenario }[] = [];
for (const lane of ["rivet", "react", "vanilla"]) {
  scenarios.push({ name: `${lane} mount-1000`, lane, scenario: "mount" });
  scenarios.push({ name: `${lane} stagger-1000`, lane, scenario: "stagger" });
}
scenarios.push(
  { name: "rivet relayout masonry house", lane: "rivet", scenario: "relayout" },
  { name: "rivet relayout masonry waapi", lane: "rivet", query: "?driver=waapi", scenario: "relayout" },
  { name: "rivet relayout grid", lane: "rivet", query: "?driver=grid", scenario: "relayout" },
  { name: "react relayout grid", lane: "react", scenario: "relayout" },
  { name: "vanilla relayout grid", lane: "vanilla", scenario: "relayout" },
);
type Win = { motionBench: MotionBench; reads: number };
const results: Record<string, Record<string, number[]>> = {};
const push = (k: string, m: string, v: number) => ((results[k] ??= {})[m] ??= []).push(v);
const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);
const median = (xs: number[]) => {
  const s = sorted(xs);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : NaN;
};

async function sample(page: Page, s: (typeof scenarios)[number]) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  if (cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  const metrics = async () =>
    Object.fromEntries(((await cdp.send("Performance.getMetrics")) as { metrics: { name: string; value: number }[] }).metrics.map((m) => [m.name, m.value]));
  const gc = async () => {
    await cdp.send("HeapProfiler.collectGarbage");
    return ((await cdp.send("Runtime.getHeapUsage")) as { usedSize: number }).usedSize;
  };
  const before = await gc();
  if (s.scenario === "relayout") {
    await page.evaluate(() => (window as unknown as Win).motionBench.mount("relayout", 1000));
    await page.evaluate(() => new Promise((y) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(y, 50)))));
    await page.evaluate(() => {
      const w = window as unknown as Win;
      w.reads = 0;
      const rect = Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = function () {
        w.reads++;
        return rect.call(this);
      };
      for (const k of ["offsetTop", "offsetLeft", "offsetWidth", "offsetHeight"] as const) {
        const d = Object.getOwnPropertyDescriptor(HTMLElement.prototype, k)!;
        Object.defineProperty(HTMLElement.prototype, k, {
          get() {
            w.reads++;
            return d.get!.call(this);
          },
          configurable: true,
        });
      }
    });
  }
  const m0 = await metrics();
  const r = await page.evaluate(
    ({ scenario, window: ms }) =>
      new Promise<Record<string, number>>((resolve) => {
        const b = (window as unknown as Win).motionBench;
        const t0 = performance.now();
        if (scenario === "relayout") b.relayout!();
        else b.mount(scenario, 1000);
        const script = performance.now() - t0;
        void document.body.offsetHeight;
        const mount = performance.now() - t0;
        let first = 0,
          last = t0,
          dropped = 0;
        const tick = (t: number) => {
          if (!first) first = performance.now() - t0;
          else if (t - last > 25) dropped++;
          last = t;
          if (t - t0 < ms) requestAnimationFrame(tick);
          else resolve({ script, mount, first, dropped, reads: (window as unknown as Win).reads ?? 0 });
        };
        requestAnimationFrame(tick);
      }),
    { scenario: s.scenario, window: s.scenario === "stagger" ? 1200 : s.scenario === "relayout" ? 700 : 200 },
  );
  const m1 = await metrics();
  push(s.name, "cdpScript", (m1.ScriptDuration! - m0.ScriptDuration!) * 1000);
  push(s.name, "layouts", m1.LayoutCount! - m0.LayoutCount!);
  for (const [k, v] of Object.entries(r)) push(s.name, k, v);
  push(s.name, "heapMB", ((await gc()) - before) / 1048576);
  await cdp.detach();
}

await withBenchLock("motion suite", async () => {
  const http = await startServer(0, dist),
    browser = await chromium.launch({ args: ["--use-mock-keychain", "--password-store=basic", "--js-flags=--expose-gc"] });
  try {
    for (let i = 0; i < samples + 1; i++)
      for (const s of i % 2 ? [...scenarios].reverse() : scenarios) {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        page.on("pageerror", (e) => console.error(`${s.name}: ${e.message}`));
        await page.goto(`${http.url}/${s.lane}${s.query ?? ""}`);
        await page.waitForFunction(() => (window as unknown as Partial<Win>).motionBench);
        if (!(await page.evaluate(() => crossOriginIsolated))) throw new Error("not cross-origin isolated");
        if (i > 0) await sample(page, s);
        else if (s.scenario !== "relayout")
          await page.evaluate((sc) => ((window as unknown as Win).motionBench.mount(sc, 1000), (window as unknown as Win).motionBench.dispose()), s.scenario);
        await page.close();
      }
  } finally {
    await browser.close();
    await http.close();
  }
});

const cols = ["script", "mount", "first", "dropped", "cdpScript", "layouts", "reads", "heapMB"];
const lines = ["scenario".padEnd(32) + cols.map((c) => c.padStart(11)).join("")];
for (const s of scenarios)
  lines.push(
    s.name.padEnd(32) +
      cols
        .map((c) =>
          median(results[s.name]?.[c] ?? [])
            .toFixed(c === "dropped" || c === "layouts" || c === "reads" ? 0 : 2)
            .padStart(11),
        )
        .join(""),
  );
console.log(`median of ${samples} samples, cpu x${cpu}, ms unless noted\n` + lines.join("\n"));
const outFile = arg("out", resolve(here, "../../../.artifacts/dom-bench/motion/latest.json"));
await mkdir(dirname(outFile), { recursive: true });
const summary = Object.fromEntries(
  Object.entries(results).map(([k, m]) => [
    k,
    Object.fromEntries(Object.entries(m).map(([n, xs]) => [n, { min: sorted(xs)[0], median: median(xs), n: xs.length }])),
  ]),
);
await writeFile(outFile, JSON.stringify({ date: new Date().toISOString(), samples, cpu, summary, results }, null, 2) + "\n");
console.log(`→ ${outFile}`);
