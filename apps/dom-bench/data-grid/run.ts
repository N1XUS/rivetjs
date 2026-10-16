// Data-grid suite runner: Chromium (Playwright), cross-origin isolated, fresh page per sample, lanes interleaved.
// Times = script + style + layout (operation, then a forced layout read), median of samples; heap after GC.
// node apps/dom-bench/data-grid/run.ts [--samples 5] [--cpu 1] [--out file.json]
//   scenarios: data-grid 1k / 10k virtual / 10k plain, cdk-table 1k / 10k (no virtualization in the RAC port).
//   ops: mount, sort (age asc → desc), filter (substring, ~10 % rows), clear filter, select all, scroll (60 steps of
//   one viewport, per-step time + rAF frame intervals while scrolling one step per frame).
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";
import { startServer } from "../server.ts";
import { withBenchLock } from "../bench-lock.ts";
import type { GridBench } from "./shape.ts";

const here = dirname(fileURLToPath(import.meta.url)),
  dist = resolve(here, "../dist/data-grid");
const arg = (name: string, fallback: string) => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1]! : fallback);
const samples = Number(arg("samples", "5")),
  cpu = Number(arg("cpu", "1"));
const scenarios = [
  { lane: "data-grid", rows: 1000, virtual: false, name: "data-grid 1k" },
  { lane: "cdk-table", rows: 1000, virtual: false, name: "cdk-table 1k" },
  { lane: "data-grid", rows: 10_000, virtual: true, name: "data-grid 10k virtual" },
  { lane: "data-grid", rows: 10_000, virtual: false, name: "data-grid 10k plain" },
  { lane: "cdk-table", rows: 10_000, virtual: false, name: "cdk-table 10k" },
];
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : NaN;
};
const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? NaN;
};
type Win = { gridBench: GridBench };
const results: Record<string, Record<string, number[]>> = {};
const push = (k: string, m: string, v: number) => ((results[k] ??= {})[m] ??= []).push(v);

async function sample(page: Page, s: (typeof scenarios)[number]) {
  const cdp = await page.context().newCDPSession(page);
  if (cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  const gc = async () => {
    await cdp.send("HeapProfiler.collectGarbage");
    await cdp.send("HeapProfiler.collectGarbage");
    return ((await cdp.send("Runtime.getHeapUsage")) as { usedSize: number }).usedSize;
  };
  const before = await gc();
  const r = await page.evaluate(
    async ({ rows, virtual }) => {
      const b = (window as unknown as Win).gridBench;
      const frame = () => new Promise((y) => requestAnimationFrame(() => setTimeout(y, 0)));
      const time = (fn: () => void) => {
        const t0 = performance.now();
        fn();
        void document.body.offsetHeight;
        return performance.now() - t0;
      };
      const out: Record<string, number | number[]> = {};
      out.mount = time(() => b.mount(rows, virtual));
      out.rendered = b.bodyRows();
      await frame();
      out.sort = time(() => b.sort());
      await frame();
      out.sortBack = time(() => b.sort());
      await frame();
      out.filter = time(() => b.filter("7"));
      out.filtered = b.bodyRows();
      await frame();
      out.clearFilter = time(() => b.filter(""));
      await frame();
      out.selectAll = time(() => b.selectAll());
      await frame();
      const el = b.scroller();
      const step = el.clientHeight;
      const steps: number[] = [];
      for (let i = 1; i <= 60; i++) steps.push(time(() => b.scrollTo(i * step)));
      out.scrollSteps = steps;
      b.scrollTo(0);
      await frame();
      // rAF-driven scroll: one viewport per frame, 120 frames.
      const intervals: number[] = await new Promise((done) => {
        const list: number[] = [];
        let last = performance.now(),
          i = 0;
        const tick = (now: number) => {
          list.push(now - last);
          last = now;
          b.scrollTo(++i * step * 0.5);
          if (i < 120) requestAnimationFrame(tick);
          else done(list.slice(1));
        };
        requestAnimationFrame((now) => ((last = now), requestAnimationFrame(tick)));
      });
      out.frames = intervals;
      return out;
    },
    { rows: s.rows, virtual: s.virtual },
  );
  push(s.name, "heapMB", ((await gc()) - before) / 1048576);
  for (const [k, v] of Object.entries(r)) {
    if (Array.isArray(v)) {
      if (k === "scrollSteps") (push(s.name, "scrollStepP50", median(v)), push(s.name, "scrollStepP95", pct(v, 0.95)));
      if (k === "frames")
        (push(s.name, "frameP95", pct(v, 0.95)), push(s.name, "fps", 1000 / median(v)), push(s.name, "longFrames", v.filter((x) => x > 25).length));
    } else push(s.name, k, v);
  }
  await page.evaluate(() => (window as unknown as Win).gridBench.dispose());
  await cdp.detach();
}

await withBenchLock("data-grid suite", async () => {
  const http = await startServer(0, dist),
    browser = await chromium.launch({ args: ["--use-mock-keychain", "--password-store=basic", "--js-flags=--expose-gc"] });
  try {
    for (let i = 0; i < samples + 1; i++)
      for (const s of i % 2 ? [...scenarios].reverse() : scenarios) {
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
        page.on("pageerror", (e) => console.error(`${s.name}: ${e.message}`));
        await page.goto(`${http.url}/${s.lane}`);
        await page.waitForFunction(() => (window as unknown as Partial<Win>).gridBench);
        if (!(await page.evaluate(() => crossOriginIsolated))) throw new Error("not cross-origin isolated");
        if (i === 0) {
          // warm-up sample (JIT), discarded
          await page.evaluate(
            ({ rows, virtual }) => ((window as unknown as Win).gridBench.mount(rows, virtual), (window as unknown as Win).gridBench.dispose()),
            s,
          );
        } else await sample(page, s);
        await page.close();
      }
  } finally {
    await browser.close();
    await http.close();
  }
});

const metrics = [
  "mount",
  "sort",
  "sortBack",
  "filter",
  "clearFilter",
  "selectAll",
  "scrollStepP50",
  "scrollStepP95",
  "fps",
  "frameP95",
  "longFrames",
  "heapMB",
  "rendered",
];
const lines = [`scenario`.padEnd(24) + metrics.map((m) => m.padStart(13)).join("")];
for (const s of scenarios)
  lines.push(
    s.name.padEnd(24) +
      metrics
        .map((m) =>
          median(results[s.name]?.[m] ?? [])
            .toFixed(m === "rendered" || m === "longFrames" ? 0 : 2)
            .padStart(13),
        )
        .join(""),
  );
console.log(`median of ${samples} samples, cpu x${cpu}, ms unless noted\n` + lines.join("\n"));
const outFile = arg("out", resolve(here, "../../../.artifacts/dom-bench/data-grid/latest.json"));
await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, JSON.stringify({ date: new Date().toISOString(), samples, cpu, scenarios, results }, null, 2) + "\n");
console.log(`→ ${outFile}`);
