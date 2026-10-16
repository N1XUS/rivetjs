// File-based route table: maps `src/routes/**` files to router patterns, layouts and special pages.
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

/** A layout or special page found along a route's folder chain. */
export interface RouteModule {
  /** Universal module (component), relative to the routes directory, posix separators. */
  readonly page?: string;
  /**
   * Server-only module: a sibling `*.server.ts` (guard, load, entries, actions, headers, request
   * handlers), or an endpoint-only plain `x.ts` exporting request handlers.
   */
  readonly server?: string;
  /** The page module itself declares server exports (`serverLoad`, `onGet`, `prerender`…). */
  readonly inline?: boolean;
  /** Page module with `export const live = true`: its `data` prop is an accessor revalidated in place. */
  readonly live?: boolean;
}
/** One matchable route. Optional segments expand into several entries sharing an `id`. */
export interface RouteEntry extends RouteModule {
  /** Stable id: the file path without extension, e.g. `blog/[slug]`. */
  readonly id: string;
  /** Router pattern for `compileRoutes`, e.g. `/blog/:slug`, `/docs/*rest`. */
  readonly pattern: string;
  /** Parameter names in pattern order. */
  readonly params: readonly string[];
  /** Layouts from the outermost folder inward. */
  readonly layouts: readonly RouteModule[];
  /** Nearest `_404` / `_error` page modules. */
  readonly notFound?: string;
  readonly error?: string;
}
export interface RouteTable {
  /** Ordered: the first matching entry wins. */
  readonly routes: readonly RouteEntry[];
  /** Root-level `_404` / `_error` for URLs that match no route. */
  readonly notFound?: string;
  readonly error?: string;
  /** `_404` pages under static folders for unmatched URLs, longest URL prefix first (root excluded). */
  readonly notFounds?: readonly { readonly prefix: string; readonly page: string }[];
}

const PAGE = /\.(tsx|jsx)$/;
const SERVER = /\.server\.(ts|js)$/;
/** Plain `.ts`/`.js` route files: endpoint-only routes when they export request handlers. */
const PLAIN = /\.(ts|js)$/;
const HANDLER = /^on(Request|Get|Post|Put|Patch|Delete|Options)$/;
const IGNORED = /(^|\/)[.]|\.(test|spec)\.[^/]+$|\.d\.ts$/;
const SPECIAL = new Set(["_layout", "_404", "_error"]);

type Segment = { kind: "static"; text: string } | { kind: "param" | "optional" | "splat"; name: string };

/** Parse one path segment of a route file name; null for a path-less `(group)`. */
function segment(part: string, file: string): Segment | null {
  if (/^\([^()/]+\)$/.test(part)) return null;
  let match = /^\[\[([A-Za-z_$][\w$]*)\]\]$/.exec(part);
  if (match) return { kind: "optional", name: match[1] };
  match = /^\[\.\.\.([A-Za-z_$][\w$]*)\]$/.exec(part);
  if (match) return { kind: "splat", name: match[1] };
  match = /^\[([A-Za-z_$][\w$]*)\]$/.exec(part);
  if (match) return { kind: "param", name: match[1] };
  if (/[[\]()*:?#\\]/.test(part)) throw new Error(`Invalid route segment "${part}" in ${file}`);
  return { kind: "static", text: part };
}

// Rank per segment: static before param before splat; a route that ends sorts before a splat at
// the same depth (both match the shorter URL), never against static/param (different lengths).
const rank = (s: Segment | undefined): number => (s === undefined ? 1.5 : s.kind === "static" ? 0 : s.kind === "splat" ? 2 : 1);
function compare(a: readonly Segment[], b: readonly Segment[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = rank(a[i]) - rank(b[i]);
    if (d) return d;
    const x = a[i],
      y = b[i];
    if (x?.kind === "static" && y?.kind === "static" && x.text !== y.text) return x.text < y.text ? -1 : 1;
  }
  return 0;
}
const shape = (segments: readonly Segment[]): string => "/" + segments.map((s) => (s.kind === "static" ? s.text : s.kind === "splat" ? "*" : ":")).join("/");
const pattern = (segments: readonly Segment[]): string =>
  "/" + segments.map((s) => (s.kind === "static" ? encodeURIComponent(s.text) : (s.kind === "splat" ? "*" : ":") + s.name)).join("/");

/**
 * Build the route table from file paths relative to the routes directory (posix separators).
 * `exports`: server export names per module file (`scanRoutes` reads them; pages/layouts with any are
 * `inline`, plain `.ts` files with request handlers are endpoint routes).
 */
export function routeTable(files: readonly string[], exports: ReadonlyMap<string, readonly string[]> = new Map()): RouteTable {
  const set = new Set(files.filter((file) => !IGNORED.test(file)));
  const servers = new Map<string, string>(); // module path without extension → server file
  for (const file of set) if (SERVER.test(file)) servers.set(file.replace(SERVER, ""), file);
  for (const file of set) {
    if (SERVER.test(file) || !PLAIN.test(file) || !exports.get(file)?.some((name) => HANDLER.test(name))) continue;
    const base = file.replace(PLAIN, "");
    const other = servers.get(base);
    if (other) throw new Error(`${file} and ${other} are both server modules of ${base}; keep one`);
    servers.set(base, file);
  }
  // `live` (a page flag `_serverExportsOf` reports with them) is not a server export.
  const isInline = (page: string | undefined) => (page ? (exports.get(page)?.some((name) => name !== "live") ?? false) : false);
  const isLive = (page: string) => exports.get(page)?.includes("live") ?? false;
  const special = (folder: string, name: string): RouteModule | undefined => {
    const base = (folder ? folder + "/" : "") + name;
    const page = [...set].find((file) => PAGE.test(file) && file.replace(PAGE, "") === base);
    const server = servers.get(base);
    return page || server ? { ...(page ? { page } : {}), ...(server ? { server } : {}), ...(isInline(page) ? { inline: true } : {}) } : undefined;
  };
  const nearest = (folders: readonly string[], name: string): string | undefined => {
    for (let i = folders.length - 1; i >= 0; i--) {
      const found = special(folders[i], name)?.page;
      if (found) return found;
    }
    return undefined;
  };
  const modules = new Map<string, RouteModule>();
  for (const file of set) {
    const page = PAGE.test(file),
      server = SERVER.test(file) || (PLAIN.test(file) && servers.get(file.replace(PLAIN, "")) === file);
    if (!page && !server) continue;
    const base = file.replace(server ? (SERVER.test(file) ? SERVER : PLAIN) : PAGE, "");
    const name = base.slice(base.lastIndexOf("/") + 1);
    if (name.startsWith("_")) {
      if (!SPECIAL.has(name)) continue;
      if (server && name !== "_layout") throw new Error(`${file}: only _layout may have a server module`);
      continue;
    }
    if (base.split("/").some((part) => part.startsWith("_"))) continue;
    const entry = modules.get(base) ?? {};
    modules.set(
      base,
      server ? { ...entry, server: file } : { ...entry, page: file, ...(isInline(file) ? { inline: true } : {}), ...(isLive(file) ? { live: true } : {}) },
    );
  }
  type Draft = { id: string; segments: Segment[]; module: RouteModule; folders: string[] };
  const drafts: Draft[] = [];
  const seen = new Map<string, string>();
  for (const [base, module] of [...modules].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const parts = base.split("/");
    const folders = [""];
    for (let i = 0; i < parts.length - 1; i++) folders.push(parts.slice(0, i + 1).join("/"));
    const parsed: Segment[] = [];
    for (const [i, part] of parts.entries()) {
      if (i === parts.length - 1 && part === "index") break;
      const s = segment(part, base);
      if (s) parsed.push(s);
    }
    const splat = parsed.findIndex((s) => s.kind === "splat");
    if (splat !== -1 && splat !== parsed.length - 1) throw new Error(`${base}: [...${(parsed[splat] as { name: string }).name}] must be the last segment`);
    const names = parsed.flatMap((s) => (s.kind === "static" ? [] : [s.name]));
    if (new Set(names).size !== names.length) throw new Error(`${base}: duplicate parameter name`);
    // Each optional segment doubles the variants: with it (longer) and without.
    let variants: Segment[][] = [[]];
    for (const s of parsed)
      variants = s.kind === "optional" ? variants.flatMap((v) => [[...v, { kind: "param", name: s.name } as Segment], v]) : variants.map((v) => [...v, s]);
    for (const segments of variants) {
      const key = shape(segments);
      const previous = seen.get(key);
      if (previous !== undefined && previous !== base) throw new Error(`Route conflict: ${previous} and ${base} both match ${key}`);
      if (previous === base) continue;
      seen.set(key, base);
      drafts.push({ id: base, segments, module, folders });
    }
  }
  drafts.sort((a, b) => compare(a.segments, b.segments));
  const routes = drafts.map(({ id, segments, module, folders }): RouteEntry => {
    const layouts = folders.map((folder) => special(folder, "_layout")).filter((m): m is RouteModule => m !== undefined);
    const notFound = nearest(folders, "_404"),
      error = nearest(folders, "_error");
    return {
      id,
      pattern: pattern(segments),
      params: segments.flatMap((s) => (s.kind === "static" ? [] : [s.name])),
      ...module,
      layouts,
      ...(notFound ? { notFound } : {}),
      ...(error ? { error } : {}),
    };
  });
  const notFound = special("", "_404")?.page,
    error = special("", "_error")?.page;
  // Unmatched URLs: nearest `_404` by folder, for folders without parameters (groups add no segment).
  const notFounds: { prefix: string; page: string }[] = [];
  for (const file of set) {
    if (!PAGE.test(file) || !file.endsWith("/_404" + file.slice(file.lastIndexOf(".")))) continue;
    const parts = file.split("/").slice(0, -1);
    if (parts.some((part) => part.startsWith("["))) continue;
    const prefix =
      "/" +
      parts
        .filter((part) => !/^\(.+\)$/.test(part))
        .map(encodeURIComponent)
        .join("/");
    if (prefix !== "/") notFounds.push({ prefix, page: file });
  }
  notFounds.sort((a, b) => b.prefix.length - a.prefix.length || (a.prefix < b.prefix ? -1 : 1));
  return { routes, ...(notFound ? { notFound } : {}), ...(error ? { error } : {}), ...(notFounds.length ? { notFounds } : {}) };
}

/** Scan a routes directory and build its table (reads modules for their server exports). */
export async function scanRoutes(dir: string): Promise<RouteTable> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile()).map((entry) => relative(dir, join(entry.parentPath, entry.name)).split(sep).join("/"));
  return routeTable(files, await _serverExportsOf(dir, files));
}

// `export const prerender` alone also makes a page carry server exports (a plain flag).
const PRERENDER = /^\s*export\s+(?:const|let|var)\s+prerender\b/m;
// `export const live = true`: a live page (reported as `live`, not a server export; universal, kept in the browser).
const LIVE = /^\s*export\s+const\s+live\s*=\s*true\b/m;

/** Server export names of route modules (pages, layouts, plain `.ts` files), by file; live pages also list `live`. */
export async function _serverExportsOf(dir: string, files: readonly string[]): Promise<Map<string, string[]>> {
  const { moduleFacts } = await import("@rivetjs/compiler");
  const out = new Map<string, string[]>();
  for (const file of files) {
    if (IGNORED.test(file) || SERVER.test(file) || !(PAGE.test(file) || PLAIN.test(file))) continue;
    const source = await readFile(join(dir, file), "utf8");
    const live = PAGE.test(file) && LIVE.test(source);
    // Cheap prefilter: no candidate export name, no parse.
    const candidates = /\b(server[A-Z]\w*|on(Request|Get|Post|Put|Patch|Delete|Options)|prerender)\b/.test(source);
    if (!candidates && !live) continue;
    const names = candidates ? [...(moduleFacts(source, file, { serverExports: true }).serverExports ?? [])] : [];
    if (PAGE.test(file) && PRERENDER.test(source)) names.push("prerender");
    if (live) names.push("live");
    if (names.length) out.set(file, names);
  }
  return out;
}
