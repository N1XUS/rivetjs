// Before-input main-thread attribution for the real-page suite (lane REALCPU 2026-11-10): per built page dist, the runner's
// sample() conditions (fresh context, cache disabled, `slow` = Slow 4G + 4x CPU unless --fast, 1280x800, same init probe), a
// Chrome trace from before navigation to load + 1,000 ms, then main-thread self time of the page's renderer by category
// (parse / style / layout / paint / compile / script / gc / other) and script self time by script URL. Also prints the
// runner's metric (CDP `Performance.getMetrics` TaskDuration) for the same load.
// --interact: also the main interaction (real-pages/contract.ts `mainInteraction`, trusted click) from its pointerdown to the
// runner's paint proxy (rAF → MessageChannel after the result text), attributed the same way.
// node apps/resume-bench/spikes/real-trace.ts --dist <dir>[,<dir>…] [--reps 5] [--port 4520] [--fast] [--top 12] [--save <dir>]
//   [--block <url substring>] (abort matching requests; upper-bound experiments) [--no-probe]
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { serve } from "../serve.ts";
import { mainInteraction, type RealPage } from "../real-pages/contract.ts";
import { chromeTarget } from "../../../scripts/bench/shared.ts";

const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => {
  const i = args.indexOf("--" + name);
  return i < 0 ? fallback : args[i + 1]!;
};
const dists = opt("dist", "").split(",").filter(Boolean);
const reps = Number(opt("reps", "5"));
const port = Number(opt("port", "4520"));
const top = Number(opt("top", "12"));
const save = opt("save", "");
const block = opt("block", "");
const slow = !args.includes("--fast");
const interact = args.includes("--interact");
if (!dists.length) throw Error("--dist <dir>[,<dir>…] required");

interface Ev {
  name: string;
  cat: string;
  ph: string;
  ts: number;
  dur?: number;
  pid: number;
  tid: number;
  args?: { data?: { url?: string; stackTrace?: { url?: string }[] }; name?: string; [k: string]: unknown };
}
const category = (name: string) => {
  if (/^(ParseHTML|Document::FinishedParsing|HTMLDocumentParser::)/.test(name)) return "parse";
  if (
    /^(DocumentLoader::CommitNavigation|Frame::Detach|Document::Document|LocalWindowProxy::|V8\.DeserializeContext|InstallConditionalFeatures|ContextCreatedNotification|Document::shutdown|DocumentLoader::StartLoadingResponse)/.test(
      name,
    )
  )
    return "navigation";
  if (/^(UpdateLayoutTree|RecalculateStyles|ParseAuthorStyleSheet|ScheduleStyleRecalculation)$/.test(name)) return "style";
  if (/^(Layout|UpdateLayerTree|IntersectionObserverController::computeIntersections)$/.test(name)) return "layout";
  if (
    /^(Paint|PrePaint|Layerize|Commit|CompositeLayers|PaintImage|Decode Image|ImageDecodeTask|UpdateLayer|BeginMainFrame|ProxyMain::BeginMainFrame|LocalFrameView::RunPostLifecycleSteps)/.test(
      name,
    )
  )
    return "paint";
  if (/compile|Compile|parseOnBackground|ScriptCompiler|v8\.parse|V8\.Parse/i.test(name)) return "compile";
  if (/GC|gc/.test(name)) return "gc";
  if (
    /^(EvaluateScript|v8\.evaluateModule|FunctionCall|TimerFire|EventDispatch|FireIdleCallback|RunMicrotasks|v8\.run|V8\.Execute|v8\.callFunction|FireAnimationFrame|XHRReadyStateChange|ResolvePromise|ParseScriptOnBackground|V8\.Run|V8\.DeoptimizeAllOptimizedCodeWithFunction|v8\.newInstance|ModuleTree|V8\.BytecodeBudgetInterrupt)/.test(
      name,
    )
  )
    return "script";
  if (/^(RunTask|ThreadControllerImpl::RunTask|Receive mojo message|SimpleWatcher::OnHandleReady|Closed mojo endpoint|AsyncTask Run)$/.test(name))
    return "task";
  return "other";
};
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) >> 1]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : 0;
};

function attribute(events: Ev[], pageUrl: string, lo: number, hi: number) {
  const threads = new Map<string, string>();
  for (const e of events) if (e.ph === "M" && e.name === "thread_name") threads.set(`${e.pid}:${e.tid}`, String((e.args as { name?: string })?.name));
  // The page's renderer: the CrRendererMain thread that parsed the page's HTML.
  const parse = events.find(
    (e) => e.name === "ParseHTML" && threads.get(`${e.pid}:${e.tid}`) === "CrRendererMain" && String((e.args as any)?.beginData?.url ?? "").startsWith(pageUrl),
  );
  if (!parse) throw Error("no ParseHTML for " + pageUrl);
  const main = events
    .filter((e) => e.pid === parse.pid && e.tid === parse.tid && e.ts >= lo && e.ts < hi && (e.ph === "X" || e.ph === "B" || e.ph === "E"))
    .sort((a, b) => a.ts - b.ts || (b.dur ?? 0) - (a.dur ?? 0));
  // Convert B/E pairs to complete events.
  const complete: Ev[] = [];
  const open: Ev[] = [];
  for (const e of main) {
    if (e.ph === "X") complete.push(e);
    else if (e.ph === "B") open.push(e);
    else {
      for (let i = open.length - 1; i >= 0; i--)
        if (open[i]!.name === e.name) {
          const b = open.splice(i, 1)[0]!;
          complete.push({ ...b, ph: "X", dur: e.ts - b.ts });
          break;
        }
    }
  }
  complete.sort((a, b) => a.ts - b.ts || (b.dur ?? 0) - (a.dur ?? 0));
  const byCat: Record<string, number> = {};
  const byName: Record<string, number> = {};
  const byUrl: Record<string, number> = {};
  let toplevel = 0;
  const stack: { e: Ev; end: number; child: number; url: string; cat: string }[] = [];
  const close = (until: number) => {
    while (stack.length && stack[stack.length - 1]!.end <= until) {
      const s = stack.pop()!;
      const self = Math.max(0, (s.e.dur ?? 0) - s.child) / 1000;
      // Script-ish self time inherits the category of the nearest classified ancestor when it is generic.
      let cat = s.cat;
      if ((cat === "other" || cat === "task") && stack.length)
        for (let i = stack.length - 1; i >= 0; i--) if (stack[i]!.cat !== "other" && stack[i]!.cat !== "task") ((cat = stack[i]!.cat), (i = -1));
      byCat[cat] = (byCat[cat] ?? 0) + self;
      byName[s.e.name] = (byName[s.e.name] ?? 0) + self;
      if (cat === "script" || cat === "compile" || cat === "gc") {
        const key = cat + " " + (s.url || "?");
        byUrl[key] = (byUrl[key] ?? 0) + self;
      }
      if (stack.length) stack[stack.length - 1]!.child += s.e.dur ?? 0;
    }
  };
  for (const e of complete) {
    close(e.ts);
    const d = e.args?.data;
    const own = d?.url || (d?.stackTrace?.[0]?.url ?? "");
    const url = own || (stack.length ? stack[stack.length - 1]!.url : "");
    if (!stack.length) toplevel += (e.dur ?? 0) / 1000;
    stack.push({ e, end: e.ts + (e.dur ?? 0), child: 0, url, cat: category(e.name) });
  }
  close(Infinity);
  return { byCat, byName, byUrl, toplevel };
}

const browser = await chromium.launch({ ...chromeTarget(), headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
const out: Record<
  string,
  { cat: Record<string, number[]>; name: Record<string, number[]>; url: Record<string, number[]>; taskDuration: number[]; toplevel: number[]; load: number[] }
> = {};
try {
  for (let r = 0; r < reps; r++)
    for (const dist of r % 2 ? [...dists].reverse() : dists) {
      const label =
        basename(dirname(resolve(dist))) +
        "/" +
        basename(resolve(dist)) +
        (dists.filter((d) => basename(d) === basename(dist)).length > 1 ? "@" + dists.indexOf(dist) : "");
      const server = await serve(resolve(dist), port);
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      if (block)
        await page.route(
          (u) => u.href.includes(block),
          (route) => route.abort(),
        );
      const cdp = await context.newCDPSession(page);
      try {
        await cdp.send("Network.enable");
        await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
        await cdp.send("Performance.enable");
        if (slow) {
          await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
          await cdp.send("Network.emulateNetworkConditions", {
            offline: false,
            latency: 150,
            downloadThroughput: (1.6 * 1024 * 1024) / 8,
            uploadThroughput: (750 * 1024) / 8,
          });
        }
        if (!args.includes("--no-probe"))
          await page.addInitScript(() => {
            const m = ((window as any).__real = { fcp: 0, lcp: 0, tasks: [] as [number, number][] });
            addEventListener("pointerdown", (e) => e.isTrusted && performance.mark("rc-down"), true);
            new PerformanceObserver((l) => {
              for (const e of l.getEntries()) m.tasks.push([e.startTime, e.duration]);
            }).observe({ type: "longtask", buffered: true });
            new PerformanceObserver((l) => {
              for (const e of l.getEntries()) if (e.name === "first-contentful-paint") m.fcp = e.startTime;
            }).observe({ type: "paint", buffered: true });
            new PerformanceObserver((l) => {
              for (const e of l.getEntries()) m.lcp = e.startTime;
            }).observe({ type: "largest-contentful-paint", buffered: true });
          });
        const events: Ev[] = [];
        cdp.on("Tracing.dataCollected", (e: { value: Ev[] }) => events.push(...e.value));
        const done = new Promise<void>((res) => cdp.once("Tracing.tracingComplete", () => res()));
        await cdp.send("Tracing.start", {
          transferMode: "ReportEvents",
          traceConfig: {
            includedCategories: [
              "devtools.timeline",
              "disabled-by-default-devtools.timeline",
              "v8",
              "v8.execute",
              "blink",
              "loading",
              "toplevel",
              "disabled-by-default-v8.compile",
              "blink.user_timing",
              "cc",
              "gpu",
            ],
          },
        });
        await page.goto(server.url, { waitUntil: "load" });
        await page.waitForTimeout(1000);
        await page.evaluate(() => performance.mark("rc-cut"));
        const metrics = await cdp.send("Performance.getMetrics");
        const load = await page.evaluate(() =>
          performance.getEntriesByType("navigation")[0] ? (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming).loadEventEnd : 0,
        );
        const kind = basename(resolve(dist)) as RealPage;
        if (interact) {
          const main = mainInteraction[kind];
          // As the runner: the paint awaited through a promise armed before the click (no `waitForFunction`, whose
          // injected-script compile would land in the window).
          await page.evaluate(({ result, text }) => {
            (window as any).__painted = new Promise<void>((painted) => {
              const observer = new MutationObserver(() => {
                if (document.querySelector(result)?.textContent !== text) return;
                observer.disconnect();
                requestAnimationFrame(() => {
                  const channel = new MessageChannel();
                  channel.port1.onmessage = () => (performance.mark("rc-paint"), painted());
                  channel.port2.postMessage(0);
                });
              });
              observer.observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
            });
          }, main);
          const painted = page.evaluate(() => (window as any).__painted);
          await page.locator(main.target).first().click();
          await painted;
          await page.waitForTimeout(100);
        }
        await cdp.send("Tracing.end");
        await done;
        if (save) {
          await mkdir(save, { recursive: true });
          await writeFile(resolve(save, label.replace(/[/@]/g, "-") + "-r" + r + ".json"), JSON.stringify({ traceEvents: events }));
        }
        const mark = (name: string) => events.find((e) => e.name === name && e.cat.includes("user_timing"))?.ts ?? NaN;
        const a = attribute(events, server.url, 0, mark("rc-cut"));
        if (interact) {
          const i = attribute(events, server.url, mark("rc-down"), mark("rc-paint"));
          const o = (out[label + " interaction"] ??= { cat: {}, name: {}, url: {}, taskDuration: [], toplevel: [], load: [] });
          o.taskDuration.push((mark("rc-paint") - mark("rc-down")) / 1000);
          o.toplevel.push(i.toplevel);
          o.load.push(0);
          for (const [k, v] of Object.entries(i.byCat)) (o.cat[k] ??= []).push(v);
          for (const [k, v] of Object.entries(i.byName)) (o.name[k] ??= []).push(v);
          for (const [k, v] of Object.entries(i.byUrl)) (o.url[k.replace(server.url, "/")] ??= []).push(v);
        }
        const o = (out[label] ??= { cat: {}, name: {}, url: {}, taskDuration: [], toplevel: [], load: [] });
        o.taskDuration.push(1000 * (metrics.metrics.find((m) => m.name === "TaskDuration")?.value ?? 0));
        o.toplevel.push(a.toplevel);
        o.load.push(load);
        for (const [k, v] of Object.entries(a.byCat)) (o.cat[k] ??= []).push(v);
        for (const [k, v] of Object.entries(a.byName)) (o.name[k] ??= []).push(v);
        for (const [k, v] of Object.entries(a.byUrl)) (o.url[k.replace(server.url, "/")] ??= []).push(v);
        process.stdout.write(".");
      } finally {
        await context.close();
        await server.close();
      }
    }
} finally {
  await browser.close();
}
console.log();
const pad = (n: number[]) => median(n.concat(Array(Math.max(0, reps - n.length)).fill(0))).toFixed(1);
for (const [label, o] of Object.entries(out)) {
  console.log(`\n## ${label} (n ${o.taskDuration.length}, ${slow ? "slow" : "fast"})`);
  console.log(
    `${label.endsWith("interaction") ? "pointerdown → paint mark" : "TaskDuration"} ${pad(o.taskDuration)} ms (min ${Math.min(...o.taskDuration).toFixed(1)} max ${Math.max(...o.taskDuration).toFixed(1)}); trace top-level ${pad(o.toplevel)}; load ${pad(o.load)}`,
  );
  console.log(
    "category: " +
      Object.entries(o.cat)
        .sort((a, b) => median(b[1]) - median(a[1]))
        .map(([k, v]) => `${k} ${pad(v)}`)
        .join(" · "),
  );
  console.log(
    "top events: " +
      Object.entries(o.name)
        .sort((a, b) => median(b[1]) - median(a[1]))
        .slice(0, top)
        .map(([k, v]) => `${k} ${pad(v)}`)
        .join(" · "),
  );
  console.log(
    "by script: " +
      Object.entries(o.url)
        .sort((a, b) => median(b[1]) - median(a[1]))
        .slice(0, top)
        .map(([k, v]) => `${k} ${pad(v)}`)
        .join(" · "),
  );
}
