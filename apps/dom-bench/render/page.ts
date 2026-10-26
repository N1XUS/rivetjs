// Rendering-cost breakdown of built pages (docs / ui-docs frames, any static dist): load phases (navigation ->
// load + settle) and per-interaction phases (click / key -> next Commit), main-thread self time per bucket
// (render/phases.ts), optional CSS selector stats (Chrome `disabled-by-default-blink.debug` SelectorStats).
// Usage: node apps/dom-bench/render/page.ts --root apps/ui-docs/dist/client --pages <file.json> [--cpu 1,4]
//   [--iterations 5] [--only a,b] [--selector-stats] [--names] [--css-swap from=to,...] [--out file.json]
// `--names` prints self time per trace event name; `RENDER_TRACE_CATEGORIES=a,b` adds trace categories.
// pages file: [{ "name": "kanban", "path": "/examples/showcase-kanban/frame/", "steps": [{ "click": "css" } | { "key": "ArrowDown" } | { "wait": ms }] }]
// Steps run in order; steps with "measure": false are warmups (not traced). `--css-swap a=b` serves file b
// for request path a (A/B of a stylesheet without rebuilding).
import { chromium, type Browser, type Page } from "playwright";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { loadavg } from "node:os";
import { dirname, extname, resolve } from "node:path";
import type { AddressInfo } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";
import { computeCPU, type TraceEvent } from "../krausest/timeline.ts";
import { median } from "../../../scripts/bench/shared.ts";
import { BUCKETS, mainThread, phases, rendering, type Phases } from "./phases.ts";

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : args[i + 1]!;
};
const flag = (name: string) => args.includes(`--${name}`);
const root = resolve(option("root", "apps/ui-docs/dist/client"));
const rates = option("cpu", "1,4").split(",").map(Number);
const iterations = Number(option("iterations", "5"));
const selectorStats = flag("selector-stats");
const names = flag("names");
const nameTotals: Record<string, Record<string, number>> = {};
const swaps = new Map(
  option("css-swap", "")
    .split(",")
    .filter(Boolean)
    .map((x) => x.split("=") as [string, string]),
);
type Step = { click?: string; key?: string; wait?: number; measure?: boolean; name?: string };
type PageSpec = { name: string; path: string; steps?: Step[]; width?: number; height?: number };
const pages = JSON.parse(await readFile(resolve(option("pages", "")), "utf8")) as PageSpec[];
const only = option("only", "");
const chrome = option("chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");

const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".jpg": "image/jpeg",
};
const server = createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url!, "http://localhost").pathname);
    if (swaps.has(path)) {
      response.writeHead(200, { "Content-Type": types[extname(swaps.get(path)!)] ?? "text/css", "Cache-Control": "no-store" });
      return void response.end(await readFile(resolve(swaps.get(path)!)));
    }
    let file = resolve(root, "." + path);
    if (!file.startsWith(root)) return void response.writeHead(403).end();
    if (path.endsWith("/") || (existsSync(file) && (await stat(file)).isDirectory())) file = resolve(file, "index.html");
    else if (!existsSync(file) && existsSync(file + ".html")) file += ".html";
    const body = await readFile(file);
    response.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    response.end(body);
  } catch {
    response.writeHead(404).end("Not found");
  }
});
await new Promise<void>((yes) => server.listen(0, "127.0.0.1", yes));
const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

const categories = [
  "devtools.timeline",
  "disabled-by-default-devtools.timeline",
  "v8",
  "blink.user_timing",
  "loading",
  ...(selectorStats ? ["disabled-by-default-blink.debug"] : []),
  ...(process.env.RENDER_TRACE_CATEGORIES?.split(",").filter(Boolean) ?? []),
];
const parse = (buffer: Buffer): TraceEvent[] => {
  const raw = JSON.parse(buffer.toString("utf8")) as { traceEvents?: TraceEvent[] } | TraceEvent[];
  return Array.isArray(raw) ? raw : (raw.traceEvents ?? []);
};
type Sel = Record<string, { elapsed: number; attempts: number; matches: number }>;
const collectSelectors = (trace: TraceEvent[], pid: number, from: number, to: number, into: Sel) => {
  for (const e of trace) {
    if (e.name !== "SelectorStats" || e.pid !== pid || e.ts < from || e.ts > to) continue;
    // Chrome names the field "elapsed (us)".
    const timings =
      (e.args as { selector_stats?: { selector_timings?: ({ selector: string; match_attempts: number; match_count: number } & Record<string, unknown>)[] } })
        ?.selector_stats?.selector_timings ?? [];
    for (const t of timings) {
      const x = (into[t.selector] ??= { elapsed: 0, attempts: 0, matches: 0 });
      x.elapsed += Number(t["elapsed (us)"] ?? t.elapsed ?? 0);
      x.attempts += t.match_attempts;
      x.matches += t.match_count;
    }
  }
};

async function run(browser: Browser, spec: PageSpec, rate: number, sel: Sel) {
  const context = await browser.newContext({ viewport: { width: spec.width ?? 1280, height: spec.height ?? 900 } });
  const page: Page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const result: Record<string, Phases & { duration: number }> = {};
  try {
    const cdp = await context.newCDPSession(page);
    if (rate !== 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    await browser.startTracing(page, { screenshots: false, categories });
    await page.goto(origin + spec.path, { waitUntil: "load" });
    await sleep(600);
    let trace = parse(await browser.stopTracing());
    const parseHtml = trace.find((e) => e.name === "ParseHTML" && JSON.stringify(e.args ?? {}).includes(spec.path));
    if (!parseHtml) throw Error(`ParseHTML not found for ${spec.path}`);
    const pid = parseHtml.pid;
    const tid = mainThread(trace, pid);
    const end = Math.max(...trace.filter((e) => e.pid === pid && e.tid === tid && e.ph === "X").map((e) => e.ts + (e.dur ?? 0)));
    const byName: Record<string, number> | undefined = names ? (nameTotals[`${spec.name}@${rate}x load`] ??= {}) : undefined;
    result.load = { duration: (end - parseHtml.ts) / 1000, ...phases(trace, pid, tid, parseHtml.ts, end, byName) };
    collectSelectors(trace, pid, parseHtml.ts, end, sel);
    let k = 0;
    for (const step of spec.steps ?? []) {
      const name = step.name ?? (step.click ? `click ${step.click}` : step.key ? `key ${step.key}` : `wait`);
      if (step.wait) {
        await sleep(step.wait);
        continue;
      }
      const act = async () => {
        if (step.click) await page.click(step.click);
        else if (step.key) await page.keyboard.press(step.key);
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))));
        await sleep(60);
      };
      if (step.measure === false) {
        await act();
        continue;
      }
      await browser.startTracing(page, { screenshots: false, categories });
      await act();
      trace = parse(await browser.stopTracing());
      const cpu = computeCPU(trace, step.click ? "click" : "keydown");
      const key = `${++k}:${name}`;
      result[key] = {
        duration: cpu.duration,
        ...phases(trace, pid, tid, cpu.tsStart, cpu.tsEnd, names ? (nameTotals[`${spec.name}@${rate}x ${key}`] ??= {}) : undefined),
      };
      collectSelectors(trace, pid, cpu.tsStart, cpu.tsEnd, sel);
    }
    if (rate !== 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    if (errors.length) throw Error(errors.join("\n"));
    return result;
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch({
  executablePath: existsSync(chrome) ? chrome : undefined,
  headless: true,
  args: ["--js-flags=--expose-gc", "--enable-benchmarking"],
});
const results: Record<string, Record<string, Record<string, number>>> = {};
const selectors: Record<string, Sel> = {};
const loads: number[] = [];
try {
  for (const spec of pages.filter((p) => !only || only.split(",").includes(p.name)))
    for (const rate of rates) {
      loads.push(loadavg()[0]!);
      const sel: Sel = {};
      const samples: Record<string, Phases & { duration: number }>[] = [];
      for (let i = 0; i < iterations; i++) samples.push(await run(browser, spec, rate, sel));
      const key = `${spec.name}@${rate}x`;
      results[key] = {};
      for (const phase of Object.keys(samples[0]!)) {
        const list = samples.map((s) => s[phase]!).filter(Boolean);
        const m: Record<string, number> = {};
        for (const f of ["duration", "total", ...BUCKETS, "styleElements", "layoutObjects"] as const) m[f] = median(list.map((x) => x[f] as number));
        m.render = median(list.map((x) => rendering(x)));
        results[key]![phase] = m;
        console.log(
          `${key.padEnd(28)} ${phase.slice(0, 34).padEnd(34)} script ${m.script!.toFixed(2)} style ${m.style!.toFixed(2)} layout ${m.layout!.toFixed(2)} prepaint ${m.prepaint!.toFixed(2)} paint ${m.paint!.toFixed(2)} comp ${m.composite!.toFixed(2)} | render ${m.render!.toFixed(2)} | els ${m.styleElements} objs ${m.layoutObjects}`,
        );
      }
      if (selectorStats)
        selectors[key] = Object.fromEntries(
          Object.entries(sel)
            .sort((a, b) => b[1].elapsed - a[1].elapsed)
            .slice(0, 60),
        );
    }
} finally {
  await browser.close();
  server.close();
}
if (names)
  for (const [key, totals] of Object.entries(nameTotals))
    console.log(
      `${key}: ` +
        Object.entries(totals)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 14)
          .map(([n, v]) => `${n} ${(v / iterations).toFixed(2)}`)
          .join(", "),
    );
const out = option("out", "");
if (out) {
  await mkdir(dirname(resolve(out)), { recursive: true });
  await writeFile(resolve(out), JSON.stringify({ chrome: browser.version(), iterations, rates, load1: loads, results, selectors }, null, 2) + "\n");
}
