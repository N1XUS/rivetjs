// Vite plugin: scan routes, write `.rivet/` codegen, compile it with the Rivet plugin (resume mode
// for server/static apps), default the build inputs, and serve requests in dev.
import { lstat, mkdir, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Plugin, ResolvedConfig, Rollup, ViteDevServer } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  rivet,
  _factsResolve,
  declaredServerOnly,
  isServerOnly,
  serverOnlyStub,
  type ServerOnlyPattern,
  type DevResume,
  type ImagesConfig,
  type RivetCSSOptions,
  type RivetOptions,
  type RivetResumeOptions,
} from "@rivetjs/compiler/vite";
import { updateEditorManifest } from "@rivetjs/compiler/editor";
import { scanRoutes, _serverExportsOf, type RouteTable } from "./routes.ts";
import { generate, type CodegenOptions } from "./codegen.ts";
import { normalizeBase } from "../shared/base.ts";
import { slashPath, type TrailingSlash } from "../shared/slash.ts";
import { DATA_PARAM } from "../shared/data.ts";
import { compileRules, type RouteRules } from "../server/route-cache.ts";
import type { DocumentPrefetch, PrefetchEagerness } from "../shared/prefetch.ts";
export type { InlineStylesheets } from "./route-css.ts";
/** Build-time helper for other Vite plugins (docs-kit example frames): one merged sheet per stylesheet list. */
export { mergeRouteCSS } from "./route-css.ts";
import { bundleRouteCSS, devRouteCSS, INLINE_CSS, inlineCSS, mergeRouteCSS, ROUTE_CSS, type InlineStylesheets } from "./route-css.ts";
import { devHandler, devReport, listenClientErrors } from "./dev-errors.ts";
import { unexportHead } from "./head-strip.ts";
import { analyzeReach, serverOnlyOption, RV_REACH, type Reach, type ReachProblem, type ServerOnlyOption } from "./reach.ts";
import { compileRoutes } from "@rivetjs/runtime/router/server";
import type { createApp as CreateApp, GeneratedEntry } from "../server/app.ts";
import type { DocumentShell } from "../server/render.ts";
import { adapterOptions, targetBuildConfig, targetEntryPlugin, type AdapterName, type AdapterOptions } from "../adapters/target-build.ts";
import { coloadPlugin } from "./coload.ts";

/** The router's own base-path module (its `BASE` reads Vite's `BASE_URL`). */
const BASE_MODULE = fileURLToPath(new URL("../shared/base.ts", import.meta.url));
/** The router's trailing-slash module (its `TRAILING_SLASH` constant is rewritten when the option is set). */
const SLASH_MODULE = fileURLToPath(new URL("../shared/slash.ts", import.meta.url));
/** `TRAILING_SLASH`'s declaration in the source (`.ts`, with its type cast) and in the published `.js` (cast stripped). */
const SLASH_DEFAULT = /export const TRAILING_SLASH = "ignore"(?: as TrailingSlash)?;/;
/** The shell cache loader (`SHELL_BUILD`, rewritten to an `import()` when a route rule has `shell`). */
const SHELL_MODULE = fileURLToPath(new URL("../server/shell-build.ts", import.meta.url));
/** `SHELL_BUILD`'s declaration in the source (`.ts`, with its type cast) and in the published `.js` (cast stripped). */
const SHELL_DEFAULT = /export const SHELL_BUILD = undefined(?: as [^;]+)?;/;
/** The shell cache module the rewritten loader imports (by file path: also what keeps it in the published package). */
const SHELL_CACHE = fileURLToPath(new URL("../server/shell-cache.ts", import.meta.url));

/** Options of the `rivetRouter()` Vite plugin. */
export interface RivetRouterOptions {
  /** Routes directory, root-relative (default `src/routes`). */
  routes?: string;
  /**
   * URL base path the app is served under (`/app`); sets Vite's `base`. Default: Vite's `base`.
   * Route patterns, `<Link to>`, `navigate()`, data requests, prefetch and the adapters follow it.
   */
  base?: string;
  /**
   * Trailing-slash policy. `"ignore"` (default): `/a` and `/a/` serve the same page as requested.
   * `"never"` / `"always"`: one canonical form — page GET/HEAD requests for the other answer 308,
   * `<Link>` / `navigate()` write hrefs in it, the static adapter writes `a.html` (`never`) or
   * `a/index.html`. `/` itself never changes; endpoints and other methods are never redirected.
   */
  trailingSlash?: TrailingSlash;
  /**
   * Route rules by path pattern (`/about`, `/blog/*`, `/docs/**`): `headers`, and `cache` / `swr` / `isr` — rendered pages
   * stored in process (fresh for `maxAge` s, then served stale while one render refreshes them; `isr: true` until
   * `revalidate()`), with ETag / Last-Modified → 304 and `s-maxage` / `stale-while-revalidate` for CDNs. JSON data:
   * the server entry exports it, every adapter applies it (`createApp` / adapter `routeRules` replace it). Dev applies
   * `headers` only. See `@rivetjs/router/route-cache`.
   */
  routeRules?: RouteRules;
  /** Codegen output directory, root-relative (default `.rivet`). */
  outDir?: string;
  /** Root-relative module whose default export is the `DocumentShell` (default `src/document.ts`). */
  document?: string;
  /** Root-relative stylesheets: client build inputs, linked by the document (`styles`). */
  styles?: string[];
  /**
   * Stylesheets written into the page as `<style>` instead of linked (Astro's `build.inlineStylesheets`), production
   * server / static pages, decided per page. `"auto"` (default): all of the page's sheets (global + route) when their
   * brotli sizes add up to at most 6 KB (the page then has no render-blocking stylesheet request), else each sheet of
   * at most Vite's `build.assetsInlineLimit` (4096 raw bytes; a function limit counts as 4096). `{ maxTotalBrotli }`:
   * `auto` with another total (bytes). `"always"`: every sheet; `"never"`: all linked. Sheets with relative `url()` /
   * `@import` references stay linked. Inline styles carry the page's CSP nonce (static pages: hashed into a
   * `style-src` you set).
   */
  inlineStylesheets?: InlineStylesheets;
  /** `server` (default) and `static` resume server-rendered pages; `csr` mounts a single-page app. */
  mode?: NonNullable<CodegenOptions["mode"]>;
  /** Resume options; generated route modules are added to `modules`. */
  resume?: Partial<RivetResumeOptions>;
  /** `?image` / `?jsx` imports (`rivet({ images })`); build with the app builder so server-only images reach the client output. */
  images?: ImagesConfig | true;
  /** DevTools on the dev server when `@rivetjs/devtools` is installed (default true; see `rivet()`). */
  devtools?: boolean;
  /**
   * Framework bridges (`rivet({ bridges })`: `react()` from `@rivetjs/bridge-react/vite`, `preact()` from
   * `@rivetjs/bridge-preact/vite`, …): those frameworks' components render as islands inside the routed pages.
   * Server / static modes only.
   */
  bridges?: RivetOptions["bridges"];
  /**
   * Component head (`@rivetjs/kit` `<Title>`, `<Meta>`, …): `components` holds each page's document
   * start until its shell rendered; on by default when the kit Vite plugin (`kit()`) is installed.
   * `early` keeps route `head` exports only (document start written first).
   */
  head?: "components" | "early";
  /** Scoped styles options passed to `rivet({ css })`. */
  css?: RivetCSSOptions;
  /** Compile-time `<Icon>` from `@rivetjs/kit/icon` (`rivet({ staticIcons })`, default true); `false` keeps every component call. */
  staticIcons?: boolean;
  /**
   * Build-time evaluation (`rivet({ comptime })`, default on in builds): constant calls of allowlisted / `@comptime`
   * functions become their results; tailwind-variants definitions become proven lookup tables. `false` keeps every call.
   */
  comptime?: RivetOptions["comptime"];
  /**
   * Locales the app serves (`rivet({ locales })`; default: the `i18n()` plugin's `locales`, else none). Declared, the
   * browser build ships cdk locale strings of these languages only (+ `en-US`); another language loads the full table on
   * its first lookup and may show `en-US` strings until then. Undeclared: every table ships whole.
   */
  locales?: RivetOptions["locales"];
  /**
   * Route transitions (View Transitions) + pending UI. Off by default; `true` = defaults. The
   * transitions module loads on the first navigation intent.
   */
  transitions?: CodegenOptions["transitions"];
  /** Route announcer for screen readers after client navigation (default true; `false` opts out). */
  announce?: boolean;
  /**
   * The app reads search params (`useSearchParams()` / `SearchParams`): the server provides the
   * request's, the resume entry the browser's. Default: detected from the project's sources
   * (`routerUsage`); set `true` when only a published dependency reads them.
   */
  searchParams?: boolean;
  /** The app calls `navigate()` / `invalidate()` / `revalidate()` / `setSearchParams()`. Default: detected (`routerUsage`). */
  navigate?: boolean;
  /**
   * The app uses `@rivetjs/forms` (directly or through `@rivetjs/ui` `Form`): enhanced submits reach the router
   * through `Symbol.for("rivet.router")` (implies `navigate`). Default: detected (`routerUsage`).
   */
  forms?: boolean;
  /** The app reads `useParams()`. Default: detected (`routerUsage`). */
  params?: boolean;
  /** The app renders `<Link active>`: active links are re-marked after client navigation. Default: detected (`routerUsage`). */
  activeLinks?: boolean;
  /**
   * Document prefetch for navigations that load a document (`@rivetjs/router/prefetch`): every page's
   * head gets Speculation Rules (Chromium) + a ~1 kB inline intent fallback. `"document"` / `"prerender"`:
   * also the default for every same-origin link without its own `prefetch` / `data-rivet-prefetch`
   * (plain `<a>` included; `"none"` opts one out). `true`: only links marked `prefetch="document"` /
   * `"prerender"`. Default: detected (`routerUsage`: such a mark in the sources); `false`: off.
   * Server / static modes (ignored in `csr`).
   */
  prefetch?: boolean | DocumentPrefetch;
  /**
   * When Chromium starts a document prefetch / prerender (Speculation Rules `eagerness`):
   * `"conservative"` (pointer / touch down), `"moderate"` (default: also a ~200 ms hover), `"eager"`
   * (sooner). Applies only while `prefetch` is on; the fallback keeps its 65 ms / focus / down timing.
   */
  prefetchEagerness?: PrefetchEagerness;
  /**
   * Which links of a client-routed app take part in document prefetch. Default `true`: `data-rivet-reload` /
   * `rel=external` links and links whose path no route matches (every page carries the route-path RegExp, in the
   * Speculation Rules and in the fallback call). `false`: only `data-rivet-reload` / `rel=external` links — for apps
   * whose document links all carry `reload` (the docs sites: −7.7 KB of route patterns per page).
   */
  prefetchPaths?: boolean;
  /**
   * Client-side navigation on pages with nothing else to resume (opt-in, Astro's `<ClientRouter />` model).
   * `true`: every page ships the router (link clicks / intent prefetch / back-forward served in place).
   * `false` (default): the router's listeners alone do not make a page resumable — a page without resumable
   * symbols, client effects or forms ships zero JS (no loader, state script or modulepreloads) and its
   * links load documents; pages that resume anyway still route in place. Ignored in `csr` (always routed).
   */
  clientRouter?: boolean;
  /**
   * Deploy target besides node (name or options object): `vite build --ssr` also emits the target's
   * entry (client manifests inlined, dependencies bundled). `"fetch"`: `dist/server/fetch.js`
   * (`export default { fetch }`, any web-standard runtime). Platforms, packaged after the server build:
   * `"vercel"` (`.vercel/output`, Build Output API v3), `"netlify"` (`.netlify/v1` + `dist/netlify`),
   * `"cloudflare"` (`dist/cloudflare`, Workers + static assets), `"bun"` (`dist/server/bun.js`),
   * `"deno"` (`dist/server/deno.js`).
   */
  adapter?: AdapterName | AdapterOptions;
  /**
   * Dev server. `resume` (default true): pages resume like production (recorder state, inline loader,
   * symbol chunks served by Vite); the first hot update switches the page to client rendering, after
   * which components hot-replace in place. `false`: pages client-render over the server HTML (the
   * recorder still runs, so serialization errors still reach the overlay).
   */
  dev?: { resume?: boolean };
  /**
   * Server-only modules besides `*.server.*` files and modules importing `@rivetjs/router/server-only`: module ids /
   * specifiers or RegExps (virtual modules serving server data, e.g. `"virtual:docs/api"`; plugins declare theirs as
   * `api.rivetServerOnly`, `rivet({ serverOnly })` too). Before each build / dev start the router walks every route's
   * browser graph: a page route reaching one through its own module and plain helper modules is a document route (links
   * load its document, its module leaves the client build); a component module, layout or error page reaching one fails
   * the build (RV3011, with the import chain and the routes). `{ modules, reach: "warn" }`: components reaching one only
   * warn, and the pages rendering them become document routes. Server / static modes (csr keeps the import error).
   */
  serverOnly?: ServerOnlyOption;
}

const posix = (path: string) => path.split(sep).join("/");
const EMPTY = "\0rivet-router-empty";
/** Client build: a document route's page module as `.rivet/app.tsx` imports it (no browser code for the page). */
const DOCUMENT_PAGE = "\0rivet-document-page:";
/** Browser stand-in of a server-only module imported only from document routes' graphs (`serverOnlyStub`). */
const STAND_IN = "\0rivet-server-only:";
/** The file behind a module id (virtual compiler parts `\0rivet-resume-part:/abs/file.tsx?…` included), no query. */
const fileOf = (id: string): string => (id.startsWith("\0") ? id.slice(id.indexOf(":") + 1) : id).split("?")[0]!;

/** Write generated files whose contents changed; returns whether anything changed. */
async function sync(dir: string, files: Readonly<Record<string, string>>): Promise<boolean> {
  await mkdir(dir, { recursive: true });
  let changed = false;
  for (const [name, contents] of Object.entries(files)) {
    const path = join(dir, name);
    const current = await readFile(path, "utf8").catch(() => null);
    if (current === contents) continue;
    await writeFile(path, contents);
    changed = true;
  }
  return changed;
}

const SOURCE = /\.[cm]?[jt]sx?$/;
/** Router features generated code provides only when the app uses them (`routerUsage`). */
export interface RouterUsage {
  /** `useSearchParams` / `SearchParams`. */
  searchParams: boolean;
  /** `navigate` / `invalidate` / `revalidate` / `setSearchParams`, or forms (below). */
  navigate: boolean;
  /** `@rivetjs/forms`, or `Form` in a file importing `@rivetjs/ui` (its `Form` is built on forms). */
  forms: boolean;
  /** `useParams`. */
  params: boolean;
  /** `<Link active>` (an `active` attribute on a `<Link>`). */
  activeLinks: boolean;
  /** `prefetch="document"` / `"prerender"` (`<Link>` prop or `data-rivet-prefetch` attribute). */
  prefetch: boolean;
}
const FEATURES: readonly (readonly [keyof RouterUsage, RegExp])[] = [
  ["searchParams", /\b(?:useSearchParams|SearchParams)\b/],
  ["navigate", /\b(?:navigate|invalidate|revalidate|setSearchParams)\b/],
  ["params", /\buseParams\b/],
  ["activeLinks", /<Link\b[^>]*?\sactive\b/],
  ["prefetch", /\bprefetch\s*=\s*\{?\s*["'](?:document|prerender)["']/],
];
/** Every `RouterUsage` flag (FEATURES + `forms`). */
const USAGE: readonly (keyof RouterUsage)[] = [...FEATURES.map(([name]) => name), "forms"];
const none = (): RouterUsage => ({ searchParams: false, navigate: false, forms: false, params: false, activeLinks: false, prefetch: false });
/** Features one source text uses: names in a file importing `@rivetjs/router` (`URLSearchParams` does not count). */
function featuresOf(text: string, into: RouterUsage): void {
  // Forms (enhanced submits follow redirects / revalidate through the router): `@rivetjs/forms`, or ui's `Form`.
  if (text.includes("@rivetjs/forms") || (text.includes("@rivetjs/ui") && /\bForm\b/.test(text))) into.forms = into.navigate = true;
  if (!text.includes("@rivetjs/router")) return;
  for (const [name, pattern] of FEATURES) if (pattern.test(text)) into[name] = true;
}
/** Never sources: dot entries (`.rivet`, `.git`), `node_modules`, build output (`dist`, `dist-<lane>`, `dist.x`). */
const OUTPUT = /^(?:\.|node_modules$|dist(?:$|[-_.]))/;
async function scan(dir: string, into: RouterUsage, seen: Set<string>): Promise<void> {
  if (seen.has(dir)) return;
  seen.add(dir);
  // Concurrent builds may create or remove files mid-walk: a vanished entry is skipped (ENOENT).
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!OUTPUT.test(entry.name)) await scan(path, into, seen);
    } else if (!entry.name.startsWith(".") && SOURCE.test(entry.name)) {
      const text = await readFile(path, "utf8").catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT" || error.code === "EISDIR") return "";
        throw error;
      });
      featuresOf(text, into);
    }
  }
}
/**
 * Which router features the project's sources use: every source under `root` (skipping
 * `node_modules`, `dist` and dot directories) plus the sources of linked (workspace / `npm link`)
 * dependencies of `root/package.json`, except `@rivetjs/*` packages. Text based: a name that appears
 * in a file importing `@rivetjs/router` counts (false positives only cost bytes); published
 * dependencies are not scanned (set `rivetRouter({ navigate, params, searchParams })`).
 */
export async function routerUsage(root: string, options: { exclude?: readonly string[] } = {}): Promise<RouterUsage> {
  const usage = none(),
    // `exclude`: absolute directories never walked (the Vite build `outDir`, the generated `.rivet/`).
    seen = new Set<string>((options.exclude ?? []).map((dir) => resolve(root, dir)).filter((dir) => dir !== resolve(root)));
  await scan(root, usage, seen);
  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8").catch(() => "{}")) as Record<string, Record<string, string> | undefined>;
  for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
    if (name.startsWith("@rivetjs/")) continue;
    for (let dir = root; ; dir = dirname(dir)) {
      const path = join(dir, "node_modules", name);
      const link = await lstat(path).catch(() => null);
      if (link?.isSymbolicLink()) await scan(await realpath(path), usage, seen);
      if (link || dir === dirname(dir)) break;
    }
  }
  return usage;
}

/** Regenerate `.rivet/` for a project root; returns the resume modules and whether files changed. */
export async function generateRoutes(
  root: string,
  options: Pick<
    RivetRouterOptions,
    | "routes"
    | "outDir"
    | "document"
    | "mode"
    | "transitions"
    | "announce"
    | "base"
    | "searchParams"
    | "navigate"
    | "forms"
    | "params"
    | "activeLinks"
    | "trailingSlash"
    | "prefetch"
    | "prefetchEagerness"
    | "prefetchPaths"
    | "routeRules"
    | "clientRouter"
  > & { head?: "components" | undefined; documents?: readonly string[] } = {},
) {
  const routesDir = posix(options.routes ?? "src/routes");
  const outDir = posix(options.outDir ?? ".rivet");
  const table = await scanRoutes(resolve(root, routesDir));
  const generated = generate(table, {
    routesDir,
    outDir,
    document: posix(options.document ?? "src/document.ts"),
    mode: options.mode ?? "server",
    ...(options.head ? { head: options.head } : {}),
    ...(options.transitions ? { transitions: options.transitions } : {}),
    ...(options.announce === false ? { announce: false } : {}),
    ...(options.base ? { base: options.base } : {}),
    ...(options.searchParams ? { searchParams: true } : {}),
    ...(options.navigate ? { navigate: true } : {}),
    ...(options.forms ? { forms: true } : {}),
    ...(options.params ? { params: true } : {}),
    ...(options.activeLinks ? { activeLinks: true } : {}),
    ...(options.prefetch ? { prefetch: options.prefetch } : {}),
    ...(options.prefetchEagerness ? { prefetchEagerness: options.prefetchEagerness } : {}),
    ...(options.prefetchPaths === false ? { prefetchPaths: false } : {}),
    ...(options.trailingSlash && options.trailingSlash !== "ignore" ? { trailingSlash: options.trailingSlash } : {}),
    ...(options.routeRules && Object.keys(options.routeRules).length ? { routeRules: options.routeRules } : {}),
    ...(options.clientRouter !== undefined ? { clientRouter: options.clientRouter } : {}),
    ...(options.documents?.length ? { documents: options.documents } : {}),
  });
  const changed = await sync(resolve(root, outDir), generated.files);
  // Editors: route ids/patterns/files for links (go to route, unknown-route warnings). Best effort.
  try {
    const routes = table.routes.filter((route) => route.page).map((route) => ({ id: route.id, pattern: route.pattern, file: routesDir + "/" + route.page }));
    updateEditorManifest(root, { routesDir, routes });
  } catch {}
  return { table, resumeModules: generated.resumeModules, changed };
}

/** Routes-relative modules that declare server exports (in-file pages/layouts, plain `.ts` endpoints). */
function serverFiles(table: RouteTable): Set<string> {
  const files = new Set<string>();
  for (const route of table.routes)
    for (const module of [route, ...route.layouts]) {
      if (module.inline && module.page) files.add(module.page);
      // Live pages (`export const live = true`) as `live:<page>`: toggling the flag regenerates the App.
      if (module.live && module.page) files.add("live:" + module.page);
      if (module.server && !/\.server\.[cm]?[jt]s$/.test(module.server)) files.add(module.server);
    }
  return files;
}

/** Root-relative page/layout/special modules of a table: compiled with `serverExports`. */
function routeModules(table: RouteTable, routesDir: string): string[] {
  const files = new Set<string>();
  for (const route of table.routes)
    for (const module of [route, ...route.layouts]) {
      if (module.page) files.add(module.page);
      // Plain `.ts` endpoints too (T7): a page importing a constant from one gets its handlers split out.
      if (module.server && !/\.server\.[cm]?[jt]s$/.test(module.server)) files.add(module.server);
    }
  return [...files].map((file) => posix(join(routesDir, file)));
}

/**
 * File routes for Vite: the routing plugin plus the Rivet compiler configured for the generated app.
 * `vite build` builds the browser side into `dist/client`; `vite build --ssr` the server entry into
 * `dist/server` (both overridable through `build`). `vite` serves pages through the same handler.
 * In `csr` mode the client build also writes `index.html` and there is no server build.
 */
const STATIC_DATA = /^([^?#]*\/)_data\.json(?:[?#]|$)/;
/**
 * Dev server, static mode: a `<page>/_data.json` request (the file the static adapter prerenders
 * beside each page, `client/index.ts` `dataURL(url, "static")`) becomes that page's data request,
 * as `adapters/static.ts` `prerender` renders it: the page path in its canonical form, no query.
 */
function staticData(req: IncomingMessage, slash: TrailingSlash): void {
  const hit = STATIC_DATA.exec(req.url ?? "");
  if (!hit || (req.method !== "GET" && req.method !== "HEAD")) return;
  const page = hit[1] === "/" ? "/" : hit[1]!.slice(0, -1);
  req.url = slashPath(page, slash) + "?" + DATA_PARAM + "=data";
  req.headers.accept = "application/json";
}

/** The router's Vite plugins: file routes, typed routes, server code split, data requests and build adapters. */
export function rivetRouter(options: RivetRouterOptions = {}): Plugin[] {
  const routesDir = options.routes ?? "src/routes";
  const outDir = options.outDir ?? ".rivet";
  const styles = options.styles ?? [];
  const mode = options.mode ?? "server";
  const documentPath = options.document ?? "src/document.ts";
  const codegen: NonNullable<Parameters<typeof generateRoutes>[1]> & { documents?: readonly string[] } = {
    routes: routesDir,
    outDir,
    document: documentPath,
    mode,
    transitions: options.transitions,
    announce: options.announce,
    ...(options.trailingSlash ? { trailingSlash: options.trailingSlash } : {}),
    ...(options.prefetchEagerness ? { prefetchEagerness: options.prefetchEagerness } : {}),
    ...(options.prefetchPaths === false ? { prefetchPaths: false } : {}),
    ...(options.routeRules ? { routeRules: options.routeRules } : {}),
    ...(options.clientRouter !== undefined ? { clientRouter: options.clientRouter } : {}),
  };
  if (options.routeRules !== undefined) {
    // Checked at config time (same checks as at server start, except the origin `isr` needs: a server option), and
    // kept to JSON (the server entry inlines it).
    compileRules(options.routeRules, true);
    const json = (value: unknown): boolean =>
      typeof value === "string" ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value)) ||
      (Array.isArray(value)
        ? value.every(json)
        : typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype && Object.values(value).every(json));
    if (!json(options.routeRules)) throw new Error("rivetRouter: routeRules must be JSON data (numbers, strings, booleans; use isr: true for no expiry)");
  }
  if (options.prefetch !== undefined && typeof options.prefetch !== "boolean" && options.prefetch !== "document" && options.prefetch !== "prerender")
    throw new Error(`rivetRouter: prefetch must be a boolean, "document" or "prerender" (got ${JSON.stringify(options.prefetch)})`);
  if (options.prefetchEagerness !== undefined && !["conservative", "moderate", "eager"].includes(options.prefetchEagerness))
    throw new Error(`rivetRouter: prefetchEagerness must be "conservative", "moderate" or "eager" (got ${JSON.stringify(options.prefetchEagerness)})`);
  if (options.prefetchPaths !== undefined && typeof options.prefetchPaths !== "boolean")
    throw new Error(`rivetRouter: prefetchPaths must be a boolean (got ${JSON.stringify(options.prefetchPaths)})`);
  const inlineOption = options.inlineStylesheets;
  if (
    inlineOption !== undefined &&
    !(typeof inlineOption === "string"
      ? ["auto", "always", "never"].includes(inlineOption)
      : typeof inlineOption === "object" &&
        inlineOption !== null &&
        Object.keys(inlineOption).every((key) => key === "maxTotalBrotli") &&
        (inlineOption.maxTotalBrotli === undefined || (Number.isSafeInteger(inlineOption.maxTotalBrotli) && inlineOption.maxTotalBrotli >= 0)))
  )
    throw new Error(`rivetRouter: inlineStylesheets must be "auto", "always", "never" or { maxTotalBrotli: <bytes> } (got ${JSON.stringify(inlineOption)})`);
  const serverOnly = serverOnlyOption(options.serverOnly);
  const slash = options.trailingSlash ?? "ignore";
  const shellBuild = Object.values(options.routeRules ?? {}).some((rule) => Boolean(rule?.shell));
  if (slash !== "ignore" && slash !== "never" && slash !== "always")
    throw new Error(`rivetRouter: trailingSlash must be "ignore", "never" or "always" (got ${JSON.stringify(slash)})`);
  // Filled in `config`, which runs before the compiler plugin reads it in `configResolved`.
  const resume: RivetResumeOptions = {
    ...options.resume,
    modules: [...(options.resume?.modules ?? [])],
    dev: options.dev?.resume !== false,
    // Every app component module a route imports resumes without being listed in `resume.modules`.
    appModules: options.resume?.appModules ?? true,
    // `.rivet/app.tsx`'s default export (`Root`) is an independent root boundary (its props = the route payload as data),
    // like a route module's default export (M2 R5).
    ...(mode !== "csr" ? { roots: [...(options.resume?.roots ?? []), posix(join(outDir, "app.tsx"))] } : {}),
  };
  let root = process.cwd();
  let table: RouteTable = { routes: [] };
  // Server reach (`build/reach.ts`): computed in `configResolved` (before any module compiles), re-run in dev after edits.
  let reach: Reach | null = null,
    reachDirty = false,
    reachRun: Promise<unknown> = Promise.resolve(),
    resolvedConfig: ResolvedConfig | null = null,
    resolver: ReturnType<ResolvedConfig["createResolver"]> | null = null,
    patterns: ServerOnlyPattern[] = [...serverOnly.modules],
    building = false;
  // Document routes' page files (absolute → routes-relative), client builds.
  let documentPages = new Map<string, string>();
  /** Walk the routes' browser graphs; true when the document routes changed (codegen input). */
  const analyze = async (): Promise<boolean> => {
    if (!resolvedConfig || mode === "csr") return false;
    resolver ??= resolvedConfig.createResolver();
    const resolveFor = resolver;
    reach = await analyzeReach({
      root,
      routesDir: resolve(root, routesDir),
      table,
      resolve: (spec, importer) => resolveFor(spec, importer, false, false),
      serverOnly: patterns,
      reach: serverOnly.reach,
      routeModules: new Set(routeModules(table, routesDir).map((file) => resolve(root, file))),
      config: resolvedConfig,
    });
    documentPages = new Map([...reach.documents.keys()].map((page) => [resolve(root, routesDir, page), page]));
    const documents = [...reach.documents.keys()].sort();
    if (documents.join("\0") === (codegen.documents ?? []).join("\0")) return false;
    codegen.documents = documents;
    return true;
  };
  const devtools = options.devtools ?? true;
  const css = options.css ? { css: options.css } : {};
  // Filled in `config` and on route changes: in-file server exports leave the browser build.
  const serverExports = { modules: [] as string[] };
  let inFile = new Set<string>(); // routes-relative files with server exports + `live:<page>` (dev change detection)
  // Dev regenerations run one at a time (two writing `.rivet/` at once race); closing the server
  // waits for the running one and drops queued ones.
  let regenerations: Promise<unknown> = Promise.resolve();
  let closed = false;
  const icons = {
    ...(options.staticIcons === undefined ? {} : { staticIcons: options.staticIcons }),
    ...(options.comptime === undefined ? {} : { comptime: options.comptime }),
    ...(options.locales === undefined ? {} : { locales: options.locales }),
  };
  const compilerOptions = mode === "csr" ? { devtools, serverExports, ...css, ...icons } : { resume, devtools, serverExports, ...css, ...icons };
  const bridges = options.bridges?.length ? options.bridges : undefined;
  if (bridges && mode === "csr") throw new Error("rivetRouter: framework bridges need server or static mode (islands are server-rendered)");
  const plugins =
    options.images || bridges
      ? rivet({ ...compilerOptions, images: options.images, bridges } as RivetOptions & { bridges: NonNullable<RivetOptions["bridges"]> })
      : [rivet(compilerOptions)];
  // With bridges the framework plugins come first: the compiler is the plugin named `vite-plugin-rivet`.
  const compiler = plugins.find((plugin) => plugin.name === "vite-plugin-rivet")!;
  const clientEntry = () => resolve(root, outDir, "entry.client.tsx");
  const adapter = adapterOptions(options.adapter);
  if (adapter && mode === "csr") throw new Error("rivetRouter: CSR apps have no server build (adapter)");
  // i18n client builds: the locale suffix of Vite's base (`/<locale>`), and the app base without it.
  let suffix = "",
    appBase = "";
  // i18n client builds: RegExp source of the app paths this build's locale serves (other locales' URLs load documents).
  let localePaths: string | null = null;
  // i18n dev server: every locale's path pattern (one client for all locales; see the base.ts transform).
  let devLocalePaths: readonly string[] | null = null;
  // Z5: the client build's output (captured before Vite rewrites dynamic imports) and, per importing
  // chunk, the files its static graph already loaded.
  let clientBundle: Rollup.OutputBundle | undefined;
  const loadedBy = new Map<string, Set<string>>();
  const preloadDeps = (file: string, deps: string[], { hostId }: { hostId: string }): string[] => {
    if (!clientBundle) return deps;
    let loaded = loadedBy.get(hostId);
    if (!loaded) {
      loaded = new Set();
      for (const stack = [hostId]; stack.length;) {
        const next = stack.pop()!;
        if (loaded.has(next)) continue;
        loaded.add(next);
        const chunk = clientBundle[next];
        if (chunk?.type === "chunk") stack.push(...chunk.imports);
      }
      loadedBy.set(hostId, loaded);
    }
    const rest = deps.filter((dep) => !loaded.has(dep));
    // Only the imported chunk itself left: `import()` fetches it anyway (a preload list would repeat its URL).
    return rest.length === 1 && rest[0] === file ? [] : rest;
  };
  const router: Plugin = {
    name: "vite-plugin-rivet-router",
    enforce: "pre",
    async config(config, env) {
      root = resolve(config.root ?? process.cwd());
      // `trailingSlash`: the server bundle must carry its own copy of the router (its policy constant
      // is rewritten in this build), even where the package would otherwise be external.
      if (slash !== "ignore") {
        const kept = config.ssr?.noExternal;
        if (kept !== true) (config.ssr ??= {}).noExternal = [...(kept === undefined ? [] : Array.isArray(kept) ? kept : [kept]), "@rivetjs/router"];
      }
      const names = new Set<string>();
      let i18nLocale: string | null = null;
      localePaths = null;
      devLocalePaths = null;
      const scan = (list: unknown): void => {
        if (Array.isArray(list)) list.forEach(scan);
        else if (list && typeof list === "object" && "name" in list) {
          const name = String((list as { name: unknown }).name);
          names.add(name);
          if (name === "vite-plugin-rivet-i18n") {
            const api = (list as { api?: { locale?: string | null; clientPaths?: string | null; devPaths?: readonly string[] | null } }).api;
            i18nLocale = api?.locale ?? null;
            localePaths = api?.clientPaths ?? null;
            if (env.command === "serve") devLocalePaths = api?.devPaths ?? null;
          }
        }
      };
      scan(config.plugins);
      // `@rivetjs/i18n/vite` client builds (one per locale, its config hook runs first) serve a
      // locale's assets under `<base><locale>/`; routes and `BASE` keep the app base.
      suffix = i18nLocale && env.command === "build" && !config.build?.ssr && !env.isSsrBuild ? "/" + i18nLocale : "";
      // One base for assets (Vite) and routes (codegen).
      if (options.base !== undefined) config.base = normalizeBase(options.base) + suffix + "/";
      appBase = normalizeBase(config.base);
      if (suffix && appBase.endsWith(suffix)) appBase = appBase.slice(0, -suffix.length);
      codegen.base = appBase;
      // Kit's plugin (`kit()` from @rivetjs/kit/vite) turns component head on unless `head: "early"`.
      const head = options.head ?? (names.has("vite-plugin-rivet-kit") ? "components" : "early");
      if (head === "components" && mode !== "csr") codegen.head = "components";
      const usage = await routerUsage(root, { exclude: [config.build?.outDir ?? "dist", outDir] });
      for (const name of USAGE) (codegen as Record<keyof RouterUsage, unknown>)[name] = options[name] ?? usage[name];
      const generated = await generateRoutes(root, codegen);
      const { resumeModules } = generated;
      table = generated.table;
      serverExports.modules.splice(0, serverExports.modules.length, ...routeModules(table, routesDir));
      inFile = serverFiles(table);
      const extra = options.resume?.modules ?? [];
      resume.modules.splice(0, resume.modules.length, ...new Set([...resumeModules, ...extra]));
      const ssr = config.build?.ssr;
      const input = config.build?.rollupOptions?.input;
      if (ssr && mode === "csr") throw new Error("rivetRouter: CSR apps have no server build");
      const serverOut = config.build?.outDir ?? "dist/server";
      // Server bundles are minified like the client's (Vite leaves SSR output as is): smaller deploys, faster cold
      // starts. `build.minify` (`vite build --ssr --minify false`) wins, e.g. for readable stack traces.
      const minify = config.build?.minify ?? true;
      if (ssr === true && adapter) {
        const target = targetBuildConfig(adapter, resolve(root, outDir, "entry.server.tsx"), serverOut);
        return { ...target, build: { ...target.build, minify } };
      }
      if (ssr === true) return { build: { ssr: resolve(root, outDir, "entry.server.tsx"), outDir: serverOut, minify } };
      if (ssr) return;
      // Keyed by file name, so stylesheets land flat in `assets/` (`styles-<hash>.css`).
      const stylesInput = Object.fromEntries(
        styles.map((path) => [
          posix(path)
            .split("/")
            .pop()!
            .replace(/\.[^.]+$/, ""),
          resolve(root, path),
        ]),
      );
      // Resumed pages have no application entry, only stylesheets (the compiler emits the derived
      // runtime entry and the boundary chunks itself). CSR apps start from the generated client entry.
      const defaultInput = mode === "csr" ? { app: clientEntry(), ...stylesInput } : styles.length ? stylesInput : { "rivet-empty": EMPTY };
      return {
        // Pages come from the app handler (or the CSR shell), not an index.html fallback.
        appType: config.appType ?? "custom",
        build: {
          outDir: config.build?.outDir ?? "dist/client",
          manifest: config.build?.manifest ?? true,
          // Z5: a dynamic import (route page, lazy component) preloads only what its importer has not
          // loaded statically: the App chunk lists no shared runtime chunks per route (routes-500 −26 KB min).
          ...(config.build?.modulePreload === undefined ? { modulePreload: { resolveDependencies: preloadDeps } } : {}),
          ...(input === undefined ? { rollupOptions: { input: defaultInput } } : {}),
        },
      };
    },
    // Server reach: every route's browser graph, before the first module compiles (codegen marks document routes).
    async configResolved(config) {
      resolvedConfig = config;
      resolver = null;
      building = config.command === "build";
      patterns = [...serverOnly.modules, ...declaredServerOnly(config.plugins)];
      if (mode === "csr") return;
      if (await analyze()) await generateRoutes(root, codegen);
    },
    buildStart() {
      if (!building || !reach) return;
      const client = this.environment?.config?.consumer !== "server";
      // Warnings once (client build); errors fail either build.
      if (client) for (const problem of reach.problems) if (problem.severity === "warning") this.warn(problem.message);
      const errors = reach.problems.filter((problem) => problem.severity === "error");
      if (errors.length)
        this.error({ message: errors.map((problem) => problem.message).join("\n\n"), plugin: "vite-plugin-rivet-router", pluginCode: RV_REACH });
    },
    resolveId(id, importer, resolveOptions) {
      if (id === EMPTY || id.startsWith(DOCUMENT_PAGE) || id.startsWith(STAND_IN)) return id;
      // `x.server.ts` modules hold secrets and server code: never part of a browser graph.
      if (!importer || resolveOptions?.ssr || this.environment?.config?.consumer === "server") return null;
      // The compiler's resume walk resolves every specifier its facts list (type-only imports too): not an import.
      if (_factsResolve(id, importer)) return null;
      const from = fileOf(importer);
      // Client build: the App's import of a document route's page — the browser never renders it (links load its document).
      if (building && documentPages.size && /^\.\.?\//.test(id) && from === resolve(root, outDir, "app.tsx")) {
        const page = documentPages.get(resolve(dirname(from), id.split("?")[0]!));
        if (page) return DOCUMENT_PAGE + page;
      }
      if (isServerOnly(patterns, id)) {
        // Reached only from document routes' graphs (their resumed parts): a stand-in that throws on use, never the module.
        if (reach?.documentOnly.has(from)) return STAND_IN + (reach.targets.get(from + "\0" + id) ?? id);
        this.error({
          message:
            `[rivet:router] ${id} is server-only and cannot be imported by browser code (imported from ${posix(importer)})` +
            "\n  fix: read it in a server export (`load(…)`, `actions(…)`, `onGet(…)`, …) and pass the data to the page; type-only imports (`import type`) are fine" +
            "\n  docs: https://rivetjs.severyn.pro/guides/security/server-only-code",
          id: importer,
          plugin: "vite-plugin-rivet-router",
        });
      }
      return null;
    },
    load(id) {
      if (id === EMPTY) return "export {};\n";
      if (id.startsWith(DOCUMENT_PAGE)) {
        const page = id.slice(DOCUMENT_PAGE.length);
        const message = `[rivet:router] ${posix(join(routesDir, page))} is a document route (its browser graph reaches a server-only module): its links load the document, the browser never renders it`;
        return `export default function DocumentRoute() {\n  throw new Error(${JSON.stringify(message)});\n}\n`;
      }
      if (id.startsWith(STAND_IN)) {
        const key = id.slice(STAND_IN.length);
        const shown = key.startsWith("/") ? posix(relative(root, key)) : key;
        return serverOnlyStub(shown, reach?.chains.get(key) ?? [], reach?.names.get(key) ?? []);
      }
      return null;
    },
    // i18n client build: `BASE` is the app base, not the locale's asset base (`BASE_URL`). Only this
    // build's copy of shared/base.ts changes, so other apps' bundles stay byte-identical.
    // `trailingSlash`: the policy constant (client and server bundles); unset, the module stays as is.
    transform(code, id, transformOptions) {
      if (shellBuild && id.split("?")[0] === SHELL_MODULE) {
        if (!SHELL_DEFAULT.test(code)) this.error("rivetRouter: server/shell-build.ts no longer declares SHELL_BUILD as expected");
        return { code: code.replace(SHELL_DEFAULT, `export const SHELL_BUILD = () => import(${JSON.stringify(SHELL_CACHE)});`), map: null };
      }
      if (slash !== "ignore" && id.split("?")[0] === SLASH_MODULE) {
        if (!SLASH_DEFAULT.test(code)) this.error("rivetRouter: shared/slash.ts no longer declares TRAILING_SLASH as expected");
        return { code: code.replace(SLASH_DEFAULT, (decl) => decl.replace('"ignore"', JSON.stringify(slash))), map: null };
      }
      // i18n dev: one client serves every locale, so `underBase` also requires the target's locale to be
      // the page's (read once at load): another locale's URL loads its document, as in a build.
      if (devLocalePaths && !transformOptions?.ssr && id.split("?")[0] === BASE_MODULE) {
        const decl = "export function underBase(";
        if (!code.includes(decl)) this.error("rivetRouter: shared/base.ts no longer declares underBase as expected");
        return {
          code:
            code.replace(decl, "function _inBase(") +
            `\nconst _LOCALES = ${JSON.stringify(devLocalePaths)}.map((source) => new RegExp(source, "i"));\n` +
            'const _localeOf = (pathname, base) => { const path = base ? pathname.slice(base.length) || "/" : pathname; return _LOCALES.findIndex((re) => re.test(path)); };\n' +
            'const _PAGE = typeof location === "undefined" ? -1 : _localeOf(location.pathname, BASE);\n' +
            "export function underBase(pathname, base = BASE) {\n" +
            "  return _inBase(pathname, base) && (_PAGE < 0 || _localeOf(pathname, base) === _PAGE);\n}\n",
          map: null,
        };
      }
      if (!suffix || id.split("?")[0] !== BASE_MODULE) return null;
      const read = /\(import\.meta(?: as [^)]*)?\)\.env\?\.BASE_URL|import\.meta\.env\?\.BASE_URL/;
      if (!read.test(code)) this.error("rivetRouter: shared/base.ts no longer reads import.meta.env.BASE_URL as expected");
      let out = code.replace(read, JSON.stringify(appBase + "/"));
      // Another locale's URL is another client build (its inlined messages, its chunks): the
      // browser loads its document; the client router and navigate() never switch locale in place.
      if (localePaths) {
        const decl = "export function underBase(";
        if (!out.includes(decl)) this.error("rivetRouter: shared/base.ts no longer declares underBase as expected");
        out =
          out.replace(decl, "function _inBase(") +
          `\nconst _LOCALE = new RegExp(${JSON.stringify(localePaths)}, "i");\n` +
          "export function underBase(pathname, base = BASE) {\n" +
          '  return _inBase(pathname, base) && _LOCALE.test(base ? pathname.slice(base.length) || "/" : pathname);\n}\n';
      }
      return { code: out, map: null };
    },
    async generateBundle(_options, bundle) {
      for (const [name, output] of Object.entries(bundle)) if (output.type === "chunk" && output.facadeModuleId === EMPTY) delete bundle[name];
      if (this.environment?.config?.consumer === "server") return;
      clientBundle = bundle;
      loadedBy.clear();
      if (mode !== "csr") {
        // Route modules' CSS (component stylesheets, css`` sheets), linked per route by the handler.
        // Several stylesheets of one route are merged into one route sheet (`mergeRouteCSS`).
        const base = this.environment?.config?.base ?? "/";
        // The app's own inputs (router `styles` by default): their CSS is global; the compiler's entries are not.
        const input = this.environment?.config?.build.rollupOptions.input ?? [];
        const apps = new Set((typeof input === "string" ? [input] : Array.isArray(input) ? input : Object.values(input)).map((file) => resolve(root, file)));
        const { routes: css, assets } = mergeRouteCSS(bundle, bundleRouteCSS(bundle, table, resolve(root, routesDir), base, apps), base);
        for (const asset of assets) this.emitFile({ type: "asset", ...asset });
        if (Object.keys(css).length) this.emitFile({ type: "asset", fileName: ROUTE_CSS, source: JSON.stringify(css, null, 2) + "\n" });
        // Sheets the handler may write inline (`inlineStylesheets`; decided per page, `server/inline-styles.ts`).
        const limit = this.environment?.config?.build.assetsInlineLimit;
        const inline = inlineCSS(bundle, assets, base, options.inlineStylesheets ?? "auto", typeof limit === "number" ? limit : 4096);
        if (inline) this.emitFile({ type: "asset", fileName: INLINE_CSS, source: JSON.stringify(inline) + "\n" });
        return;
      }
      const base = this.environment?.config?.base ?? "/";
      const entry = Object.values(bundle).find((output) => output.type === "chunk" && output.facadeModuleId === clientEntry());
      if (!entry || entry.type !== "chunk") return;
      const css = new Set<string>(entry.viteMetadata?.importedCss ?? []);
      const sources = new Set(styles.map((path) => posix(path)));
      for (const output of Object.values(bundle))
        if (output.type === "asset" && output.fileName.endsWith(".css") && output.originalFileNames.some((name) => sources.has(posix(name))))
          css.add(output.fileName);
      const { shellHTML } = await import("../adapters/csr.ts");
      const document = await loadDocument(resolve(root, documentPath));
      const source = shellHTML(document, { script: base + entry.fileName, styles: [...css].map((file) => base + file) });
      this.emitFile({ type: "asset", fileName: "index.html", source });
    },
    async closeServer() {
      closed = true;
      await regenerations;
    },
    configureServer(server: ViteDevServer) {
      const routesPath = resolve(root, routesDir);
      const regenerate = async (file: string) => (resolve(file).startsWith(routesPath + sep) ? refresh() : false);
      closed = false;
      const refresh = (): Promise<boolean> => {
        const run = regenerations.then(async () => {
          if (closed) return false;
          const { changed, table: next } = await generateRoutes(root, codegen);
          table = next;
          serverExports.modules.splice(0, serverExports.modules.length, ...routeModules(table, routesDir));
          inFile = serverFiles(table);
          // A new route table (or new document routes): the browser graphs are walked again on the next page request.
          if (changed) reachDirty = true;
          if (changed && !closed) server.ws.send({ type: "full-reload" });
          return changed;
        });
        regenerations = run.catch(() => {});
        return run;
      };
      // A failed regeneration is logged (an unhandled rejection would end the dev server's process).
      const logged = (fn: (file: string) => Promise<unknown>) => (file: string) =>
        void fn(file).catch((error: unknown) =>
          server.config.logger.error("rivet router: " + (error instanceof Error ? (error.stack ?? error.message) : String(error))),
        );
      server.watcher.on("add", logged(regenerate));
      server.watcher.on("unlink", logged(regenerate));
      // Any source edit can change what a route's browser graph reaches (re-walked lazily, changed files only).
      const stale = (file: string) => {
        if (SOURCE.test(file)) reachDirty = true;
      };
      server.watcher.on("add", stale);
      server.watcher.on("unlink", stale);
      server.watcher.on("change", stale);
      // Dev server reach: a page's RV3011 reports on its load (terminal once per report, overlay on every load of an
      // error); new document routes regenerate the App (full reload).
      const reported = new Set<string>();
      let routeMatch: { table: RouteTable; match: (url: URL) => RouteTable["routes"][number] | undefined } | undefined;
      const devReach = async (url: URL): Promise<readonly ReachProblem[]> => {
        if (mode === "csr") return [];
        if (reachDirty) {
          reachDirty = false;
          const run = reachRun.then(async () => {
            if (!closed && (await analyze())) await refresh();
          });
          reachRun = run.catch(() => {});
          await run;
        }
        if (!reach?.problems.length) return [];
        if (routeMatch?.table !== table) {
          const at = (pattern: string) => (codegen.base ? (pattern === "/" ? codegen.base : codegen.base + pattern) : pattern);
          const match = compileRoutes(table.routes.filter((route) => route.page).map((route) => ({ path: at(route.pattern), render: () => route })));
          routeMatch = { table, match: (target) => match(target)?.route.render(undefined, null as never) as RouteTable["routes"][number] | undefined };
        }
        const route = routeMatch.match(url);
        if (!route) return [];
        const files = new Set([route.page, route.notFound, route.error, ...route.layouts.map((layout) => layout.page)].filter(Boolean));
        const found = reach.problems.filter((problem) => problem.files.some((file) => files.has(file)));
        for (const problem of found)
          if (!reported.has(problem.message)) {
            reported.add(problem.message);
            if (problem.severity === "error") server.config.logger.error(problem.message);
            else server.config.logger.warn(problem.message);
          }
        return found;
      };
      // A source starts using a router feature (search params, navigate(), useParams()): generate it
      // from now on (regenerate + full reload). A dev server never turns one off again.
      const features = async (file: string) => {
        if (!SOURCE.test(file) || /(?:^|[\\/])(?:node_modules|dist(?:[-_.][^\\/]*)?|\.[^\\/]*)[\\/]/.test(relative(root, file))) return false;
        const found = none();
        featuresOf(await readFile(file, "utf8").catch(() => ""), found);
        const added = USAGE.filter((name) => found[name] && !codegen[name] && options[name] === undefined);
        if (!added.length) return false;
        for (const name of added) codegen[name] = true;
        await refresh();
        return true;
      };
      server.watcher.on("add", logged(features));
      // An edit can add or remove in-file server exports: only then does the route table change
      // (regenerated without touching other edits). Server-only edits (`*.server.ts`, in-file
      // loaders) refetch the route data and re-mount the page (`rivet:data`).
      server.watcher.on(
        "change",
        logged(async (file) => {
          if (await features(file)) return;
          const path = posix(file);
          if (/\.server\.[cm]?[jt]sx?$/.test(path)) return server.ws.send({ type: "custom", event: "rivet:data" });
          if (!resolve(file).startsWith(routesPath + sep)) return;
          const name = posix(relative(routesPath, resolve(file)));
          const names = (await _serverExportsOf(routesPath, [name])).get(name) ?? [];
          const has = names.some((n) => n !== "live");
          if ((has !== inFile.has(name) || names.includes("live") !== inFile.has("live:" + name)) && (await regenerate(file))) return;
          if (has) server.ws.send({ type: "custom", event: "rivet:data" });
        }),
      );
      const devStyles = styles.map((path) => "/" + posix(path));
      // i18n (`@rivetjs/i18n/vite`): dev pages render their locale's variant, and a non-default
      // locale loads the dev entry with `?rivet-locale=` (its client modules compile for that locale).
      const i18n = (
        server.config.plugins.find((p) => p.name === "vite-plugin-rivet-i18n")?.api as
          { config?: { locales: readonly string[]; defaultLocale: string } } | undefined
      )?.config;
      const devEntry = server.config.base + posix(join(outDir, "entry.dev.tsx"));
      const devMount = server.config.base + posix(join(outDir, "dev-mount.tsx"));
      // Dev errors: server failures reach the overlay and a dev error page; browser ones are forwarded.
      listenClientErrors(server);
      // Dev SSR renders like production (boundary recorder, dev manifest).
      const devResume = (compiler.api as { devResume: DevResume }).devResume;
      const onError = devReport(server, () => table, routesPath);
      // Pages resume like production; opted out, or a non-default i18n locale (its client graph
      // compiles per locale, chunks do not yet): client-render without the recorded state.
      const devMode = (locale: string | undefined): "check" | "resume" =>
        !resume.dev || (i18n && locale && locale !== i18n.defaultLocale) ? "check" : "resume";
      const listeners = new WeakMap<object, (req: IncomingMessage, res: ServerResponse) => void>();
      // After Vite's own middlewares (modules, assets): pages and data go through the app handler.
      return () => {
        server.middlewares.use(async (req, res, next) => {
          try {
            if (mode === "csr") {
              if (req.method !== "GET" && req.method !== "HEAD") return next();
              const { shellHTML } = await import("../adapters/csr.ts");
              const document = (await server.ssrLoadModule("/" + posix(documentPath))).default as DocumentShell;
              const shell = shellHTML(document, { script: "/" + posix(join(outDir, "entry.client.tsx")), styles: devStyles });
              const html = await server.transformIndexHtml(req.url ?? "/", shell);
              res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" });
              res.end(req.method === "HEAD" ? undefined : html);
              return;
            }
            // The entry re-exports createApp: handler and app load through one SSR graph (one runtime).
            const entry = (await server.ssrLoadModule("/" + posix(join(outDir, "entry.server.tsx")))) as GeneratedEntry & { createApp: typeof CreateApp };
            // One app per entry namespace: Vite hands out a new one once an edit invalidates the graph.
            let listener = listeners.get(entry);
            if (!listener) {
              const { createListener } = await import("../adapters/node.ts");
              const handler = entry.createApp({
                entry,
                styles: devStyles,
                routeStyles: (id) => devRouteCSS(server, table, resolve(root, routesDir), id, new Set(devStyles)),
                dev: true,
                // Read per page: the dev manifest grows as Vite compiles modules.
                devResume: {
                  get manifest() {
                    return devResume.manifest();
                  },
                  mode: devMode,
                },
                // The DevTools agent (when on) runs first, before any framework module evaluates.
                devScripts: (locale) => [
                  ...(compiler.api as { devtoolsScripts(): string[] }).devtoolsScripts(),
                  server.config.base + "@vite/client",
                  // Framework bridges' dev preambles (React Fast Refresh: `@vitejs/plugin-react/preamble`), before any island module.
                  ...((compiler.api as { bridgeScripts?(): string[] }).bridgeScripts?.() ?? []),
                  // Resumed: the entry that switches to client rendering on a hot update; else the mount itself.
                  devMode(locale) === "resume"
                    ? devEntry
                    : i18n && locale && locale !== i18n.defaultLocale
                      ? devMount + "?rivet-locale=" + encodeURIComponent(locale)
                      : devMount,
                ],
                ...(i18n ? { i18n: { locales: i18n.locales } } : {}),
                onError,
              });
              listener = createListener({ handler: devHandler(handler, server, () => table, devReach), compress: false }).listener;
              listeners.set(entry, listener);
            }
            // Vite's base middleware strips the base from `req.url`: route patterns carry it.
            const original = (req as { originalUrl?: string }).originalUrl;
            if (codegen.base && original) req.url = original;
            // Static mode: client navigation reads prerendered `<page>/_data.json` files, which only the
            // build writes. Dev answers them from the data endpoint, as the static adapter renders them.
            if (mode === "static") staticData(req, slash);
            listener(req, res);
          } catch (error) {
            // Never reject (connect does not await middlewares; an unhandled rejection ends the dev server).
            try {
              if (error instanceof Error) server.ssrFixStacktrace(error);
            } catch {
              /* Keep the original stack. */
            }
            next(error);
          }
        });
      };
    },
  };
  // Server / static apps: route modules' `head` export leaves the client build (server data; `head-strip.ts`). Builds only:
  // on the dev server the hot wrapper (compiler `hot.ts`) has listed `head` among the module's exports before this post
  // transform, so a stripped export made every edit look like an export change (`invalidate`: a reload, state lost).
  const headStrip: Plugin = {
    name: "vite-plugin-rivet-router-head",
    enforce: "post",
    apply: "build",
    transform(code, id, transformOptions) {
      if (mode === "csr" || transformOptions?.ssr || this.environment?.config?.consumer === "server") return null;
      const file = id.split("?")[0]!;
      if (!serverExports.modules.some((path) => resolve(root, path) === file)) return null;
      const out = unexportHead(code);
      return out === null ? null : { code: out, map: null };
    },
  };
  return [
    router,
    ...plugins,
    headStrip,
    // Co-load chunk groups (two-pass builds, env `RIVET_COLOAD`; inert otherwise): `coload.ts`.
    coloadPlugin(),
    ...(adapter ? [targetEntryPlugin(adapter, { serverEntry: () => resolve(root, outDir, "entry.server.tsx"), mode: () => mode })] : []),
  ];
}

/** Import the document shell module at build time (Node strips its types). */
async function loadDocument(path: string): Promise<DocumentShell> {
  const module = (await import(pathToFileURL(path).href)) as { default?: DocumentShell };
  if (typeof module.default !== "function") throw new Error(`${path}: default export must be a DocumentShell function`);
  return module.default;
}
