// Real-Chrome resumability benchmark: Rivet plus separate stable and preview Qwik/Solid lanes.
// Usage: node apps/resume-bench/run.ts [--build] [--verify] [--repeats N] [--lanes rivet,qwik] [--conditions fast,slow]
//   [--scenarios load,click,…] [--no-traces] [--no-coverage]
// Traces: results/traces/<run-id>/<condition>/<scenario>/<lane>-r<repeat>.json.gz (Chrome trace, gzip).
import { chromium, type Browser, type CDPSession, type Page } from "playwright";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { serve } from "./serve.ts";
import { isLane, laneNames, readBuildManifest, type BuildManifest } from "./provenance.ts";
import { median, chromeTarget } from "../../scripts/bench/shared.ts";

type Scenario = (page: Page, context: { beforeInput: () => Promise<void> }) => Promise<Record<string, number> | void>;
/** One script's coverage: module top level ran / any other function ran. */
interface ScriptCoverage {
  top: boolean;
  fn: boolean;
}
type CoverageMap = Record<string, ScriptCoverage>;
/** A finished network response, as recorded from CDP events. */
interface Loaded {
  id: string;
  type: string;
  url: string;
  mime: string;
  bytes: number;
  at: number;
}
interface Sent {
  at: number;
  from: string | undefined;
}
interface PrefetchChunk {
  url: string | null;
  strategy: string | undefined;
  bytes: number;
  used: boolean;
  usedByInteraction: boolean | null;
}
/** In-page marks plus probe buffers, read back after a scenario. */
interface Marks {
  pointerdown?: number;
  keydown?: number;
  tasks: [number, number][];
  loafs: [number, number, number][];
  events: [string, number, number, number][];
  sync: BenchProbe["sync"];
  fcp: number;
  scripts: number[];
}
type Run = Record<string, unknown> & { lane: string; condition: string; scenario: string; errors: string[] };
type Stat = { share: number; n: number; values: boolean[] } | { median: number; min: number; max: number };

const root = fileURLToPath(new URL("./", import.meta.url));
const args = process.argv.slice(2);
const flag = (name: string) => args.includes("--" + name);
const option = (name: string, fallback: string): string => {
  const i = args.indexOf("--" + name);
  return i < 0 ? fallback : args[i + 1]!;
};
const requestedLanes = option("lanes", laneNames.join(",")).split(",");
if (!requestedLanes.length || requestedLanes.some((lane) => !isLane(lane)) || new Set(requestedLanes).size !== requestedLanes.length)
  throw Error(`Unknown or duplicate lanes: ${requestedLanes.join(",")}`);
const LANES = requestedLanes.filter(isLane);
const CONDITIONS: Record<string, { latency: number; download: number; upload: number; cpu: number } | null> = {
  fast: null,
  // Lighthouse "Slow 4G" + 4x CPU.
  slow: { latency: 150, download: (1.6 * 1024 * 1024) / 8, upload: (750 * 1024) / 8, cpu: 4 },
};
const conditions = option("conditions", "fast,slow").split(",");
const repeats = Number(option("repeats", "10"));
const dist = (lane: string) => resolve(root, "dist", lane);
const traces = !flag("no-traces");
const coverage = !flag("no-coverage");
// DevTools Performance panel categories minus the JS sampling profiler (its overhead skews 4x-CPU runs).
const TRACE_CATEGORIES = [
  "devtools.timeline",
  "disabled-by-default-devtools.timeline",
  "disabled-by-default-devtools.timeline.frame",
  "disabled-by-default-devtools.timeline.stack",
  "v8.execute",
  "blink.user_timing",
  "loading",
  "latencyInfo",
];
// Scenario → [first-interaction event type, DOM-update mark that must hold when its dispatch ends].
const FIRST_INPUT: Record<string, [string, string]> = {
  click: ["click", "count"],
  hoverClick: ["click", "count"],
  navigate: ["click", "detail"],
  scrollClick: ["click", "count"],
  filter: ["input", "rows"],
  filterKey: ["input", "rows"],
  filterSettled: ["input", "rows"],
};
const STRATEGIES: Record<string, string> = { e: "eager", i: "idle", v: "visible" };

// In-page probes: long tasks, LoAF, event timing, rAF gaps, DOM-change timestamps.
function probe(options?: { sync: boolean }) {
  const m = (window.__bench = { tasks: [], loafs: [], events: [], frames: [], marks: {}, sync: {} } as unknown as BenchProbe);
  const observe = <E extends PerformanceEntry>(type: string, fn: (entry: E) => void, extra = {}) => {
    try {
      new PerformanceObserver((list) => (list.getEntries() as E[]).forEach(fn)).observe({ type, buffered: true, ...extra });
    } catch {}
  };
  observe("longtask", (e) => m.tasks.push([e.startTime, e.duration]));
  observe<PerformanceEntry & { blockingDuration: number }>("long-animation-frame", (e) => m.loafs.push([e.startTime, e.duration, e.blockingDuration]));
  observe<PerformanceEntry & { interactionId?: number }>("event", (e) => e.interactionId && m.events.push([e.name, e.startTime, e.duration, e.interactionId]), {
    durationThreshold: 16,
  });
  addEventListener("pointerdown", (e) => (m.marks.pointerdown ??= e.timeStamp), true);
  addEventListener("click", (e) => (m.marks.click ??= e.timeStamp), true);
  addEventListener("keydown", (e) => (m.marks.keydown ??= e.timeStamp), true);
  // First trusted click / input: did its dispatch change the DOM? Window capture listeners run before
  // any framework listener; the window bubble listener (or a timeout if propagation stopped) closes the
  // dispatch. `until` marks set by then were reached inside the input task (MutationObserver microtasks
  // run after each listener). `rows`: #rows subtree mutated inside the dispatch.
  if (options?.sync)
    for (const type of ["click", "input"]) {
      // Records are delivered to the callback at each microtask checkpoint; collect them there too.
      let seen: MutationRecord[] = [];
      const observer = new MutationObserver((records) => seen.push(...records));
      let live = false;
      const end = () => {
        if (!live) return;
        live = false;
        const records = seen.concat(observer.takeRecords());
        seen = [];
        observer.disconnect();
        const rows = document.getElementById("rows");
        Object.assign(m.sync[type]!, {
          end: performance.now(),
          mutated: records.length > 0,
          marks: Object.keys(m.marks),
          rows: records.some((r) => rows && rows.contains(r.target)),
        });
      };
      addEventListener(
        type,
        (e) => {
          if (m.sync[type] || !e.isTrusted) return;
          m.sync[type] = { at: e.timeStamp };
          live = true;
          observer.observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
          setTimeout(end, 0);
        },
        true,
      );
      addEventListener(type, end);
    }
  m.frameLoop = () => {
    const tick = (t: number) => {
      m.frames.push(t);
      if (m.frames.length < 2000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  // Resolve when predicate holds, timestamped by a MutationObserver callback (microtask after the DOM change).
  // Scenarios register it (awaited) before sending input: Runtime and Input CDP commands may reorder.
  m.until = (name, predicate) =>
    new Promise((done) => {
      const check = () => {
        if (!predicate()) return false;
        m.marks[name] = performance.now();
        // Paint mark (B7): the frame that renders this DOM change has run (rAF → style/layout/paint → the
        // next task). Effects, cleanup and layout of the update are included, unlike the mutation mark.
        requestAnimationFrame(() => {
          const channel = new MessageChannel();
          channel.port1.onmessage = () => (m.marks[name + "Paint"] = performance.now());
          channel.port2.postMessage(0);
        });
        done(m.marks[name]);
        return true;
      };
      if (check()) return;
      const observer = new MutationObserver(() => check() && observer.disconnect());
      observer.observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
    });
}

const SCENARIOS: Record<string, Scenario> = {
  // Load only: what runs before any interaction.
  async load(page) {
    await page.waitForTimeout(3000);
  },
  // First click, cold (no hover dwell before pointerdown).
  async click(page, { beforeInput }) {
    await page.waitForTimeout(1000);
    await beforeInput();
    await page.evaluate(() => {
      __bench.pending = __bench.until("count", () => document.querySelector("#count")?.textContent === "1");
    });
    const done = page.evaluate(() => __bench.pending);
    await page.click("#inc");
    await done;
    await page.waitForTimeout(500);
    await page.waitForFunction(() => __bench.marks.countPaint != null, null, { timeout: 30000 });
    return page.evaluate(() => ({ latency: __bench.marks.count! - __bench.marks.click!, paintLatency: __bench.marks.countPaint! - __bench.marks.click! }));
  },
  // Same first click by keyboard (Enter on the focused button) and by touch (tap): Chrome stalls the frame
  // after a DOM change made inside a trusted *mouse* click (~25–45 ms until the hover update), not after
  // keyboard or touch, so mouse-only numbers misstate input→paint. Same marks as `click` (click → paint).
  async keyClick(page, { beforeInput }) {
    await page.waitForTimeout(1000);
    await page.focus("#inc");
    await beforeInput();
    await page.evaluate(() => {
      __bench.pending = __bench.until("count", () => document.querySelector("#count")?.textContent === "1");
    });
    const done = page.evaluate(() => __bench.pending);
    await page.keyboard.press("Enter");
    await done;
    await page.waitForTimeout(500);
    await page.waitForFunction(() => __bench.marks.countPaint != null, null, { timeout: 30000 });
    return page.evaluate(() => ({ latency: __bench.marks.count! - __bench.marks.click!, paintLatency: __bench.marks.countPaint! - __bench.marks.click! }));
  },
  async tapClick(page, { beforeInput }) {
    await page.waitForTimeout(1000);
    await beforeInput();
    await page.evaluate(() => {
      __bench.pending = __bench.until("count", () => document.querySelector("#count")?.textContent === "1");
    });
    const done = page.evaluate(() => __bench.pending);
    await page.tap("#inc");
    await done;
    await page.waitForTimeout(500);
    await page.waitForFunction(() => __bench.marks.countPaint != null, null, { timeout: 30000 });
    return page.evaluate(() => ({ latency: __bench.marks.count! - __bench.marks.click!, paintLatency: __bench.marks.countPaint! - __bench.marks.click! }));
  },
  // Hover first (intent prefetch), then click.
  async hoverClick(page, { beforeInput }) {
    await page.waitForTimeout(1000);
    await page.hover("#inc");
    await page.waitForTimeout(600);
    await beforeInput();
    await page.evaluate(() => {
      __bench.pending = __bench.until("count", () => document.querySelector("#count")?.textContent === "1");
    });
    const done = page.evaluate(() => __bench.pending);
    await page.mouse.down();
    await page.mouse.up();
    await done;
    await page.waitForTimeout(500);
    await page.waitForFunction(() => __bench.marks.countPaint != null, null, { timeout: 30000 });
    return page.evaluate(() => ({ latency: __bench.marks.count! - __bench.marks.click!, paintLatency: __bench.marks.countPaint! - __bench.marks.click! }));
  },
  // Filter 1,000 rows down to 100 ("golf"): first keydown → list updated.
  async filter(page, { beforeInput }) {
    await page.waitForTimeout(1000);
    await beforeInput();
    await page.click("#filter");
    await page.evaluate(() => {
      __bench.pending = __bench.until("rows", () => document.querySelectorAll("#rows li").length === 100);
    });
    const done = page.evaluate(() => __bench.pending);
    await page.keyboard.type("golf");
    await done;
    await page.waitForTimeout(500);
    await page.waitForFunction(() => __bench.marks.rowsPaint != null, null, { timeout: 30000 });
    return page.evaluate(() => ({ latency: __bench.marks.rows! - __bench.marks.keydown!, paintLatency: __bench.marks.rowsPaint! - __bench.marks.keydown! }));
  },
  // One key ("g" already leaves the 100 rows): first-result latency alone, no later keys queued behind it.
  async filterKey(page, { beforeInput }) {
    await page.waitForTimeout(1000);
    await beforeInput();
    await page.click("#filter");
    await page.evaluate(() => {
      __bench.pending = __bench.until("rows", () => document.querySelectorAll("#rows li").length === 100);
    });
    const done = page.evaluate(() => __bench.pending);
    await page.keyboard.type("g");
    await done;
    await page.waitForTimeout(500);
    await page.waitForFunction(() => __bench.marks.rowsPaint != null, null, { timeout: 30000 });
    return page.evaluate(() => ({ latency: __bench.marks.rows! - __bench.marks.keydown!, paintLatency: __bench.marks.rowsPaint! - __bench.marks.keydown! }));
  },
  // Same typing as `filter`, until the final query settled: the 4th trusted `input` ("golf") finished its dispatch
  // (window bubble) with the 100 rows shown, then the frame after it. `latency` = first keydown → that point. A lane
  // handling input asynchronously (after dispatch) still has to show the rows: the check re-runs on DOM changes.
  async filterSettled(page, { beforeInput }) {
    await page.waitForTimeout(1000);
    await beforeInput();
    await page.click("#filter");
    await page.evaluate(() => {
      __bench.pending = new Promise((done) => {
        const m = __bench.marks;
        let inputs = 0;
        const check = () => {
          if (m.settled != null || inputs < 4 || document.querySelectorAll("#rows li").length !== 100) return;
          observer.disconnect();
          m.settled = performance.now();
          requestAnimationFrame(() => {
            const channel = new MessageChannel();
            channel.port1.onmessage = () => (m.settledPaint = performance.now());
            channel.port2.postMessage(0);
          });
          done(m.settled);
        };
        // DOM changes (a lane updating after the dispatch) and dispatch ends (window bubble: an unchanged result
        // mutates nothing) both re-check.
        const observer = new MutationObserver(check);
        observer.observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
        addEventListener("input", (e) => {
          if (e.isTrusted) (inputs++, check());
        });
      });
    });
    const done = page.evaluate(() => __bench.pending);
    await page.keyboard.type("golf");
    await done;
    await page.waitForTimeout(500);
    await page.waitForFunction(() => __bench.marks.settledPaint != null, null, { timeout: 30000 });
    return page.evaluate(() => ({
      latency: __bench.marks.settled! - __bench.marks.keydown!,
      paintLatency: __bench.marks.settledPaint! - __bench.marks.keydown!,
    }));
  },
  // Client navigation to the lazy detail route.
  async navigate(page, { beforeInput }) {
    await page.waitForTimeout(1000);
    await beforeInput();
    await page.evaluate(() => {
      __bench.pending = __bench.until("detail", () => !!document.querySelector("#detail"));
    });
    const done = page.evaluate(() => __bench.pending);
    await page.click("#rows li:nth-child(3) a.open");
    await done;
    await page.waitForTimeout(500);
    await page.waitForFunction(() => __bench.marks.detailPaint != null, null, { timeout: 30000 });
    return page.evaluate(() => ({ latency: __bench.marks.detail! - __bench.marks.click!, paintLatency: __bench.marks.detailPaint! - __bench.marks.click! }));
  },
  // Continuous scroll; the first click (sticky header) happens mid-scroll and needs a chunk fetch.
  // beforeInput runs before the scroll starts: a coverage snapshot mid-scroll would itself cause jank.
  async scrollClick(page, { beforeInput }) {
    await page.waitForTimeout(1000);
    await beforeInput();
    await page.evaluate(() => {
      __bench.frameLoop();
      const step = () => {
        scrollBy(0, 6);
        if (__bench.frames.length < 150) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    await page.waitForTimeout(400);
    const box = (await page.locator("#inc").boundingBox())!;
    await page.evaluate(() => {
      __bench.pending = __bench.until("count", () => document.querySelector("#count")?.textContent === "1");
    });
    const done = page.evaluate(() => __bench.pending);
    const start = await page.evaluate(() => performance.now());
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await done;
    await page.waitForFunction(() => __bench.frames.length >= 150, null, { timeout: 30000 });
    return page.evaluate((start) => {
      const f = __bench.frames,
        gaps: number[] = [];
      for (let i = 1; i < f.length; i++) if (f[i]! >= start) gaps.push(f[i]! - f[i - 1]!);
      const end = f[f.length - 1]!;
      const blocked = __bench.tasks.filter(([s]) => s >= start && s <= end).reduce((sum, [, d]) => sum + d, 0);
      return {
        latency: __bench.marks.count! - __bench.marks.click!,
        paintLatency: (__bench.marks.countPaint ?? NaN) - __bench.marks.click!,
        maxFrameGap: Math.max(...gaps),
        droppedFrames: gaps.reduce((sum, gap) => sum + Math.max(0, Math.round(gap / 16.67) - 1), 0),
        blockedDuringScroll: blocked,
      };
    }, start);
  },
};

// Per-script coverage from a Profiler.takePreciseCoverage result (call counts since the previous
// take): { pathname: { top, fn } }. top = module top level ran; fn = any other function ran.
function coverageByPath(result: { url: string; functions: { functionName: string; ranges: { startOffset: number; count: number }[] }[] }[]): CoverageMap {
  const out: CoverageMap = {};
  for (const script of result) {
    if (!/^https?:/.test(script.url)) continue;
    const entry = (out[new URL(script.url).pathname] ??= { top: false, fn: false });
    for (const f of script.functions) {
      if (!f.ranges[0]!.count) continue;
      if (f.ranges[0]!.startOffset === 0 && !f.functionName) entry.top = true;
      else entry.fn = true;
    }
  }
  return out;
}

const unescapeAttr = (value: string) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

// Rivet: JS fetched before the first interaction, attributed to the preload strategy that requested it
// (plan URL → its strategy; plan runtime → runtime; static/dynamic import → its importer's strategy;
// anything else → intent), with use from coverage (see FIXTURE.md "Prefetch waste").
function prefetchWaste(html: string, js: Loaded[], sent: Map<string, Sent>, before: Loaded[], covBefore: CoverageMap | null, covAfter: CoverageMap | null) {
  const match = html.match(/<script[^>]*type="rivet\/state"[^>]*>/)?.[0].match(/data-preload="([^"]*)"/);
  const plan = (match ? JSON.parse(unescapeAttr(match[1]!)) : []) as [string?, ...[string, string][]];
  const byPath = new Map<string | null, string>((plan.slice(1) as [string, string][]).map(([url, strategy]) => [url, STRATEGIES[strategy] ?? strategy]));
  const runtime = plan[0] ?? html.match(/"rt":"([^"]+)"/)?.[1];
  const path = (url: string | undefined) => (/^https?:/.test(url ?? "") ? new URL(url!).pathname : null);
  const strategyOf = new Map<string | null, string | undefined>();
  for (const r of [...js].sort((a, b) => (sent.get(a.id)?.at ?? 0) - (sent.get(b.id)?.at ?? 0))) {
    const p = path(r.url);
    strategyOf.set(p, byPath.get(p) ?? (p === runtime ? "runtime" : (strategyOf.get(path(sent.get(r.id)?.from)) ?? "intent")));
  }
  const chunks = before.map((r): PrefetchChunk => {
    const p = path(r.url);
    const pre = p === null ? undefined : covBefore?.[p],
      post = p === null ? undefined : covAfter?.[p];
    return {
      url: p,
      strategy: strategyOf.get(p),
      bytes: r.bytes,
      used: !!(pre?.fn || post?.fn),
      usedByInteraction: covAfter ? !!post?.fn : null,
    };
  });
  const strategies = ["runtime", ...new Set([...byPath.values()]), "intent"];
  const out: { chunks: PrefetchChunk[] } & Record<string, unknown> = { chunks };
  const sum = (list: PrefetchChunk[]) => list.reduce((total, c) => total + c.bytes, 0);
  for (const strategy of strategies) {
    const own = chunks.filter((c) => c.strategy === strategy);
    out["prefetchBytes." + strategy] = sum(own);
    if (covBefore) out["wastedBytes." + strategy] = sum(own.filter((c) => !c.used));
    if (covAfter) out["wastedForInteractionBytes." + strategy] = sum(own.filter((c) => !c.usedByInteraction));
  }
  return out;
}

async function saveTrace(cdp: CDPSession, file: string) {
  const complete = new Promise<{ stream?: string }>((done) => cdp.once("Tracing.tracingComplete", done));
  await cdp.send("Tracing.end");
  const { stream } = await complete;
  const parts: Buffer[] = [];
  for (;;) {
    const { data, base64Encoded, eof } = await cdp.send("IO.read", { handle: stream!, size: 1 << 20 });
    parts.push(Buffer.from(data, base64Encoded ? "base64" : "utf8"));
    if (eof) break;
  }
  await cdp.send("IO.close", { handle: stream! });
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, Buffer.concat(parts));
}

async function measure(browser: Browser, url: string, condition: string, scenario: string, { lane, traceFile }: { lane: string; traceFile: string | null }) {
  const rivet = lane === "rivet";
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: scenario === "tapClick" });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  const net = CONDITIONS[condition];
  if (net) {
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: net.latency,
      downloadThroughput: net.download,
      uploadThroughput: net.upload,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: net.cpu });
  }
  // Coverage runs in every lane so its (small) overhead is symmetric; only Rivet reports from it.
  if (coverage) {
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.startPreciseCoverage", { callCount: true, detailed: false });
  }
  if (traceFile)
    await cdp.send("Tracing.start", {
      transferMode: "ReturnAsStream",
      streamCompression: "gzip",
      traceConfig: { includedCategories: TRACE_CATEGORIES, excludedCategories: ["*"] },
    });
  const requests = new Map<string, Omit<Loaded, "bytes" | "at">>();
  const sent = new Map<string, Sent>();
  let interacted = Infinity;
  cdp.on("Network.requestWillBeSent", ({ requestId, initiator, timestamp }) =>
    sent.set(requestId, { at: timestamp, from: initiator.url ?? initiator.stack?.callFrames?.[0]?.url }),
  );
  cdp.on("Network.responseReceived", ({ requestId, type, response }) =>
    requests.set(requestId, { id: requestId, type, url: response.url, mime: response.mimeType }),
  );
  const loaded: Loaded[] = [];
  cdp.on("Network.loadingFinished", ({ requestId, encodedDataLength, timestamp }) => {
    const r = requests.get(requestId);
    if (r) loaded.push({ ...r, bytes: encodedDataLength, at: timestamp });
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(probe, { sync: rivet });
  await page.goto(url + "/", { waitUntil: "load" });
  const html = await page.content();
  const take = async () => (coverage ? coverageByPath((await cdp.send("Profiler.takePreciseCoverage")).result) : null);
  // Coverage before the first input (the take resets counters), then after the scenario.
  let covBefore: CoverageMap | null = null,
    covAfter: CoverageMap | null = null;
  const beforeInput = async () => {
    covBefore ??= await take();
  };
  const result = (await SCENARIOS[scenario]!(page, { beforeInput })) ?? {};
  if (covBefore) covAfter = await take();
  else covBefore = await take();
  const marks = await page.evaluate((): Marks => ({
    ...__bench.marks,
    tasks: __bench.tasks,
    loafs: __bench.loafs,
    events: __bench.events,
    sync: __bench.sync,
    fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0,
    scripts: performance
      .getEntriesByType("resource")
      .filter((r) => /\.m?js(\?|$)/.test(r.name))
      .map((r) => r.startTime),
  }));
  interacted = marks.pointerdown ?? marks.keydown ?? Infinity;
  const isJS = (r: Loaded) => /javascript/.test(r.mime) || /\.m?js(\?|$)/.test(r.url);
  // CDP timestamps are monotonic seconds; map through the document request.
  const doc = loaded.find((r) => r.type === "Document");
  const docEnd = await page.evaluate(() => (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming).responseEnd);
  const toPage = (at: number) => (doc ? (at - doc.at) * 1000 + docEnd : 0);
  const js = loaded.filter(isJS);
  const before = js.filter((r) => toPage(r.at) < interacted);
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="(?:rivet\/state|qwik\/json|application\/json)")[^>]*>([\s\S]*?)<\/script>/g)].reduce(
    (sum, m) => sum + m[1].length,
    0,
  );
  const windowEnd = Number.isFinite(interacted) ? interacted : Infinity;
  const loadTasks = marks.tasks.filter(([s]) => s < windowEnd);
  const out: Record<string, unknown> & { scenario: string; errors: string[] } = {
    scenario,
    ...result,
    documentBytes: doc?.bytes ?? 0,
    jsBytesBeforeInteraction: before.reduce((sum, r) => sum + r.bytes, 0),
    jsRequestsBeforeInteraction: before.length,
    jsBytesTotal: js.reduce((sum, r) => sum + r.bytes, 0),
    inlineScriptChars: inline,
    tbtBeforeInteraction: loadTasks.reduce((sum, [, d]) => sum + Math.max(0, d - 50), 0),
    longestTask: Math.max(0, ...marks.tasks.map(([, d]) => d)),
    loafCount: marks.loafs.length,
    loafMax: Math.max(0, ...marks.loafs.map(([, d]) => d)),
    inp: Math.max(0, ...marks.events.map(([, , d]) => d)),
    errors,
  };
  if (rivet) {
    const first = FIRST_INPUT[scenario];
    const sync = first && marks.sync[first[0]];
    if (sync) {
      out.firstInputSync = first[1] === "rows" ? !!sync.rows : !!sync.marks?.includes(first[1]);
      out.firstInput = { type: first[0], mutated: !!sync.mutated, rowsMutated: !!sync.rows, marks: sync.marks, dispatchMs: sync.end! - sync.at };
      // Script requests started between the first pointerdown/keydown and the end of the first input's dispatch.
      out.jsRequestsDuringFirstInput = marks.scripts.filter((t) => t >= interacted && t <= (sync.end ?? Infinity)).length;
    }
    const { chunks, ...waste } = prefetchWaste(html, js, sent, before, covBefore, Number.isFinite(interacted) ? covAfter : null);
    Object.assign(out, waste);
    out.prefetch = chunks;
  }
  if (traceFile) {
    await saveTrace(cdp, traceFile);
    out.trace = relative(root, traceFile);
  }
  await context.close();
  return out;
}

// Contract checks (FIXTURE.md) for one lane.
async function verify(browser: Browser, url: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let documents = 0;
  page.on("request", (r) => r.resourceType() === "document" && documents++);
  const fail: string[] = [];
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (error) {
      fail.push(name + ": " + (error as Error).message.split("\n")[0]);
    }
  };
  const wait = (fn: () => unknown) => page.waitForFunction(fn, undefined, { timeout: 10000 });
  await page.goto(url + "/");
  await step("ssr rows", async () => {
    const html = await (await fetch(url + "/")).text();
    if ((html.match(/class="row/g) ?? []).length !== 1000) throw Error("SSR rows " + (html.match(/class="row/g) ?? []).length);
  });
  await step("counter", async () => {
    await page.click("#inc");
    await wait(() => document.querySelector("#count")!.textContent === "1");
  });
  await step("toggle", async () => {
    await page.click("#toggle");
    await wait(() => document.querySelector("#open b")?.textContent === "1");
    await page.click("#inc");
    await wait(() => document.querySelector("#open b")?.textContent === "2");
  });
  await step("filter", async () => {
    await page.fill("#filter", "golf");
    await wait(() => document.querySelectorAll("#rows li").length === 100);
  });
  await step("pick", async () => {
    await page.click("#rows li:nth-child(2) .pick");
    await wait(() => document.querySelector("#rows li:nth-child(2)")!.classList.contains("sel"));
  });
  await step("navigate", async () => {
    await page.click("#rows li:nth-child(1) a.open");
    await wait(() => !!document.querySelector("#detail"));
    if (!/\/item\/7$/.test(page.url())) throw Error("url " + page.url());
  });
  await step("back link", async () => {
    await page.click("#back");
    await wait(() => document.querySelectorAll("#rows li").length === 100 && document.querySelector<HTMLInputElement>("#filter")!.value === "golf");
  });
  await step("history back", async () => {
    await page.click("#rows li:nth-child(1) a.open");
    await wait(() => !!document.querySelector("#detail"));
    await page.goBack();
    await wait(() => document.querySelectorAll("#rows li").length === 100);
  });
  await step("scroll", async () => {
    await page.evaluate(() => scrollTo(0, 400));
    await wait(() => document.querySelector("#scrolled")!.textContent === "scrolled");
  });
  await step("canvas", async () => {
    await page.evaluate(() => document.querySelector("#chart")!.scrollIntoView());
    await wait(() => document.querySelector<HTMLElement>("#chart")!.dataset.drawn === "1");
  });
  await step("analytics", async () => {
    await wait(() => (window.__analytics ?? []).some(([kind, path]) => kind === "pageview" && path === "/"));
  });
  if (documents !== 1) fail.push("documents loaded: " + documents);
  if (errors.length) fail.push("page errors: " + errors.join("; "));
  await context.close();
  return fail;
}

// Table cell: median (min–max), or share of true with per-repeat y/n for booleans.
const cell = (stat: Stat | undefined) =>
  !stat
    ? "–"
    : "share" in stat
      ? `${Math.round(stat.share * 100)}% (${stat.values.map((v) => (v ? "y" : "n")).join("")})`
      : `${+stat.median.toFixed(1)} (${+stat.min.toFixed(1)}–${+stat.max.toFixed(1)})`;

async function main() {
  const builds: Record<string, BuildManifest> = {};
  for (const lane of LANES) {
    if (flag("build") || !existsSync(resolve(dist(lane), "index.html")) || !existsSync(resolve(dist(lane), "build-manifest.json"))) {
      console.log("build", lane);
      const { build } = (await import(pathToFileURL(resolve(root, "lanes", lane, "build.ts")).href)) as { build: (outDir: string) => Promise<void> };
      await build(dist(lane));
    }
    builds[lane] = await readBuildManifest(lane, dist(lane));
  }
  const servers: Record<string, Awaited<ReturnType<typeof serve>>> = Object.fromEntries(
    await Promise.all(LANES.map(async (lane) => [lane, await serve(dist(lane))])),
  );
  // RESUME_BENCH_CHROME=<executable> runs a pinned Chromium instead of the installed Chrome channel (cloud containers).
  const browser = await chromium.launch({
    ...chromeTarget(),
    headless: !flag("headed"),
    args: ["--use-mock-keychain", "--password-store=basic"],
  });
  console.log("chrome", browser.version());
  try {
    if (flag("verify")) {
      let ok = true;
      for (const lane of LANES) {
        const fail = await verify(browser, servers[lane]!.url);
        console.log(lane, fail.length ? "FAIL\n  " + fail.join("\n  ") : "ok");
        ok &&= !fail.length;
      }
      if (!ok) process.exitCode = 1;
      return;
    }
    const scenarios = option("scenarios", Object.keys(SCENARIOS).join(",")).split(",");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const runs: Run[] = [];
    for (const condition of conditions)
      for (const scenario of scenarios)
        for (let r = 0; r < repeats; r++) {
          // Randomized lane order per repeat.
          const order = [...LANES].sort(() => Math.random() - 0.5);
          for (const lane of order) {
            const traceFile = traces ? resolve(root, "results", "traces", stamp, condition, scenario, `${lane}-r${r}.json.gz`) : null;
            const result = await measure(browser, servers[lane]!.url, condition, scenario, { lane, traceFile });
            runs.push({ lane, condition, repeat: r, ...result });
            process.stdout.write(".");
          }
        }
    console.log();
    // Rivet-only: per-strategy prefetch/waste bytes (dynamic keys) and first-input synchronicity.
    const strategyMetrics = ["prefetchBytes.", "wastedBytes.", "wastedForInteractionBytes."].flatMap((prefix) => [
      ...new Set(runs.flatMap((run) => Object.keys(run).filter((key) => key.startsWith(prefix)))),
    ]);
    const metrics = [
      "paintLatency",
      "latency",
      "maxFrameGap",
      "droppedFrames",
      "blockedDuringScroll",
      "documentBytes",
      "jsBytesBeforeInteraction",
      "jsRequestsBeforeInteraction",
      "jsBytesTotal",
      "inlineScriptChars",
      "tbtBeforeInteraction",
      "longestTask",
      "loafCount",
      "loafMax",
      "inp",
      ...strategyMetrics,
      "jsRequestsDuringFirstInput",
      "firstInputSync",
    ];
    const summary: Record<string, Record<string, (number | boolean)[]>> = {};
    for (const run of runs) {
      const key = [run.condition, run.scenario, run.lane].join("/");
      summary[key] ??= {};
      for (const metric of metrics)
        if ((typeof run[metric] === "number" && Number.isFinite(run[metric])) || typeof run[metric] === "boolean")
          (summary[key][metric] ??= []).push(run[metric]);
    }
    const table: Record<string, Record<string, Stat>> = {};
    for (const [key, values] of Object.entries(summary))
      table[key] = Object.fromEntries(
        Object.entries(values).map(([metric, list]) => [
          metric,
          typeof list[0] === "boolean"
            ? { share: list.filter(Boolean).length / list.length, n: list.length, values: list as boolean[] }
            : { median: median(list as number[]), min: Math.min(...(list as number[])), max: Math.max(...(list as number[])) },
        ]),
      );
    const errors = runs.filter((run) => run.errors.length).map((run) => [run.lane, run.condition, run.scenario, run.errors]);
    await mkdir(resolve(root, "results"), { recursive: true });
    const versions = {
      chrome: browser.version(),
      ...Object.fromEntries(LANES.map((lane) => [lane, builds[lane]!.version])),
    };
    await writeFile(
      resolve(root, "results", stamp + ".json"),
      JSON.stringify(
        { versions, builds, lanes: LANES, repeats, conditions, traces: traces ? "traces/" + stamp : null, coverage, table, errors, runs },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ versions, errors }, null, 1));
    for (const condition of conditions)
      for (const scenario of scenarios) {
        console.log(`\n## ${condition} / ${scenario}`);
        const rows = LANES.map((lane): [string, Record<string, Stat>] => [lane, table[[condition, scenario, lane].join("/")] ?? {}]);
        const shown = metrics.filter((metric) => rows.some(([, t]) => t[metric]));
        console.log("| metric | " + LANES.map((lane) => `${builds[lane]!.label} ${builds[lane]!.version}`).join(" | ") + " |");
        console.log("|---|" + LANES.map(() => "---").join("|") + "|");
        for (const metric of shown) console.log(`| ${metric} | ` + rows.map(([, t]) => cell(t[metric])).join(" | ") + " |");
      }
    console.log("\nresults/" + stamp + ".json" + (traces ? "\nresults/traces/" + stamp + "/" : ""));
  } finally {
    await browser.close();
    await Promise.all(Object.values(servers).map((s) => s.close()));
  }
}

await main();
