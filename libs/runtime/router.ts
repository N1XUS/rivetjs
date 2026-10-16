import type { AsyncWork } from "./async.ts";

/** A flat route. Target adapters choose the allowed rendered value type. */
export interface RouteDefinition<T = unknown, V = unknown> {
  readonly path: string;
  readonly load?: (work: AsyncWork, match: RouteMatch<T, V>) => T | PromiseLike<T>;
  readonly render: (data: T, match: RouteMatch<T, V>) => V;
}
/** A matched definition with immutable decoded parameters and a fresh URL. */
export interface RouteMatch<T = unknown, V = unknown> {
  readonly route: RouteDefinition<T, V>;
  readonly params: Readonly<Record<string, string>>;
  readonly url: URL;
}
/** @internal A compiled path segment. */
export type _Segment = { name: string; splat: boolean; text?: undefined } | { text: string; name?: undefined; splat?: undefined };
/** Loaded route state handed from an Async load to its children. */
interface Resolved<T, V> {
  match: RouteMatch<T, V> | null;
  url?: URL;
  data: T | undefined;
}

/**
 * A lazy route table: `paths` compile once per array (module constants: once per process), and only
 * the matched index's definition is created (`route(index)`, whose `path` must be `paths[index]`).
 * Generated apps pass one so a request allocates no per-route closures.
 */
export interface RouteTable<V = unknown> {
  readonly paths: readonly string[];
  readonly route: (index: number) => RouteDefinition<any, V>;
}
/** Routes a `Router` accepts: definitions (compiled per call) or a lazy table. */
export type Routes<V = unknown> = readonly RouteDefinition<any, V>[] | RouteTable<V>;

/** @internal A path hit: declaration index, decoded params (shared frozen empty object when none). */
export type _PathMatch = { index: number; params: Readonly<Record<string, string>> };
/** @internal Compiles path patterns into a first-match (declaration order) matcher. */
export type _PathsCompiler = (patterns: readonly _Segment[][]) => (url: URL) => _PathMatch | null;
const EMPTY: Readonly<Record<string, string>> = Object.freeze(Object.create(null));
// Validate and compile one path pattern into segments.
function checkPath(path: unknown): asserts path is string {
  if (typeof path !== "string" || !path.startsWith("/") || /[?#\\]/.test(path)) throw new TypeError("Route path must be an absolute path pattern");
}
function compilePattern(path: unknown): _Segment[] {
  checkPath(path);
  const parts = segments(path),
    names = new Set<string>();
  return parts.map((part, index): _Segment => {
    if (!part) throw new TypeError("Route pattern contains an empty segment");
    if (part[0] === ":" || part[0] === "*") {
      const name = part.slice(1),
        splat = part[0] === "*";
      if (!name || /[:*]/.test(name) || names.has(name)) throw new TypeError("Route parameter name must be nonempty and unique");
      if (splat && index !== parts.length - 1) throw new TypeError("Route splat must be terminal");
      names.add(name);
      return { name, splat };
    }
    if (/[:*]/.test(part)) throw new TypeError("Route pattern has malformed segment");
    try {
      return { text: decodeURIComponent(part) };
    } catch {
      throw new TypeError("Route pattern has malformed path escape");
    }
  });
}

/** @internal Decoded URL path segments; null for a malformed escape or an empty segment. */
export function _urlParts(input: URL): string[] | null {
  let parts: string[];
  try {
    parts = segments(input.pathname).map((part) => (part.includes("%") ? decodeURIComponent(part) : part));
  } catch {
    return null;
  }
  return parts.includes("") ? null : parts;
}
/** @internal The hit for `pattern` (declaration `index`) over decoded `parts` it fits. */
export function _pathMatch(index: number, pattern: readonly _Segment[], parts: readonly string[]): _PathMatch {
  let params = EMPTY;
  for (let at = 0; at < pattern.length; at++) {
    const segment = pattern[at]!;
    if (segment.name === undefined) continue;
    if (params === EMPTY) params = Object.create(null);
    (params as Record<string, string>)[segment.name] = segment.splat ? parts.slice(at).join("/") : parts[at]!;
  }
  return { index, params: params === EMPTY ? EMPTY : Object.freeze(params) };
}
/*
 * Linear first match in declaration order: the browser's matcher (a client holds few routes per
 * table; the bucketed server matcher, `router-buckets.ts`, stays out of client bundles).
 */
function linearPaths(patterns: readonly _Segment[][]): (url: URL) => _PathMatch | null {
  return (input: URL): _PathMatch | null => {
    const parts = _urlParts(input);
    if (parts) for (let index = 0; index < patterns.length; index++) if (_fits(patterns[index]!, parts)) return _pathMatch(index, patterns[index]!, parts);
    return null;
  };
}

// Snapshot a definition; path errors first, then callbacks.
function checkDefinition<T, V>(definition: RouteDefinition<T, V>): RouteDefinition<T, V> {
  const route = Object.freeze({ ...definition });
  checkPath(route.path);
  if (typeof route.render !== "function" || (route.load !== undefined && typeof route.load !== "function"))
    throw new TypeError("Route requires render and an optional load function");
  return route;
}

/** Compile snapshots once; first match wins, malformed URL escapes return null. */
/*
 * Snapshot flat route definitions and compile their path segments once.
 * Matching is case-sensitive and follows declaration order. Parameters decode
 * once, including encoded slashes; malformed URL escapes produce no match.
 * Params and the fresh URL are allocated on a hit only.
 */
export function compileRoutes<T, V>(routes: readonly RouteDefinition<T, V>[], paths: _PathsCompiler = linearPaths): (url: URL) => RouteMatch<T, V> | null {
  const definitions: RouteDefinition<T, V>[] = [],
    patterns = routes.map((definition) => compilePattern(definitions[definitions.push(checkDefinition(definition)) - 1]!.path));
  const match = paths(patterns);
  return (input: URL): RouteMatch<T, V> | null => {
    const hit = match(input);
    return hit && { route: definitions[hit.index]!, params: hit.params, url: new URL(input.href) };
  };
}

// Table matchers per `paths` array (generated apps: module constants, so once per process).
const tables = new WeakMap<readonly string[], (url: URL) => _PathMatch | null>();
/** @internal Matcher for `Router`'s `routes`: an array compiles now; a table's paths once per array, its definition per hit. */
export function routeMatcher<V>(routes: Routes<V>, compile: _PathsCompiler = linearPaths): (url: URL) => RouteMatch<any, V> | null {
  if (Array.isArray(routes)) return compileRoutes(routes as readonly RouteDefinition<any, V>[], compile);
  const { paths, route } = routes as RouteTable<V>;
  if (!Array.isArray(paths) || typeof route !== "function") throw new TypeError("Route table requires paths and a route function");
  let match = tables.get(paths);
  if (!match) tables.set(paths, (match = compile(paths.map(compilePattern))));
  return (input: URL): RouteMatch<any, V> | null => {
    const hit = match(input);
    if (!hit) return null;
    const definition = checkDefinition(route(hit.index));
    if (definition.path !== paths[hit.index]) throw new TypeError("Route table definition path must equal its paths entry");
    return { route: definition, params: hit.params, url: new URL(input.href) };
  };
}

/** @internal Whether a compiled pattern matches decoded URL segments (a terminal splat takes the rest, even none). */
export function _fits(pattern: readonly _Segment[], parts: readonly string[]): boolean {
  let index = 0;
  for (const segment of pattern) {
    if (segment.splat) return true;
    if (index >= parts.length || (segment.text !== undefined && segment.text !== parts[index])) return false;
    index++;
  }
  return index === parts.length;
}

function segments(path: string): string[] {
  if (path === "/") return [];
  return path.slice(1, path.endsWith("/") ? -1 : undefined).split("/");
}

/** @internal Target-neutral Async route adapter. */
/*
 * Adapt matching to a target's owned Async boundary. Read location
 * during load for reactive tracking; preserve work/context/cancellation and
 * defer all render callbacks until Async constructs the resolved children.
 */
export function renderRoute<V, R>(
  Async: (props: { load: (work: AsyncWork) => unknown; children: (value: any) => V | null; fallback?: () => V; error?: (cause: unknown) => V }) => R,
  matcher: (url: URL) => RouteMatch<any, V> | null,
  readURL: () => URL,
  { fallback, error, notFound }: { fallback?: () => V; error?: (cause: unknown) => V; notFound?: (url: URL) => V } = {},
): R {
  return Async({
    load(work): Resolved<unknown, V> | Promise<Resolved<unknown, V>> {
      const url = readURL(),
        match = matcher(url);
      if (!match) return { match: null, url, data: undefined };
      if (!match.route.load) return { match, data: undefined };
      // A synchronous load value commits synchronously (no fallback frame); thenables settle as usual.
      const data = match.route.load(work, match) as unknown;
      return typeof (data as PromiseLike<unknown> | undefined)?.then == "function" ? Promise.resolve(data).then((data) => ({ match, data })) : { match, data };
    },
    children({ match, data, url }: Resolved<unknown, V>): V | null {
      return match ? match.route.render(data, match) : notFound ? notFound(url!) : null;
    },
    fallback,
    error,
  });
}

/** @internal Router client hook (`beforeLeave` back/forward guards): true when a popstate must not move the browser router. */
export const _popGate: { blocked?: (event: Event) => boolean } = {};
