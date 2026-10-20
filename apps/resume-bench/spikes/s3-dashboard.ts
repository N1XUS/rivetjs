// Spike S3 (docs/design/research/2026-10-18-beyond-resume-hydration.md §8): the widget-heavy page. Measures today's
// resumed ui-docs dashboard showcase frame (Kpi cards + sparklines, area + donut charts, DataGrid, Segment, SearchField)
// in Chromium under the resume-bench `slow` profile (Slow 4G + 4× CPU): bytes (document, resume state, JS before
// input), and the first interactions — the period Segment (a keyed <Show> that re-creates the KPI + chart subtree on
// the client: the cost of a client run of most of the page, i.e. an upper bound for an adopt run of it) and typing in
// the orders SearchField (DataGrid filter). Serve the built site first: `node libs/docs-kit/cli.ts serve apps/ui-docs`.
//
//   RESUME_BENCH_CHROME=/opt/pw-browsers/chromium node apps/resume-bench/spikes/s3-dashboard.ts [--url http://127.0.0.1:4327] [--repeats 5] [--fast]
import { chromium } from "playwright";
import { median, chromeTarget } from "../../../scripts/bench/shared.ts";

const argv = process.argv.slice(2);
const opt = (name: string, def: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1]! : def);
const base = opt("--url", "http://127.0.0.1:4327");
const repeats = Number(opt("--repeats", "5"));
const slow = !argv.includes("--fast");
const frame = `${base}/examples/showcase-dashboard/frame/`;

const browser = await chromium.launch({
  ...chromeTarget(),
  args: ["--use-mock-keychain", "--password-store=basic"],
});
const fmt = (xs: number[]) => (xs.length ? `${median(xs).toFixed(1)} (${Math.min(...xs).toFixed(1)}–${Math.max(...xs).toFixed(1)})` : "–");

interface Sample {
  documentBytes: number;
  stateBytes: number;
  jsRequestsBefore: number;
  jsBytesBefore: number;
  jsEvaluatedBefore: number;
  periodLatency: number;
  periodPaint: number;
  periodJsRequests: number;
  periodJsBytes: number;
  searchLatency: number;
  searchPaint: number;
  searchJsRequests: number;
}

async function run(): Promise<Sample> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  if (slow) {
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6e6 / 8) * 1,
      uploadThroughput: (750e3 / 8) * 1,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  }
  page.on("crash", () => console.error("page crashed"));
  page.on("pageerror", (e) => console.error("pageerror", e.message.split("\n")[0]));
  browser.on("disconnected", () => console.error("browser disconnected"));
  const js: { url: string; bytes: number; at: number }[] = [];
  let documentBytes = 0;
  page.on("response", async (r) => {
    try {
      const type = r.request().resourceType();
      const len = Number(r.headers()["content-length"] ?? 0) || (await r.body()).length;
      if (type === "document") documentBytes = len;
      if (type === "script") js.push({ url: r.url(), bytes: len, at: Date.now() });
    } catch {}
  });
  await page.addInitScript(() => {
    const w = window as unknown as { __s3: { marks: Record<string, number>; evaluated: number } };
    w.__s3 = { marks: {}, evaluated: 0 };
    addEventListener("click", (e) => (w.__s3.marks.click = e.timeStamp), true);
    addEventListener("keydown", (e) => (w.__s3.marks.keydown ??= e.timeStamp), true);
  });
  const t0 = Date.now();
  const step = (m: string) => process.env.S3_DEBUG && console.error(`  ${((Date.now() - t0) / 1000).toFixed(1)}s ${m}`);
  step("goto");
  await page.goto(frame, { waitUntil: "load" });
  step("loaded");
  await page.waitForTimeout(3000); // before input: idle preloads done
  const stateBytes = await page.evaluate(() => [...document.querySelectorAll('script[type="rivet/state"]')].reduce((n, s) => n + s.textContent!.length, 0));
  const jsEvaluatedBefore = await page.evaluate(() => performance.getEntriesByType("resource").filter((e) => /\.js(\?|$)/.test(e.name)).length);
  const before = js.length;
  const jsBytesBefore = js.reduce((n, j) => n + j.bytes, 0);

  // first interaction: the period segment → keyed Show re-creates KPIs + charts
  // The frame is served under a hash-based CSP (no unsafe-eval): the predicate is a fixed in-page function, never built
  // from a string.
  const until = (sel: string, text: string) =>
    page.evaluate(
      ([sel, text]) =>
        new Promise<{ change: number; paint: number }>((done) => {
          const w = window as unknown as { __s3: { marks: Record<string, number> } };
          const check = () => {
            const el = document.querySelector(sel);
            if (!el || !el.textContent!.includes(text)) return false;
            const change = performance.now();
            requestAnimationFrame(() => {
              const ch = new MessageChannel();
              ch.port1.onmessage = () => done({ change, paint: performance.now() });
              ch.port2.postMessage(0);
            });
            return true;
          };
          if (check()) return;
          const mo = new MutationObserver(() => check() && mo.disconnect());
          mo.observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
          void w;
        }),
      [sel, text] as const,
    );
  step("period click");
  const periodBefore = js.length;
  // ui Segment = radiogroup; the selected item carries aria-checked="true" (libs/ui/tests/segment.server.test.tsx)
  const periodDone = until('#period [role="radio"][aria-checked="true"]', "7 days");
  await page.click("#period >> text=7 days");
  const period = await periodDone;
  step("period done");
  const clickMark = await page.evaluate(() => (window as unknown as { __s3: { marks: Record<string, number> } }).__s3.marks.click);
  await page.waitForTimeout(1500);
  const periodJs = js.slice(periodBefore);

  // search: type into the orders SearchField, wait for the grid to shrink
  const rowsBefore = await page.evaluate(() => document.querySelectorAll('[role="row"]').length);
  const searchBefore = js.length;
  step("search");
  const search = page.locator('input[type="search"], [role="searchbox"]').first();
  await search.click();
  const searchDone = page.evaluate(
    (rowsBefore) =>
      new Promise<{ change: number; paint: number }>((done) => {
        const check = () => {
          if (document.querySelectorAll('[role="row"]').length >= rowsBefore) return false;
          const change = performance.now();
          requestAnimationFrame(() => {
            const ch = new MessageChannel();
            ch.port1.onmessage = () => done({ change, paint: performance.now() });
            ch.port2.postMessage(0);
          });
          return true;
        };
        const mo = new MutationObserver(() => check() && mo.disconnect());
        mo.observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
      }),
    rowsBefore,
  );
  await page.evaluate(() => ((window as unknown as { __s3: { marks: Record<string, number> } }).__s3.marks.keydown = undefined as never));
  await page.keyboard.type("zz");
  const searchResult = await Promise.race([searchDone, page.waitForTimeout(15000).then(() => null)]);
  const keyMark = await page.evaluate(() => (window as unknown as { __s3: { marks: Record<string, number> } }).__s3.marks.keydown);
  step("done");
  await context.close();
  return {
    documentBytes,
    stateBytes,
    jsRequestsBefore: before,
    jsBytesBefore,
    jsEvaluatedBefore,
    periodLatency: period.change - clickMark,
    periodPaint: period.paint - clickMark,
    periodJsRequests: periodJs.length,
    periodJsBytes: periodJs.reduce((n, j) => n + j.bytes, 0),
    searchLatency: searchResult ? searchResult.change - keyMark : NaN,
    searchPaint: searchResult ? searchResult.paint - keyMark : NaN,
    searchJsRequests: js.length - searchBefore,
  };
}

const samples: Sample[] = [];
for (let i = 0; i < repeats; i++) {
  try {
    samples.push(await run());
    process.stdout.write(".");
  } catch (e) {
    console.error(`\nrepeat ${i}: ${(e as Error).message.split("\n")[0]}`);
  }
}
console.log(`\n${slow ? "slow (Slow 4G + 4× CPU)" : "fast"}, ${samples.length} repeats, ${frame}`);
console.log(`| metric | median (min–max) |`);
console.log(`| --- | ---: |`);
const col = (k: keyof Sample) => samples.map((s) => s[k]).filter((v) => Number.isFinite(v));
for (const k of Object.keys(samples[0] ?? {}) as (keyof Sample)[]) console.log(`| ${k} | ${fmt(col(k))} |`);
await browser.close();
