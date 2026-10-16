// Full docs build: content routes + example frames → app build (client + server: the examples are part of it) →
// prerender (docs pages and example frame pages) → example checks in Chromium (measures written into the pages) →
// critical CSS inlined per page (tools/critical-css.ts) → search index → link check (host files + AI outputs after
// prerender). Output: dist/client (the site), dist/server.
import { constants, existsSync } from "node:fs";
import { cp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prerender } from "@rivetjs/router/static";
// Deep import (no package subpath): the loader `prerenderBuild` uses, so one bundle instance serves both prerender paths.
import { loadBuild, type LoadedBuild } from "../../router/adapters/build.ts";
import { pagePreload } from "../frame-theme.ts";
import { EXAMPLES_JSON } from "./examples.ts";
import { mb, memoryBudget, watchMemory } from "./memory.ts";
import { loadApp } from "./app.ts";
import type { ExampleData } from "../components/types.ts";
import { viteBuild } from "./vite-build.ts";

export interface BuildOptions {
  /** Example checks in Chromium (default true; `false` = `--no-checks`: the "What loaded" paragraphs stay empty). */
  checks?: boolean;
  /** Pagefind index (default true). */
  search?: boolean;
  /** Output dir (default `<root>/dist`): `<dist>/client`, `<dist>/server`. */
  dist?: string;
  /** Reuse the checks of unchanged example frame pages (default true; `false` = `--no-cache`, `example-checks.ts`). */
  cache?: boolean;
  log?: (message: string) => void;
}

/** Build the site at `root` into `<root>/dist` (or `options.dist`). */
export async function buildDocs(root: string, options: BuildOptions = {}): Promise<{ pages: string[] }> {
  await loadApp(root);
  const log = options.log ?? ((message: string) => console.log(message));
  const started = performance.now();
  const dist = resolve(options.dist ?? resolve(root, "dist"));
  // Peak RSS of the whole process tree (workers, Chromium, Pagefind) per phase, against the memory budget.
  const memory = watchMemory();
  let phasePeak = 0;
  let mark = started;
  const phases: string[] = [];
  const lap = (phase: string) => {
    const now = performance.now();
    const peak = memory.peak();
    phases.push(`${phase} ${((now - mark) / 1000).toFixed(1)} s${peak > phasePeak ? `, peak ${mb(peak)}` : ""}`);
    phasePeak = peak;
    mark = now;
  };
  // Content routes + example frames are generated (strictly) by the docs Vite plugin's `config` hook in the build
  // child (`content/plugin.ts`): generating here too kept ~100 MB more in this process during the Vite build
  // (markdown pipeline, highlighter; cdk-docs 246 → 141 MB) and rendered every page twice.
  const report = await buildSite(root, {
    dist,
    log,
    ...(options.search === false ? { search: false } : {}),
    ...(options.checks === false ? { checks: false } : options.cache === false ? { checks: { cache: false } } : {}),
  });
  lap("site");
  const examples = Object.values(JSON.parse(await readFile(resolve(root, EXAMPLES_JSON), "utf8")) as Record<string, ExampleData>);
  log(`content: ${report.pages.length} pages, ${examples.length} examples (${examples.filter((example) => !example.codeOnly).length} live)`);
  const peak = await memory.stop();
  const budget = memoryBudget();
  log(
    `done in ${((performance.now() - started) / 1000).toFixed(1)} s (${phases.join(", ")}); peak tree RSS ${mb(peak)} (budget ${budget ? budget + " MB" : "off"})`,
  );
  if (budget && peak > budget * 1024 * 1024)
    throw new Error(`docs-kit build: peak memory ${mb(peak)} (this process + workers + Chromium) is over the ${budget} MB budget (DOCS_KIT_MAX_RSS_MB)`);
  return { pages: report.pages };
}

export interface SiteBuildOptions {
  /** Output: `<dist>/client` + `<dist>/server` (replaced). */
  dist: string;
  /** Pagefind index (default true). `"reuse"`: copy `<previous>/pagefind` (incremental rebuilds whose titles did not change). */
  search?: boolean | "reuse";
  /**
   * Incremental prerender: render only `pages` (URL paths) and carry the rest over from the client dir
   * `previous` (`tools/incremental.ts`); falls back to a full prerender when that is not safe.
   */
  incremental?: { previous: string; pages: readonly string[] };
  /** Example checks (default true): `false` skips them; `{ cache: false }` re-checks every example. */
  checks?: boolean | { cache: boolean };
  log?: (message: string) => void;
}

export interface SiteBuildReport {
  /** Prerendered page paths (full prerender) or the rendered subset (incremental). */
  pages: string[];
  /** How pages were produced: `full`, or `incremental` (rendered + carried over). */
  prerender: "full" | "incremental";
  rendered: number;
  /** Why an incremental prerender fell back to a full one. */
  fallback?: string;
  /** Seconds per phase (`vite`, `prerender`, `checks`, `critical`, `search`, `links`). */
  timings: Record<string, number>;
}

/**
 * Client + server build (Vite), prerender, host files, search, link check of the site at `root` (content
 * routes already generated). Records the module graph in `.artifacts/site-graph.json`.
 */
export async function buildSite(root: string, options: SiteBuildOptions): Promise<SiteBuildReport> {
  const { site } = await loadApp(root);
  const dist = resolve(options.dist);
  const log = options.log ?? ((message: string) => console.log(message));
  const timings: Record<string, number> = {};
  let mark = performance.now();
  const lap = (phase: string) => {
    const now = performance.now();
    timings[phase] = Math.round((now - mark) / 100) / 10;
    mark = now;
  };
  for (const dir of ["client", "server"]) await rm(resolve(dist, dir), { recursive: true, force: true });
  // In a child process: its ~1.9 GB (rolldown + module graph) is released before prerender and the Chromium checks.
  await viteBuild(root, { dist, graph: true });
  lap("vite");
  const client = resolve(dist, "client");
  // One server bundle instance per process: the incremental path and its full fallback share it.
  const build = await loadBuild(dist, { preload: pagePreload(site.leanPages) });
  let report: Omit<SiteBuildReport, "timings">;
  if (options.incremental) {
    const { prerenderPartial } = await import("./incremental.ts");
    const partial = await prerenderPartial({ dist, build, previous: options.incremental.previous, pages: options.incremental.pages, origin: site.origin });
    if (partial.ok) report = { pages: [...options.incremental.pages], prerender: "incremental", rendered: partial.rendered };
    else {
      log(`prerender: incremental not possible (${partial.why}), full prerender`);
      report = { ...(await fullPrerender(build, site.origin)), fallback: partial.why };
    }
  } else report = await fullPrerender(build, site.origin);
  log(`prerender: ${report.rendered} pages (${report.prerender})`);
  await hostFiles(client);
  // AI outputs (llms.txt, llms-full.txt, `<page>.md`): tools/llms/generate.ts.
  const llms = await import("./llms/generate.ts");
  log(`llms: ${await llms.writeLlms(await llms.generateLlms(root), client)} files`);
  lap("prerender");
  if (options.checks !== false) {
    const { checkExamples, writeMeasures } = await import("./example-checks.ts");
    const examples = JSON.parse(await readFile(resolve(root, EXAMPLES_JSON), "utf8")) as Record<string, ExampleData>;
    const measures = await checkExamples(root, client, examples, { log, ...(typeof options.checks === "object" ? { cache: options.checks.cache } : {}) });
    const written = await writeMeasures(client, measures);
    log(`checks: ${Object.keys(measures).length} example(s) measured, written into ${written} page(s)`);
  }
  lap("checks");
  // Inline critical CSS per page, full stylesheets after the first paint (tools/critical-css.ts). After the measures:
  // their "What loaded" markup (<strong>) counts as page content.
  const { inlineCriticalPages } = await import("./critical-css.ts");
  // Pages with code blocks: the idle highlighter (components/highlighter.ts) adds its token classes, maybe before the
  // full stylesheets arrive (bold / italic tokens would change line widths then).
  const critical = await inlineCriticalPages(client, {
    added: (html) => (html.includes(" data-lang=") ? HIGHLIGHT_CLASSES : undefined),
    extraSelectors: site.criticalCss?.extraSelectors,
  });
  log(`critical css: ${critical.pages} pages, ${Math.round(critical.bytes / Math.max(1, critical.pages) / 100) / 10} KB inline per page`);
  // Pages left render-blocking (full stylesheet links kept): no shell activation script, or no plain head link.
  for (const { file, why } of critical.skipped.slice(0, 10)) log(`critical css: kept stylesheet links of ${file} (${why})`);
  if (critical.skipped.length > 10) log(`critical css: … ${critical.skipped.length - 10} more pages kept their stylesheet links`);
  lap("critical");
  if (options.search === "reuse" && options.incremental && report.prerender === "incremental" && existsSync(resolve(options.incremental.previous, "pagefind")))
    await cp(resolve(options.incremental.previous, "pagefind"), resolve(client, "pagefind"), { recursive: true, mode: constants.COPYFILE_FICLONE });
  else if (options.search !== false) {
    const { buildSearch } = await import("./search.ts");
    const indexed = await buildSearch(client);
    log(`search: ${indexed} pages indexed`);
  }
  lap("search");
  const { checkLinks } = await import("./check-links.ts");
  const problems = await checkLinks(dist);
  if (problems.length)
    throw new Error(`Broken links:\n  ${problems.slice(0, 50).join("\n  ")}${problems.length > 50 ? `\n  … ${problems.length - 50} more` : ""}`);
  lap("links");
  log(
    `site phases: ${Object.entries(timings)
      .map(([phase, s]) => `${phase} ${s} s`)
      .join(", ")}`,
  );
  return { ...report, timings };
}

/** Token classes of components/highlight-classes.ts (`lightClass` / `darkClass` / `STYLE_CLASSES`, `code-rv`). */
const HIGHLIGHT_CLASSES = /^(?:h[ld]-[0-9a-f]{3,8}|h[ibu]|code-rv)$/;

/** `prerenderBuild` over an already loaded build. */
async function fullPrerender(build: LoadedBuild, origin: string): Promise<Omit<SiteBuildReport, "timings">> {
  const { entry, handler, client } = build;
  const report = await prerender({
    handler,
    routes: entry.routes,
    outDir: client,
    origin,
    ...(entry.base ? { base: entry.base } : {}),
    ...(entry.trailingSlash ? { trailingSlash: entry.trailingSlash } : {}),
  });
  return { pages: report.pages, prerender: "full", rendered: report.pages.length };
}

/**
 * Static host files (Cloudflare Pages format): immutable assets, security headers, and Speculation Rules served as a
 * header (inline rules would need `'inline-speculation-rules'` in the per-page CSP, which `hashCSP` does not emit).
 */
async function hostFiles(client: string): Promise<void> {
  const rules = { prerender: [{ where: { and: [{ href_matches: "/*" }, { not: { href_matches: "/pagefind/*" } }] }, eagerness: "moderate" }] };
  await writeFile(resolve(client, "speculation-rules.json"), JSON.stringify(rules) + "\n");
  await writeFile(
    resolve(client, "_headers"),
    [
      "/*",
      "  X-Content-Type-Options: nosniff",
      "  Referrer-Policy: strict-origin-when-cross-origin",
      '  Speculation-Rules: "/speculation-rules.json"',
      "/assets/*",
      "  Cache-Control: public, max-age=31536000, immutable",
      "/speculation-rules.json",
      "  Content-Type: application/speculationrules+json",
      "",
    ].join("\n"),
  );
}

/** CLI: `docs-kit build <app root> [--no-checks] [--no-search] [--no-cache] [--dist dir]`. */
export async function buildCommand(root: string, args: string[]): Promise<void> {
  const at = args.indexOf("--dist");
  const dist = at >= 0 ? args[at + 1] : undefined;
  if (at >= 0 && !dist) throw new Error("docs-kit build: --dist needs a directory");
  await buildDocs(root, {
    checks: !args.includes("--no-checks"),
    search: !args.includes("--no-search"),
    ...(args.includes("--no-cache") ? { cache: false } : {}),
    ...(dist ? { dist: resolve(dist) } : {}),
  });
}
