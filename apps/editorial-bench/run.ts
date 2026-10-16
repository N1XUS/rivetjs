// Editorial-site benchmark runner: build time + peak RSS, output size, client JS, Lighthouse, throttled navigation
// timing (all lanes, one shared static server), and the rivet-dynamic lane (node adapter per request) under load.
//
//   bash $S/heavy.sh node apps/editorial-bench/run.ts [--n 100,1000,5000] [--lanes rivet,astro,...] [--runs 3]
//       [--phases build,output,serve,dynamic] [--serve-n 1000] [--max-load 8] [--out apps/editorial-bench/results]
//
// Timed phases take the host bench lock when EDITORIAL_BENCH_LOCK points at bench-lock.sh (agent hosts). A sample whose
// 1-min load at start is above --max-load is void and repeated (up to 2× the run count). results.json + report.md.
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { cpus, loadavg, totalmem } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { brotliCompressSync, constants as zlib, gzipSync } from "node:zlib";
import { generate } from "./fixture/gen.ts";
import { Connection, type Response } from "../ssr-bench/loadgen/client.ts";

const HERE = import.meta.dirname;
const LANES = ["rivet", "astro", "eleventy", "hugo", "next", "sveltekit"] as const;
type Lane = (typeof LANES)[number];
const SITE_ROOT: Record<Lane, string> = {
  rivet: "lanes/rivet/dist/client",
  astro: "lanes/astro/dist",
  eleventy: "lanes/eleventy/dist",
  hugo: "lanes/hugo/dist",
  next: "lanes/next/dist",
  sveltekit: "lanes/sveltekit/dist",
};
const RSS_CAP_KB = 2_800_000; // whole build tree; the agent cap is 3 GB including this process
// Build wall time includes /usr/bin/time + bash start (~5 ms).
const BUILD_TIMEOUT_MS = 20 * 60_000;
const STATIC_PORT = 4411;
const DYNAMIC_PORT = 4412;

const { values: args } = parseArgs({
  options: {
    n: { type: "string", default: "100,1000,5000" },
    lanes: { type: "string", default: LANES.join(",") },
    runs: { type: "string", default: "3" },
    phases: { type: "string", default: "build,output,serve,dynamic" },
    "serve-n": { type: "string", default: "1000" },
    "max-load": { type: "string", default: "8" },
    out: { type: "string", default: join(HERE, "results") },
    "lh-runs": { type: "string", default: "3" },
    "nav-runs": { type: "string", default: "5" },
    "load-seconds": { type: "string", default: "10" },
    as: { type: "string" },
  },
});
const SIZES = args.n!.split(",").map(Number);
const lanes = args.lanes!.split(",") as Lane[];
const RUNS = Number(args.runs);
// --as <key>: store this invocation's results under another lane key (a configuration variant, e.g. next-cpus4).
const key = (lane: Lane): string => (args.as as string | undefined) ?? lane;
const PHASES = new Set(args.phases!.split(","));
const SERVE_N = Number(args["serve-n"]);
const MAX_LOAD = Number(args["max-load"]);
const OUT = resolve(args.out!);
mkdirSync(OUT, { recursive: true });
const contentDir = (n: number) => join(HERE, "fixture", "content", `n${n}`);
const load1 = () => loadavg()[0]!;
const median = (xs: number[]) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return NaN;
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const stat = (xs: number[]) => ({ median: median(xs), min: Math.min(...xs), max: Math.max(...xs), samples: xs });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (...a: unknown[]) => console.log(`[editorial ${new Date().toISOString().slice(11, 19)} load ${load1().toFixed(1)}]`, ...a);

// ---------------------------------------------------------------- results file (merged across invocations)
const resultsPath = join(OUT, "results.json");
type Results = Record<string, any>;
const results: Results = existsSync(resultsPath) ? JSON.parse(readFileSync(resultsPath, "utf8")) : {};
results.meta = {
  ...(results.meta ?? {}),
  host: { cpus: cpus().length, cpuModel: cpus()[0]?.model, memGB: Math.round(totalmem() / 2 ** 30), platform: process.platform, node: process.version },
  updated: new Date().toISOString(),
  versions: laneVersions(),
};
const save = () => writeFileSync(resultsPath, JSON.stringify(results, null, 2) + "\n");

function laneVersions() {
  const v: Record<string, Record<string, string>> = {};
  for (const lane of LANES) {
    const dir = join(HERE, "lanes", lane);
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    v[lane] = {};
    for (const name of Object.keys(pkg.dependencies ?? {})) {
      const p = join(dir, "node_modules", name, "package.json");
      v[lane]![name] = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")).version : "missing";
    }
  }
  const root = join(HERE, "..", "..", "node_modules");
  v.rivet!.vite = JSON.parse(readFileSync(join(root, "vite", "package.json"), "utf8")).version;
  v.rivet!["@rivetjs/*"] = "workspace (" + execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: HERE, encoding: "utf8" }).trim() + ")";
  try {
    v.hugo!.hugo = execFileSync(join(HERE, "lanes/hugo/node_modules/hugo-extended/bin/hugo"), ["version"], { encoding: "utf8" }).trim().split(" ")[1]!;
  } catch {}
  return v;
}

// ---------------------------------------------------------------- bench lock
const LOCK = process.env.EDITORIAL_BENCH_LOCK;
function lock(why: string) {
  if (!LOCK) return;
  log("lock: waiting", why);
  execFileSync("bash", [LOCK, "acquire", "EDITORIAL", why, String(MAX_LOAD)], { stdio: "inherit" });
}
function unlock() {
  if (LOCK) execFileSync("bash", [LOCK, "release", "EDITORIAL"], { stdio: "inherit" });
}
process.on("exit", () => {
  try {
    unlock();
  } catch {}
});
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => process.exit(130));

// ---------------------------------------------------------------- process tree sampling
function treeRss(rootPid: number): number {
  const out = execFileSync("ps", ["-A", "-o", "pid=,ppid=,rss="], { encoding: "utf8" });
  const kids = new Map<number, number[]>();
  const rss = new Map<number, number>();
  for (const line of out.split("\n")) {
    const [pid, ppid, kb] = line.trim().split(/\s+/).map(Number);
    if (!pid) continue;
    rss.set(pid, kb!);
    if (!kids.has(ppid!)) kids.set(ppid!, []);
    kids.get(ppid!)!.push(pid);
  }
  let sum = 0;
  const stack = [rootPid];
  const seen: number[] = [];
  while (stack.length) {
    const p = stack.pop()!;
    seen.push(p);
    sum += rss.get(p) ?? 0;
    stack.push(...(kids.get(p) ?? []));
  }
  (treeRss as any).pids = seen;
  return sum;
}
function killTree(pid: number) {
  treeRss(pid);
  for (const p of ((treeRss as any).pids as number[]).reverse())
    try {
      process.kill(p, "SIGKILL");
    } catch {}
}

/** Run build.sh under the RSS sampler: wall ms, peak tree RSS KB, status. */
async function timedBuild(lane: Lane, n: number, extra: string[] = []) {
  const script = join(HERE, "lanes", lane, "build.sh");
  const t0 = performance.now();
  // /usr/bin/time -l: max RSS of the largest single process (catches builds shorter than the sampling interval);
  // the sampler sums the whole tree every 50 ms. Peak = max of both.
  const child = spawn("/usr/bin/time", ["-l", "bash", script, contentDir(n), ...extra], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_OPTIONS: "" },
  });
  let output = "";
  child.stdout!.on("data", (d) => (output += d));
  child.stderr!.on("data", (d) => (output += d));
  let peak = 0;
  let status: "ok" | "failed" | "over-cap" | "timeout" = "ok";
  const exited = new Promise<number>((r) => child.on("exit", (code) => r(code ?? 1)));
  let done = false;
  exited.then(() => (done = true));
  while (!done) {
    try {
      const kb = treeRss(child.pid!);
      if (kb > peak) peak = kb;
      if (kb > RSS_CAP_KB) {
        status = "over-cap";
        killTree(child.pid!);
      }
    } catch {}
    if (performance.now() - t0 > BUILD_TIMEOUT_MS) {
      status = "timeout";
      killTree(child.pid!);
    }
    await Promise.race([exited, sleep(50)]);
  }
  const code = await exited;
  const ms = performance.now() - t0;
  const maxrss = /(\d+)\s+maximum resident set size/.exec(output);
  if (maxrss) peak = Math.max(peak, Number(maxrss[1]) / 1024);
  if (code !== 0 && status === "ok") status = "failed";
  if (status !== "ok") log(`build ${lane} n=${n} ${status}`, output.slice(-1500));
  return { ms, peakKB: peak, status };
}

// ---------------------------------------------------------------- phase: build
async function buildPhase() {
  results.build ??= {};
  for (const n of SIZES) {
    if (!existsSync(join(contentDir(n), "site.json"))) generate(n, join(HERE, "fixture", "content"));
    lock(`editorial builds n=${n}`);
    const samples: Record<string, any[]> = Object.fromEntries(lanes.map((l) => [l, []]));
    const skip = new Set<Lane>();
    for (let attempt = 0; attempt < RUNS * 2 && lanes.some((l) => !skip.has(l) && samples[l]!.filter((s) => s.valid).length < RUNS); attempt++) {
      for (const lane of lanes) {
        if (skip.has(lane) || samples[lane]!.filter((s) => s.valid).length >= RUNS) continue;
        // Wait for a quiet host before each sample (other lanes' work); the build itself raises the end load.
        for (let w = 0; w < 40 && load1() > MAX_LOAD; w++) await sleep(15_000);
        const loadStart = load1();
        const r = await timedBuild(lane, n);
        const loadEnd = load1();
        const valid = r.status === "ok" && loadStart <= MAX_LOAD;
        samples[lane]!.push({ ...r, loadStart, loadEnd, valid });
        log(`build ${lane} n=${n}: ${(r.ms / 1000).toFixed(2)} s, peak ${(r.peakKB / 1024).toFixed(0)} MB, ${r.status}${valid ? "" : " (void)"}`);
        if (r.status !== "ok") skip.add(lane);
      }
    }
    unlock();
    results.build[n] ??= {};
    for (const lane of lanes) {
      const ok = samples[lane]!.filter((s) => s.valid);
      results.build[n][key(lane)] = {
        status: ok.length >= RUNS ? "ok" : (samples[lane]!.find((s) => s.status !== "ok")?.status ?? "void"),
        seconds: ok.length ? stat(ok.map((s) => s.ms / 1000)) : null,
        peakMB: ok.length ? stat(ok.map((s) => s.peakKB / 1024)) : null,
        raw: samples[lane],
      };
    }
    save();
    if (PHASES.has("output")) outputPhase(n);
  }
}

// ---------------------------------------------------------------- phase: output
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const br = (b: Buffer | string) => brotliCompressSync(b, { params: { [zlib.BROTLI_PARAM_QUALITY]: 11 } }).length;
const gz = (b: Buffer | string) => gzipSync(b, { level: 9 }).length;
const slugs = (n: number) => Array.from({ length: 20 }, (_, k) => `story-${String(Math.floor((k * n) / 20) + 1).padStart(5, "0")}`);

/** Script inventory of one HTML page: inline JS, inline data (JSON script types), referenced JS files (script src, modulepreload, preload as=script). */
function scripts(html: string, root: string, pageDir: string) {
  let inlineJS = 0;
  let inlineData = 0;
  const files = new Set<string>();
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1]!;
    const src = /\bsrc="([^"]+)"/i.exec(attrs)?.[1];
    if (src) files.add(src);
    else {
      const type = /\btype="([^"]+)"/i.exec(attrs)?.[1] ?? "text/javascript";
      if (/javascript|module/i.test(type)) inlineJS += Buffer.byteLength(m[2]!);
      else inlineData += Buffer.byteLength(m[2]!);
    }
  }
  for (const m of html.matchAll(/<link\b([^>]*)>/gi)) {
    const a = m[1]!;
    if (/rel="modulepreload"/i.test(a) || (/rel="preload"/i.test(a) && /as="script"/i.test(a))) files.add(/href="([^"]+)"/i.exec(a)![1]!);
  }
  let raw = 0;
  let brotli = 0;
  for (const f of files) {
    const path = f.startsWith("/") ? join(root, f) : resolve(pageDir, f);
    if (!existsSync(path)) continue;
    const b = readFileSync(path);
    raw += b.length;
    brotli += br(b);
  }
  return { inlineJS, inlineData, files: files.size, fileRaw: raw, fileBrotli: brotli };
}

/** Visible text of the page body (tags/scripts/comments stripped, entities decoded, whitespace collapsed). */
function bodyText(html: string): string {
  const body = html.slice(html.search(/<body/i));
  return body
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function outputPhase(n: number) {
  results.output ??= {};
  results.output[n] ??= {};
  const refRoot = join(HERE, SITE_ROOT.rivet);
  // Parity reference = the rivet site built at this N (its articles/ dir holds exactly N pages).
  const ref = existsSync(join(refRoot, "articles")) && readdirSync(join(refRoot, "articles")).length === n ? refRoot : null;
  for (const lane of lanes) {
    const root = join(HERE, SITE_ROOT[lane]);
    if (results.build?.[n]?.[key(lane)]?.status !== "ok" || !existsSync(root)) continue;
    const files = walk(root);
    const total = files.reduce((s, f) => s + statSync(f).size, 0);
    const html = files.filter((f) => f.endsWith(".html"));
    const js = files.filter((f) => /\.m?js$/.test(f));
    const article = slugs(n).map((slug) => {
      const dir = join(root, "articles", slug);
      const page = readFileSync(join(dir, "index.html"), "utf8");
      return { raw: Buffer.byteLength(page), brotli: br(page), gzip: gz(page), ...scripts(page, root, dir), text: bodyText(page) };
    });
    const page = (p: string) => {
      const f = join(root, p, "index.html");
      if (!existsSync(f)) return null;
      const s = readFileSync(f);
      return { raw: s.length, brotli: br(s) };
    };
    let parity: string = lane === "rivet" ? "reference" : "not checked (no rivet build at this N)";
    if (lane !== "rivet" && ref) {
      const mism = slugs(n).filter((slug, k) => bodyText(readFileSync(join(ref, "articles", slug, "index.html"), "utf8")) !== article[k]!.text);
      parity = mism.length ? `${mism.length}/20 article texts differ from rivet (first: ${mism[0]})` : "20/20 article texts equal rivet";
    }
    results.output[n][key(lane)] = {
      totalBytes: total,
      files: files.length,
      htmlFiles: html.length,
      jsFiles: js.length,
      jsBytes: js.reduce((s, f) => s + statSync(f).size, 0),
      article: {
        raw: median(article.map((a) => a.raw)),
        brotli: median(article.map((a) => a.brotli)),
        gzip: median(article.map((a) => a.gzip)),
        inlineJS: median(article.map((a) => a.inlineJS)),
        inlineData: median(article.map((a) => a.inlineData)),
        jsFiles: median(article.map((a) => a.files)),
        jsFileRaw: median(article.map((a) => a.fileRaw)),
        jsFileBrotli: median(article.map((a) => a.fileBrotli)),
      },
      index: page(""),
      tag: page("tags/politics"),
      parity,
    };
    log(`output ${lane} n=${n}: ${(total / 1e6).toFixed(2)} MB, ${files.length} files, article ${article[0]!.raw} B, ${parity}`);
  }
  save();
}

// ---------------------------------------------------------------- servers
function startServer(cmd: string, argv: string[], env: Record<string, string>, port: number): Promise<ChildProcess> {
  const child = spawn(cmd, argv, { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NODE_OPTIONS: "", ...env } });
  child.stderr!.on("data", (d) => process.stderr.write(d));
  return new Promise((ok, fail) => {
    const t0 = Date.now();
    const poll = async () => {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/site.css`);
        if (r.ok) return ok(child);
      } catch {}
      if (Date.now() - t0 > 15_000) return fail(new Error(`server on ${port} did not start`));
      setTimeout(poll, 100);
    };
    poll();
  });
}
const stop = (c: ChildProcess) => new Promise<void>((r) => (c.exitCode !== null ? r() : (c.once("exit", () => r()), c.kill("SIGTERM"))));
const staticServer = (lane: Lane) =>
  startServer(process.execPath, [join(HERE, "harness/static-server.mjs"), join(HERE, SITE_ROOT[lane]), String(STATIC_PORT)], {}, STATIC_PORT);

// ---------------------------------------------------------------- phase: serve (client JS, Lighthouse, throttled navigation)
async function servePhase() {
  const n = SERVE_N;
  const { chromium } = await import("playwright");
  const { runLighthouse } = await import("./harness/lh.mjs");
  const chromePath = chromium.executablePath();
  const article = `/articles/${slugs(n)[3]}/`;
  results.serve ??= {};
  results.serve[n] ??= {};
  for (const lane of lanes) {
    if (!existsSync(join(HERE, SITE_ROOT[lane])) || results.build?.[n]?.[key(lane)]?.status !== "ok") {
      log(`serve ${lane}: no n=${n} build, skipped`);
      continue;
    }
    // The output phase of a later N may have replaced dist: rebuild at the serve N (not timed).
    if (results.output?.[n]?.[key(lane)]?.files !== walk(join(HERE, SITE_ROOT[lane])).length) {
      log(`serve ${lane}: rebuilding at n=${n}`);
      await timedBuild(lane, n);
    }
    const server = await staticServer(lane);
    const base = `http://127.0.0.1:${STATIC_PORT}`;
    const entry: any = {};
    try {
      lock(`editorial serve ${lane}`);
      entry.loadStart = load1();
      // 1. Client JS actually loaded by an article page (unthrottled, wait for idle-time boot).
      {
        const browser = await chromium.launch({ args: ["--use-mock-keychain", "--password-store=basic"] });
        const ctx = await browser.newContext();
        const pg = await ctx.newPage();
        const reqs: { type: string; url: string; transfer: number; size: number }[] = [];
        pg.on("requestfinished", async (req) => {
          const res = await req.response();
          const sizes = await req.sizes().catch(() => null);
          const body = await res?.body().catch(() => null);
          reqs.push({
            type: req.resourceType(),
            url: req.url(),
            transfer: (sizes?.responseBodySize ?? 0) + (sizes?.responseHeadersSize ?? 0),
            size: body?.length ?? 0,
          });
        });
        await pg.goto(base + article, { waitUntil: "load" });
        await pg.waitForTimeout(4000);
        const domElements = await pg.evaluate(() => document.getElementsByTagName("*").length);
        await browser.close();
        const js = reqs.filter((r) => r.type === "script");
        entry.client = {
          requests: reqs.length,
          transferBytes: reqs.reduce((s, r) => s + r.transfer, 0),
          jsRequests: js.length,
          jsTransferBytes: js.reduce((s, r) => s + r.transfer, 0),
          jsBytes: js.reduce((s, r) => s + r.size, 0),
          other: reqs.filter((r) => r.type !== "script" && r.type !== "document").map((r) => `${r.type} ${new URL(r.url).pathname}`),
          domElements,
        };
      }
      // 2. Lighthouse (mobile preset), article + index.
      entry.lighthouse = {};
      for (const [name, path] of [
        ["article", article],
        ["index", "/"],
      ] as const) {
        const runs = [];
        for (let r = 0; r < Number(args["lh-runs"]); r++) runs.push(await runLighthouse(base + path, chromePath));
        const pick = (k: string) => stat(runs.map((x: any) => x[k]));
        entry.lighthouse[name] = Object.fromEntries(["score", "lcp", "fcp", "tbt", "cls", "si", "domSize", "bytes"].map((k) => [k, pick(k)]));
        entry.lighthouse[name].warnings = [...new Set(runs.flatMap((x: any) => x.warnings))];
      }
      // 3. Cold-cache navigation at Fast 3G + 4x CPU (DevTools Fast 3G: 562.5 ms RTT, 1.44 Mbit/s down, 675 kbit/s up).
      {
        const browser = await chromium.launch({ args: ["--use-mock-keychain", "--password-store=basic"] });
        const nav = [];
        for (let r = 0; r < Number(args["nav-runs"]); r++) {
          const ctx = await browser.newContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true });
          const pg = await ctx.newPage();
          const cdp = await ctx.newCDPSession(pg);
          await cdp.send("Network.enable");
          await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
          await cdp.send("Network.emulateNetworkConditions", {
            offline: false,
            latency: 562.5,
            downloadThroughput: (1.6 * 1024 * 1024 * 0.9) / 8,
            uploadThroughput: (750 * 1024 * 0.9) / 8,
          });
          await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
          await pg.goto(base + article, { waitUntil: "load" });
          await pg.waitForTimeout(300);
          nav.push(
            await pg.evaluate(() => {
              const t = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
              const fcp = performance.getEntriesByName("first-contentful-paint")[0];
              return { ttfb: t.responseStart, dcl: t.domContentLoadedEventEnd, load: t.loadEventEnd, fcp: fcp ? fcp.startTime : NaN };
            }),
          );
          await ctx.close();
        }
        await browser.close();
        entry.nav = Object.fromEntries(["ttfb", "dcl", "load", "fcp"].map((k) => [k, stat(nav.map((x: any) => x[k]))]));
      }
      entry.loadEnd = load1();
      entry.valid = entry.loadStart <= MAX_LOAD;
    } finally {
      unlock();
      await stop(server);
    }
    results.serve[n][key(lane)] = entry;
    log(
      `serve ${lane}: js ${entry.client.jsBytes} B (${entry.client.jsRequests} req), LH article ${entry.lighthouse.article.score.median} LCP ${entry.lighthouse.article.lcp.median.toFixed(0)} ms, nav load ${entry.nav.load.median.toFixed(0)} ms`,
    );
    save();
  }
}

// ---------------------------------------------------------------- phase: dynamic (rivet node adapter vs static file serving)
function cpuSeconds(pid: number): number {
  const t = execFileSync("ps", ["-o", "time=", "-p", String(pid)], { encoding: "utf8" }).trim(); // [[dd-]hh:]mm:ss.cc
  const parts = t.split(":").map(Number);
  return parts.reduce((s, x) => s * 60 + x, 0);
}

async function closedLoop(port: number, paths: string[], concurrency: number, seconds: number, serverPid: number) {
  const requests = paths.map((p) =>
    Buffer.from(`GET ${p} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: keep-alive\r\nAccept: text/html\r\n\r\n`, "latin1"),
  );
  const conns = Array.from({ length: concurrency }, () => new Connection("127.0.0.1", port, paths[0]!));
  await Promise.all(conns.map((c) => c.open()));
  const lat: number[] = [];
  const ttfb: number[] = [];
  let bytes = 0;
  let errors = 0;
  let next = 0;
  const cpu0 = cpuSeconds(serverPid);
  const t0 = performance.now();
  const end = t0 + seconds * 1000;
  await Promise.all(
    conns.map(
      (c) =>
        new Promise<void>((done) => {
          const go = () => {
            if (performance.now() >= end) return done();
            (c as unknown as { request: Buffer }).request = requests[next++ % requests.length]!;
            c.send((r: Response) => {
              if (r.status !== 200 || r.error) errors++;
              else {
                lat.push(Number(r.end - c.sentAt) / 1e6);
                ttfb.push(Number(r.firstByte - c.sentAt) / 1e6);
                bytes += r.bytes;
              }
              go();
            });
          };
          go();
        }),
    ),
  );
  const wall = (performance.now() - t0) / 1000;
  const cpu = cpuSeconds(serverPid) - cpu0;
  conns.forEach((c) => c.close());
  const q = (xs: number[], p: number) => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? NaN;
  };
  return {
    requests: lat.length,
    errors,
    rps: lat.length / wall,
    p50: q(lat, 0.5),
    p99: q(lat, 0.99),
    ttfbP50: q(ttfb, 0.5),
    cpuMsPerReq: (cpu * 1000) / lat.length,
    bytesPerReq: bytes / lat.length,
  };
}

async function dynamicPhase() {
  const n = SERVE_N;
  const seconds = Number(args["load-seconds"]);
  log(`dynamic: building rivet server mode at n=${n}`);
  const b = await timedBuild("rivet", n, ["server"]);
  if (b.status !== "ok") throw new Error("rivet server build failed");
  const paths = slugs(n).map((s) => `/articles/${s}/`);
  const targets: [string, () => Promise<ChildProcess>, number][] = [
    [
      "rivet-dynamic",
      () =>
        startServer(
          process.execPath,
          [join(HERE, "lanes/rivet/serve-dynamic.js")],
          { EDITORIAL_CONTENT: contentDir(n), PORT: String(DYNAMIC_PORT) },
          DYNAMIC_PORT,
        ),
      DYNAMIC_PORT,
    ],
    // Same build, route rules `{ "/**": { swr: 60 } }`: rendered once per URL, then served from the in-process page cache.
    [
      "rivet-dynamic-cached",
      () =>
        startServer(
          process.execPath,
          [join(HERE, "lanes/rivet/serve-dynamic.js")],
          { EDITORIAL_CONTENT: contentDir(n), PORT: String(DYNAMIC_PORT), EDITORIAL_ROUTE_CACHE: "1" },
          DYNAMIC_PORT,
        ),
      DYNAMIC_PORT,
    ],
  ];
  // Static baselines: same article URLs from the shared static server (identity encoding, like the dynamic lane).
  for (const lane of ["rivet", "hugo"] as Lane[])
    if (existsSync(join(HERE, SITE_ROOT[lane])))
      targets.push([
        `static:${lane}`,
        () => startServer(process.execPath, [join(HERE, "harness/static-server.mjs"), join(HERE, SITE_ROOT[lane]), String(STATIC_PORT)], {}, STATIC_PORT),
        STATIC_PORT,
      ]);
  results.dynamic ??= {};
  results.dynamic[n] = { seconds, note: "closed loop over 20 article URLs, keep-alive, identity encoding; CPU = server process ps time delta" };
  lock("editorial dynamic load");
  try {
    const rounds: Record<string, any[]> = {};
    for (let round = 0; round < RUNS; round++) {
      for (const [name, start, port] of targets) {
        const server = await start();
        try {
          await closedLoop(port, paths, 1, 2, server.pid!); // warm-up (module load, JIT, fixture read)
          const loadStart = load1();
          const c1 = await closedLoop(port, paths, 1, seconds, server.pid!);
          const c10 = await closedLoop(port, paths, 10, seconds, server.pid!);
          (rounds[name] ??= []).push({ c1, c10, loadStart, loadEnd: load1() });
          log(`dynamic ${name} round ${round}: c1 p50 ${c1.p50.toFixed(2)} ms cpu ${c1.cpuMsPerReq.toFixed(3)} ms/req; c10 ${c10.rps.toFixed(0)} rps`);
        } finally {
          await stop(server);
        }
      }
    }
    for (const [name, rs] of Object.entries(rounds)) {
      const agg = (c: "c1" | "c10") =>
        Object.fromEntries(["rps", "p50", "p99", "ttfbP50", "cpuMsPerReq", "bytesPerReq"].map((k) => [k, stat(rs.map((r) => r[c][k]))]));
      results.dynamic[n][name] = {
        c1: agg("c1"),
        c10: agg("c10"),
        loads: rs.map((r) => [r.loadStart, r.loadEnd]),
        errors: rs.reduce((s, r) => s + r.c1.errors + r.c10.errors, 0),
      };
    }
  } finally {
    unlock();
  }
  save();
}

// ---------------------------------------------------------------- report.md
const fmt = (x: number | null | undefined, d = 0) => (x == null || !Number.isFinite(x) ? "–" : x.toFixed(d));
const range = (s: any, d = 0, k = 1) => (s ? `${fmt(s.median * k, d)} (${fmt(s.min * k, d)}–${fmt(s.max * k, d)})` : "–");

/** WIN/TIE/LOSE of rivet vs other: lower is better unless `higher`. ≥ 1.1× = win/lose. */
export function verdict(rivet: number, other: number, higher = false, eps = 0): string {
  if (!Number.isFinite(rivet) || !Number.isFinite(other)) return "–";
  if (Math.abs(rivet) <= eps && Math.abs(other) <= eps) return "TIE (both ~0)";
  if (Math.abs(rivet) <= eps) return higher ? "LOSE (rivet 0)" : "WIN (rivet 0)";
  if (Math.abs(other) <= eps) return higher ? "WIN (other 0)" : "LOSE (other 0)";
  const ratio = higher ? rivet / other : other / rivet;
  const r = ratio >= 1 ? ratio : 1 / ratio;
  return (ratio >= 1.1 ? "WIN " : ratio <= 1 / 1.1 ? "LOSE " : "TIE ") + r.toFixed(2) + "×";
}

function report() {
  const L: string[] = [];
  const found = new Set<string>(LANES);
  for (const phase of [results.build, results.output, results.serve])
    for (const byLane of Object.values<any>(phase ?? {})) for (const k of Object.keys(byLane)) found.add(k);
  const ALL = [...found] as Lane[];
  const others = ALL.filter((l) => l !== "rivet");
  const v = results.meta.versions;
  L.push(
    "# Editorial benchmark — generated report",
    "",
    `Generated ${results.meta.updated} by \`apps/editorial-bench/run.ts\` (raw data: results.json). Host: ${results.meta.host.cpuModel}, ${results.meta.host.cpus} CPUs, ${results.meta.host.memGB} GB, ${results.meta.host.platform}, Node ${results.meta.host.node}.`,
    "",
  );
  L.push("## Versions", "", "| Lane | Packages |", "| --- | --- |");
  for (const l of ALL)
    L.push(
      `| ${l} | ${Object.entries(v[l] ?? v[l.split("-")[0]!] ?? {})
        .map(([k, x]) => `${k} ${x}`)
        .join(", ")} |`,
    );
  L.push("");
  if (results.build) {
    L.push("## Build (wall s and peak process-tree RSS MB; median (min–max) of valid runs)", "");
    const ns = Object.keys(results.build)
      .map(Number)
      .sort((a, b) => a - b);
    L.push(
      `| Lane | ${ns.map((n) => `N=${n} s`).join(" | ")} | ${ns.map((n) => `N=${n} MB`).join(" | ")} |`,
      `| --- |${ns.map(() => " --- |").join("")}${ns.map(() => " --- |").join("")}`,
    );
    for (const l of ALL) {
      const cell = (n: number, k: string, d: number) => {
        const b = results.build[n]?.[l];
        return !b ? "–" : b.status !== "ok" ? b.status : range(b[k], d);
      };
      L.push(`| ${l} | ${ns.map((n) => cell(n, "seconds", 2)).join(" | ")} | ${ns.map((n) => cell(n, "peakMB", 0)).join(" | ")} |`);
    }
    const loads = ns.flatMap((n) => ALL.flatMap((l) => (results.build[n]?.[l]?.raw ?? []).map((s: any) => s.loadStart)));
    L.push("", `1-min load at sample start: ${fmt(Math.min(...loads), 1)}–${fmt(Math.max(...loads), 1)} (void above ${MAX_LOAD}).`, "");
  }
  if (results.output) {
    for (const n of Object.keys(results.output)) {
      L.push(
        `## Output, N=${n}`,
        "",
        "| Lane | total MB | files | JS files | article HTML raw B | article HTML br B | article inline JS B | article inline data B | article referenced JS files / raw B / br B | index raw B | content parity |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
      );
      for (const l of ALL) {
        const o = results.output[n][l];
        if (!o) continue;
        L.push(
          `| ${l} | ${fmt(o.totalBytes / 1e6, 2)} | ${o.files} | ${o.jsFiles} | ${o.article.raw} | ${o.article.brotli} | ${o.article.inlineJS} | ${o.article.inlineData} | ${o.article.jsFiles} / ${o.article.jsFileRaw} / ${o.article.jsFileBrotli} | ${o.index?.raw ?? "–"} | ${o.parity} |`,
        );
      }
      L.push("");
    }
  }
  if (results.serve) {
    for (const n of Object.keys(results.serve)) {
      const S = results.serve[n];
      L.push(
        `## Browser, N=${n} (shared static server, gzip)`,
        "",
        "| Lane | JS loaded (req / decoded B / transfer B) | all requests / transfer B | LH article score | LCP ms | FCP ms | TBT ms | CLS | DOM elements (LH / document) | LH index score | index LCP ms | Fast 3G + 4× DCL ms | load ms |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
      );
      for (const l of ALL) {
        const e = S[l];
        if (!e) continue;
        const a = e.lighthouse.article;
        const i = e.lighthouse.index;
        L.push(
          `| ${l} | ${e.client.jsRequests} / ${e.client.jsBytes} / ${e.client.jsTransferBytes} | ${e.client.requests} / ${e.client.transferBytes} | ${range(a.score)} | ${range(a.lcp)} | ${range(a.fcp)} | ${range(a.tbt)} | ${range(a.cls, 3)} | ${fmt(a.domSize.median)} / ${e.client.domElements} | ${range(i.score)} | ${range(i.lcp)} | ${range(e.nav.dcl)} | ${range(e.nav.load)} |`,
        );
      }
      L.push(
        "",
        `Load at start per lane: ${ALL.filter((l) => S[l])
          .map((l) => `${l} ${fmt(S[l].loadStart, 1)}/${fmt(S[l].loadEnd, 1)}`)
          .join(", ")} (start/end).`,
        "",
      );
    }
  }
  if (results.dynamic) {
    for (const n of Object.keys(results.dynamic)) {
      const D = results.dynamic[n];
      L.push(
        `## Dynamic vs static serving, N=${n} (${D.note}; ${D.seconds} s per level, ${RUNS} rounds)`,
        "",
        "| Target | c1 p50 ms | c1 TTFB p50 ms | c1 CPU ms/req | c10 rps | c10 p50 ms | c10 p99 ms | c10 CPU ms/req | bytes/req | errors |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
      );
      for (const [name, x] of Object.entries<any>(D)) {
        if (!x?.c1) continue;
        L.push(
          `| ${name} | ${range(x.c1.p50, 2)} | ${range(x.c1.ttfbP50, 2)} | ${range(x.c1.cpuMsPerReq, 3)} | ${range(x.c10.rps)} | ${range(x.c10.p50, 2)} | ${range(x.c10.p99, 2)} | ${range(x.c10.cpuMsPerReq, 3)} | ${fmt(x.c1.bytesPerReq.median)} | ${x.errors} |`,
        );
      }
      L.push("");
    }
  }
  // Verdict table: rivet vs each lane.
  const rows: [string, (l: Lane) => number | undefined, boolean, number][] = [];
  for (const n of Object.keys(results.build ?? {})) {
    rows.push([`build s N=${n}`, (l) => results.build[n]?.[l]?.seconds?.median, false, 0]);
    rows.push([`build peak MB N=${n}`, (l) => results.build[n]?.[l]?.peakMB?.median, false, 0]);
  }
  const on = Number(Object.keys(results.output ?? {}).includes(String(SERVE_N)) ? SERVE_N : Object.keys(results.output ?? {})[0]);
  if (results.output?.[on]) {
    rows.push([`output MB N=${on}`, (l) => results.output[on][l]?.totalBytes, false, 0]);
    rows.push([`files N=${on}`, (l) => results.output[on][l]?.files, false, 0]);
    rows.push(["article HTML raw B", (l) => results.output[on][l]?.article.raw, false, 0]);
    rows.push(["article HTML br B", (l) => results.output[on][l]?.article.brotli, false, 0]);
  }
  const S = results.serve?.[SERVE_N];
  if (S) {
    rows.push(["article JS decoded B (loaded)", (l) => S[l]?.client.jsBytes, false, 0]);
    rows.push(["article transfer B (all)", (l) => S[l]?.client.transferBytes, false, 0]);
    rows.push(["LH article score", (l) => S[l]?.lighthouse.article.score.median, true, 0]);
    rows.push(["LH article LCP ms", (l) => S[l]?.lighthouse.article.lcp.median, false, 0]);
    rows.push(["LH article FCP ms", (l) => S[l]?.lighthouse.article.fcp.median, false, 0]);
    rows.push(["LH article TBT ms", (l) => S[l]?.lighthouse.article.tbt.median, false, 0.5]);
    rows.push(["LH article CLS", (l) => S[l]?.lighthouse.article.cls.median, false, 0.001]);
    rows.push(["article DOM elements", (l) => S[l]?.client.domElements, false, 0]);
    rows.push(["LH index LCP ms", (l) => S[l]?.lighthouse.index.lcp.median, false, 0]);
    rows.push(["Fast 3G + 4× DCL ms", (l) => S[l]?.nav.dcl.median, false, 0]);
    rows.push(["Fast 3G + 4× load ms", (l) => S[l]?.nav.load.median, false, 0]);
  }
  L.push(
    "## Verdict (rivet vs lane; ≥ 1.1× = WIN/LOSE, ratio = worse/better)",
    "",
    `| Metric | ${others.join(" | ")} |`,
    `| --- |${others.map(() => " --- |").join("")}`,
  );
  for (const [name, get, higher, eps] of rows) {
    const r = get("rivet");
    L.push(`| ${name} | ${others.map((l) => (r == null || get(l) == null ? "–" : verdict(r, get(l)!, higher, eps))).join(" | ")} |`);
  }
  L.push("");
  writeFileSync(join(OUT, "report.md"), L.join("\n"));
  log(`report → ${join(OUT, "report.md")}`);
}

// ---------------------------------------------------------------- main
if (PHASES.has("build")) await buildPhase();
else if (PHASES.has("output")) for (const n of SIZES) outputPhase(n);
if (PHASES.has("serve")) await servePhase();
if (PHASES.has("dynamic")) await dynamicPhase();
report();
