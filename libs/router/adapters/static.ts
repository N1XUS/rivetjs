// Static adapter: prerender resumable pages (static routes + `entries()`) through the app handler,
// with `_data.json` beside each page for client navigation and a CSR shell for the rest.
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, rmdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import type { AppHandler, AppRoute } from "../server/handler.ts";
import { DATA_PARAM } from "../shared/data.ts";
import { loadServer } from "../server/module.ts";
import type { AppConfig } from "../server/app.ts";
import type { CSPOptions } from "../shared/csp.ts";
import { hashPolicy, inlineSources } from "../shared/csp-hash.ts";
export type { CSPDirectives, CSPOptions } from "../shared/csp.ts";
export { COLOAD_ENV, pageScripts, planCoload, type ColoadPlan, type ColoadReport } from "../build/coload.ts";
export { buildDictionary, writeDictionaries, type DictionaryBuildOptions, type DictionaryManifest, type WriteDictionariesOptions } from "./dictionary.ts";
import { normalizeBase } from "../shared/base.ts";
import { slashPath, type TrailingSlash } from "../shared/slash.ts";
import { writeDictionaries, type DictionaryManifest, type WriteDictionariesOptions } from "./dictionary.ts";

/** Options of `prerender()`. */
export interface PrerenderOptions {
  handler: AppHandler;
  routes: readonly AppRoute[];
  outDir: string;
  /**
   * The site's origin (`https://example.com`), used for the synthetic page requests: absolute URLs a page builds from
   * its request URL (canonical links, `og:url`) carry it. Resume state and `_data.json` hold same-origin URL values
   * relative either way. Unset: requests use the placeholder `http://localhost`, and a page whose state or data still
   * holds it (a URL string built from the request URL) is an error.
   */
  origin?: string;
  /** CSR shell for routes that can't be prerendered and have no server module; written to `200.html`. */
  shell?: () => string | Promise<string>;
  /**
   * Static pages have no per-request nonce: each page gets a `<meta>` CSP allowing its own inline
   * scripts by hash (`hashCSP`, given these options: `trustedTypes`, extra `directives` such as
   * `{ "script-src": "'wasm-unsafe-eval'", "worker-src": "'self' blob:" }`). `false` leaves the pages
   * as rendered (the host sets headers).
   */
  csp?: false | CSPOptions;
  /** URL base path the route patterns carry (`/app`): files are written relative to it (the host serves `outDir` under it). */
  base?: string;
  /**
   * The app's `trailingSlash` policy (`prerenderBuild` reads it from the build): pages are requested in
   * canonical form and written as `a.html` (`"never"`, hosts serve it at `/a`) or `a/index.html`
   * (`"always"`, `"ignore"`). `_data.json` stays at `a/_data.json` either way.
   */
  trailingSlash?: TrailingSlash;
  /**
   * Zero-JS sites (no page resumes, no CSR shell route): delete the client build's scripts no page references
   * (`outDir/.vite/manifest.json` chunks outside the static / dynamic import closure of the pages' `<script src>` and
   * modulepreload links, and the resume loader's `*.deps.js` modules). `prerenderBuild` turns it on (`prune: false` keeps them).
   */
  prune?: boolean;
  /**
   * Compression dictionary (RFC 9842 `dcz`, served by the node adapter / docs-kit serve): after the pages are written,
   * the site's dictionary (≤ `max` 128 KiB) from up to 12 pages per route group and their `_data.json`
   * (`_rivet/dict/<id>.dict` + `.vite/rivet-dictionaries.json`). Default on; `false` writes none (a host that cannot
   * negotiate `Available-Dictionary` ignores the file either way).
   */
  dictionary?: false | Omit<WriteDictionariesOptions, "base">;
}
/** What `prerender()` wrote: page paths and the routes served by the CSR shell. */
export interface PrerenderReport {
  pages: string[];
  /** Route ids served by the CSR shell. */
  fallback: string[];
  /** Some page resumes (ships resume state + loader); `false`: every page is zero-JS (no `_data.json` written). */
  resumes: boolean;
  /** Script files `prune` deleted (outDir-relative). */
  pruned?: string[];
  /** Compression dictionaries written (`dictionary`). */
  dictionaries?: DictionaryManifest["dictionaries"];
}

/** Fill a router pattern with params (`:name` encoded, `*name` encoded per segment). */
export function fillPattern(pattern: string, params: Record<string, string>): string {
  const out = pattern.replace(/([:*])([A-Za-z_$][\w$]*)/g, (_, kind: string, name: string) => {
    const value = params[name];
    if (value === undefined || value === "") throw new Error(`Missing param "${name}" for ${pattern}`);
    return kind === "*" ? value.split("/").map(encodeURIComponent).join("/") : encodeURIComponent(value);
  });
  return out.replace(/\/+$/, "") || "/";
}

/**
 * Add a CSP `<meta>` to a static page: its inline scripts allowed by SHA-256 hash, script files from
 * its own origin, no plugins, no `<base>`. (`'strict-dynamic'` would not do: browsers pass a nonce's
 * trust on to `import()`, but not a hash's, and the resume loader imports its chunks.) Pages without
 * `<head>` or without inline scripts (and no `options.directives`) are returned unchanged. The `<meta>` goes after a
 * leading `<meta charset>` and `<meta name="viewport">` (the charset must stay in the first 1024 bytes, first).
 * `options.directives` merge in (`cspPolicy`): e.g. `{ "script-src": "'wasm-unsafe-eval'", "worker-src": "'self' blob:" }`;
 * header-only directives (`frame-ancestors`, `report-uri`, `report-to`, `sandbox`) throw.
 */
export function hashCSP(html: string, options?: CSPOptions): string {
  const sha = (text: string) => `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;
  // Inline `<style>` elements (inlined stylesheets, head styles): hashed into a `style-src` / `style-src-elem` the options set.
  const found = inlineSources(html, !!options?.directives);
  const head = /<head\b[^>]*>/i.exec(html);
  const extra = options?.directives !== undefined && Object.keys(options.directives).length > 0;
  if ((!found.scripts.length && !extra) || !head) return html;
  const policy = hashPolicy(found.scripts.map(sha), found.origins, found.styles.map(sha), options, true);
  // After a leading charset / viewport meta (in that order), before everything else.
  const lead = /^(?:\s*<meta\s+charset\b[^>]*>)?(?:\s*<meta\s+name\s*=\s*["']?viewport\b[^>]*>)?/i.exec(html.slice(head.index + head[0].length))!;
  const at = head.index + head[0].length + lead[0].length;
  return html.slice(0, at) + `<meta http-equiv="Content-Security-Policy" content="${policy}">` + html.slice(at);
}

/** Synthetic request origin when `origin` is unset. */
const PLACEHOLDER = "http://localhost";
const STATE = /<script type="rivet\/boundaries"[^>]*>[^<]*/g;
// The placeholder origin as JSON / HTML text holds it (`http://localhost/…`, `http://localhost"`; `:port` is another origin).
const PLACEHELD = /http:(?:\\?\/){2}localhost(?![\w.:-])/;
const placeholder = (text: string): boolean => PLACEHELD.test(text);
const ambiguous = (url: string, where: string, text: string) => {
  const at = PLACEHELD.exec(text)!.index;
  return `Prerender ${url}: the ${where} holds the placeholder origin http://localhost (a URL string built from the request URL: …${text.slice(Math.max(0, at - 40), at + 60)}…); pass prerender({ origin }) / prerenderBuild({ origin }) with the site's origin`;
};

// `<script src>` / `<link rel=modulepreload href>` (attribute order as rendered: rel before href).
const SCRIPT_URL = /<(script\b[^>]*?\ssrc|link\b[^>]*?\srel="?modulepreload"?[^>]*?\shref)="([^"]+)"/g;

/** Delete the client build's scripts outside the referenced ones' import closure, and every `*.deps.js` module. */
async function prune(outDir: string, base: string, scripts: ReadonlySet<string>): Promise<string[]> {
  let manifest: Record<string, { file: string; imports?: string[]; dynamicImports?: string[] }>;
  try {
    manifest = JSON.parse(await readFile(join(resolve(outDir), ".vite/manifest.json"), "utf8"));
  } catch {
    return [];
  }
  const byFile = new Map(Object.values(manifest).map((chunk) => [chunk.file, chunk]));
  const keep = new Set<string>();
  const visit = (file: string | undefined) => {
    const chunk = file === undefined ? undefined : byFile.get(file);
    if (!chunk || keep.has(chunk.file)) return;
    keep.add(chunk.file);
    for (const key of [...(chunk.imports ?? []), ...(chunk.dynamicImports ?? [])]) visit(manifest[key]?.file);
  };
  for (const src of scripts) {
    if (!src.startsWith("/") || src.startsWith("//")) continue;
    const path = base && src.startsWith(base + "/") ? src.slice(base.length) : src;
    visit(path.slice(1).split(/[?#]/)[0]);
  }
  const drop = [...byFile.keys()].filter((file) => file.endsWith(".js") && !keep.has(file));
  // The loader's deps modules (`<chunk>.deps.js`): only resumed pages import them.
  const deps = (await readdir(resolve(outDir), { recursive: true })).map((file) => file.split(sep).join("/")).filter((file) => file.endsWith(".deps.js"));
  const out = [...new Set([...drop, ...deps])].sort();
  await Promise.all(out.map((file) => rm(resolve(outDir, file), { force: true })));
  // Directories left empty (`assets/`).
  for (const dir of new Set(out.map((file) => dirname(resolve(outDir, file))))) if (dir !== resolve(outDir)) await rmdir(dir).catch(() => undefined);
  return out;
}

/** Output file for a URL path, kept inside outDir. */
function target(outDir: string, path: string, file: string): string {
  const root = resolve(outDir);
  const decoded = decodeURIComponent(path);
  const out = resolve(root, "." + decoded, file);
  if (out !== root && !out.startsWith(root + sep)) throw new Error(`Prerender path escapes outDir: ${path}`);
  return out;
}
async function write(path: string, body: string | Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
}

/**
 * Prerender every eligible route. Non-prerenderable routes with server modules are errors, and so are two
 * pages whose paths differ only in letter case (checked before the second one is written).
 */
export async function prerender(options: PrerenderOptions): Promise<PrerenderReport> {
  const { handler, routes, outDir, trailingSlash = "ignore" } = options;
  const origin = options.origin ?? PLACEHOLDER;
  // Directive mistakes throw before any page is rendered.
  if (options.csp) hashCSP("<head><script></script>", options.csp);
  const base = normalizeBase(options.base);
  // Output paths: the URL path below the base.
  const local = (path: string) => (base && (path === base || path.startsWith(base + "/")) ? path.slice(base.length) || "/" : path);
  // Some prerendered page resumes (boundaries script): client navigation may run, so pages get `_data.json` files.
  let resumes = false;
  const html = async (response: Response, url: string): Promise<string> => {
    const text = await response.text();
    const states = text.match(STATE);
    if (states) resumes = true;
    if (options.prune) for (const [, , src] of text.matchAll(SCRIPT_URL)) scripts.add(src!);
    const held = origin === PLACEHOLDER ? states?.find(placeholder) : undefined;
    if (held) throw new Error(ambiguous(url, "resume state", held));
    return options.csp === false ? text : hashCSP(text, options.csp);
  };
  const report: PrerenderReport = { pages: [], fallback: [], resumes: false };
  // Script URLs the pages reference (`prune`).
  const scripts = new Set<string>();
  const done = new Set<string>();
  // Prerendered page paths (their `_data.json` files are written after every page rendered).
  const written: string[] = [];
  // Output paths folded to lower case → the page that took it.
  const files = new Map<string, string>();
  const render = async (path: string, data: boolean): Promise<Response> => {
    const url = new URL(path, origin);
    if (data) url.searchParams.set(DATA_PARAM, "data");
    return handler(new Request(url, { headers: { accept: data ? "application/json" : "text/html" } }));
  };
  for (const route of routes) {
    if (!route.page) continue;
    const module = await loadServer(route.server);
    const dynamic = /[:*]/.test(route.pattern);
    const enabled = module?.prerender ?? (!dynamic || module?.entries !== undefined);
    if (!enabled) {
      // Layout loaders/guards run per request too: the CSR shell would skip them.
      const layouts = await Promise.all(route.layouts.map(loadServer));
      if ([module, ...layouts].some((m) => m?.load || m?.guard))
        throw new Error(
          `Route ${route.id} needs a server (a load(…) / guard(…) export on it or a layout, without prerender); use the node adapter or add an entries(…) export`,
        );
      if (!report.fallback.includes(route.id)) report.fallback.push(route.id);
      continue;
    }
    const sets = dynamic ? [...((await module?.entries?.()) ?? [])] : [{}];
    for (const params of sets) {
      const path = fillPattern(route.pattern, params);
      if (done.has(path)) continue;
      done.add(path);
      // One file on case-insensitive file systems (macOS, Windows) and hosts: the later page would overwrite the earlier.
      const folded = decodeURIComponent(local(path)).toLowerCase();
      const clash = files.get(folded);
      if (clash !== undefined)
        throw new Error(`Prerender paths ${clash} and ${path} (${route.id}) differ only in letter case: one output file on case-insensitive file systems`);
      files.set(folded, path);
      // The canonical URL (`trailingSlash`): the other form would answer 308.
      const url = slashPath(path, trailingSlash);
      const page = await render(url, false);
      if (page.status !== 200) throw new Error(`Prerender ${url} (${route.id}) returned ${page.status}`);
      const at = local(path);
      await write(trailingSlash === "never" && at !== "/" ? target(outDir, at + ".html", "") : target(outDir, at, "index.html"), await html(page, url));
      report.pages.push(url);
      written.push(path);
    }
  }
  const missing = await render(base + "/__rivet_not_found__", false);
  if (missing.status === 404) await write(join(resolve(outDir), "404.html"), await html(missing, "404.html"));
  // `_data.json` serves client navigation only: none when no page resumes (zero-JS sites: links load documents)
  // and no CSR shell route navigates. (Per page they stay: any resumed page's router may navigate to any route.)
  if (resumes || report.fallback.length)
    for (const path of written) {
      const url = slashPath(path, trailingSlash);
      const data = await render(url, true);
      const body = new Uint8Array(await data.arrayBuffer());
      const text = origin === PLACEHOLDER ? new TextDecoder().decode(body) : "";
      if (placeholder(text)) throw new Error(ambiguous(url, "_data.json", text));
      await write(target(outDir, local(path), "_data.json"), body);
    }
  report.resumes = resumes;
  if (options.prune && !resumes && !report.fallback.length) {
    const pruned = await prune(outDir, base, scripts);
    if (pruned.length) report.pruned = pruned;
  }
  if (report.fallback.length) {
    if (!options.shell) throw new Error(`Routes ${report.fallback.join(", ")} need a CSR shell (options.shell)`);
    await write(join(resolve(outDir), "200.html"), await options.shell());
  }
  if (options.dictionary !== false) {
    const written = writeDictionaries(resolve(outDir), { ...options.dictionary, ...(base ? { base } : {}) });
    if (written.dictionaries.length) report.dictionaries = written.dictionaries;
  }
  return report;
}

/**
 * Prerender a production build (`vite build` + `vite build --ssr`, router `mode: "static"`) into its
 * client directory, so `<dist>/client` is the deployable site.
 */
export async function prerenderBuild(
  options: {
    dist?: string;
    origin?: string;
    shell?: PrerenderOptions["shell"];
    csp?: PrerenderOptions["csp"];
    /** Preload planner (`AppConfig.preload`): `lean` pages (nothing before an interaction). */
    preload?: AppConfig["preload"];
    /** i18n: per-locale client builds (see `loadBuild`). */
    locales?: readonly string[];
    /** `PrerenderOptions.prune` (default true): a zero-JS site keeps no unreferenced scripts. */
    prune?: boolean;
    /** `PrerenderOptions.dictionary` (default on): compression dictionaries of the prerendered pages. */
    dictionary?: PrerenderOptions["dictionary"];
  } = {},
): Promise<PrerenderReport> {
  const { loadBuild } = await import("./build.ts");
  const { entry, handler, client } = await loadBuild(
    options.dist ?? "dist",
    options.preload ? { preload: options.preload } : {},
    options.locales ? { locales: options.locales } : {},
  );
  return prerender({
    handler,
    routes: entry.routes,
    outDir: client,
    ...(entry.base ? { base: entry.base } : {}),
    ...(entry.trailingSlash ? { trailingSlash: entry.trailingSlash } : {}),
    ...(options.origin ? { origin: options.origin } : {}),
    ...(options.shell ? { shell: options.shell } : {}),
    ...(options.csp !== undefined ? { csp: options.csp } : {}),
    prune: options.prune ?? true,
    ...(options.dictionary !== undefined ? { dictionary: options.dictionary } : {}),
  });
}
