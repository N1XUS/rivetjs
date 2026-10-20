// Masonry suite runner: Chromium (Playwright), cross-origin isolated, fresh page per sample, scenarios interleaved.
// Times = script + style + layout (operation, then a forced layout read), median of samples; heap after GC.
// node apps/dom-bench/masonry/run.ts [--samples 5] [--cpu 1] [--dist <dir>] [--out file.json]
//   scenarios: rivet exact / justified / measure 1k, rivet virtual 10k, vanilla css-columns / round-robin (react-masonry-css
//   algorithm) / measure-absolute (masonry.js algorithm) 1k.
//   ops: mount at 1000 px (3 columns), resize to 1300 px (4 columns) and back, `resizeLayouts` (CDP LayoutCount of one
//   resize + the frame after it), `toggle` / `toggleMid` (rivet live span of item 0 / 500: one incremental relayout), total height,
//   virtual only: 60 scroll steps of one viewport + rAF frames.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";
import { startServer } from "../server.ts";
import { withBenchLock } from "../bench-lock.ts";
import type { MasonryBench, Mode } from "./shape.ts";
import { median } from "../../../scripts/bench/shared.ts";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name: string, fallback: string) => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1]! : fallback);
const samples = Number(arg("samples", "5")),
  cpu = Number(arg("cpu", "1")),
  dist = resolve(arg("dist", resolve(here, "../../../.artifacts/dom-bench/masonry/dist")));
const scenarios: { lane: string; mode: Mode; count: number; name: string }[] = [
  { lane: "rivet", mode: "exact", count: 1000, name: "rivet exact 1k" },
  { lane: "rivet", mode: "exact-fixed", count: 1000, name: "rivet exact-3 1k" },
  { lane: "rivet", mode: "justified", count: 1000, name: "rivet justified 1k" },
  { lane: "rivet", mode: "justified-max", count: 1000, name: "rivet justified max 1k" },
  { lane: "rivet", mode: "measure", count: 1000, name: "rivet measure 1k" },
  { lane: "vanilla", mode: "css-columns", count: 1000, name: "css-columns 1k" },
  { lane: "vanilla", mode: "round-robin", count: 1000, name: "round-robin 1k" },
  { lane: "vanilla", mode: "measure-absolute", count: 1000, name: "measure-abs 1k" },
  { lane: "rivet", mode: "virtual", count: 10_000, name: "rivet virtual 10k" },
];
const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? NaN;
};
type Win = { masonryBench: MasonryBench };
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
    async ({ count, mode }) => {
      const b = (window as unknown as Win).masonryBench;
      const frame = () => new Promise((y) => requestAnimationFrame(() => setTimeout(y, 0)));
      const time = (fn: () => void) => {
        const t0 = performance.now();
        fn();
        void document.body.offsetHeight;
        return performance.now() - t0;
      };
      const out: Record<string, number | number[]> = {};
      document.querySelector<HTMLElement>("#host")!.style.width = "1000px";
      const t0 = performance.now();
      b.mount(count, mode);
      out.mountScript = performance.now() - t0;
      void document.body.offsetHeight;
      out.mount = performance.now() - t0;
      out.rendered = b.rendered();
      await frame();
      out.height = b.height();
      out.resize = time(() => b.resize(1300));
      await frame();
      out.resizeBack = time(() => b.resize(1000));
      await frame();
      // Live item control (rivet exact / justified): item 0 grows to 2 columns and back.
      if (b.toggle) {
        let ok = false;
        out.toggle = time(() => (ok = b.toggle!()));
        await frame();
        if (!ok) delete out.toggle;
        else {
          b.toggle();
          await frame();
          // Mid-list item (500): rows / columns before it are kept (incremental re-place).
          out.toggleMid = time(() => b.toggle!(500));
          await frame();
          b.toggle(500);
          await frame();
        }
      }
      const el = b.scroller();
      if (el) {
        const step = el.clientHeight;
        const steps: number[] = [];
        for (let i = 1; i <= 60; i++)
          steps.push(
            time(() => {
              el.scrollTop = i * step;
              el.dispatchEvent(new Event("scroll"));
            }),
          );
        out.scrollSteps = steps;
        el.scrollTop = 0;
        await frame();
        out.frames = await new Promise<number[]>((done) => {
          const list: number[] = [];
          let last = performance.now(),
            i = 0;
          const tick = (now: number) => {
            list.push(now - last);
            last = now;
            el.scrollTop = ++i * step * 0.5;
            if (i < 120) requestAnimationFrame(tick);
            else done(list.slice(1));
          };
          requestAnimationFrame((now) => ((last = now), requestAnimationFrame(tick)));
        });
      }
      return out;
    },
    { count: s.count, mode: s.mode },
  );
  push(s.name, "heapMB", ((await gc()) - before) / 1048576);
  for (const [k, v] of Object.entries(r)) {
    if (Array.isArray(v)) {
      if (k === "scrollSteps") (push(s.name, "scrollStepP50", median(v)), push(s.name, "scrollStepP95", pct(v, 0.95)));
      if (k === "frames") (push(s.name, "frameP95", pct(v, 0.95)), push(s.name, "longFrames", v.filter((x) => x > 25).length));
    } else push(s.name, k, v);
  }
  await page.evaluate(() => (window as unknown as Win).masonryBench.dispose());
  // Layout passes of one resize (1000 → 1300 px) incl. the frame after it (observer-driven work), CDP LayoutCount.
  if (s.mode !== "virtual") {
    await cdp.send("Performance.enable");
    const layouts = async () =>
      ((await cdp.send("Performance.getMetrics")) as { metrics: { name: string; value: number }[] }).metrics.find((m) => m.name === "LayoutCount")!.value;
    await page.evaluate(({ count, mode }) => (window as unknown as Win).masonryBench.mount(count, mode), { count: s.count, mode: s.mode });
    await page.evaluate(() => new Promise((y) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(y, 0)))));
    const l0 = await layouts();
    await page.evaluate(async () => {
      (window as unknown as Win).masonryBench.resize(1300);
      await new Promise((y) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(y, 0))));
    });
    push(s.name, "resizeLayouts", (await layouts()) - l0);
    await page.evaluate(() => (window as unknown as Win).masonryBench.dispose());
  }
  await cdp.detach();
}

await withBenchLock("masonry suite", async () => {
  const http = await startServer(0, dist),
    browser = await chromium.launch({ args: ["--use-mock-keychain", "--password-store=basic", "--js-flags=--expose-gc"] });
  try {
    for (let i = 0; i < samples + 1; i++)
      for (const s of i % 2 ? [...scenarios].reverse() : scenarios) {
        const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
        page.on("pageerror", (e) => console.error(`${s.name}: ${e.message}`));
        await page.goto(`${http.url}/${s.lane}`);
        await page.waitForFunction(() => (window as unknown as Partial<Win>).masonryBench);
        if (!(await page.evaluate(() => crossOriginIsolated))) throw new Error("not cross-origin isolated");
        if (i === 0) {
          // warm-up sample (JIT), discarded
          await page.evaluate(
            ({ count, mode }) => ((window as unknown as Win).masonryBench.mount(count, mode), (window as unknown as Win).masonryBench.dispose()),
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
  "mountScript",
  "mount",
  "resize",
  "resizeBack",
  "resizeLayouts",
  "toggle",
  "toggleMid",
  "heapMB",
  "height",
  "rendered",
  "scrollStepP50",
  "scrollStepP95",
  "frameP95",
  "longFrames",
];
const lines = [`scenario`.padEnd(24) + metrics.map((m) => m.padStart(14)).join("")];
for (const s of scenarios)
  lines.push(
    s.name.padEnd(24) +
      metrics
        .map((m) =>
          median(results[s.name]?.[m] ?? [])
            .toFixed(m === "rendered" || m === "longFrames" || m === "height" || m === "resizeLayouts" ? 0 : 2)
            .padStart(14),
        )
        .join(""),
  );
console.log(`median of ${samples} samples, cpu x${cpu}, ms unless noted\n` + lines.join("\n"));
const outFile = arg("out", resolve(here, "../../../.artifacts/dom-bench/masonry/latest.json"));
await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, JSON.stringify({ date: new Date().toISOString(), samples, cpu, scenarios, results }, null, 2) + "\n");
console.log(`→ ${outFile}`);
