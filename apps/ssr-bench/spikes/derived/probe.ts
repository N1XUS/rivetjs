// M2 gate probe (derived-client plan M2, lane M2-GATE): browser-side numbers for the `/resume` page of running
// ssr-bench lanes (`rivet-resume` vs `rivet-derived`, any `name=origin`): HTML bytes (identity, brotli q5 / q11),
// JS fetched + evaluated before input, and the first (cold) click's input-to-paint in Chromium.
//   node apps/ssr-bench/spikes/derived/probe.ts --lane rivet-resume=http://127.0.0.1:18315 \
//     --lane rivet-derived=http://127.0.0.1:18332 [--rows 100,1000,5000] [--samples 10] [--cpu 1,4] [--json out.json]
// Each sample: fresh browser context, `goto` → `load` + 1.5 s idle → snapshot (scripts fetched: resource entries;
// evaluated: CDP `Debugger.scriptParsed`, inline scripts included) → one trusted mouse click on a target → DOM change
// (MutationObserver) → rAF → next task = paint. `latency` = click `timeStamp` → mutation, `paint` = → the task after
// the rAF following it (resume-bench `paintLatency` definition). Scenarios: `row` (row 0's button → `data-state`),
// `layout` (the nested layout's Visits button → its text). Not in build.ts / zero-cost / typecheck.
import { request } from "node:http";
import { brotliCompressSync, constants } from "node:zlib";
import { writeFileSync } from "node:fs";
import { chromium, type Page } from "playwright";

const argv = process.argv.slice(2);
const all = (name: string) => argv.flatMap((a, i) => (a === `--${name}` ? [argv[i + 1]!] : []));
const one = (name: string, fallback: string) => all(name)[0] ?? fallback;
const lanes = all("lane").map((spec) => {
  const at = spec.indexOf("=");
  return { name: spec.slice(0, at), origin: spec.slice(at + 1) };
});
const rowsList = one("rows", "100,1000,5000").split(",").map(Number);
const samples = Number(one("samples", "10"));
const cpus = one("cpu", "1,4").split(",").map(Number);
const out = all("json")[0];
if (!lanes.length) throw new Error("--lane name=origin required");

/** Identity body (no Accept-Encoding) of one page. */
const fetchRaw = (url: string) =>
  new Promise<Buffer>((resolve, reject) =>
    request(url, (res) => {
      const parts: Buffer[] = [];
      res
        .on("data", (c: Buffer) => parts.push(c))
        .on("end", () => resolve(Buffer.concat(parts)))
        .on("error", reject);
    })
      .on("error", reject)
      .end(),
  );
const br = (b: Buffer, q: number) =>
  brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: q, [constants.BROTLI_PARAM_SIZE_HINT]: b.length } }).length;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : NaN;
};

const SCENARIOS = {
  row: { target: 'article[data-row="0"] footer button', watch: 'article[data-row="0"]', attr: "data-state" },
  layout: { target: '[data-layout="resume"] nav button', watch: '[data-layout="resume"] nav button', attr: null },
} as const;

interface Sample {
  scriptsBefore: number;
  fetchedBefore: number;
  decodedBefore: number;
  evaluatedBefore: number;
  scriptsAfter: number;
  fetchedAfter: number;
  latency: number;
  paint: number;
  /** No DOM change within 10 s (e.g. a `rivet:resume-error` + reload-once). */
  failed: boolean;
  resumeErrors: string[];
}

async function scriptStats(page: Page) {
  return page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((e) => /\.m?js(\?|$)/.test(new URL(e.name).pathname))
      .map((e) => ({ transfer: (e as PerformanceResourceTiming).transferSize, decoded: (e as PerformanceResourceTiming).decodedBodySize })),
  );
}

async function sample(origin: string, rows: number, cpu: number, scenario: keyof typeof SCENARIOS, token: string): Promise<Sample> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    if (cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
    let evaluated = 0;
    let parsing = true;
    // Page scripts only (inline ones carry the document URL): Playwright's injected / evaluated scripts have none.
    cdp.on("Debugger.scriptParsed", (e: { length?: number; url: string }) => {
      if (parsing && e.url.startsWith(origin)) evaluated += e.length ?? 0;
    });
    // Scripts requested after the click (a reload-once after a resume error resets resource timing, so count here).
    let clicked = false;
    const after: Promise<number>[] = [];
    page.on("requestfinished", (r) => {
      if (clicked && r.resourceType() === "script") after.push(r.sizes().then((z) => z.responseBodySize + z.responseHeadersSize));
    });
    await cdp.send("Debugger.enable");
    const s = SCENARIOS[scenario];
    await page.addInitScript(
      ({ target, watch, attr }) => {
        const w = window as unknown as { __m2: { t0?: number; t1?: number; t2?: number } };
        w.__m2 = {};
        addEventListener("click", (e) => void (e.isTrusted && w.__m2.t0 === undefined && (w.__m2.t0 = e.timeStamp)), true);
        addEventListener("DOMContentLoaded", () => {
          const read = () => {
            // Re-queried: a resumed page may replace the server node on its first change.
            const el = document.querySelector(watch);
            return el && (attr ? el.getAttribute(attr) : el.textContent);
          };
          const before = read();
          if (before === null) return;
          new MutationObserver((_, obs) => {
            const now = read();
            if (now === before || w.__m2.t1 !== undefined) return;
            w.__m2.t1 = performance.now();
            obs.disconnect();
            requestAnimationFrame(() => setTimeout(() => (w.__m2.t2 = performance.now())));
          }).observe(document.documentElement, { subtree: true, attributes: true, childList: true, characterData: true });
          void target;
        });
      },
      { target: s.target, watch: s.watch, attr: s.attr },
    );
    await page.goto(`${origin}/resume?rows=${rows}&token=${token}`, { waitUntil: "load" });
    const box = await page.locator(s.target).boundingBox();
    if (!box) throw new Error(`no ${s.target}`);
    if (box.y + box.height > 900 || box.y < 0) throw new Error(`${s.target} outside the viewport (${box.y})`);
    await page.waitForTimeout(1500);
    const before = await scriptStats(page);
    parsing = false;
    const evaluatedBefore = evaluated;
    clicked = true;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    let failed = false;
    const resumeErrors: string[] = [];
    // A reload (resume error → reload-once) replaces the document: errors are collected before it via the console.
    page.on("console", (msg) => void (msg.text().startsWith("m2e:") && resumeErrors.push(msg.text().slice(4))));
    await page.evaluate(() => document.addEventListener("rivet:resume-error", (e) => console.log("m2e:" + String((e as CustomEvent).detail))));
    await page
      .waitForFunction(() => (window as unknown as { __m2?: { t2?: number } }).__m2?.t2 !== undefined, null, { timeout: 10_000 })
      .catch(() => void (failed = true));
    const m = failed ? { t0: NaN, t1: NaN, t2: NaN } : await page.evaluate(() => (window as unknown as { __m2: { t0: number; t1: number; t2: number } }).__m2);
    await page.waitForTimeout(300);
    const afterBytes = await Promise.all(after);
    return {
      scriptsBefore: before.length,
      fetchedBefore: before.reduce((a, e) => a + e.transfer, 0),
      decodedBefore: before.reduce((a, e) => a + e.decoded, 0),
      evaluatedBefore,
      scriptsAfter: afterBytes.length,
      fetchedAfter: afterBytes.reduce((a, b) => a + b, 0),
      latency: m.t1 - m.t0,
      paint: m.t2 - m.t0,
      failed,
      resumeErrors,
    };
  } finally {
    await browser.close();
  }
}

const results: Record<string, unknown>[] = [];
for (const rows of rowsList) {
  for (const lane of lanes) {
    const html = await fetchRaw(`${lane.origin}/resume?rows=${rows}&token=probe`);
    const bytes = { raw: html.length, br5: br(html, 5), br11: br(html, 11) };
    for (const cpu of cpus)
      for (const scenario of Object.keys(SCENARIOS) as (keyof typeof SCENARIOS)[]) {
        const runs: Sample[] = [];
        // Lanes interleave per sample would need both servers warm; samples are sequential per lane (both lanes idle).
        for (let i = 0; i < samples; i++) runs.push(await sample(lane.origin, rows, cpu, scenario, `probe-${i}`));
        const ok = runs.filter((r) => !r.failed);
        const pick = (
          k: "scriptsBefore" | "fetchedBefore" | "decodedBefore" | "evaluatedBefore" | "scriptsAfter" | "fetchedAfter" | "latency" | "paint",
          from = runs,
        ) => median(from.map((r) => r[k]));
        const row = {
          lane: lane.name,
          rows,
          cpu,
          scenario,
          ...bytes,
          scriptsBefore: pick("scriptsBefore"),
          fetchedBefore: pick("fetchedBefore"),
          decodedBefore: pick("decodedBefore"),
          evaluatedBefore: pick("evaluatedBefore"),
          scriptsAfter: pick("scriptsAfter"),
          fetchedAfter: pick("fetchedAfter"),
          latency: pick("latency", ok),
          paint: pick("paint", ok),
          paintMin: ok.length ? Math.min(...ok.map((r) => r.paint)) : NaN,
          paintMax: ok.length ? Math.max(...ok.map((r) => r.paint)) : NaN,
          n: runs.length,
          failed: runs.length - ok.length,
          resumeErrors: [...new Set(runs.flatMap((r) => r.resumeErrors))],
        };
        results.push(row);
        console.log(JSON.stringify(row));
      }
  }
}
if (out) writeFileSync(out, JSON.stringify({ chromium: chromium.executablePath(), lanes, samples, results }, null, 2) + "\n");
