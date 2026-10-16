// Context suite runner: server (Node, one child process per lane per round, interleaved) and DOM (Chromium via
// Playwright, cross-origin isolated, lanes interleaved per sample). Script time only (no paint).
// node apps/dom-bench/context/run.ts [--targets server,dom] [--samples 15] [--rounds 3] [--scenarios a,b] [--lanes a,b] [--max-depth] [--out file.json]
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { startServer } from "../server.ts";
import { withBenchLock } from "../bench-lock.ts";
import { scenarios as all } from "./shape.js";

const here = dirname(fileURLToPath(import.meta.url)),
  dist = resolve(here, "../dist/context");
const arg = (name: string, fallback: string) => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1]! : fallback);
const targets = arg("targets", "server,dom").split(","),
  samples = Number(arg("samples", "15")),
  rounds = Number(arg("rounds", "3")),
  scenarios = arg("scenarios", all.join(",")).split(","),
  lanes = arg("lanes", "rivet,solid-stable").split(",");
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
};
type Row = Record<string, number[]>;
const results: Record<string, Record<string, Record<string, Row>>> = {};
const push = (target: string, scenario: string, lane: string, metric: string, value: number) =>
  ((((results[target] ??= {})[scenario] ??= {})[lane] ??= {})[metric] ??= []).push(value);

// Server child: one process per lane per round (two Rivet bundles in one process run slower: shared
// global registries), lanes alternate per round against drift. One sample = mean ms over a ~20 ms batch.
const child = `
const urls = process.argv[1].split(","), scenarios = process.argv[2].split(","), samples = +process.argv[3];
const benches = [];
for (const url of urls) { await import(url); benches.push(globalThis.ctxBench); }
const out = urls.map(() => ({}));
for (const name of scenarios) {
  const renders = benches.map((bench) => () => bench.render(name));
  const batches = renders.map((render, l) => {
    const html = render();
    if (typeof html !== "string") throw new Error(name + ": async render");
    let batch = 1; for (let t = performance.now(); performance.now() - t < 20; batch++) render();
    for (let i = 0; i < 20; i++) render();
    const ok = name.startsWith("providers") ? html.includes(">235<") : name.startsWith("error") ? html.includes("failed") : name.startsWith("update") ? html.includes(">0<") : name.startsWith("deep") || name.startsWith("themed") ? html.split("<div").length - 1 === +name.split("-")[1] + 1 : html.split("<b").length - 1 === 1023;
    out[l][name] = { times: [], bytes: html.length, ok, html: html.length < 4000 ? html : html.slice(0, 200) + "…" + html.slice(-200) };
    return batch;
  });
  const batch = Math.max(...batches);
  for (let s = 0; s < samples; s++)
    for (let k = 0; k < renders.length; k++) {
      const l = s % 2 ? renders.length - 1 - k : k, render = renders[l];
      globalThis.gc();
      const t0 = performance.now();
      for (let i = 0; i < batch; i++) render();
      out[l][name].times.push((performance.now() - t0) / batch);
    }
}
process.stdout.write(JSON.stringify(out));
`;
async function server() {
  const per = Math.max(1, Math.ceil(samples / rounds));
  for (let round = 0; round < rounds; round++) {
    for (const lane of round % 2 ? [...lanes].reverse() : lanes) {
      const url = pathToFileURL(resolve(dist, `${lane}-server.js`)).href;
      const run = spawnSync(process.execPath, ["--expose-gc", "--input-type=module", "-e", child, url, scenarios.join(","), String(per)], {
        encoding: "utf8",
        maxBuffer: 1 << 26,
      });
      if (run.status !== 0) throw new Error(`${lane} server: ${run.stderr}`);
      const outs = JSON.parse(run.stdout) as Record<string, { times: number[]; bytes: number; ok: boolean; html: string }>[];
      for (const [name, r] of Object.entries(outs[0]!)) {
        if (!r.ok) throw new Error(`${lane} server ${name}: wrong output ${r.html}`);
        for (const t of r.times) push("server", name, lane, "render", t);
        if (round === 0) push("server", name, lane, "bytes", r.bytes);
      }
    }
  }
}
async function dom() {
  const http = await startServer(0, dist),
    browser = await chromium.launch();
  try {
    const pages = new Map<string, { page: import("playwright").Page; cdp: import("playwright").CDPSession }>();
    for (const lane of lanes) {
      const page = await browser.newPage(),
        cdp = await page.context().newCDPSession(page);
      page.on("pageerror", (error) => console.error(`${lane}: ${error.message}`));
      await page.goto(`${http.url}/${lane}-dom`);
      await page.waitForFunction(() => (window as unknown as { ctxBench?: unknown }).ctxBench);
      if (!(await page.evaluate(() => crossOriginIsolated))) throw new Error(`${lane}: not cross-origin isolated`);
      pages.set(lane, { page, cdp });
    }
    const heap = async (cdp: import("playwright").CDPSession) => {
      await cdp.send("HeapProfiler.collectGarbage");
      await cdp.send("HeapProfiler.collectGarbage");
      return ((await cdp.send("Runtime.getHeapUsage")) as { usedSize: number }).usedSize;
    };
    for (const name of scenarios) {
      for (const lane of lanes) {
        const { page } = pages.get(lane)!;
        // Validate once, then warm up.
        await page.evaluate((n) => (window as any).ctxBench.run(n, true), name);
        for (let i = 0; i < 5; i++) await page.evaluate((n) => (window as any).ctxBench.run(n, false), name);
      }
      for (let s = 0; s < samples; s++)
        for (const lane of s % 2 ? [...lanes].reverse() : lanes) {
          const { page, cdp } = pages.get(lane)!;
          await heap(cdp);
          const r = (await page.evaluate((n) => (window as any).ctxBench.run(n, false), name)) as {
            mount: number;
            update: number | null;
            dispose: number;
            elements: number;
          };
          push("dom", name, lane, "mount", r.mount);
          if (r.update !== null) push("dom", name, lane, "update", r.update);
          push("dom", name, lane, "dispose", r.dispose);
          if (s === 0) push("dom", name, lane, "elements", r.elements);
        }
      for (const lane of lanes) {
        const { page, cdp } = pages.get(lane)!;
        for (let i = 0; i < 3; i++) {
          const before = await heap(cdp);
          await page.evaluate((n) => (window as any).ctxBench.hold(n), name);
          push("dom", name, lane, "heapKB", ((await heap(cdp)) - before) / 1024);
          await page.evaluate(() => (window as any).ctxBench.release());
        }
      }
    }
    // Deepest deep-N tree that mounts on a fresh (cold, unoptimized) page: stack use per nested reactive level.
    if (process.argv.includes("--max-depth"))
      for (const lane of lanes) {
        let lo = 100,
          hi = 4000;
        while (lo < hi) {
          const mid = (lo + hi + 1) >> 1,
            page = await browser.newPage();
          await page.goto(`${http.url}/${lane}-dom`);
          await page.waitForFunction(() => (window as unknown as { ctxBench?: unknown }).ctxBench);
          const ok = await page.evaluate((n) => {
            try {
              (window as any).ctxBench.run(`deep-${n}`, false);
              return true;
            } catch {
              return false;
            }
          }, mid);
          await page.close();
          if (ok) lo = mid;
          else hi = mid - 1;
        }
        push("dom", "max-depth", lane, "levels", lo);
      }
  } finally {
    await browser.close();
    await http.close();
  }
}
await withBenchLock("context suite", async () => {
  if (targets.includes("server")) await server();
  if (targets.includes("dom")) await dom();
});
const summary: string[] = [];
for (const [target, byScenario] of Object.entries(results))
  for (const [name, byLane] of Object.entries(byScenario)) {
    const metrics = Object.keys(byLane[lanes[0]!] ?? {});
    for (const metric of metrics) {
      const cells = lanes.map((lane) => median(byLane[lane]?.[metric] ?? [NaN]));
      const ratio = cells[0]! / cells[1]!;
      summary.push(
        `${target.padEnd(6)} ${name.padEnd(13)} ${metric.padEnd(8)} ${lanes.map((l, i) => `${l} ${cells[i]!.toFixed(metric === "elements" || metric === "bytes" || metric === "levels" ? 0 : 3)}`).join("  ")}  ratio ${ratio.toFixed(2)}`,
      );
    }
  }
console.log(summary.join("\n"));
const outFile = arg("out", resolve(here, "../../../.artifacts/dom-bench/context/latest.json"));
await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, JSON.stringify({ date: new Date().toISOString(), samples, rounds, lanes, results }, null, 2) + "\n");
console.log(`→ ${outFile}`);
