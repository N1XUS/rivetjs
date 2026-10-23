// apps/bridge-demo runner: the same React dashboard (shared components, data, CSS) in Next 16 App Router and in Rivet
// file routes + `@rivetjs/bridge-react` islands, per route. Phases:
//   build      — every lane with a build: wall time, peak RSS of the process tree (ps samples every 200 ms).
//   server     — per-request SSR of each route through each lane's production server (no compression in any lane):
//                closed-loop keep-alive client in this process, c1 + c10, interleaved rounds: requests/s, TTFB p50,
//                complete p50, server CPU per page (process-tree CPU time delta / requests), peak RSS, page bytes.
//   browser    — Playwright Chromium, fresh context per sample, lanes interleaved, conditions `fast3g` (DevTools Fast 3G
//                + 4× CPU) and `unthrottled`. Per route: bytes / JS bytes / JS requests before the first input (as
//                transferred = raw, plus a gzip -6 estimate of the same bodies), prefetch bytes before input (Next RSC
//                prefetches, Rivet speculation-rules document prefetches), script CPU until idle (hydration), CLS, and
//                first input → paint of the route's interactions (sort click, filter keystroke, row → modal, user menu,
//                form submit with errors, chart hover, nav click → next route painted).
//   lighthouse — Lighthouse 13.5.0 mobile preset (simulated slow 4G + 4× CPU), median of `--lh-runs`: score, LCP, TBT,
//                CLS, total JS bytes.
// Timed phases run under the host bench lock (`BD_BENCH_LOCK=<bench-lock.sh>`, lane BRIDGES); a loaded host is
// recorded with every result. Results: results/<stamp>.json (or --out, merged per lane) → report.ts.
//
// Usage: node apps/bridge-demo/run.ts [--phases build,server,browser,lighthouse] [--lanes a,b] [--routes /,/orders]
//        [--seconds 5] [--rounds 3] [--repeats 10] [--conditions fast3g,unthrottled] [--lh-runs 3] [--out results/x.json] [--loaded]
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { request, Agent } from "node:http";
import { loadavg } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { gzipSync } from "node:zlib";
import { median as middle } from "../../scripts/bench/shared.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const { values: args } = parseArgs({
  options: {
    phases: { type: "string", default: "build,server,browser,lighthouse" },
    lanes: { type: "string", default: "rivet,rivet-all-load,rivet-no-prefetch,next,next-no-prefetch" },
    routes: { type: "string", default: "/,/orders,/orders/new" },
    seconds: { type: "string", default: "5" },
    rounds: { type: "string", default: "3" },
    repeats: { type: "string", default: "10" },
    conditions: { type: "string", default: "fast3g,unthrottled" },
    "lh-runs": { type: "string", default: "3" },
    out: { type: "string" },
    loaded: { type: "boolean", default: false },
  },
});
const phases = new Set(args.phases!.split(","));
const ROUTES = args.routes!.split(",");
const SECONDS = Number(args.seconds);
const ROUNDS = Number(args.rounds);
const REPEATS = Number(args.repeats);
const CONDITIONS = args.conditions!.split(",");
const LH_RUNS = Number(args["lh-runs"]);

export interface Lane {
  name: string;
  port: number;
  /** Build command (cwd = repo) + env; exit 3 = not installed (skipped). `null`: serves another lane's build. */
  build: { cmd: string[]; env?: Record<string, string> } | null;
  /** Production server (cwd), printing a line matching `ready` once listening. */
  serve: { cmd: string[]; cwd: string; ready: RegExp; env?: Record<string, string> };
  installed(): boolean;
  missing: string;
}
const node = process.execPath;
const rivetLane = (name: string, port: number, dist: string, env: Record<string, string>, build = true): Lane => ({
  name,
  port,
  build: build ? { cmd: [node, "apps/bridge-demo/rivet/build.ts"], env: { ...env, BD_DIST: dist } } : null,
  serve: { cmd: [node, "serve.ts", String(port)], cwd: resolve(here, "rivet"), ready: /ready/, env: { BD_DIST: "./" + dist } },
  installed: () => true,
  missing: "",
});
const nextInstalled = () => existsSync(resolve(here, "next/node_modules/next/package.json"));
const nextLane = (name: string, port: number, env: Record<string, string>, build: boolean): Lane => ({
  name,
  port,
  build: build ? { cmd: ["bash", "apps/bridge-demo/next/build.sh"] } : null,
  serve: {
    cmd: [node, "node_modules/next/dist/bin/next", "start", "-p", String(port), "-H", "127.0.0.1"],
    cwd: resolve(here, "next"),
    ready: /Ready|ready/,
    env: { NEXT_TELEMETRY_DISABLED: "1", ...env },
  },
  installed: nextInstalled,
  missing: "not installed: npm ci --workspaces=false --ignore-scripts in apps/bridge-demo/next",
});
export const LANES: Lane[] = [
  // Headline: idiomatic policies (table + form `load`, chart `visible`, user menu `idle`), router `prefetch: "document"`.
  rivetLane("rivet", 4451, "dist", {}),
  // Fairness control: every island `client="load"` (what Next does with client components).
  rivetLane("rivet-all-load", 4452, "dist-all-load", { BD_ALL_LOAD: "1" }),
  rivetLane("rivet-no-prefetch", 4453, "dist-no-prefetch", { BD_PREFETCH: "off" }),
  // Next: <Link> prefetch on (default); the no-prefetch row = same build, `prefetch={false}` via the server env.
  nextLane("next", 4454, {}, true),
  nextLane("next-no-prefetch", 4455, { BD_PREFETCH: "off" }, false),
];
const lanes = args.lanes!.split(",").map((name) => {
  const lane = LANES.find((l) => l.name === name);
  if (!lane) throw new Error("unknown lane " + name);
  return lane;
});
const active = lanes.filter((lane) => {
  if (lane.installed()) return true;
  console.log(`[bridge-demo] skip ${lane.name}: ${lane.missing}`);
  return false;
});

const outFile = resolve(here, args.out ?? `results/${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
export interface ServerStats {
  rps: number;
  ttfbP50: number;
  completeP50: number;
  cpuMsPerPage: number;
  peakRssMb: number;
  pageBytes: number;
  pageBytesGzip: number;
  /** Inline `<script>` bodies in the page (raw bytes; JSON data scripts excluded): Next's RSC payload pushes, Rivet's boot + loader. */
  inlineJsBytes: number;
  requests: number;
  load: [number, number];
}
export interface BrowserStats {
  bytesBeforeInput: number;
  bytesGzipBeforeInput: number;
  jsBytesBeforeInput: number;
  jsBytesGzipBeforeInput: number;
  jsRequestsBeforeInput: number;
  prefetchBytesBeforeInput: number;
  scriptMsUntilIdle: number;
  cls: number;
  /** First input → paint per interaction (ms), keyed by interaction name. */
  paint: Record<string, number>;
  samples: number;
}
export interface LighthouseStats {
  score: number;
  lcp: number;
  tbt: number;
  cls: number;
  jsBytes: number;
  totalBytes: number;
  runs: number;
}
export interface Results {
  stamp: string;
  host: { loaded: boolean; notes: string[]; env: Record<string, string> };
  versions: Record<string, string>;
  skipped: Record<string, string>;
  build: Record<string, { ms: number; treePeakRssMb: number }>;
  /** lane → route → `c1` / `c10`. */
  server: Record<string, Record<string, Record<string, ServerStats>>>;
  /** condition → lane → route. */
  browser: Record<string, Record<string, Record<string, BrowserStats>>>;
  /** lane → route. */
  lighthouse: Record<string, Record<string, LighthouseStats>>;
  /** JS before input by what the chunk holds (gzip est. bytes): lane → route → category → bytes (last browser sample). */
  chunks: Record<string, Record<string, Record<string, number>>>;
  /**
   * JS fetched vs executed before the first input (condition → lane → route), from each lane's warm-up visit with V8
   * precise coverage (a script counts as executed when its top-level code ran; modulepreloaded / fetch-ahead modules
   * are fetched and compiled, never run). Kept out of the timed samples: coverage costs CPU.
   */
  executed: Record<string, Record<string, Record<string, { fetchedGzip: number; executedGzip: number; fetched: number; executed: number }>>>;
}
/**
 * What a script chunk holds, first match wins (a chunk bundles a component with its libraries in both lanes): React
 * DOM (+ React), recharts, TanStack Table + Radix Dialog, react-hook-form + zod, the use-sync-external-store shim, the
 * UserMenu component's chunk; anything else is the framework (Next's router / RSC runtime, Rivet's resume runtime).
 * Inline scripts are HTML bytes (`inlineJsBytes` in the server rows), not in these sums.
 */
export const CATEGORIES: [name: string, test: RegExp][] = [
  ["React (react-dom + react)", /__reactContainer\$|__reactFiber\$/],
  ["recharts (+ RevenueChart)", /recharts-/],
  ["TanStack Table + Radix Dialog (+ OrdersTable)", /getToggleSortingHandler|getFilteredRowModel/],
  ["react-hook-form + zod (+ OrderForm)", /ZodError|shouldUnregister/],
  ["use-sync-external-store (library shim)", /useSyncExternalStoreWithSelector/],
  ["UserMenu (+ what its chunk bundles)", /user-menu/],
  ["framework", /(?:)/],
];
export const categoryOf = (code: string) => CATEGORIES.find(([, test]) => test.test(code))![0];
const previous = existsSync(outFile) ? (JSON.parse(readFileSync(outFile, "utf8")) as Results) : null;
const results: Results = previous ?? {
  stamp: new Date().toISOString(),
  host: { loaded: args.loaded!, notes: [], env: {} },
  versions: {},
  skipped: {},
  build: {},
  server: {},
  browser: {},
  lighthouse: {},
  chunks: {},
  executed: {},
};
results.lighthouse ??= {};
results.chunks ??= {};
results.executed ??= {};
for (const lane of lanes) if (!active.includes(lane)) results.skipped[lane.name] = lane.missing;
if (args.loaded) results.host.loaded = true;
results.host.env = { NODE_ENV: "production (every lane's build + server)" };
const save = () => {
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify(results, null, 2) + "\n");
};

// ---------------------------------------------------------------- helpers
const sleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));
const median = (xs: number[]) => middle(xs.filter((x) => !Number.isNaN(x)));
const load1 = () => Number(loadavg()[0]!.toFixed(2));
function tree(pid: number): number[] {
  const out = execFileSync("ps", ["-A", "-o", "pid=,ppid="], { encoding: "utf8" });
  const kids = new Map<number, number[]>();
  for (const line of out.trim().split("\n")) {
    const [p, pp] = line.trim().split(/\s+/).map(Number) as [number, number];
    (kids.get(pp) ?? kids.set(pp, []).get(pp)!).push(p);
  }
  const all = [pid];
  for (let i = 0; i < all.length; i++) all.push(...(kids.get(all[i]!) ?? []));
  return all;
}
/** CPU seconds (user + sys) and RSS (MB) of a process tree (`ps time` = [[dd-]hh:]mm:ss.cc). */
function usage(pid: number): { cpu: number; rss: number } {
  const out = execFileSync("ps", ["-o", "time=,rss=", "-p", tree(pid).join(",")], { encoding: "utf8" });
  let cpu = 0,
    rss = 0;
  for (const line of out.trim().split("\n")) {
    const [time, kb] = line.trim().split(/\s+/) as [string, string];
    let seconds = 0;
    for (const part of time.split(/[:-]/).map(Number)) seconds = seconds * 60 + part;
    cpu += seconds;
    rss += Number(kb) / 1024;
  }
  return { cpu, rss };
}

interface Timing {
  ttfb: number;
  complete: number;
  bytes: number;
  html: string;
}
function fetchPage(port: number, path: string, agent: Agent, keep = false): Promise<Timing> {
  return new Promise((done, fail) => {
    const t0 = performance.now();
    let ttfb = 0,
      bytes = 0;
    const req = request({ host: "127.0.0.1", port, path, agent }, (res) => {
      if (res.statusCode !== 200) return fail(new Error(`HTTP ${res.statusCode} ${path}`));
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => {
        if (!ttfb) ttfb = performance.now() - t0;
        bytes += chunk.length;
        if (keep) chunks.push(chunk);
      });
      res.on("end", () => done({ ttfb, complete: performance.now() - t0, bytes, html: keep ? Buffer.concat(chunks).toString("utf8") : "" }));
      res.on("error", fail);
    });
    req.on("error", fail);
    req.end();
  });
}
/** The markup every lane must serve per route (same components, same data). */
const MARKERS: Record<string, string[]> = {
  "/": ['id="revenue-chart"', 'id="user-button"', "Recent orders", "Refund rate"],
  "/orders": ['id="filter"', 'data-col="total"', 'data-id="ORD-10025"', 'id="page"'],
  "/orders/new": ['id="order-form"', 'id="submit"', 'name="customer"'],
};
function validate(lane: string, route: string, html: string): void {
  for (const marker of MARKERS[route] ?? []) if (!html.includes(marker)) throw new Error(`${lane} ${route}: page lacks ${marker}`);
  // 500 orders serialized for the table island in both lanes (RSC payload / island props).
  if (route === "/orders" && !html.includes("ORD-10500")) throw new Error(`${lane} /orders: the 500 orders are not in the page`);
}

/** Raw bytes of the inline classic / module scripts (no `src`; `type` absent, `module` or a JavaScript MIME type). */
function inlineJs(html: string): number {
  let bytes = 0;
  for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc=/.test(attrs!)) continue;
    const type = /\btype="([^"]*)"/.exec(attrs!)?.[1];
    if (type && type !== "module" && !/javascript/.test(type)) continue;
    bytes += Buffer.byteLength(body!);
  }
  return bytes;
}

async function start(lane: Lane): Promise<ChildProcess> {
  const child = spawn(lane.serve.cmd[0]!, lane.serve.cmd.slice(1), {
    cwd: lane.serve.cwd,
    env: { ...process.env, NODE_ENV: "production", ...lane.serve.env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  await new Promise<void>((ready, fail) => {
    const timer = setTimeout(() => fail(new Error(lane.name + " server did not start:\n" + log)), 30_000);
    const seen = (chunk: Buffer) => {
      log += chunk;
      if (lane.serve.ready.test(log)) (clearTimeout(timer), ready());
    };
    child.stdout!.on("data", seen);
    child.stderr!.on("data", seen);
    child.on("exit", (code) => fail(new Error(`${lane.name} server exited (${code}):\n${log}`)));
  });
  for (let i = 0; i < 50; i++) {
    try {
      await fetchPage(lane.port, "/", new Agent({ keepAlive: false }));
      return child;
    } catch {
      await sleep(100);
    }
  }
  throw new Error(lane.name + " server not answering");
}
const stop = (child: ChildProcess) =>
  new Promise<void>((done) => {
    if (child.exitCode !== null) return done();
    child.once("exit", () => done());
    child.kill("SIGTERM");
    setTimeout(() => child.kill("SIGKILL"), 3000);
  });

async function lock<T>(purpose: string, run: () => Promise<T>): Promise<T> {
  const script = process.env.BD_BENCH_LOCK;
  if (!script) {
    results.host.notes.push(`${purpose}: no bench lock (BD_BENCH_LOCK unset), load ${load1()}`);
    return run();
  }
  const maxLoad = args.loaded ? "99" : "4";
  execFileSync("bash", [script, "acquire", "BRIDGES", "bridge-demo " + purpose, maxLoad], { stdio: "inherit" });
  results.host.notes.push(`${purpose}: bench lock acquired at load ${load1()}${args.loaded ? " (loaded host: maxLoad waived)" : ""}`);
  try {
    return await run();
  } finally {
    execFileSync("bash", [script, "release", "BRIDGES"], { stdio: "inherit" });
  }
}

// ---------------------------------------------------------------- build
if (phases.has("build")) {
  for (const lane of active) {
    if (!lane.build) continue;
    const t0 = performance.now();
    const out = spawn(lane.build.cmd[0]!, lane.build.cmd.slice(1), {
      cwd: repo,
      env: { ...process.env, NODE_ENV: "production", ...lane.build.env },
      stdio: ["ignore", "inherit", "pipe"],
    });
    let err = "",
      treeRss = 0;
    out.stderr!.on("data", (chunk: Buffer) => (err += chunk));
    const sampler = setInterval(() => {
      try {
        treeRss = Math.max(treeRss, usage(out.pid!).rss);
      } catch {}
    }, 200);
    const code = await new Promise<number>((done) => out.on("exit", (c) => done(c ?? 1)));
    clearInterval(sampler);
    if (code !== 0) throw new Error(`${lane.name} build failed (${code}):\n${err.slice(-2000)}`);
    results.build[lane.name] = { ms: Math.round(performance.now() - t0), treePeakRssMb: Math.round(treeRss) };
    console.log(`[bridge-demo] built ${lane.name}: ${results.build[lane.name]!.ms} ms, peak RSS (tree) ${results.build[lane.name]!.treePeakRssMb} MB`);
  }
  save();
}

// ---------------------------------------------------------------- versions
const version = (from: string, pkg: string) => {
  try {
    return JSON.parse(readFileSync(resolve(from, "node_modules", pkg, "package.json"), "utf8")).version as string;
  } catch {
    return "n/a";
  }
};
// Rivet lane: the workspace package's own node_modules first (npm nests a version the root does not hoist), then the root.
const rivetVersion = (pkg: string) => (version(here, pkg) === "n/a" ? version(repo, pkg) : version(here, pkg));
const both = (pkg: string) => `${rivetVersion(pkg)} (rivet) / ${version(resolve(here, "next"), pkg)} (next)`;
results.versions = {
  node: process.version,
  next: version(resolve(here, "next"), "next"),
  react: both("react"),
  "react-dom": both("react-dom"),
  "@tanstack/react-table": both("@tanstack/react-table"),
  "react-hook-form": both("react-hook-form"),
  "@hookform/resolvers": both("@hookform/resolvers"),
  recharts: both("recharts"),
  "@radix-ui/react-dialog": both("@radix-ui/react-dialog"),
  zod: both("zod"),
  vite: version(repo, "vite"),
  playwright: version(repo, "playwright"),
  lighthouse: version(repo, "lighthouse"),
};

// ---------------------------------------------------------------- server
if (phases.has("server")) {
  await lock("server", async () => {
    const samples: Record<string, Record<string, Record<string, ServerStats[]>>> = {};
    const firsts: Record<string, Record<string, { bytes: number; gzip: number; inline: number }>> = {};
    for (const lane of active) {
      const child = await start(lane);
      try {
        for (const route of ROUTES) {
          const first = await fetchPage(lane.port, route, new Agent(), true);
          validate(lane.name, route, first.html);
          (firsts[lane.name] ??= {})[route] = { bytes: first.bytes, gzip: gzipSync(first.html).length, inline: inlineJs(first.html) };
        }
      } finally {
        await stop(child);
      }
    }
    for (let round = 0; round < ROUNDS; round++)
      for (const lane of round % 2 ? [...active].reverse() : active) {
        const child = await start(lane);
        try {
          for (const route of ROUTES) {
            const warm = new Agent({ keepAlive: true, maxSockets: 4 });
            const until = performance.now() + 1000;
            while (performance.now() < until) await fetchPage(lane.port, route, warm);
            warm.destroy();
            for (const c of [1, 10]) {
              const agent = new Agent({ keepAlive: true, maxSockets: c });
              const ttfb: number[] = [],
                complete: number[] = [];
              let peak = 0;
              const loadBefore = load1();
              const before = usage(child.pid!);
              const sampler = setInterval(() => (peak = Math.max(peak, usage(child.pid!).rss)), 200);
              const t0 = performance.now(),
                end = t0 + SECONDS * 1000;
              await Promise.all(
                Array.from({ length: c }, async () => {
                  while (performance.now() < end) {
                    const t = await fetchPage(lane.port, route, agent);
                    ttfb.push(t.ttfb);
                    complete.push(t.complete);
                  }
                }),
              );
              const elapsed = (performance.now() - t0) / 1000;
              clearInterval(sampler);
              const after = usage(child.pid!);
              agent.destroy();
              const stats: ServerStats = {
                rps: ttfb.length / elapsed,
                ttfbP50: median(ttfb),
                completeP50: median(complete),
                cpuMsPerPage: ((after.cpu - before.cpu) * 1000) / ttfb.length,
                peakRssMb: Math.max(peak, after.rss),
                pageBytes: firsts[lane.name]![route]!.bytes,
                pageBytesGzip: firsts[lane.name]![route]!.gzip,
                inlineJsBytes: firsts[lane.name]![route]!.inline,
                requests: ttfb.length,
                load: [loadBefore, load1()],
              };
              (((samples[lane.name] ??= {})[route] ??= {})["c" + c] ??= []).push(stats);
              console.log(
                `[bridge-demo] server ${lane.name} ${route} c${c} r${round}: ${stats.rps.toFixed(0)} req/s, cpu ${stats.cpuMsPerPage.toFixed(2)} ms/page, ttfb ${stats.ttfbP50.toFixed(2)} ms, rss ${stats.peakRssMb.toFixed(0)} MB, load ${stats.load.join("→")}`,
              );
            }
          }
        } finally {
          await stop(child);
        }
      }
    for (const [lane, byRoute] of Object.entries(samples)) {
      results.server[lane] = {};
      for (const [route, byC] of Object.entries(byRoute)) {
        results.server[lane]![route] = {};
        for (const [c, list] of Object.entries(byC)) {
          const pick = (key: keyof ServerStats) => median(list.map((s) => s[key] as number));
          results.server[lane]![route]![c] = {
            rps: pick("rps"),
            ttfbP50: pick("ttfbP50"),
            completeP50: pick("completeP50"),
            cpuMsPerPage: pick("cpuMsPerPage"),
            peakRssMb: Math.max(...list.map((s) => s.peakRssMb)),
            pageBytes: list[0]!.pageBytes,
            pageBytesGzip: list[0]!.pageBytesGzip,
            inlineJsBytes: list[0]!.inlineJsBytes,
            requests: list.reduce((n, s) => n + s.requests, 0),
            load: [Math.min(...list.map((s) => s.load[0])), Math.max(...list.map((s) => s.load[1]))],
          };
        }
      }
    }
    save();
  });
}

// ---------------------------------------------------------------- browser
const NETWORK: Record<string, { latency: number; download: number; upload: number; cpu: number } | null> = {
  // DevTools "Fast 3G" (562.5 ms RTT, 1.44 Mbps down, 675 kbps up) + 4× CPU.
  fast3g: { latency: 562.5, download: (1.44 * 1000 * 1000) / 8, upload: (675 * 1000) / 8, cpu: 4 },
  unthrottled: null,
};
/**
 * In-page probe (installed before any page script; no lane code involved): CLS, and `arm(check)` = time from the next
 * trusted input event (click / keydown / pointermove) to the frame after `check()` first holds.
 */
const PROBE = `(() => {
  const bd = (window.__bd = { cls: 0 });
  new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) bd.cls += e.value; }).observe({ type: "layout-shift", buffered: true });
  bd.arm = (source) => new Promise((resolve) => {
    const check = new Function("return (" + source + ")()");
    let ts = 0;
    const input = (event) => { if (ts) return; ts = event.timeStamp; for (const t of ["click", "keydown", "pointermove"]) removeEventListener(t, input, true); test(); };
    for (const t of ["click", "keydown", "pointermove"]) addEventListener(t, input, { capture: true });
    const test = () => {
      if (!ts) return;
      let ok = false;
      try { ok = !!check(); } catch {}
      if (!ok) return;
      observer.disconnect();
      requestAnimationFrame(() => setTimeout(() => resolve(performance.now() - ts)));
    };
    const observer = new MutationObserver(test);
    observer.observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
  });
})();`;

type Page = import("playwright").Page;
interface Interaction {
  name: string;
  /** Browser-side predicate source: true once the interaction's result is on screen. */
  check: string;
  act(page: Page): Promise<void>;
  /** Wait before acting (e.g. scroll + chunk load), not timed. */
  before?(page: Page): Promise<void>;
}
/** Interactions per route, in order (each sees the previous one's state). */
const INTERACTIONS: Record<string, Interaction[]> = {
  "/": [
    { name: "user menu (idle)", check: `() => document.getElementById("user-list")`, act: (p) => p.click("#user-button") },
    {
      name: "chart hover (visible)",
      check: `() => document.querySelector("#revenue-chart .recharts-tooltip-wrapper")?.textContent.includes("Paid")`,
      act: (p) => p.hover("#revenue-chart .recharts-bar-rectangle >> nth=3"),
    },
  ],
  "/orders": [
    {
      name: "sort click (load)",
      check: `() => document.querySelector("th:nth-child(5)")?.getAttribute("aria-sort") === "descending"`,
      act: (p) => p.click('button.sort[data-col="total"]'),
    },
    {
      name: "filter keystroke",
      check: `() => /^\\d+ orders$/.test(document.getElementById("row-count")?.textContent ?? "") && document.getElementById("row-count").textContent !== "500 orders"`,
      act: (p) => p.type("#filter", "a"),
    },
    { name: "row → modal", check: `() => document.getElementById("order-dialog")`, act: (p) => p.click("tbody tr:first-child td:first-child") },
    {
      name: "nav click → /orders/new painted",
      check: `() => location.pathname === "/orders/new" && document.getElementById("order-form")`,
      before: async (p) => {
        await p.keyboard.press("Escape");
        await sleep(300);
      },
      act: (p) => p.click('nav a[href="/orders/new"]'),
    },
  ],
  "/orders/new": [{ name: "form submit → errors (load)", check: `() => document.querySelectorAll(".error").length >= 4`, act: (p) => p.click("#submit") }],
};

if (phases.has("browser")) {
  const { chromium } = await import("playwright");
  await lock("browser", async () => {
    const browser = await chromium.launch({ headless: true });
    results.versions.chrome = browser.version();
    const servers = new Map<string, ChildProcess>();
    try {
      for (const lane of active) servers.set(lane.name, await start(lane));
      for (const condition of CONDITIONS) {
        const net = NETWORK[condition];
        if (net === undefined) throw new Error("unknown condition " + condition);
        const samples: Record<string, Record<string, Omit<BrowserStats, "samples">[]>> = {};
        // repeat -1 = one discarded warm-up visit per lane and route.
        for (let repeat = -1; repeat < REPEATS; repeat++)
          for (const route of ROUTES)
            for (const lane of repeat % 2 ? [...active].reverse() : active) {
              const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
              const page = await context.newPage();
              await page.addInitScript(PROBE);
              const cdp = await context.newCDPSession(page);
              await cdp.send("Network.enable");
              await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
              await cdp.send("Performance.enable");
              if (net) {
                await cdp.send("Network.emulateNetworkConditions", {
                  offline: false,
                  latency: net.latency,
                  downloadThroughput: net.download,
                  uploadThroughput: net.upload,
                });
                await cdp.send("Emulation.setCPUThrottlingRate", { rate: net.cpu });
              }
              let bytes = 0,
                jsBytes = 0,
                jsRequests = 0,
                prefetch = 0,
                lastNet = performance.now(),
                counting = true;
              const info = new Map<string, { type: string; prefetch: boolean; url: string }>();
              const coverage = repeat < 0;
              if (coverage) {
                await cdp.send("Profiler.enable");
                await cdp.send("Profiler.startPreciseCoverage", { callCount: false, detailed: false });
              }
              // In-flight requests: a long download sends no events, so "quiet" also needs none in flight.
              const inflight = new Set<string>();
              cdp.on("Network.loadingFailed", (e: { requestId: string }) => (inflight.delete(e.requestId), (lastNet = performance.now())));
              const counted: string[] = [];
              cdp.on("Network.requestWillBeSent", (e: { requestId: string; request: { url: string; headers: Record<string, string> }; type?: string }) => {
                lastNet = performance.now();
                inflight.add(e.requestId);
                const h = e.request.headers;
                // Next RSC prefetch (`Next-Router-Prefetch`), speculation-rules / link prefetch (`Sec-Purpose: prefetch`).
                const isPrefetch =
                  "Next-Router-Prefetch" in h ||
                  "next-router-prefetch" in h ||
                  /prefetch/.test(h["Sec-Purpose"] ?? h["sec-purpose"] ?? "") ||
                  e.type === "Prefetch";
                info.set(e.requestId, { type: e.type ?? "", prefetch: isPrefetch, url: e.request.url });
              });
              cdp.on("Network.responseReceived", (e: { requestId: string; type: string }) => {
                const entry = info.get(e.requestId) ?? { type: "", prefetch: false, url: "" };
                entry.type = e.type;
                info.set(e.requestId, entry);
              });
              cdp.on("Network.loadingFinished", (e: { requestId: string; encodedDataLength: number }) => {
                lastNet = performance.now();
                inflight.delete(e.requestId);
                if (!counting) return;
                const entry = info.get(e.requestId);
                if (entry?.prefetch) prefetch += e.encodedDataLength;
                bytes += e.encodedDataLength;
                counted.push(e.requestId);
                if (entry?.type === "Script") ((jsBytes += e.encodedDataLength), jsRequests++);
              });
              const quiet = async (ms: number, cap: number) => {
                const end = performance.now() + cap;
                while ((inflight.size || performance.now() - lastNet < ms) && performance.now() < end) await sleep(50);
              };
              await page.goto(`http://127.0.0.1:${lane.port}${route}`, { waitUntil: "load", timeout: 120_000 });
              // Idle: nothing in flight and no network event for 1 s (load / idle / above-the-fold visible islands included).
              await quiet(1000, 30_000);
              await sleep(500);
              counting = false;
              // Scripts whose top-level code ran (coverage visits only).
              let ran: Set<string> | null = null;
              if (coverage) {
                const taken = (await cdp.send("Profiler.takePreciseCoverage")) as {
                  result: { url: string; functions: { ranges: { startOffset: number; count: number }[] }[] }[];
                };
                ran = new Set(
                  taken.result
                    .filter((script) => script.functions.some((fn) => fn.ranges[0]?.startOffset === 0 && fn.ranges[0].count > 0))
                    .map((script) => script.url),
                );
                await cdp.send("Profiler.stopPreciseCoverage");
              }
              let gzBytes = 0,
                gzJs = 0,
                ranGz = 0,
                ranScripts = 0,
                fetchedScripts = 0;
              const categories: Record<string, number> = {};
              for (const id of counted) {
                const body = (await cdp.send("Network.getResponseBody", { requestId: id }).catch(() => null)) as {
                  body: string;
                  base64Encoded: boolean;
                } | null;
                if (!body) continue;
                const buffer = Buffer.from(body.body, body.base64Encoded ? "base64" : "utf8");
                const size = gzipSync(buffer).length;
                gzBytes += size;
                if (info.get(id)?.type !== "Script") continue;
                gzJs += size;
                fetchedScripts++;
                if (ran?.has(info.get(id)!.url)) ((ranGz += size), ranScripts++);
                const category = categoryOf(buffer.toString("utf8"));
                categories[category] = (categories[category] ?? 0) + size;
              }
              if (coverage) {
                (results.chunks[lane.name] ??= {})[route] = categories;
                ((results.executed[condition] ??= {})[lane.name] ??= {})[route] = {
                  fetchedGzip: gzJs,
                  executedGzip: ranGz,
                  fetched: fetchedScripts,
                  executed: ranScripts,
                };
              }
              const metrics = (await cdp.send("Performance.getMetrics")) as { metrics: { name: string; value: number }[] };
              const scriptMs = (metrics.metrics.find((m) => m.name === "ScriptDuration")?.value ?? 0) * 1000;
              const paint: Record<string, number> = {};
              for (const interaction of INTERACTIONS[route] ?? []) {
                if (interaction.before) await interaction.before(page);
                const armed = page.evaluate(
                  (source) => (window as unknown as { __bd: { arm(s: string): Promise<number> } }).__bd.arm(source),
                  interaction.check,
                );
                await sleep(20);
                await interaction.act(page);
                paint[interaction.name] = (await Promise.race([armed, sleep(20_000).then(() => NaN)])) as number;
              }
              const cls = (await page.evaluate(() => (window as unknown as { __bd: { cls: number } }).__bd.cls)) as number;
              if (repeat >= 0)
                ((samples[lane.name] ??= {})[route] ??= []).push({
                  bytesBeforeInput: bytes,
                  bytesGzipBeforeInput: gzBytes,
                  jsBytesBeforeInput: jsBytes,
                  jsBytesGzipBeforeInput: gzJs,
                  jsRequestsBeforeInput: jsRequests,
                  prefetchBytesBeforeInput: prefetch,
                  scriptMsUntilIdle: scriptMs,
                  cls,
                  paint,
                });
              console.log(
                `[bridge-demo] browser ${condition} ${lane.name} ${route} ${repeat < 0 ? "warm-up" : "r" + repeat}: ${(bytes / 1024).toFixed(1)} KB raw / ${(gzBytes / 1024).toFixed(1)} KB gz (${jsRequests} JS, ${(gzJs / 1024).toFixed(1)} KB gz, prefetch ${(prefetch / 1024).toFixed(1)} KB), script ${scriptMs.toFixed(0)} ms, ${Object.entries(
                  paint,
                )
                  .map(([k, v]) => k.split(" ")[0] + " " + v.toFixed(0))
                  .join(" / ")} ms, cls ${cls.toFixed(3)}, load ${load1()}`,
              );
              await context.close();
            }
        results.browser[condition] ??= {}; // merged per lane: a run of some lanes keeps the others' rows
        for (const [lane, byRoute] of Object.entries(samples)) {
          results.browser[condition]![lane] ??= {};
          for (const [route, list] of Object.entries(byRoute)) {
            const pick = (key: Exclude<keyof BrowserStats, "paint" | "samples">) => median(list.map((s) => s[key]));
            results.browser[condition]![lane]![route] = {
              bytesBeforeInput: pick("bytesBeforeInput"),
              bytesGzipBeforeInput: pick("bytesGzipBeforeInput"),
              jsBytesBeforeInput: pick("jsBytesBeforeInput"),
              jsBytesGzipBeforeInput: pick("jsBytesGzipBeforeInput"),
              jsRequestsBeforeInput: pick("jsRequestsBeforeInput"),
              prefetchBytesBeforeInput: pick("prefetchBytesBeforeInput"),
              scriptMsUntilIdle: pick("scriptMsUntilIdle"),
              cls: pick("cls"),
              paint: Object.fromEntries(Object.keys(list[0]!.paint).map((name) => [name, median(list.map((s) => s.paint[name]!))])),
              samples: list.length,
            };
          }
        }
        save();
      }
    } finally {
      for (const child of servers.values()) await stop(child);
      await browser.close();
    }
  });
}

// ---------------------------------------------------------------- lighthouse
if (phases.has("lighthouse")) {
  const { chromium } = await import("playwright");
  const chromeLauncher = await import("chrome-launcher");
  const { default: lighthouse } = await import("lighthouse");
  // Playwright's full Chromium when installed, else its headless shell of the same revision (`npx playwright install
  // chromium-headless-shell` installs only that); `BD_CHROME` overrides both. The binary used is recorded in the notes.
  const full = chromium.executablePath();
  const shell = full.replace(/chromium-(\d+)\/.*$/, (_, rev: string) => `chromium_headless_shell-${rev}/chrome-headless-shell-mac-arm64/chrome-headless-shell`);
  const chromePath = process.env.BD_CHROME ?? (existsSync(full) || !existsSync(shell) ? full : shell);
  results.host.notes.push(
    `lighthouse: chrome ${chromePath === full ? "Playwright Chromium" : chromePath === shell ? "Playwright headless shell" : "BD_CHROME"} (${chromePath})`,
  );
  await lock("lighthouse", async () => {
    const servers = new Map<string, ChildProcess>();
    try {
      for (const lane of active) servers.set(lane.name, await start(lane));
      const runs: Record<string, Record<string, LighthouseStats[]>> = {};
      for (let r = 0; r < LH_RUNS; r++)
        for (const route of ROUTES)
          for (const lane of r % 2 ? [...active].reverse() : active) {
            const chrome = await chromeLauncher.launch({
              chromePath,
              chromeFlags: ["--headless=new", "--no-first-run", "--disable-extensions", "--use-mock-keychain", "--password-store=basic"],
            });
            try {
              const result = await lighthouse(`http://127.0.0.1:${lane.port}${route}`, {
                port: chrome.port,
                output: "json",
                logLevel: "error",
                onlyCategories: ["performance"],
              });
              const lhr = result!.lhr;
              const num = (id: string) => (lhr.audits[id]?.numericValue as number | undefined) ?? NaN;
              const items = ((lhr.audits["resource-summary"]?.details as { items?: { resourceType: string; transferSize: number }[] } | undefined)?.items ??
                []) as {
                resourceType: string;
                transferSize: number;
              }[];
              const stats: LighthouseStats = {
                score: Math.round((lhr.categories.performance!.score ?? 0) * 100),
                lcp: num("largest-contentful-paint"),
                tbt: num("total-blocking-time"),
                cls: num("cumulative-layout-shift"),
                jsBytes: items.find((item) => item.resourceType === "script")?.transferSize ?? NaN,
                totalBytes: num("total-byte-weight"),
                runs: 1,
              };
              ((runs[lane.name] ??= {})[route] ??= []).push(stats);
              console.log(
                `[bridge-demo] lighthouse ${lane.name} ${route} r${r}: score ${stats.score}, LCP ${stats.lcp.toFixed(0)} ms, TBT ${stats.tbt.toFixed(0)} ms, JS ${(stats.jsBytes / 1024).toFixed(1)} KB`,
              );
            } finally {
              await chrome.kill();
            }
          }
      for (const [lane, byRoute] of Object.entries(runs)) {
        results.lighthouse[lane] ??= {};
        for (const [route, list] of Object.entries(byRoute)) {
          const pick = (key: keyof LighthouseStats) => median(list.map((s) => s[key]));
          results.lighthouse[lane]![route] = {
            score: pick("score"),
            lcp: pick("lcp"),
            tbt: pick("tbt"),
            cls: pick("cls"),
            jsBytes: pick("jsBytes"),
            totalBytes: pick("totalBytes"),
            runs: list.length,
          };
        }
      }
      save();
    } finally {
      for (const child of servers.values()) await stop(child);
    }
  });
}
save();
console.log("[bridge-demo] results → " + outFile);
