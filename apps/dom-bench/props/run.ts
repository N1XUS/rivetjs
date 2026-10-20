// Props suite runner: Chromium via Playwright, cross-origin isolated, lanes interleaved per sample (order
// alternates), CDP heap after forced GC. Script time only (no paint).
// node apps/dom-bench/props/run.ts [--samples 20] [--lanes rivet,solid-stable] [--flags "<js flags>"] [--out file.json]
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startServer } from "../server.ts";
import { withBenchLock } from "../bench-lock.ts";
import { median } from "../../../scripts/bench/shared.ts";

const here = dirname(fileURLToPath(import.meta.url)),
  dist = resolve(here, "../dist/props");
const arg = (name: string, fallback: string) => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1]! : fallback);
const samples = Number(arg("samples", "20")),
  lanes = arg("lanes", "rivet,solid-stable").split(","),
  flags = arg("flags", "");
const results: Record<string, Record<string, number[]>> = {};
const push = (lane: string, metric: string, value: number) => ((results[lane] ??= {})[metric] ??= []).push(value);
type Bench = { propsBench: { run(check: boolean): Record<string, number>; hold(): void; release(): void } };

await withBenchLock("props suite", async () => {
  const http = await startServer(0, dist),
    browser = await chromium.launch({ args: ["--use-mock-keychain", "--password-store=basic", ...(flags ? [`--js-flags=${flags}`] : [])] });
  try {
    const pages = new Map<string, { page: import("playwright").Page; cdp: import("playwright").CDPSession }>();
    for (const lane of lanes) {
      const page = await browser.newPage(),
        cdp = await page.context().newCDPSession(page);
      page.on("pageerror", (error) => console.error(`${lane}: ${error.message}`));
      await page.goto(`${http.url}/${lane}`);
      await page.waitForFunction(() => (window as unknown as Partial<Bench>).propsBench);
      if (!(await page.evaluate(() => crossOriginIsolated))) throw new Error(`${lane}: not cross-origin isolated`);
      pages.set(lane, { page, cdp });
    }
    const heap = async (cdp: import("playwright").CDPSession) => {
      await cdp.send("HeapProfiler.collectGarbage");
      await cdp.send("HeapProfiler.collectGarbage");
      return ((await cdp.send("Runtime.getHeapUsage")) as { usedSize: number }).usedSize;
    };
    for (const lane of lanes) {
      const { page } = pages.get(lane)!;
      await page.evaluate(() => (window as unknown as Bench).propsBench.run(true));
      for (let i = 0; i < 8; i++) await page.evaluate(() => (window as unknown as Bench).propsBench.run(false));
    }
    for (let s = 0; s < samples; s++)
      for (const lane of s % 2 ? [...lanes].reverse() : lanes) {
        const { page, cdp } = pages.get(lane)!;
        await heap(cdp);
        const r = await page.evaluate(() => (window as unknown as Bench).propsBench.run(false));
        for (const [metric, value] of Object.entries(r)) if (metric !== "elements" || s === 0) push(lane, metric, value);
      }
    for (let i = 0; i < 5; i++)
      for (const lane of lanes) {
        const { page, cdp } = pages.get(lane)!;
        const before = await heap(cdp);
        await page.evaluate(() => (window as unknown as Bench).propsBench.hold());
        push(lane, "heapKB", ((await heap(cdp)) - before) / 1024);
        await page.evaluate(() => (window as unknown as Bench).propsBench.release());
      }
  } finally {
    await browser.close();
    await http.close();
  }
});
const metrics = ["mount", "relabel", "select", "bump", "dispose", "heapKB", "elements"];
const ref = lanes.includes("solid-stable") ? "solid-stable" : lanes[lanes.length - 1]!;
const lines = [`metric    ${lanes.map((l) => l.padStart(14)).join("")}   (median; ratio vs ${ref})`];
for (const metric of metrics) {
  const cells = lanes.map((lane) => median(results[lane]?.[metric] ?? [NaN]));
  const r = cells[lanes.indexOf(ref)]!;
  lines.push(`${metric.padEnd(10)}${cells.map((c) => `${c.toFixed(metric === "elements" ? 0 : 3).padStart(9)} ${(c / r).toFixed(2)}`.padStart(14)).join("")}`);
}
console.log(lines.join("\n"));
const outFile = arg("out", resolve(here, "../../../.artifacts/dom-bench/props/latest.json"));
await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, JSON.stringify({ date: new Date().toISOString(), samples, lanes, flags, results }, null, 2) + "\n");
console.log(`→ ${outFile}`);
