// Allocation profile of one timed large-DOM mount under the run.ts mount protocol (warm-up cycle, forced GC, re-warm
// cycle, timed mount): CDP HeapProfiler sampling including objects collected by minor and major GC, so the totals are
// bytes allocated (not retained). Prints bytes per row and the top allocation sites (self bytes per function and per
// url:line:column; minified lanes show minified names — pass `--dist` with an unminified build to read them, and
// `--flags "--max-inlined-bytecode-size=0"` to keep inlined callees apart).
// Usage: node apps/dom-bench/alloc.ts [--lanes rivet,solid-stable] [--rows 5000] [--interval 64] [--repeat 2] [--top 25]
//   [--dist dir] [--flags "<v8 flags>"]
import { chromium } from "playwright";
import { startServer } from "./server.ts";

const arg = (k: string, d: string) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1]! : d);
const lanes = arg("--lanes", "rivet").split(","),
  rows = Number(arg("--rows", "5000")),
  interval = Number(arg("--interval", "64")),
  repeat = Number(arg("--repeat", "2")),
  top = Number(arg("--top", "25")),
  flags = arg("--flags", "");
interface ProfileNode {
  callFrame: { functionName: string; url: string; lineNumber: number; columnNumber: number };
  selfSize: number;
  children: ProfileNode[];
}
const server = await (process.argv.includes("--dist") ? startServer(0, arg("--dist", "")) : startServer());
const browser = await chromium.launch({ args: flags ? [`--js-flags=${flags}`] : [] });
try {
  for (const lane of lanes) {
    const byFunction = new Map<string, number>(),
      bySite = new Map<string, number>();
    let total = 0;
    for (let k = 0; k < repeat; k++) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      await page.goto(`${server.url}/${lane}`);
      await page.waitForFunction(() => window.bench);
      const cdp = await context.newCDPSession(page);
      const cycle = () =>
        page.evaluate((r) => {
          window.bench.mount(r);
          window.bench.dispose();
        }, rows);
      await cycle();
      await cdp.send("HeapProfiler.collectGarbage");
      await cycle();
      await page.evaluate(() => new Promise((y) => setTimeout(y, 0)));
      await cdp.send("HeapProfiler.enable");
      await cdp.send("HeapProfiler.startSampling", {
        samplingInterval: interval,
        includeObjectsCollectedByMajorGC: true,
        includeObjectsCollectedByMinorGC: true,
      });
      await page.evaluate((r) => window.bench.mount(r), rows);
      const { profile } = (await cdp.send("HeapProfiler.stopSampling")) as unknown as { profile: { head: ProfileNode } };
      const visit = (node: ProfileNode) => {
        const name = node.callFrame.functionName || "(anonymous)",
          site = `${name} ${node.callFrame.url.split("/").pop()}:${node.callFrame.lineNumber + 1}:${node.callFrame.columnNumber + 1}`;
        if (node.selfSize) {
          byFunction.set(name, (byFunction.get(name) ?? 0) + node.selfSize);
          bySite.set(site, (bySite.get(site) ?? 0) + node.selfSize);
          total += node.selfSize;
        }
        for (const child of node.children) visit(child);
      };
      visit(profile.head);
      await context.close();
    }
    const perRow = (bytes: number) => (bytes / repeat / rows).toFixed(0).padStart(7);
    console.log(
      `${lane} ${rows} rows, ${repeat} mounts, ${interval} B sampling: ${(total / repeat / 1048576).toFixed(2)} MiB / mount = ${perRow(total).trim()} B / row`,
    );
    for (const [title, map] of [
      ["by function", byFunction],
      ["by site", bySite],
    ] as const) {
      console.log(`  -- ${title} (B / row)`);
      for (const [key, bytes] of [...map].sort((a, b) => b[1] - a[1]).slice(0, top)) console.log(`  ${perRow(bytes)} ${key}`);
    }
  }
} finally {
  await browser.close();
  await server.close();
}
