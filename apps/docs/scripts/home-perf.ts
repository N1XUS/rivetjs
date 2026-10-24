// Writes content/_home-perf.json: homepage regression metadata, measured on the BUILT site.
//   node apps/docs/scripts/home-perf.ts          measure dist/client/index.html, write the JSON
//   node apps/docs/scripts/home-perf.ts --check  exit 1 when the JSON no longer matches the build
//   node apps/docs/scripts/home-perf.ts --lighthouse  also: Lighthouse mobile × 3 (median) + Fast 3G / 4× CPU navigation × 3
//     on dist/client served by apps/editorial-bench/harness/static-server.mjs (gzip); run it under the bench lock.
// tests/site.test.ts checks this metadata against the build; the current home does not render it.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants } from "node:zlib";

const root = fileURLToPath(new URL("..", import.meta.url));
const file = resolve(root, "content/_home-perf.json");

export interface HomePerf {
  /** Inline resume loader of `/` (the script right after the `rivet/boundaries` script): UTF-8 bytes, brotli quality 11 bytes. */
  loader: { bytes: number; brotli: number };
  /** `@rivetjs/cdk` test cases (`it(` / `test(` calls in libs/cdk/tests*); `a11y` = those whose title names ARIA, keyboard,
   * focus, labels, roles, screen readers or announcements. The legacy home quoted them rounded down ("4,800+"), so new tests
   * never make the JSON wrong; the check only fails when tests were removed below the quoted count. */
  cdk: { tests: number; a11y: number };
  /** Every inline executable `<script>` of `/` (no `src`, no data type: theme bootstrap, speculation-rules fallback,
   * resume loader): UTF-8 bytes summed. Visible effects also download external scripts. */
  inlineJs: { bytes: number; scripts: number };
  /** The built `/` document: UTF-8 bytes and brotli-11 bytes. `stale()` compares whole KB, preserving the existing regression contract. */
  html: { bytes: number; brotli: number };
  /** `--lighthouse` run (kept by plain writes): date, Lighthouse mobile medians of 3, Fast 3G + 4× CPU navigation medians of 3. */
  lighthouse?: {
    date: string;
    score: number;
    lcp: number;
    fcp: number;
    tbt: number;
    cls: number;
    /** Playwright, cold cache, Fast 3G (562.5 ms RTT, 1.44 Mbit/s) + 4× CPU, 412 px: LCP, LCP − responseStart, CLS, script bytes before input. */
    nav: { lcp: number; lcpAfterResponse: number; cls: number; jsBytes: number };
  };
}

const TEST_CALL = /^\s*(?:it|test)(?:\.each\([^)]*\))?\(/gm;
const A11Y_CALL = /^\s*(?:it|test)\(\s*['"`][^'"`]*(?:aria|keyboard|focus|screen ?reader|label|role|announce)/gim;

/** Counts the cdk test cases under `libs/cdk/tests` and `libs/cdk/tests-components` (see `HomePerf.cdk`). */
export function countCdkTests(repo: string): HomePerf["cdk"] {
  let tests = 0;
  let a11y = 0;
  for (const dir of ["libs/cdk/tests", "libs/cdk/tests-components"])
    for (const entry of readdirSync(resolve(repo, dir), { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !/\.test\.tsx?$/.test(entry.name)) continue;
      const source = readFileSync(resolve(entry.parentPath, entry.name), "utf8");
      tests += source.match(TEST_CALL)?.length ?? 0;
      a11y += source.match(A11Y_CALL)?.length ?? 0;
    }
  return { tests, a11y };
}

/** The inline loader script of a built page: the first `<script>` after its `type="rivet/boundaries"` script. */
export function inlineLoader(html: string): string {
  const match = /<script type="rivet\/boundaries"[^>]*>[\s\S]*?<\/script><script[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!match) throw new Error("home-perf: no inline resume loader after the rivet/boundaries script");
  return match[1]!;
}

const brotli = (bytes: Buffer) => brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;

/** The document numbers of a built page. */
export function measureHtml(html: string): HomePerf["html"] {
  const bytes = Buffer.from(html);
  return { bytes: bytes.length, brotli: brotli(bytes) };
}

/** Inline executable scripts of a built page (see `HomePerf.inlineJs`). */
export function measureInlineJs(html: string): HomePerf["inlineJs"] {
  let bytes = 0;
  let scripts = 0;
  for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc=/.test(attrs!)) continue;
    const type = /\btype="([^"]*)"/.exec(attrs!)?.[1];
    if (type && type !== "module" && type !== "text/javascript") continue;
    bytes += Buffer.byteLength(body!);
    scripts++;
  }
  return { bytes, scripts };
}

/** Regression ceiling for the built `/` document (raw / brotli bytes): `stale()` fails above it. The spec bar is
 * 40 KB / 12 KB (docs/design/specs/2026-10-11-homepage-design.md); lower this ceiling as the page gets there. The
 * ceiling leaves out the inline critical CSS (`<style data-rivet-critical>`, docs-kit tools/critical-css.ts): those
 * bytes replaced the render-blocking stylesheets; the page's own numbers (`html`) include them. */
export const HTML_CEILING = { bytes: 130_000, brotli: 25_000 };

/** The loader numbers of a built page. */
export function measure(html: string): HomePerf["loader"] {
  const loader = Buffer.from(inlineLoader(html));
  return { bytes: loader.length, brotli: brotli(loader) };
}

/** Problems of a committed `_home-perf.json` against the build and the sources ([] = fresh). */
export function stale(perf: HomePerf, html: string, repo: string): string[] {
  const problems: string[] = [];
  const loader = measure(html);
  if (perf.loader.bytes !== loader.bytes || perf.loader.brotli !== loader.brotli) problems.push(`loader: JSON ${JSON.stringify(perf.loader)}, build ${JSON.stringify(loader)}`);
  const page = measureHtml(html);
  const kb = (n: number) => Math.round(n / 1000);
  if (kb(perf.html.bytes) !== kb(page.bytes) || kb(perf.html.brotli) !== kb(page.brotli)) problems.push(`html: JSON ${JSON.stringify(perf.html)}, build ${JSON.stringify(page)}`);
  const own = measureHtml(html.replace(/<style data-rivet-critical>[\s\S]*?<\/style>/, ""));
  if (own.bytes > HTML_CEILING.bytes || own.brotli > HTML_CEILING.brotli) problems.push(`html: build ${JSON.stringify(own)} (without critical CSS) above the ceiling ${JSON.stringify(HTML_CEILING)}`);
  const inline = measureInlineJs(html);
  if (perf.inlineJs?.bytes !== inline.bytes || perf.inlineJs.scripts !== inline.scripts) problems.push(`inline JS: JSON ${JSON.stringify(perf.inlineJs)}, build ${JSON.stringify(inline)}`);
  const cdk = countCdkTests(repo);
  if (perf.cdk.tests > cdk.tests || perf.cdk.a11y > cdk.a11y) problems.push(`cdk tests: JSON ${JSON.stringify(perf.cdk)} above the sources ${JSON.stringify(cdk)}`);
  return problems;
}

/** Astro's article LCP in docs/benchmarks/2026-10-11-editorial.json (serve 1000, lighthouse.article.lcp.median), rounded. */
const BAR_LCP = 1052;

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

/** Lighthouse + throttled navigation of `/` on the built site (see `HomePerf.lighthouse`). */
async function lighthouse(repo: string): Promise<NonNullable<HomePerf["lighthouse"]>> {
  const { spawn } = await import("node:child_process");
  const { chromium } = await import("playwright");
  const harness = resolve(repo, "apps/editorial-bench/harness");
  const { runLighthouse } = (await import(resolve(harness, "lh.mjs"))) as {
    runLighthouse: (url: string, chrome: string) => Promise<{ score: number; lcp: number; fcp: number; tbt: number; cls: number }>;
  };
  const port = 4419;
  const server = spawn(process.execPath, [resolve(harness, "static-server.mjs"), resolve(root, "dist/client"), String(port)], { stdio: "ignore" });
  try {
    for (let i = 0; i < 100; i++) {
      if (await fetch(`http://127.0.0.1:${port}/`).then((r) => r.ok, () => false)) break;
      await new Promise((done) => setTimeout(done, 100));
    }
    const url = `http://127.0.0.1:${port}/`;
    const runs = [];
    for (let i = 0; i < 3; i++) runs.push(await runLighthouse(url, chromium.executablePath()));
    const browser = await chromium.launch();
    const navs = [];
    try {
      for (let i = 0; i < 3; i++) {
        const context = await browser.newContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true });
        const page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        await cdp.send("Network.enable");
        await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
        await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 562.5, downloadThroughput: (1.6 * 1024 * 1024 * 0.9) / 8, uploadThroughput: (750 * 1024 * 0.9) / 8 });
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
        await page.goto(url, { waitUntil: "load" });
        await page.waitForTimeout(1000);
        navs.push(
          await page.evaluate(
            () =>
              new Promise<{ lcp: number; lcpAfterResponse: number; cls: number; jsBytes: number }>((done) => {
                const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
                const shifts = (performance.getEntriesByType("layout-shift") as unknown as { value: number; hadRecentInput: boolean }[]).filter((s) => !s.hadRecentInput);
                const scripts = (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).filter((entry) => /\.m?js(?:$|\?)/.test(entry.name));
                new PerformanceObserver((list) => {
                  const lcp = list.getEntries().at(-1)!.startTime;
                  done({ lcp, lcpAfterResponse: lcp - navigation.responseStart, cls: shifts.reduce((sum, s) => sum + s.value, 0), jsBytes: scripts.reduce((sum, e) => sum + e.transferSize, 0) });
                }).observe({ type: "largest-contentful-paint", buffered: true });
              }),
          ),
        );
        await context.close();
      }
    } finally {
      await browser.close();
    }
    const pick = <T>(list: T[], key: keyof T) => median(list.map((entry) => entry[key] as number));
    return {
      date: new Date().toLocaleDateString("en-CA"), // local YYYY-MM-DD
      score: pick(runs, "score"),
      lcp: Math.round(pick(runs, "lcp")),
      fcp: Math.round(pick(runs, "fcp")),
      tbt: Math.round(pick(runs, "tbt")),
      cls: pick(runs, "cls"),
      nav: { lcp: Math.round(pick(navs, "lcp")), lcpAfterResponse: Math.round(pick(navs, "lcpAfterResponse")), cls: pick(navs, "cls"), jsBytes: pick(navs, "jsBytes") },
    };
  } finally {
    server.kill("SIGTERM");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repo = resolve(root, "../..");
  const html = readFileSync(resolve(root, "dist/client/index.html"), "utf8");
  if (process.argv.includes("--check")) {
    const problems = stale(JSON.parse(readFileSync(file, "utf8")) as HomePerf, html, repo);
    if (problems.length) {
      console.error(`content/_home-perf.json is stale (run node apps/docs/scripts/home-perf.ts, then rebuild):\n${problems.join("\n")}`);
      process.exit(1);
    }
  } else {
    const previous = JSON.parse(readFileSync(file, "utf8")) as HomePerf;
    const measured = process.argv.includes("--lighthouse") ? await lighthouse(repo) : previous.lighthouse;
    const perf: HomePerf = { loader: measure(html), cdk: countCdkTests(repo), inlineJs: measureInlineJs(html), html: measureHtml(html), ...(measured ? { lighthouse: measured } : {}) };
    writeFileSync(file, JSON.stringify(perf, null, 2) + "\n");
    if (measured) console.log(`Lighthouse ${measured.score} · LCP ${measured.lcp} ms · CLS ${measured.cls} · TBT ${measured.tbt} ms; Fast 3G nav LCP ${measured.nav.lcp} ms`);
    // Acceptance bar (docs/design/specs/2026-10-11-homepage-design.md): score 100, LCP ≤ Astro's editorial article LCP, CLS 0.
    if (measured && process.argv.includes("--lighthouse")) {
      const misses = [measured.score < 100 && `score ${measured.score} < 100`, measured.lcp > BAR_LCP && `LCP ${measured.lcp} ms > ${BAR_LCP} ms`, measured.cls > 0 && `CLS ${measured.cls} > 0`].filter(Boolean);
      console.log(misses.length ? `acceptance bar missed: ${misses.join(", ")}` : "acceptance bar met");
    }
  }
}
