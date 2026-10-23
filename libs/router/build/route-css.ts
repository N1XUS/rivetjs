// Per-route stylesheets: the CSS a route's layouts and page can render (their chunks' static
// import closure), outer → inner, so SSR links exactly the route's CSS in the head.
import { createHash } from "node:crypto";
import { brotliCompressSync, constants } from "node:zlib";
import type { InlineStyleManifest } from "../server/inline-styles.ts";
import { resolve } from "node:path";
import type { Rollup, ViteDevServer } from "vite";
import type { RouteTable } from "./routes.ts";

/** Client build asset: route id → stylesheet URLs (written only when some route has CSS). */
export const ROUTE_CSS = ".vite/rivet-route-css.json";

const routeFiles = (table: RouteTable, routesDir: string, id: string): string[] => {
  const route = table.routes.find((r) => r.id === id);
  if (!route?.page) return [];
  return [...route.layouts.flatMap((l) => (l.page ? [l.page] : [])), route.page].map((file) => resolve(routesDir, file));
};

/**
 * Stylesheet URLs per route id from a client bundle (empty when no route module imports CSS). `appEntries`: the module
 * ids of the app's own build inputs (router `styles`, `build.rollupOptions.input`): their CSS is global. Every other
 * entry is the compiler's (derived boundary modules, a route page among them, and the runtime): its CSS stays per route.
 */
export function bundleRouteCSS(
  bundle: Rollup.OutputBundle,
  table: RouteTable,
  routesDir: string,
  base: string,
  appEntries: ReadonlySet<string>,
): Record<string, string[]> {
  const chunks = Object.values(bundle).filter((o): o is Rollup.OutputChunk => o.type === "chunk");
  const byFile = new Map(chunks.map((c) => [c.fileName, c]));
  const owner = new Map<string, Rollup.OutputChunk>();
  for (const chunk of chunks) for (const id of chunk.moduleIds) owner.set(id.split("?")[0]!, chunk);
  // App entry CSS (router `styles`) is linked on every page already. Boundary modules are entries too (the compiler
  // emits one per derived boundary module, e.g. `src/routes/index.tsx`) but their CSS is a page's or a component's.
  const global = new Set(
    chunks.filter((c) => c.isEntry && c.facadeModuleId !== null && appEntries.has(c.facadeModuleId)).flatMap((c) => [...(c.viteMetadata?.importedCss ?? [])]),
  );
  const out: Record<string, string[]> = {};
  for (const id of new Set(table.routes.map((r) => r.id))) {
    const css: string[] = [];
    const seen = new Set<string>();
    // Post-order: a chunk's static imports' CSS precedes its own.
    const visit = (chunk: Rollup.OutputChunk) => {
      if (seen.has(chunk.fileName)) return;
      seen.add(chunk.fileName);
      for (const file of chunk.imports) {
        const imported = byFile.get(file);
        if (imported) visit(imported);
      }
      for (const file of chunk.viteMetadata?.importedCss ?? []) if (!global.has(file) && !css.includes(base + file)) css.push(base + file);
    };
    for (const file of routeFiles(table, routesDir, id)) {
      const chunk = owner.get(file);
      if (chunk) visit(chunk);
    }
    if (css.length) out[id] = css;
  }
  return out;
}

/**
 * One stylesheet per route: a route whose modules import several stylesheets (per-component CSS, `@rivetjs/ui`)
 * links them as one merged asset (`assets/route-<hash>.css`, the files joined in link order; routes with the same
 * list share it), so a page has one render-blocking route sheet next to the global styles. Lists of one file stay.
 * Returns the merged assets to emit and the route map pointing at them. `prefix` names the asset (docs-kit example
 * frames: `frame`).
 */
export function mergeRouteCSS(
  bundle: Rollup.OutputBundle,
  css: Record<string, string[]>,
  base: string,
  prefix = "route",
): { routes: Record<string, string[]>; assets: { fileName: string; source: string }[] } {
  const assets = new Map<string, string>();
  const routes: Record<string, string[]> = {};
  for (const [id, list] of Object.entries(css)) {
    const sources = list.map((href) => bundle[href.slice(base.length)]);
    if (list.length < 2 || sources.some((asset) => asset?.type !== "asset")) {
      routes[id] = list;
      continue;
    }
    const source = dedupeTopLevel(sources.map((asset) => unmarked(String((asset as Rollup.OutputAsset).source))).join("\n"));
    const fileName = `assets/${prefix}-${createHash("sha256").update(source).digest("base64url").slice(0, 8)}.css`;
    assets.set(fileName, source + "\n");
    routes[id] = [base + fileName];
  }
  return { routes, assets: [...assets].map(([fileName, source]) => ({ fileName, source })) };
}

// Vite's CSS chunk marker (`/*$vite$:1*/`): still in the bundle's CSS assets during `generateBundle` (Vite drops it when
// it writes its own assets, not from sources copied elsewhere).
const unmarked = (css: string): string => css.replace(/\/\*\$vite\$:\d+\*\/\n?/g, "").trim();

/** Client build asset: the stylesheets the handler may write inline (`InlineStyleManifest`; written only when some are). */
export const INLINE_CSS = ".vite/rivet-inline-css.json";

/**
 * `rivetRouter({ inlineStylesheets })` (Astro's `build.inlineStylesheets` model, decided per page on compressed bytes):
 * `"auto"` (default) / `{ maxTotalBrotli }`, `"always"`, `"never"`.
 */
export type InlineStylesheets = "auto" | "always" | "never" | { readonly maxTotalBrotli?: number };
/** `auto`: all of a page's sheets inline when their brotli sizes add up to at most this. */
export const MAX_TOTAL_BROTLI = 6144;

// A `url()` / `@import` the document would resolve against its own URL instead of the sheet's: `./` / `../` / bare
// paths (Vite writes base-absolute URLs unless `base` is relative). Site-absolute, scheme, protocol-relative, `data:`
// and fragment-only references resolve the same from both.
const RELATIVE_REFERENCE = /(?:url\(\s*|@import\s+)(["']?)(?![a-z][\w+.-]*:|\/|#|["')\s])/i;

/**
 * The inline stylesheet manifest (`.vite/rivet-inline-css.json`, `server/inline-styles.ts` decides per page), or
 * `undefined` when no sheet qualifies (`"never"`, nothing listed). Listed: every client CSS asset and merged route sheet
 * (keys = the URLs the handler links, `base` + file name) without relative `url()` / `@import` references (they resolve
 * against the sheet's URL) that could ever go inline — `"always"`: all; `"auto"`: brotli size ≤ `maxTotalBrotli` (the
 * per-page total) or raw size ≤ `limit` (Vite `build.assetsInlineLimit`, the per-sheet fallback). Brotli at quality 11.
 */
export function inlineCSS(
  bundle: Rollup.OutputBundle,
  extra: readonly { fileName: string; source: string }[],
  base: string,
  mode: InlineStylesheets,
  limit: number,
): InlineStyleManifest | undefined {
  if (mode === "never") return undefined;
  const always = mode === "always";
  const maxTotalBrotli = typeof mode === "object" ? (mode.maxTotalBrotli ?? MAX_TOTAL_BROTLI) : MAX_TOTAL_BROTLI;
  const sheets: Record<string, { css: string; bytes: number; br: number }> = {};
  const all = [
    ...Object.values(bundle).flatMap((o) => (o.type === "asset" && o.fileName.endsWith(".css") ? [{ fileName: o.fileName, source: String(o.source) }] : [])),
    ...extra,
  ];
  for (const { fileName, source } of all) {
    const css = unmarked(source);
    if (!css || RELATIVE_REFERENCE.test(css)) continue;
    const bytes = Buffer.byteLength(css);
    const br = brotliCompressSync(css, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: bytes } }).length;
    if (always || br <= maxTotalBrotli || bytes <= limit) sheets[base + fileName] = { css, bytes, br };
  }
  return Object.keys(sheets).length ? { mode: always ? "always" : "auto", maxTotalBrotli, limit, sheets } : undefined;
}

/**
 * Drops repeated top-level `@property` / `@keyframes` blocks and `@layer a, b;` statements that are byte-identical to an
 * earlier one (each per-component stylesheet carries the ones it uses; a repeat changes nothing). Strings and comments
 * are skipped; anything else is kept as is.
 */
export function dedupeTopLevel(css: string): string {
  const seen = new Set<string>();
  let out = "";
  let depth = 0;
  for (let i = 0; i < css.length;) {
    const ch = css[i]!;
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== ch) j += css[j] === "\\" ? 2 : 1;
      out += css.slice(i, j + 1);
      i = j + 1;
    } else if (ch === "/" && css[i + 1] === "*") {
      const j = css.indexOf("*/", i + 2);
      const end = j < 0 ? css.length : j + 2;
      out += css.slice(i, end);
      i = end;
    } else if (depth === 0 && ch === "@" && /^@(property|keyframes|-webkit-keyframes|layer)\b/.test(css.slice(i, i + 20))) {
      const end = blockEnd(css, i);
      const block = css.slice(i, end);
      const isStatement = block.endsWith(";");
      if (!(/^@layer/.test(block) && !isStatement) && seen.has(block)) {
        i = end;
        continue;
      }
      if (!/^@layer/.test(block) || isStatement) seen.add(block);
      if (/^@layer/.test(block) && !isStatement) {
        // A layer block: keep its head, scan its body (nested rules are not deduplicated).
        out += ch;
        i++;
        continue;
      }
      out += block;
      i = end;
    } else {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      out += ch;
      i++;
    }
  }
  return out;
}

/** End (exclusive) of the at-rule starting at `at`: after its `;` (statement) or its balanced `{…}` block. */
function blockEnd(css: string, at: number): number {
  let depth = 0;
  for (let i = at; i < css.length; i++) {
    const ch = css[i];
    if (ch === '"' || ch === "'") {
      for (i++; i < css.length && css[i] !== ch; i += css[i] === "\\" ? 2 : 1);
    } else if (ch === ";" && depth === 0) return i + 1;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return i + 1;
  }
  return css.length;
}

const CSS_REQUEST = /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/;
const NOT_LINKED = /[?&](?:inline|url|raw)\b/;

/**
 * Dev: stylesheets in the SSR module graph of a route's modules (loaded first), as `?direct` links
 * (no flash before the client graph injects its `<style>`s; `entry.dev.tsx` then removes them).
 */
export async function devRouteCSS(server: ViteDevServer, table: RouteTable, routesDir: string, id: string, exclude: ReadonlySet<string>): Promise<string[]> {
  const environment = server.environments.ssr;
  const css: string[] = [];
  const seen = new Set<string>();
  const visit = (node: { id: string | null; url: string; importedModules: Set<any> } | undefined) => {
    if (!node?.id || seen.has(node.id)) return;
    seen.add(node.id);
    for (const imported of node.importedModules) visit(imported);
    if (CSS_REQUEST.test(node.url) && !NOT_LINKED.test(node.url) && !exclude.has(node.url.split("?")[0]!)) {
      const href = node.url + (node.url.includes("?") ? "&" : "?") + "direct";
      if (!css.includes(href)) css.push(href);
    }
  };
  for (const file of routeFiles(table, routesDir, id)) {
    await server.ssrLoadModule(file);
    visit(environment.moduleGraph.getModuleById(file));
  }
  return css;
}
