// apps/island-bench runner: the same page (header + 1000-row list + React counter `load` + chart `visible` below the
// fold + picker `idle` + one static React component) in Rivet + React islands, Astro + React, Next.js (App Router) and
// Rivet native. Phases:
//   build   — every lane: wall time, peak RSS of the largest build process (/usr/bin/time -l) and of the whole process
//             tree (ps samples every 200 ms; the 3 GB agent cap applies to the tree).
//   server  — per-request SSR through each lane's own production server: closed-loop keep-alive client in this
//             process, c1 + c10 (no lane compresses: Astro's standalone server cannot, Next runs `compress: false`),
//             interleaved rounds: requests/s, TTFB p50 (first body byte), complete p50, server CPU per page (process-tree CPU time delta / requests), peak server RSS.
//   browser — Playwright Chromium, fresh context per sample, lanes interleaved; conditions `fast3g` (DevTools Fast 3G +
//             4× CPU) and `unthrottled`: bytes / JS requests / JS bytes before the first input (as transferred = raw,
//             plus a gzip -6 estimate of the same bodies), script CPU until idle
//             (hydration), CLS, first-input-to-paint per island (counter click; picker click; chart click after
//             scrolling it into view and waiting for its chunk).
// Timed phases run under the host bench lock (`IB_BENCH_LOCK=<bench-lock.sh>`, lane BRIDGES); a loaded host is
// recorded with every result (1-min load before / after). Results: results/<stamp>.json + report via report.ts.
//
// Usage: node apps/island-bench/run.ts [--phases build,server,browser] [--lanes a,b] [--seconds 5] [--rounds 3]
//        [--repeats 5] [--conditions fast3g,unthrottled] [--out results/x.json] [--loaded]
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { request, Agent } from "node:http";
import { loadavg } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createGunzip, gzipSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const { values: args } = parseArgs({
  options: {
    phases: { type: "string", default: "build,server,browser" },
    lanes: {
      type: "string",
      default: "rivet-bridge-react,rivet-bridge-react-full,astro-react,next,rivet-native,rivet-bridge-preact,rivet-bridge-preact-p10,astro-preact",
    },
    seconds: { type: "string", default: "5" },
    rounds: { type: "string", default: "3" },
    repeats: { type: "string", default: "5" },
    conditions: { type: "string", default: "fast3g,unthrottled" },
    out: { type: "string" },
    loaded: { type: "boolean", default: false },
  },
});
const phases = new Set(args.phases!.split(","));
const SECONDS = Number(args.seconds);
const ROUNDS = Number(args.rounds);
const REPEATS = Number(args.repeats);
const CONDITIONS = args.conditions!.split(",");

interface Lane {
  name: string;
  port: number;
  /** Build command (cwd = repo); exit code 3 = not installed (skipped). `null`: serves another lane's build. */
  build: string[] | null;
  /** Production server command (cwd), printing a line matching `ready` once listening. */
  serve: { cmd: string[]; cwd: string; ready: RegExp; env?: Record<string, string> };
  installed(): boolean;
  missing: string;
}
const node = process.execPath;
const LANES: Lane[] = [
  {
    name: "rivet-bridge-react",
    port: 4431,
    build: [node, "apps/island-bench/build-lane.ts", "rivet-bridge-react"],
    serve: { cmd: [node, "apps/island-bench/serve-rivet.ts", "apps/island-bench/dist/rivet-bridge-react", "4431"], cwd: repo, ready: /ready/ },
    installed: () => true,
    missing: "",
  },
  // T7b baseline: the bridge lane's build and manifest, served by an SSR bundle copy with `offerLean` stubbed
  // (`serve-rivet.ts` `IB_FULL_TAIL=1`), so the server keeps the full resume driver (the pre-T7b server work and tail:
  // state script + resume loader + runtime chunks) on the same client bundle.
  {
    name: "rivet-bridge-react-full",
    port: 4435,
    build: null,
    serve: {
      cmd: [node, "apps/island-bench/serve-rivet.ts", "apps/island-bench/dist/rivet-bridge-react", "4435"],
      cwd: repo,
      ready: /ready/,
      env: { IB_FULL_TAIL: "1" },
    },
    installed: () => existsSync(resolve(here, "dist/rivet-bridge-react/client/.vite/rivet-resume.json")),
    missing: "not built: build the rivet-bridge-react lane first (--phases build --lanes rivet-bridge-react)",
  },
  {
    name: "astro-react",
    port: 4432,
    build: ["bash", "apps/island-bench/lanes/astro-react/build.sh"],
    serve: {
      cmd: [node, "dist/server/entry.mjs"],
      cwd: resolve(here, "lanes/astro-react"),
      ready: /Server listening|localhost|127\.0\.0\.1/,
      env: { HOST: "127.0.0.1", PORT: "4432" },
    },
    installed: () => existsSync(resolve(here, "lanes/astro-react/node_modules/astro/package.json")),
    missing: "not installed: run npm install --workspaces=false --ignore-scripts in apps/island-bench/lanes/astro-react",
  },
  {
    name: "next",
    port: 4433,
    build: ["bash", "apps/island-bench/lanes/next/build.sh"],
    serve: {
      cmd: [node, "node_modules/next/dist/bin/next", "start", "-p", "4433", "-H", "127.0.0.1"],
      cwd: resolve(here, "lanes/next"),
      ready: /Ready|ready/,
      env: { NEXT_TELEMETRY_DISABLED: "1", NODE_ENV: "production" },
    },
    installed: () => existsSync(resolve(here, "lanes/next/node_modules/next/package.json")),
    missing: "not installed: run `npm ci --workspaces=false` in apps/editorial-bench/lanes/next (this lane links its node_modules)",
  },
  {
    name: "rivet-native",
    port: 4434,
    build: [node, "apps/island-bench/build-lane.ts", "rivet-native"],
    serve: { cmd: [node, "apps/island-bench/serve-rivet.ts", "apps/island-bench/dist/rivet-native", "4434"], cwd: repo, ready: /ready/ },
    installed: () => true,
    missing: "",
  },
  // T8 Preact pair: the same page with the Preact twins of the components (`components/*.preact.tsx`).
  {
    name: "rivet-bridge-preact",
    port: 4436,
    build: [node, "apps/island-bench/build-lane.ts", "rivet-bridge-preact"],
    serve: { cmd: [node, "apps/island-bench/serve-rivet.ts", "apps/island-bench/dist/rivet-bridge-preact", "4436"], cwd: repo, ready: /ready/ },
    installed: () => true,
    missing: "",
  },
  // Same-version control (T8 review F3): the rivet-bridge-preact page on astro-preact's Preact 10.29.8.
  {
    name: "rivet-bridge-preact-p10",
    port: 4438,
    build: [node, "apps/island-bench/build-lane.ts", "rivet-bridge-preact-p10"],
    serve: { cmd: [node, "apps/island-bench/serve-rivet.ts", "apps/island-bench/dist/rivet-bridge-preact-p10", "4438"], cwd: repo, ready: /ready/ },
    installed: () => existsSync(resolve(here, "lanes/astro-preact/node_modules/preact/package.json")),
    missing:
      "not installed: it builds against the astro-preact lane's Preact 10 (npm ci --workspaces=false --ignore-scripts in apps/island-bench/lanes/astro-preact)",
  },
  {
    name: "astro-preact",
    port: 4437,
    build: ["bash", "apps/island-bench/lanes/astro-preact/build.sh"],
    serve: {
      cmd: [node, "dist/server/entry.mjs"],
      cwd: resolve(here, "lanes/astro-preact"),
      ready: /Server listening|localhost|127\.0\.0\.1/,
      env: { HOST: "127.0.0.1", PORT: "4437" },
    },
    installed: () => existsSync(resolve(here, "lanes/astro-preact/node_modules/astro/package.json")),
    missing: "not installed: run npm ci --workspaces=false --ignore-scripts in apps/island-bench/lanes/astro-preact",
  },
];
const lanes = args.lanes!.split(",").map((name) => {
  const lane = LANES.find((l) => l.name === name);
  if (!lane) throw new Error("unknown lane " + name);
  return lane;
});
// Next lane: no own install, it reuses the editorial-bench lane's (pins there). Link it when that install exists.
const nextModules = resolve(here, "lanes/next/node_modules");
if (!existsSync(nextModules) && existsSync(resolve(here, "../editorial-bench/lanes/next/node_modules/next/package.json"))) {
  try {
    lstatSync(nextModules);
    unlinkSync(nextModules); // a dangling link
  } catch {}
  symlinkSync("../../../editorial-bench/lanes/next/node_modules", nextModules);
}
const active = lanes.filter((lane) => {
  if (lane.installed()) return true;
  console.log(`[island-bench] skip ${lane.name}: ${lane.missing}`);
  return false;
});

const outFile = resolve(here, args.out ?? `results/${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
const previous = existsSync(outFile) ? (JSON.parse(readFileSync(outFile, "utf8")) as Results) : null;
interface Results {
  stamp: string;
  host: { loaded: boolean; notes: string[]; env?: Record<string, string> };
  versions: Record<string, string>;
  skipped: Record<string, string>;
  build: Record<string, { ms: number; peakRssMb: number; treePeakRssMb: number }>;
  server: Record<string, Record<string, ServerStats>>;
  browser: Record<string, Record<string, BrowserStats>>;
}
const results: Results = previous ?? {
  stamp: new Date().toISOString(),
  host: { loaded: args.loaded!, notes: [] },
  versions: {},
  skipped: {},
  build: {},
  server: {},
  browser: {},
};
for (const lane of lanes) if (!active.includes(lane)) results.skipped[lane.name] = lane.missing;
// A merged file stays "loaded host" once any timed phase ran with --loaded.
if (args.loaded) results.host.loaded = true;
results.host.env = { NODE_ENV: "production (every lane's build + server)" };
const save = () => {
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify(results, null, 2) + "\n");
};

// ---------------------------------------------------------------- helpers
const sleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : NaN;
};
const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]! : NaN;
};
const load1 = () => Number(loadavg()[0]!.toFixed(2));
/** The process tree of `pid` (macOS / Linux `ps`). */
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
/** CPU seconds (user + sys) and RSS (MB) of a process tree. */
function usage(pid: number): { cpu: number; rss: number } {
  const pids = tree(pid);
  const out = execFileSync("ps", ["-o", "time=,rss=", "-p", pids.join(",")], { encoding: "utf8" });
  let cpu = 0,
    rss = 0;
  for (const line of out.trim().split("\n")) {
    const [time, kb] = line.trim().split(/\s+/) as [string, string];
    const parts = time.split(/[:-]/).map(Number);
    let seconds = 0;
    for (const part of parts) seconds = seconds * 60 + part;
    // `ps time` = [[dd-]hh:]mm:ss.cc
    cpu += seconds;
    rss += Number(kb) / 1024;
  }
  return { cpu, rss };
}

async function start(lane: Lane): Promise<ChildProcess> {
  const child = spawn(lane.serve.cmd[0]!, lane.serve.cmd.slice(1), {
    cwd: lane.serve.cwd,
    // React (and every framework) picks its production build by NODE_ENV: set for every lane, never inherited.
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
  // Ready line printed before the port accepts on some servers: poll once.
  for (let i = 0; i < 50; i++) {
    try {
      await fetchPage(lane.port, new Agent({ keepAlive: false }));
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

interface Timing {
  ttfb: number;
  complete: number;
  bytes: number;
  html: string;
}
/** GET / (gzip): TTFB = first body byte, complete = end; `html` decoded (validated on the first page per lane). */
function fetchPage(port: number, agent: Agent, decode = false): Promise<Timing> {
  return new Promise((done, fail) => {
    const t0 = performance.now();
    let ttfb = 0,
      bytes = 0;
    const req = request({ host: "127.0.0.1", port, path: "/", agent, headers: { "accept-encoding": "gzip" } }, (res) => {
      if (res.statusCode !== 200) return fail(new Error("HTTP " + res.statusCode));
      const chunks: Buffer[] = [];
      const body = decode && res.headers["content-encoding"] === "gzip" ? res.pipe(createGunzip()) : res;
      res.on("data", (chunk: Buffer) => {
        if (!ttfb) ttfb = performance.now() - t0;
        bytes += chunk.length;
      });
      if (decode) body.on("data", (chunk: Buffer) => chunks.push(chunk));
      body.on("end", () => done({ ttfb, complete: performance.now() - t0, bytes, html: decode ? Buffer.concat(chunks).toString("utf8") : "" }));
      body.on("error", fail);
    });
    req.on("error", fail);
    req.end();
  });
}
/** The page every lane must serve: 1000 rows, the four components' markup. */
function validate(lane: string, html: string): void {
  const rows = html.match(/<li>|<li [^>]*>/g)?.length ?? 0;
  for (const marker of ['id="inc"', 'id="count"', 'class="badge"', 'id="picked"', 'id="bar-label"', 'data-d="31"'])
    if (!html.includes(marker)) throw new Error(`${lane}: page lacks ${marker}`);
  if (rows !== 1000) throw new Error(`${lane}: ${rows} rows, expected 1000`);
}

interface ServerStats {
  rps: number;
  ttfbP50: number;
  completeP50: number;
  completeP99: number;
  cpuMsPerPage: number;
  peakRssMb: number;
  pageBytes: number;
  pageBytesGzip: number;
  requests: number;
  load: [number, number];
}
async function loadRound(lane: Lane, child: ChildProcess, concurrency: number): Promise<ServerStats> {
  const agent = new Agent({ keepAlive: true, maxSockets: concurrency });
  const ttfb: number[] = [],
    complete: number[] = [];
  let bytes = 0,
    peak = 0;
  const loadBefore = load1();
  const before = usage(child.pid!);
  const sampler = setInterval(() => (peak = Math.max(peak, usage(child.pid!).rss)), 200);
  const end = performance.now() + SECONDS * 1000;
  const t0 = performance.now();
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (performance.now() < end) {
        const t = await fetchPage(lane.port, agent);
        ttfb.push(t.ttfb);
        complete.push(t.complete);
        bytes = t.bytes;
      }
    }),
  );
  const elapsed = (performance.now() - t0) / 1000;
  clearInterval(sampler);
  const after = usage(child.pid!);
  agent.destroy();
  return {
    rps: ttfb.length / elapsed,
    ttfbP50: median(ttfb),
    completeP50: median(complete),
    completeP99: pct(complete, 99),
    cpuMsPerPage: ((after.cpu - before.cpu) * 1000) / ttfb.length,
    peakRssMb: Math.max(peak, after.rss),
    pageBytes: bytes,
    pageBytesGzip: 0,
    requests: ttfb.length,
    load: [loadBefore, load1()],
  };
}

async function lock<T>(purpose: string, run: () => Promise<T>): Promise<T> {
  const script = process.env.IB_BENCH_LOCK;
  if (!script) {
    results.host.notes.push(`${purpose}: no bench lock (IB_BENCH_LOCK unset), load ${load1()}`);
    return run();
  }
  const maxLoad = args.loaded ? "99" : "4";
  execFileSync("bash", [script, "acquire", "BRIDGES", "island-bench " + purpose, maxLoad], { stdio: "inherit" });
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
    const out = spawn("/usr/bin/time", ["-l", ...lane.build], {
      cwd: repo,
      env: { ...process.env, NODE_ENV: "production" },
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
    const rss = Number(/(\d+)\s+maximum resident set size/.exec(err)?.[1] ?? 0) / 1024 / 1024;
    results.build[lane.name] = { ms: Math.round(performance.now() - t0), peakRssMb: Math.round(rss), treePeakRssMb: Math.round(Math.max(treeRss, rss)) };
    const built = results.build[lane.name]!;
    console.log(`[island-bench] built ${lane.name}: ${built.ms} ms, peak RSS ${built.peakRssMb} MB (process tree ${built.treePeakRssMb} MB)`);
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
results.versions = {
  node: process.version,
  react: version(repo, "react"),
  "react-dom": version(repo, "react-dom"),
  vite: version(repo, "vite"),
  next: version(resolve(here, "lanes/next"), "next"),
  "next react": version(resolve(here, "lanes/next"), "react"),
  astro: version(resolve(here, "lanes/astro-react"), "astro"),
  "@astrojs/react": version(resolve(here, "lanes/astro-react"), "@astrojs/react"),
  "@astrojs/node": version(resolve(here, "lanes/astro-react"), "@astrojs/node"),
  "@astrojs/preact": version(resolve(here, "lanes/astro-preact"), "@astrojs/preact"),
  "astro-preact preact": version(resolve(here, "lanes/astro-preact"), "preact"),
  "rivet preact": version(repo, "preact"),
  playwright: version(repo, "playwright"),
};

// ---------------------------------------------------------------- server
if (phases.has("server")) {
  await lock("server", async () => {
    const samples: Record<string, Record<string, ServerStats[]>> = {};
    const gzipped: Record<string, number> = {};
    for (const lane of active) {
      const child = await start(lane);
      try {
        const first = await fetchPage(lane.port, new Agent(), true);
        validate(lane.name, first.html);
        gzipped[lane.name] = gzipSync(first.html).length;
      } finally {
        await stop(child);
      }
    }
    for (let round = 0; round < ROUNDS; round++)
      for (const lane of round % 2 ? [...active].reverse() : active) {
        const child = await start(lane);
        try {
          // Warm-up: JIT + caches (not measured).
          const warm = new Agent({ keepAlive: true, maxSockets: 4 });
          const until = performance.now() + 1500;
          while (performance.now() < until) await fetchPage(lane.port, warm);
          warm.destroy();
          for (const c of [1, 10]) {
            const stats = await loadRound(lane, child, c);
            ((samples[lane.name] ??= {})["c" + c] ??= []).push(stats);
            console.log(
              `[island-bench] server ${lane.name} c${c} r${round}: ${stats.rps.toFixed(0)} req/s, cpu ${stats.cpuMsPerPage.toFixed(2)} ms/page, ttfb ${stats.ttfbP50.toFixed(2)} ms, complete ${stats.completeP50.toFixed(2)} ms, rss ${stats.peakRssMb.toFixed(0)} MB, load ${stats.load.join("→")}`,
            );
          }
        } finally {
          await stop(child);
        }
      }
    for (const [lane, byC] of Object.entries(samples)) {
      results.server[lane] = {};
      for (const [c, list] of Object.entries(byC)) {
        const pick = (key: keyof ServerStats) => median(list.map((s) => s[key] as number));
        results.server[lane]![c] = {
          rps: pick("rps"),
          ttfbP50: pick("ttfbP50"),
          completeP50: pick("completeP50"),
          completeP99: pick("completeP99"),
          cpuMsPerPage: pick("cpuMsPerPage"),
          peakRssMb: Math.max(...list.map((s) => s.peakRssMb)),
          pageBytes: list[0]!.pageBytes,
          pageBytesGzip: gzipped[lane] ?? 0,
          requests: list.reduce((n, s) => n + s.requests, 0),
          load: [Math.min(...list.map((s) => s.load[0])), Math.max(...list.map((s) => s.load[1]))],
        };
      }
    }
    save();
  });
}

// ---------------------------------------------------------------- browser
interface BrowserStats {
  bytesBeforeInput: number;
  bytesGzipBeforeInput: number;
  jsBytesGzipBeforeInput: number;
  jsBytesBeforeInput: number;
  jsRequestsBeforeInput: number;
  scriptMsUntilIdle: number;
  cls: number;
  counterPaint: number;
  pickerPaint: number;
  chartPaint: number;
  chartReadyMs: number;
  samples: number;
}
const NETWORK: Record<string, { latency: number; download: number; upload: number; cpu: number } | null> = {
  // DevTools "Fast 3G" (562.5 ms RTT, 1.44 Mbps down, 675 kbps up) + 4× CPU.
  fast3g: { latency: 562.5, download: (1.44 * 1000 * 1000) / 8, upload: (675 * 1000) / 8, cpu: 4 },
  unthrottled: null,
};
/** In-page probe (installed before any page script): first-input-to-paint and CLS; no lane code involved. */
const PROBE = `(() => {
  const ib = (window.__ib = { cls: 0 });
  new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) ib.cls += e.value; }).observe({ type: "layout-shift", buffered: true });
  ib.arm = (selector, expected) => new Promise((resolve) => {
    let ts = 0;
    addEventListener("click", (event) => { ts = event.timeStamp; check(); }, { capture: true, once: true });
    const check = () => {
      const el = document.querySelector(selector);
      if (!ts || !el || !String(el.textContent).startsWith(expected)) return;
      observer.disconnect();
      requestAnimationFrame(() => setTimeout(() => resolve(performance.now() - ts)));
    };
    const observer = new MutationObserver(check);
    observer.observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
  });
})();`;

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
        const samples: Record<string, BrowserStats[]> = {};
        // repeat -1 = one discarded warm-up visit per lane (cold server: first-request JIT / SSR paths).
        for (let repeat = -1; repeat < REPEATS; repeat++)
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
              lastNet = performance.now(),
              counting = true;
            const types = new Map<string, string>();
            const counted: string[] = [];
            // In-flight requests: one long download sends no events, so "quiet" also needs none in flight (fixed
            // 2026-10-12 in the bridge-demo lane: before, a > 1 s chunk on Fast 3G ended the "before input" window early).
            const inflight = new Set<string>();
            cdp.on("Network.loadingFailed", (e: { requestId: string }) => (inflight.delete(e.requestId), (lastNet = performance.now())));
            cdp.on("Network.responseReceived", (e: { requestId: string; type: string }) => types.set(e.requestId, e.type));
            cdp.on("Network.loadingFinished", (e: { requestId: string; encodedDataLength: number }) => {
              lastNet = performance.now();
              inflight.delete(e.requestId);
              if (!counting) return;
              bytes += e.encodedDataLength;
              counted.push(e.requestId);
              if (types.get(e.requestId) === "Script") ((jsBytes += e.encodedDataLength), jsRequests++);
            });
            cdp.on("Network.requestWillBeSent", (e: { requestId: string }) => ((lastNet = performance.now()), inflight.add(e.requestId)));
            const quiet = async (ms: number, cap: number) => {
              const end = performance.now() + cap;
              while ((inflight.size || performance.now() - lastNet < ms) && performance.now() < end) await sleep(50);
            };
            await page.goto(`http://127.0.0.1:${lane.port}/`, { waitUntil: "load", timeout: 120_000 });
            // Idle: nothing in flight and no network event for 1 s (idle islands included; the visible chart stays unloaded below the fold).
            await quiet(1000, 30_000);
            await sleep(500);
            counting = false;
            let gzBytes = 0,
              gzJs = 0;
            for (const id of counted) {
              const body = (await cdp.send("Network.getResponseBody", { requestId: id }).catch(() => null)) as { body: string; base64Encoded: boolean } | null;
              if (!body) continue;
              const size = gzipSync(Buffer.from(body.body, body.base64Encoded ? "base64" : "utf8")).length;
              gzBytes += size;
              if (types.get(id) === "Script") gzJs += size;
            }
            const metrics = (await cdp.send("Performance.getMetrics")) as { metrics: { name: string; value: number }[] };
            const scriptMs = (metrics.metrics.find((m) => m.name === "ScriptDuration")?.value ?? 0) * 1000;
            const paint = async (selector: string, expected: string, target: string) => {
              const armed = page.evaluate(
                ([s, e]) => (window as unknown as { __ib: { arm(s: string, e: string): Promise<number> } }).__ib.arm(s!, e!),
                [selector, expected],
              );
              await sleep(20);
              await page.click(target);
              return (await Promise.race([armed, sleep(15_000).then(() => NaN)])) as number;
            };
            const counterPaint = await paint("#count", "1", "#inc");
            const pickerPaint = await paint("#picked", "2026-10-15", '[data-d="15"]');
            const scrolled = performance.now();
            await page.evaluate(() => document.getElementById("bar-label")!.scrollIntoView({ block: "center" }));
            await sleep(100);
            await quiet(800, 30_000);
            const chartReadyMs = performance.now() - scrolled - 800;
            const chartPaint = await paint("#bar-label", "bar 4", '.bar[data-i="3"]');
            const cls = (await page.evaluate(() => (window as unknown as { __ib: { cls: number } }).__ib.cls)) as number;
            if (repeat >= 0)
              (samples[lane.name] ??= []).push({
                bytesBeforeInput: bytes,
                bytesGzipBeforeInput: gzBytes,
                jsBytesGzipBeforeInput: gzJs,
                jsBytesBeforeInput: jsBytes,
                jsRequestsBeforeInput: jsRequests,
                scriptMsUntilIdle: scriptMs,
                cls,
                counterPaint,
                pickerPaint,
                chartPaint,
                chartReadyMs,
                samples: 1,
              });
            console.log(
              `[island-bench] browser ${condition} ${lane.name} ${repeat < 0 ? "warm-up" : "r" + repeat}: ${(bytes / 1024).toFixed(1)} KB raw / ${(gzBytes / 1024).toFixed(1)} KB gz (${jsRequests} JS, ${(jsBytes / 1024).toFixed(1)} KB raw / ${(gzJs / 1024).toFixed(1)} KB gz), script ${scriptMs.toFixed(0)} ms, paint counter ${counterPaint.toFixed(0)} / picker ${pickerPaint.toFixed(0)} / chart ${chartPaint.toFixed(0)} ms, cls ${cls.toFixed(3)}, load ${load1()}`,
            );
            await context.close();
          }
        results.browser[condition] ??= {}; // merged per lane: a run of some lanes keeps the others' rows
        for (const [lane, list] of Object.entries(samples)) {
          const pick = (key: keyof BrowserStats) => median(list.map((s) => s[key]));
          results.browser[condition]![lane] = {
            bytesBeforeInput: pick("bytesBeforeInput"),
            bytesGzipBeforeInput: pick("bytesGzipBeforeInput"),
            jsBytesGzipBeforeInput: pick("jsBytesGzipBeforeInput"),
            jsBytesBeforeInput: pick("jsBytesBeforeInput"),
            jsRequestsBeforeInput: pick("jsRequestsBeforeInput"),
            scriptMsUntilIdle: pick("scriptMsUntilIdle"),
            cls: pick("cls"),
            counterPaint: pick("counterPaint"),
            pickerPaint: pick("pickerPaint"),
            chartPaint: pick("chartPaint"),
            chartReadyMs: pick("chartReadyMs"),
            samples: list.length,
          };
        }
        save();
      }
    } finally {
      for (const child of servers.values()) await stop(child);
      await browser.close();
    }
  });
}
save();
console.log("[island-bench] results → " + outFile);
