// LAZY-FLIP harness: client cost of lazy rows / DOM-DATA on the `stories/` app built several ways (e.g. default,
// `lazyRows`, `domData`, both: `stories.ts --build [--dom-data] --dist <d>`, `RIVET_LAZY_BUILD=0` for no lazyRows).
// One server child per build (`@rivetjs/router/node` `start()`, compression on, `RIVET_LAZY_ROWS=on`: lazy builds write
// lazy rows, others ignore it). Headless Chromium (playwright), fresh context per load, cold (the resume runtime boots
// at the first input). Per page and build:
//   - `row`: first click on a row → its handler's DOM effect (`until`), `ctl`: first click on the layout's `#bench-ctl`
//     (no row), `move`: a keyed update moving 50 rows (`#ld-move`, `/list-data-1000` only);
//     paint ms = pointerdown timeStamp → the task after the rAF after the DOM change; dom ms = → the mutation.
//   - JS before input: script / modulepreload bytes (encoded, resource timing) + CDP `ScriptDuration` at the click.
//   - idle load (fast ×1, 3 s settle): heap used after GC, JS bytes + script ms, document raw / br, `rivet/state`
//     raw / br, keyed For modes (docs-kit `pageRows`).
// Conditions: `fast1` (no throttling), `fast4` (4× CPU), `slow4` (Slow 4G 150 ms / 1.6 Mbps / 750 kbps + 4× CPU).
// Trials interleave builds (rotated order per trial); before each trial the 1-min load average must be ≤ `--max-load`
// (waits up to `--max-wait` s, default 120, then runs; the load is recorded with every sample). Median over `--loads` trials.
//
//   node apps/ssr-bench/spikes/lazy-cost/client.ts --builds default=<dist>,lazy=<dist>,… [--pages /a,/b]
//        [--loads 7] [--conditions fast1,fast4,slow4] [--scenarios row,ctl,move,idle] [--max-load 8] [--max-wait 120] [--json <file>]
import { spawn, type ChildProcess } from "node:child_process";
import { writeFileSync } from "node:fs";
import { loadavg } from "node:os";
import { brotliCompressSync } from "node:zlib";

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1]! : def;
}

if (process.argv.includes("--serve")) {
  // A client that goes away mid-stream rejects the adapter's backpressure promise unhandled (router node adapter): log it, keep serving.
  process.on("unhandledRejection", (e) => console.error("server: unhandled rejection: " + (e as Error).message));
  const { start } = await import("../../../../libs/router/adapters/node.ts");
  const app = await start({ dist: arg("serve", ""), port: 0, host: "127.0.0.1", onError: () => {} });
  console.log("URL " + app.url);
  process.on("SIGTERM", () => void app.close().then(() => process.exit(0)));
  await new Promise(() => {});
}

interface Page {
  /** Row click: element selector + page predicate (expression) once the handler's effect is in the DOM. */
  row: { sel: string; until: string };
  move?: { sel: string; until: string };
}
const option = (list: string) => `document.querySelector(${JSON.stringify(list + " [role=option]")})`;
const selected = (el: string) => `${el}?.getAttribute("aria-selected") === "true"`;
// `onAction` ListBoxes: a click is the action (`#dd-picked` shows the item).
const picked = `document.getElementById("dd-picked")?.textContent?.startsWith('{"id":1,') === true`;
const PAGES: Record<string, Page> = {
  "/list-data-1000": {
    row: { sel: "#ld-animals [role=option]", until: selected(option("#ld-animals")) },
    move: { sel: "#ld-move", until: `${option("#ld-animals")}?.getAttribute("data-key") === "951"` },
  },
  "/list-data": { row: { sel: "#ld-animals [role=option]", until: selected(option("#ld-animals")) } },
  "/virtualized-collections": { row: { sel: "#vlist [role=option]", until: selected(option("#vlist")) } },
  "/grid-list": {
    // `#gl-data` (lazy rows on a lazy build; no selection): the row's press handler focuses it (`data-focused`).
    row: { sel: "#gl-data [role=row]", until: `document.querySelector("#gl-data [role=row]")?.getAttribute("data-focused") === "true"` },
  },
  "/table": {
    // A row click is the row action (`onRowAction`).
    row: { sel: "#tbl-pets tbody [role=row]", until: `document.getElementById("tbl-action")?.textContent === "p1"` },
  },
  "/dom-data": { row: { sel: "#dd-customers [role=option]", until: picked } },
  "/dom-data-200": { row: { sel: "#dd-customers [role=option]", until: picked } },
  "/dom-data-1000": { row: { sel: "#dd-customers [role=option]", until: picked } },
  "/resume-1000": {
    row: { sel: 'article[data-row="1"] footer button', until: `document.querySelector('article[data-row="1"]')?.getAttribute("data-state") === "selected"` },
  },
};
const CTL = { sel: "#bench-ctl", until: `document.getElementById("bench-out")?.textContent === "1"` };
const SLOW = { latency: 150, download: (1.6 * 1024 * 1024) / 8, upload: (750 * 1024) / 8 };

const builds = arg("builds", "")
  .split(",")
  .filter(Boolean)
  .map((s) => {
    const [name, dist] = s.split("=");
    return { name: name!, dist: dist! };
  });
const pages = arg("pages", Object.keys(PAGES).join(",")).split(",");
const loads = Number(arg("loads", "7"));
const conditions = arg("conditions", "fast1,fast4,slow4").split(",");
const scenarios = arg("scenarios", "row,ctl,move,idle").split(",");
const maxLoad = Number(arg("max-load", "8"));
const maxWait = Number(arg("max-wait", "120"));
const jsonOut = arg("json", "");

const children: ChildProcess[] = [];
const origins = new Map<string, string>();
for (const b of builds) {
  const child = spawn(process.execPath, [import.meta.filename, "--serve", b.dist], {
    env: { ...process.env, RIVET_LAZY_ROWS: "on" },
    stdio: ["ignore", "pipe", "inherit"],
  });
  children.push(child);
  origins.set(
    b.name,
    await new Promise<string>((ok, fail) => {
      let out = "";
      child.stdout!.on("data", (d) => {
        out += d;
        const m = /URL (\S+)/.exec(out);
        if (m) ok(m[1]!);
      });
      child.on("exit", (code) => fail(new Error(`server ${b.name} exited ${code}`)));
    }),
  );
}
const stop = () => children.forEach((c) => c.kill("SIGTERM"));
process.on("exit", stop);

const { chromium } = await import("playwright");
const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
type BrowserPage = import("playwright").Page;
type Cdp = import("playwright").CDPSession;

async function open(url: string, condition: string): Promise<{ page: BrowserPage; cdp: Cdp; close: () => Promise<void> }> {
  const context = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.error(`page error ${url}: ${e.message.slice(0, 200)}`));
  page.on("console", (m) => void (m.type() === "error" && console.error(`console error ${url}: ${m.text().slice(0, 200)}`)));
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  if (condition !== "fast1") await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  if (condition === "slow4") {
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: SLOW.latency,
      downloadThroughput: SLOW.download,
      uploadThroughput: SLOW.upload,
    });
  }
  await page.goto(url, { waitUntil: "load", timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 120_000 }).catch(() => {});
  await page.waitForTimeout(condition === "slow4" ? 1000 : 500);
  return { page, cdp, close: () => context.close() };
}

async function jsBefore(page: BrowserPage, cdp: Cdp): Promise<{ jsBytes: number; jsFiles: number; scriptMs: number }> {
  const js = await page.evaluate(() =>
    (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
      .filter((e) => /\.m?js(\?|$)/.test(new URL(e.name).pathname))
      .reduce((a, e) => ({ bytes: a.bytes + (e.encodedBodySize || e.transferSize), files: a.files + 1 }), { bytes: 0, files: 0 }),
  );
  const { metrics } = await cdp.send("Performance.getMetrics");
  const script = metrics.find((m) => m.name === "ScriptDuration")?.value ?? 0;
  return { jsBytes: js.bytes, jsFiles: js.files, scriptMs: Math.round(script * 10000) / 10 };
}

/** One cold load + one click; paint / dom ms from pointerdown, or null (no effect within the timeout). */
async function clickOnce(url: string, condition: string, target: { sel: string; until: string }) {
  const { page, cdp, close } = await open(url, condition);
  try {
    const box = await page.locator(target.sel).first().boundingBox();
    if (!box) return { paint: null, dom: null, error: "no target" };
    const before = await jsBefore(page, cdp);
    if (await page.evaluate(target.until)) return { paint: null, dom: null, error: "until already true", ...before };
    await page.evaluate((until) => {
      const w = window as unknown as { __lf: { t0: number; dom: number; paint: number } };
      w.__lf = { t0: 0, dom: 0, paint: 0 };
      const check = new Function("return (" + until + ")") as () => boolean;
      addEventListener("pointerdown", (e) => void (w.__lf.t0 ||= e.timeStamp), { capture: true });
      const mo = new MutationObserver(() => {
        if (!w.__lf.t0 || w.__lf.dom || !check()) return;
        w.__lf.dom = performance.now();
        mo.disconnect();
        requestAnimationFrame(() => setTimeout(() => (w.__lf.paint = performance.now()), 0));
      });
      mo.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    }, target.until);
    const x = box.x + box.width / 2;
    const y = box.y + Math.min(box.height / 2, 12);
    await page.mouse.click(x, y);
    const ok = await page
      .waitForFunction(() => (window as unknown as { __lf: { paint: number } }).__lf.paint > 0, undefined, { timeout: 15_000 })
      .then(
        () => true,
        () => false,
      );
    const lf = await page.evaluate(() => (window as unknown as { __lf: { t0: number; dom: number; paint: number } }).__lf);
    const r = (n: number) => Math.round(n * 10) / 10;
    return ok ? { paint: r(lf.paint - lf.t0), dom: r(lf.dom - lf.t0), ...before } : { paint: null, dom: null, error: "timeout", ...before };
  } finally {
    await close();
  }
}

async function idleOnce(url: string) {
  const { page, cdp, close } = await open(url, "fast1");
  try {
    await page.waitForTimeout(2500);
    const before = await jsBefore(page, cdp);
    await cdp.send("HeapProfiler.collectGarbage");
    const heap = (await cdp.send("Runtime.getHeapUsage")) as { usedSize: number };
    return { heapMB: Math.round(heap.usedSize / 10485.76) / 100, ...before };
  } finally {
    await close();
  }
}

async function docFacts(origin: string, path: string) {
  const html = await (await fetch(origin + path, { headers: { "accept-encoding": "identity" } })).text();
  // Serialized: the `rivet/state` table; derived model: the `rivet/boundaries` tail (+ streamed `data-patch` tails), summed.
  const state = [...html.matchAll(/<script type="rivet\/(?:state|boundaries)"[^>]*>(.*?)<\/script>/gs)].map((m) => m[1]).join("");
  const { pageRows } = await import("../../../../libs/docs-kit/tools/rows.ts");
  let fors = "-";
  try {
    const rows = pageRows(html);
    if (rows) {
      const lazy = rows.fors.filter((f) => f.mode === "lazy");
      const rec = rows.fors.filter((f) => f.mode === "recorded");
      fors = `${lazy.length} lazy (${lazy.reduce((s, f) => s + f.rows, 0)} rows) / ${rec.length} rec (${rec.reduce((s, f) => s + f.rows, 0)} rows)`;
    }
  } catch (e) {
    fors = "? " + (e as Error).message.slice(0, 40);
  }
  return {
    docRaw: Buffer.byteLength(html),
    docBr: brotliCompressSync(Buffer.from(html)).length,
    stateRaw: Buffer.byteLength(state),
    stateBr: state ? brotliCompressSync(Buffer.from(state)).length : 0,
    domEntries: (/"D":/.test(state) ? 1 : 0) as number,
    fors,
  };
}

const med = (xs: (number | null | undefined)[]) => {
  const v = xs.filter((x): x is number => typeof x === "number").sort((a, b) => a - b);
  return v.length ? v[Math.floor((v.length - 1) / 2)]! : null;
};

type Sample = Record<string, number | string | null | undefined> & { load: number };
const results: Record<string, Record<string, Record<string, Sample[]>>> = {}; // page → build → cell → samples
const facts: Record<string, Record<string, Awaited<ReturnType<typeof docFacts>>>> = {};
const push = (page: string, build: string, cell: string, s: Sample) => (((results[page] ??= {})[build] ??= {})[cell] ??= []).push(s);

async function waitQuiet(): Promise<number> {
  const until = Date.now() + maxWait * 1000;
  while (loadavg()[0]! > maxLoad && Date.now() < until) await new Promise((r) => setTimeout(r, 5000));
  return Math.round(loadavg()[0]! * 10) / 10;
}

for (const path of pages) for (const b of builds) (facts[path] ??= {})[b.name] = await docFacts(origins.get(b.name)!, path);

for (let trial = 0; trial < loads; trial++) {
  const order = builds.map((_, i) => builds[(i + trial) % builds.length]!);
  for (const path of pages) {
    const def = PAGES[path]!;
    const load = await waitQuiet();
    console.error(`trial ${trial + 1}/${loads} ${path} load ${load}`);
    for (const sc of scenarios) {
      if (sc === "idle") {
        for (const b of order) push(path, b.name, "idle", { load, ...(await idleOnce(origins.get(b.name)! + path)) });
        continue;
      }
      const target = sc === "row" ? def.row : sc === "ctl" ? CTL : def.move;
      if (!target) continue;
      for (const condition of conditions) {
        if (sc !== "row" && condition === "slow4") continue; // slow 4G: the row click only (time box)
        for (const b of order) {
          // A sample that starts above `--max-load` waits for the load to drop and reruns (up to 3 times; the last one is kept).
          for (let attempt = 0; ; attempt++) {
            const load = await waitQuiet();
            const s = await clickOnce(origins.get(b.name)! + path, condition, target);
            const after = Math.round(loadavg()[0]! * 10) / 10;
            if ((load <= maxLoad && after <= maxLoad) || attempt >= 2) {
              push(path, b.name, `${sc}:${condition}`, { load: Math.max(load, after), ...s });
              break;
            }
          }
        }
      }
    }
  }
}

const out: string[] = [];
const loadRange = (ss: Sample[]) => {
  const l = ss.map((s) => s.load);
  return `${Math.min(...l)}–${Math.max(...l)}`;
};
for (const path of pages) {
  out.push(`\n### \`${path}\`\n`);
  out.push(`| metric | ${builds.map((b) => b.name).join(" | ")} |`);
  out.push(`| --- | ${builds.map(() => "---:").join(" | ")} |`);
  const row = (label: string, f: (b: string) => string) => out.push(`| ${label} | ${builds.map((b) => f(b.name)).join(" | ")} |`);
  const cells = new Set(builds.flatMap((b) => Object.keys(results[path]?.[b.name] ?? {})));
  for (const cell of [...cells].filter((c) => c !== "idle").sort()) {
    row(`${cell} paint / dom ms (load)`, (b) => {
      const ss = results[path]?.[b]?.[cell] ?? [];
      const fails = ss.filter((s) => s.paint === null).length;
      return `${med(ss.map((s) => s.paint as number))} / ${med(ss.map((s) => s.dom as number))}${fails ? ` (${fails} fail)` : ""} (${loadRange(ss)})`;
    });
    if (cell.startsWith("row:"))
      row(`${cell} JS before input KB / files / script ms`, (b) => {
        const ss = results[path]?.[b]?.[cell] ?? [];
        return `${((med(ss.map((s) => s.jsBytes as number)) ?? 0) / 1024).toFixed(1)} / ${med(ss.map((s) => s.jsFiles as number))} / ${med(ss.map((s) => s.scriptMs as number))}`;
      });
  }
  if (cells.has("idle")) {
    row("idle: heap MB (load)", (b) => {
      const ss = results[path]?.[b]?.idle ?? [];
      return `${med(ss.map((s) => s.heapMB as number))} (${loadRange(ss)})`;
    });
    row("idle: JS KB / files / script ms", (b) => {
      const ss = results[path]?.[b]?.idle ?? [];
      return `${((med(ss.map((s) => s.jsBytes as number)) ?? 0) / 1024).toFixed(1)} / ${med(ss.map((s) => s.jsFiles as number))} / ${med(ss.map((s) => s.scriptMs as number))}`;
    });
  }
  row("state raw / br B", (b) => `${facts[path]![b]!.stateRaw} / ${facts[path]![b]!.stateBr}`);
  row("document raw / br B", (b) => `${facts[path]![b]!.docRaw} / ${facts[path]![b]!.docBr}`);
  row("keyed Fors", (b) => facts[path]![b]!.fors);
}
console.log(out.join("\n"));
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ date: new Date().toISOString(), builds, pages, loads, conditions, results, facts }, null, 1));
await browser.close();
stop();
process.exit(0);
