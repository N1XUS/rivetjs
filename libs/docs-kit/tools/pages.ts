// The pages phase of a docs build (`build.ts` `buildSite`), in a child process: load the server bundle, prerender
// (full, or incremental with its full fallback), colour code blocks (`highlight-pages.ts`), host files, AI outputs.
// The server bundle instance, the prerender's garbage and the highlighter stay in the child: run in the parent they
// kept it at ~1.5 GB through the Chromium example checks that follow (ui-docs tree peak 2.8 GB there; UIDOCS-RSS
// 2026-10-29). The child reports its log lines and result over IPC and exits.
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { LoadedBuild } from "../../router/adapters/build.ts";
import { loadApp } from "./app.ts";

export interface PagesOptions {
  /** Build dir: `<dist>/client` (pages written into it), `<dist>/server` (the bundle). */
  dist: string;
  /** Incremental prerender: render only `pages`, carry the rest over from the client dir `previous`. */
  incremental?: { previous: string; pages: readonly string[] };
  /** Persistent code tokens (`highlightCache`; the caller resolved `buildCacheOn()`). */
  pageCache: boolean;
}

export interface PagesReport {
  pages: string[];
  prerender: "full" | "incremental";
  rendered: number;
  fallback?: string;
  /** The router entry's `base` (the compression dictionaries need it). */
  base?: string;
}

type Message = { log: string } | { done: PagesReport } | { error: string };

/** Run the pages phase of the site at `root` in a child process; `log` gets its log lines. */
export function renderPages(root: string, options: PagesOptions, log: (message: string) => void): Promise<PagesReport> {
  const args = [...process.execArgv, fileURLToPath(import.meta.url), resolve(root), JSON.stringify(options)];
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, args, { stdio: ["ignore", "inherit", "inherit", "ipc"] });
    const stop = () => child.kill();
    process.once("exit", stop);
    let report: PagesReport | undefined;
    let error: string | undefined;
    child.on("message", (message: Message) => {
      if ("log" in message) log(message.log);
      else if ("done" in message) report = message.done;
      else error = message.error;
    });
    child.once("error", fail);
    child.once("exit", (code, signal) => {
      process.off("exit", stop);
      if (code === 0 && report) done(report);
      else fail(new Error(error ?? `docs-kit: pages of ${root} failed (${signal ? "signal " + signal : "exit code " + code})`));
    });
  });
}

/** Child side. */
async function pages(root: string, options: PagesOptions, log: (message: string) => void): Promise<PagesReport> {
  const { site } = await loadApp(root);
  const { dist } = options;
  const client = resolve(dist, "client");
  // Imported here, not at the top: the parent (`build.ts`) imports this module for `renderPages` only.
  // Deep import (no package subpath): the loader `prerenderBuild` uses, so one bundle instance serves both prerender paths.
  const { loadBuild } = await import("../../router/adapters/build.ts");
  const { pagePreload } = await import("../frame-theme.ts");
  // One server bundle instance per process: the incremental path and its full fallback share it.
  const build = await loadBuild(dist, { preload: pagePreload(site.leanPages) });
  let report: Omit<PagesReport, "base">;
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
  // Code blocks coloured in the HTML (tools/highlight-pages.ts): docs pages ship no highlighter JS.
  const { highlightCache, highlightPages } = await import("./highlight-pages.ts");
  const tokens = options.pageCache ? highlightCache(root) : undefined;
  const coloured = await highlightPages(client, tokens ? { cache: tokens } : {});
  if (tokens) log(`highlight: tokens of ${tokens.hits} block(s) reused, ${tokens.misses} tokenised (build cache)${prunedNote(tokens.prune())}`);
  log(`highlight: ${coloured.blocks} code blocks coloured in ${coloured.pages} pages (${coloured.plain} plain, ${coloured.left} left for the browser)`);
  await hostFiles(client);
  // AI outputs (llms.txt, llms-full.txt, `<page>.md`): tools/llms/generate.ts.
  const llms = await import("./llms/generate.ts");
  log(`llms: ${await llms.writeLlms(await llms.generateLlms(root), client)} files`);
  return { ...report, ...(build.entry.base ? { base: build.entry.base } : {}) };
}

export const prunedNote = (removed: number) => (removed ? `, ${removed} old entr${removed === 1 ? "y" : "ies"} pruned` : "");

/** `prerenderBuild` over an already loaded build. */
async function fullPrerender(build: LoadedBuild, origin: string): Promise<Omit<PagesReport, "base">> {
  const { entry, handler, client } = build;
  const { prerender } = await import("@rivetjs/router/static");
  const report = await prerender({
    handler,
    routes: entry.routes,
    outDir: client,
    origin,
    ...(entry.base ? { base: entry.base } : {}),
    ...(entry.trailingSlash ? { trailingSlash: entry.trailingSlash } : {}),
    // Written after critical CSS (`build.ts`): the dictionaries hold the pages' final bytes.
    dictionary: false,
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

if (import.meta.main) {
  const send = (message: Message) => new Promise<void>((done) => process.send!(message, () => done()));
  const logs: Promise<void>[] = [];
  pages(process.argv[2]!, JSON.parse(process.argv[3]!) as PagesOptions, (message) => void logs.push(send({ log: message }))).then(
    // Exit at once: open handles (the server bundle's timers, workers) would keep the memory alive.
    async (report) => {
      await Promise.all(logs);
      await send({ done: report });
      process.exit(0);
    },
    async (error: unknown) => {
      await Promise.all(logs);
      await send({ error: error instanceof Error ? (error.stack ?? error.message) : String(error) });
      process.exit(1);
    },
  );
}
