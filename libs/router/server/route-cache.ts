// Route rules (`routeRules`): response headers per path pattern, and an in-process cache of rendered pages
// (fresh → stale-while-revalidate / ISR) with validators (ETag / Last-Modified → 304). Spec:
// docs/design/specs/2026-10-12-route-cache.md. Pay-per-use: `createApp` imports this module only when the app has
// rules. Web-standard (Web Crypto; no Node APIs): every adapter gets the cache, the node adapter also takes the
// `ROUTE_CACHE` fast path (a hit before any `Request` is built).
import type { AppHandler } from "./handler.ts";
import { DIRECT_BODY, type DirectBody } from "./body.ts";
import type { CSPOptions } from "../shared/csp.ts";
import { hashPolicy, noncedSources } from "../shared/csp-hash.ts";
import { DATA_PARAM } from "../shared/data.ts";

/** How a matched route's rendered pages are cached (`RouteRule.cache`). */
export interface CacheRule {
  /** Seconds a stored page is served without rendering (fresh). */
  readonly maxAge: number;
  /**
   * Seconds after `maxAge` the stored page is still served while one background render refreshes it
   * (stale-while-revalidate); `true`: without limit. Default 0 (an expired page renders on the request).
   */
  readonly swr?: number | true;
  /** Names `revalidate({ tag })` drops these pages by. */
  readonly tags?: readonly string[];
  /**
   * Request headers whose values key separate copies (`accept-language`, …); case-insensitive; never `cookie` /
   * `authorization`. Sent as `Vary` with every stored page. A response `Vary` naming other headers adds them to the key
   * too; one naming `cookie` / `authorization` (the i18n guard's) is stored only when `varies` names a header.
   */
  readonly varies?: readonly string[];
  /**
   * Query strings: `true` (default) keys a copy per query string (a new query string is stored on its second
   * request), `false` ignores the query (one copy per path), a list keys only those parameters.
   */
  readonly query?: boolean | readonly string[];
  /**
   * `true`: requests with a `Cookie` header are served from the cache too (cookies are not part of the key) — and every
   * page of the rule renders without the request's `Cookie` / `Authorization` (anonymous: a loader never sees a session),
   * so one visitor's page is never stored for everyone. Default: requests with cookies bypass the cache.
   */
  readonly cookies?: boolean;
}
/** What shared caches / CDNs are told (`RouteRule.cdn`): `s-maxage` / `stale-while-revalidate` seconds. */
export interface CdnRule {
  readonly maxAge: number;
  readonly swr?: number | true;
}
/** What applies to the requests whose path matches a pattern. */
export interface RouteRule {
  /** Response headers set on every response of the matched paths (pages, data requests, endpoints, 304s). */
  readonly headers?: Readonly<Record<string, string>>;
  /** Cache rendered pages; `false` turns off a less specific rule's cache. */
  readonly cache?: CacheRule | false;
  /** Shorthand: `swr: n` = `cache: { maxAge: n, swr: true }`. */
  readonly swr?: number | true;
  /**
   * Shorthand: `isr: n` = `cache: { maxAge: n, swr: true }`; `isr: true` = stored until `revalidate()`. Needs a fixed
   * `origin` (`routeCache.origin`, or the adapter's). CDNs get `s-maxage=0, must-revalidate` (`revalidate()` is
   * process-local: it cannot purge a CDN) unless `cdn` says otherwise.
   */
  readonly isr?: number | true;
  /**
   * `Cache-Control` for shared caches / CDNs of the stored pages (`s-maxage`, `stale-while-revalidate`). Default: the
   * cache's own `maxAge` / `swr`, `isr` (and `maxAge: Infinity`) rules `s-maxage=0, must-revalidate`.
   */
  readonly cdn?: CdnRule;
  /**
   * Shell cache (partial prerendering, `server/shell-cache.ts`): the document up to its first streamed boundary (the shell:
   * everything outside `<Async fallback>` holes reading deferred loaders) is stored once and sent at once on later
   * requests — signed-in ones too (cookies never bypass it, never key it) — while the holes render live per request in
   * the same response. `true`: the rule's `cache` / `swr` / `isr` times, else stored until `revalidate()` (needs a fixed
   * `origin`, like `isr`); an object sets them. Fills that read request input outside the key (cookies, headers, locals,
   * unkeyed query parameters) are not stored (dev logs why). `false` turns off a less specific rule's shell. Not with `cdn`.
   */
  readonly shell?: boolean | ShellRule;
}
/** `RouteRule.shell` times and keys (defaults: the rule's `cache` / `swr` / `isr`, else stored until `revalidate()`). */
export interface ShellRule {
  readonly maxAge?: number;
  readonly swr?: number | true;
  readonly tags?: readonly string[];
  /** Request headers whose values key separate shells (never `cookie` / `authorization`). */
  readonly varies?: readonly string[];
  /** `true` (default): one shell per query string; `false`: query-less URLs only; a list: those parameters (other URLs render without the shell). */
  readonly query?: boolean | readonly string[];
}
/**
 * Rules by path pattern (pathname below the app's base): `/about` exact, `*` one segment (`/blog/*`), a trailing
 * `/**` the path and everything below it (`/docs/**`, `/**`). Every matching rule applies, the less specific first
 * (fewer literal characters): headers merge by name, the most specific `cache` (or shorthand) wins.
 */
export type RouteRules = Readonly<Record<string, RouteRule>>;
/** Bounds of the in-process page store (`createApp({ routeCache })`). */
export interface RouteCacheOptions {
  /** Stored bytes — bodies, their br / gzip copies, keys, headers (default 32 MiB); a page over a quarter of it is never stored. */
  readonly maxBytes?: number;
  /** Stored pages (default 5000). */
  readonly maxEntries?: number;
  /**
   * The public origin pages are stored for (`https://shop.example`); requests for another origin bypass the cache.
   * Required by `isr` rules. Without it the request's origin (from `Host` / trusted forwarded headers) is part of the
   * key: a forged `Host` renders and stores a copy of its own (never served to other hosts) — set it, or a fixed
   * `origin` on the node / fetch adapter (`start()` / `createFetchHandler()` pass theirs on).
   */
  readonly origin?: string;
}

/** A stored page (exported for the node adapter's fast path). */
export interface CachedPage {
  readonly key: string;
  /** Pathname below the base (decoded). */
  readonly path: string;
  readonly tags: readonly string[];
  /** The stored body (a nonce-free document when the app's policy was converted to hashes). */
  readonly body: Uint8Array;
  /** Response headers (lower-case names): content type, cache-control, CSP, validators, rule headers. */
  readonly headers: readonly (readonly [string, string])[];
  readonly etag: string;
  /** `Last-Modified` (HTTP date) and its time (ms, second precision). */
  readonly modified: string;
  readonly modifiedAt: number;
  /** Times (ms): stored, fresh until, served stale until. */
  readonly created: number;
  readonly fresh: number;
  readonly stale: number;
  /** CLOCK reference bit. */
  used: boolean;
  /** Bytes counted against `maxBytes` (body, key, headers, `charge`d copies). */
  size: number;
  /** Background refreshes that failed in a row, and when the next may start (ms; exponential backoff). */
  failures: number;
  retry: number;
  /** Count `bytes` more against the store's `maxBytes` (an adapter's compressed copy of the body). */
  charge(bytes: number): void;
}
/** Request header lookup (lower-case name). */
export type HeaderOf = (name: string) => string | null | undefined;
/** Fresh stored page for a GET / HEAD request, if any (node adapter fast path: before a `Request` exists). `origin`: the request URL's. */
export type CacheLookup = (method: string, origin: string, pathname: string, search: string, header: HeaderOf) => CachedPage | undefined;
/** Own property of a handler with route rules: the cache lookup. */
export const ROUTE_CACHE = Symbol.for("rivet.routeCache");
/** A handler with route rules. */
export type CachingHandler = AppHandler & { readonly [ROUTE_CACHE]: CacheLookup };

interface Cache {
  readonly maxAge: number;
  readonly swr: number;
  readonly tags: readonly string[];
  readonly varies: readonly string[];
  readonly query: boolean | readonly string[];
  readonly cookies: boolean;
  /** The `Cache-Control` stored pages answer with. */
  readonly control: string;
  /** Headers responses named in `Vary` (beyond `varies`): part of the key from then on. */
  readonly learned: string[];
}
/** @internal A rule's normalised cache (exported for `shell-cache.ts`). */
export type { Cache as _Cache };
/** @internal */
export interface Resolved {
  readonly headers: readonly (readonly [string, string])[];
  readonly cache: Cache | undefined;
  /** Shell cache (`RouteRule.shell`): wins over `cache` for documents. */
  readonly shell?: Cache;
}
interface Compiled {
  readonly test: RegExp;
  readonly weight: number;
  readonly rule: RouteRule;
}

const RULE_KEYS = new Set(["headers", "cache", "swr", "isr", "cdn", "shell"]);
const SHELL_KEYS = new Set(["maxAge", "swr", "tags", "varies", "query"]);
const CREDENTIALS = new Set(["cookie", "authorization"]);
// Request headers a fill / refresh never forwards (unless the rule's `varies` names them): credentials and what
// identifies the visitor behind a proxy — a stored page must not depend on the visitor whose miss rendered it.
const VISITOR = /^(?:cookie|authorization|forwarded|x-forwarded-.+|x-real-ip|true-client-ip|x-client-ip|cf-.+|fastly-client-ip)$/;
const CACHE_KEYS = new Set(["maxAge", "swr", "tags", "varies", "query", "cookies"]);
const YEAR = 31536000;
const seconds = (value: unknown, what: string): number => {
  if (typeof value !== "number" || !(value >= 0)) throw new TypeError(`routeRules: ${what} must be a number of seconds ≥ 0 (got ${String(value)})`);
  return value;
};
const strings = (value: unknown, what: string): readonly string[] => {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item)) throw new TypeError(`routeRules: ${what} must be a list of names`);
  return value;
};

/** Check and normalise one rule's cache (shorthands → `CacheRule`). */
function cacheOf(rule: RouteRule, pattern: string, origin: boolean): Cache | false | undefined {
  const where = `"${pattern}"`;
  const given = [rule.cache !== undefined, rule.swr !== undefined, rule.isr !== undefined].filter(Boolean).length;
  if (given > 1) throw new TypeError(`routeRules ${where}: give one of cache, swr, isr`);
  let cache: CacheRule;
  if (rule.cdn !== undefined && (given === 0 || rule.cache === false)) throw new TypeError(`routeRules ${where}: cdn needs a cache (cache, swr or isr)`);
  if (rule.cache === false) return false;
  if (rule.cache !== undefined) {
    if (typeof rule.cache !== "object" || rule.cache === null) throw new TypeError(`routeRules ${where}: cache must be an object or false`);
    for (const key of Object.keys(rule.cache)) if (!CACHE_KEYS.has(key)) throw new TypeError(`routeRules ${where}: unknown cache option "${key}"`);
    cache = rule.cache;
  } else if (rule.swr !== undefined || rule.isr !== undefined) {
    const value = (rule.swr ?? rule.isr)!;
    cache = { maxAge: value === true ? (rule.isr !== undefined ? Infinity : 0) : value, swr: true };
  } else return undefined;
  const maxAge = seconds(cache.maxAge, `${pattern} maxAge`);
  const swr = cache.swr === true ? Infinity : cache.swr === undefined ? 0 : seconds(cache.swr, `${pattern} swr`);
  const query = cache.query ?? true;
  if (typeof query !== "boolean") strings(query, `${pattern} query`);
  const s = (n: number) => (n === Infinity ? YEAR : Math.floor(n));
  const varies = cache.varies ? strings(cache.varies, `${pattern} varies`).map((name) => name.toLowerCase()) : [];
  if (varies.some((name) => CREDENTIALS.has(name)))
    throw new TypeError(`routeRules ${where}: varies cannot name cookie / authorization (one copy per visitor)`);
  // Stored until revalidate(): never keyed by a client-sent Host.
  const isr = rule.isr !== undefined || maxAge === Infinity;
  if (isr && !origin) throw new TypeError(`routeRules ${where}: isr needs a fixed origin (createApp({ routeCache: { origin } }) or the adapter's \`origin\`)`);
  let cdn = "";
  if (rule.cdn !== undefined) {
    if (typeof rule.cdn !== "object" || rule.cdn === null) throw new TypeError(`routeRules ${where}: cdn must be { maxAge, swr? }`);
    for (const key of Object.keys(rule.cdn)) if (key !== "maxAge" && key !== "swr") throw new TypeError(`routeRules ${where}: unknown cdn option "${key}"`);
    const max = seconds(rule.cdn.maxAge, `${pattern} cdn.maxAge`);
    const stale = rule.cdn.swr === true ? Infinity : rule.cdn.swr === undefined ? 0 : seconds(rule.cdn.swr, `${pattern} cdn.swr`);
    cdn = `s-maxage=${s(max)}` + (stale ? `, stale-while-revalidate=${s(stale)}` : "");
  }
  return {
    maxAge,
    swr,
    tags: cache.tags ? strings(cache.tags, `${pattern} tags`) : [],
    varies,
    query: typeof query === "boolean" ? query : [...query].sort(),
    cookies: cache.cookies === true,
    // Browsers revalidate every time (304 when unchanged); shared caches / CDNs follow the rule — except ISR pages,
    // which only this process can drop (`revalidate()`): CDNs revalidate them every time unless `cdn` opts in.
    control:
      "public, max-age=0, " + (cdn || (isr ? "s-maxage=0, must-revalidate" : `s-maxage=${s(maxAge)}` + (swr ? `, stale-while-revalidate=${s(swr)}` : ""))),
    learned: [],
  };
}

/** Check and normalise one rule's `shell` (defaults: the rule's own cache times, else stored until `revalidate()`). */
function shellOf(rule: RouteRule, pattern: string, origin: boolean, cache: Cache | false | undefined): Cache | false | undefined {
  const where = `"${pattern}"`;
  const given = rule.shell;
  if (given === undefined) return undefined;
  if (given === false) return false;
  if (given !== true && (typeof given !== "object" || given === null))
    throw new TypeError(`routeRules ${where}: shell must be true, false or { maxAge, swr, tags, varies, query }`);
  if (rule.cdn !== undefined) throw new TypeError(`routeRules ${where}: shell cannot take cdn (shell documents carry per-visitor holes: private, no-cache)`);
  const own: ShellRule = given === true ? {} : given;
  for (const key of Object.keys(own)) if (!SHELL_KEYS.has(key)) throw new TypeError(`routeRules ${where}: unknown shell option "${key}"`);
  const base = cache || undefined;
  const maxAge = own.maxAge ?? base?.maxAge ?? Infinity;
  const swr = own.swr ?? (base ? (base.swr === Infinity ? true : base.swr) : undefined);
  const normal = cacheOf(
    {
      cache: {
        maxAge,
        ...(swr !== undefined ? { swr } : {}),
        ...((own.tags ?? base?.tags)?.length ? { tags: own.tags ?? base!.tags } : {}),
        ...((own.varies ?? base?.varies)?.length ? { varies: own.varies ?? base!.varies } : {}),
        ...(own.query !== undefined ? { query: own.query } : base ? { query: base.query } : {}),
      },
    },
    pattern + " shell",
    origin,
  );
  // Documents with live holes: never shared-cacheable, revalidated by the browser every time.
  return normal ? { ...normal, control: "private, no-cache" } : undefined;
}

/**
 * Compile `rules` (throws `TypeError` on a malformed pattern or rule) into a pathname → rule lookup. `origin`: a fixed
 * origin is configured (`isr` rules need one).
 */
export function compileRules(rules: RouteRules, origin = false): (pathname: string) => Resolved | undefined {
  const compiled: Compiled[] = [];
  const caches = new Map<RouteRule, Cache | false | undefined>();
  const shells = new Map<RouteRule, Cache | false | undefined>();
  for (const [pattern, rule] of Object.entries(rules)) {
    const segments = pattern.split("/");
    if (
      !pattern.startsWith("/") ||
      segments.some((segment, at) => segment.includes("*") && segment !== "*" && (segment !== "**" || at !== segments.length - 1))
    )
      throw new TypeError(`routeRules: pattern "${pattern}" must start with "/"; "*" is a whole segment, "/**" only at the end`);
    if (typeof rule !== "object" || rule === null) throw new TypeError(`routeRules "${pattern}": the rule must be an object`);
    for (const key of Object.keys(rule)) if (!RULE_KEYS.has(key)) throw new TypeError(`routeRules "${pattern}": unknown option "${key}"`);
    if (rule.headers !== undefined)
      for (const [name, value] of Object.entries(rule.headers))
        if (!/^[!#$%&'*+.^`|~\w-]+$/.test(name) || typeof value !== "string" || /[\r\n\0]/.test(value))
          throw new TypeError(`routeRules "${pattern}": invalid header ${JSON.stringify(name)}`);
    const own = cacheOf(rule, pattern, origin);
    caches.set(rule, own);
    if (rule.shell !== undefined) shells.set(rule, shellOf(rule, pattern, origin, own));
    const any = pattern.endsWith("/**");
    const body = any ? pattern.slice(0, -3) : pattern;
    const source = body
      .split("/")
      .map((segment) => (segment === "*" ? "[^/]+" : segment.replace(/[.+?^${}()|[\]\\]/g, "\\$&")))
      .join("/");
    compiled.push({ test: new RegExp(`^${source}${any ? "(?:/.*)?" : "/?"}$`), weight: body.replace(/\*/g, "").length, rule });
  }
  // Less specific first: later (more specific) headers / cache win.
  compiled.sort((a, b) => a.weight - b.weight);
  const memo = new Map<string, Resolved | null>();
  return (pathname) => {
    let hit = memo.get(pathname);
    if (hit === undefined) {
      let headers: Map<string, string> | undefined;
      let cache: Cache | false | undefined;
      let shell: Cache | false | undefined;
      let matched = false;
      for (const { test, rule } of compiled) {
        if (!test.test(pathname)) continue;
        matched = true;
        if (rule.headers) for (const [name, value] of Object.entries(rule.headers)) (headers ??= new Map()).set(name.toLowerCase(), value);
        const own = caches.get(rule);
        if (own !== undefined) cache = own;
        const shelled = shells.get(rule);
        if (shelled !== undefined) shell = shelled;
      }
      // A shell rule wins for documents: no whole-page copy of them (their holes are per visitor).
      hit = matched
        ? shell
          ? { headers: headers ? [...headers] : [], cache: undefined, shell }
          : { headers: headers ? [...headers] : [], cache: cache || undefined }
        : null;
      // Bounded: request paths are client-controlled.
      if (memo.size >= 2048) memo.clear();
      memo.set(pathname, hit);
    }
    return hit ?? undefined;
  };
}

/** Bounded page store, CLOCK eviction (a hit sets one bit). Shell entries (`shell-cache.ts`) live here too (key `…\0shell`). */
class Store {
  readonly pages = new Map<string, CachedPage>();
  /** Shell cache: rejected fills per route id (3 in a row → no more attempts until a `revalidate()`). */
  readonly sticky = new Map<string, number>();
  bytes = 0;
  /** Fills running now (`path`, `tags`): a `revalidate()` matching one voids it (it answers but does not store). */
  readonly filling = new Set<{ readonly path: string; readonly tags: readonly string[]; void: boolean }>();
  readonly maxBytes: number;
  readonly maxEntries: number;
  readonly base: string;
  constructor(maxBytes: number, maxEntries: number, base: string) {
    this.maxBytes = maxBytes;
    this.maxEntries = maxEntries;
    this.base = base;
  }
  get(key: string): CachedPage | undefined {
    return this.pages.get(key);
  }
  set(page: CachedPage): void {
    this.delete(page.key);
    if (page.size > this.maxBytes / 4) return;
    this.pages.set(page.key, page);
    this.bytes += page.size;
    this.evict(page);
  }
  /** `page` (stored) grew by `bytes`. */
  grow(page: CachedPage, bytes: number): void {
    if (this.pages.get(page.key) !== page) return;
    page.size += bytes;
    this.bytes += bytes;
    this.evict(page);
  }
  private evict(keep: CachedPage): void {
    for (const [key, old] of this.pages) {
      if (this.bytes <= this.maxBytes && this.pages.size <= this.maxEntries) break;
      if (old === keep) continue;
      this.pages.delete(key);
      if (old.used) {
        old.used = false;
        this.pages.set(key, old);
      } else this.bytes -= old.size;
    }
  }
  delete(key: string): boolean {
    const page = this.pages.get(key);
    if (!page) return false;
    this.pages.delete(key);
    this.bytes -= page.size;
    return true;
  }
}
const stores = new Set<WeakRef<Store>>();
/** @internal The page store type (`shell-cache.ts` keeps its entries in it). */
export type { Store as _Store };

// Path segments: kept as sent when printable ASCII outside the WHATWG path percent-encode set (and `%`, `/`);
// everything else percent-encoded (upper-case hex) — the form browsers send and the router's links use.
const LITERAL = /^[!$&'()*+,\-.0-9:;=@A-Z[\]^_a-z|~\\]$/;
const encodeSegment = (segment: string): string => {
  let out = "";
  for (const char of segment) out += LITERAL.test(char) ? char : encodeURIComponent(char);
  return out;
};
/**
 * The router's view of a raw pathname: `match` — segments percent-decoded (a decoded `/` stays `%2F`: one segment),
 * what rules match and keys use; `canonical` — the raw path is that path's one encoding (only those are stored, so
 * `/%61dmin` neither escapes an `/admin/**` rule nor adds a copy of `/admin`). Malformed escapes: not canonical.
 */
export function normalPath(pathname: string): { readonly match: string; readonly canonical: boolean } {
  if (!pathname.includes("%")) return { match: pathname, canonical: true };
  const segments = pathname.split("/");
  let match = "";
  let canonical = true;
  for (let at = 0; at < segments.length; at++) {
    const raw = segments[at]!;
    let decoded: string;
    try {
      decoded = raw.includes("%") ? decodeURIComponent(raw) : raw;
    } catch {
      return { match: pathname, canonical: false };
    }
    if (canonical && encodeSegment(decoded) !== raw) canonical = false;
    match += (at ? "/" : "") + decoded.replaceAll("/", "%2F");
  }
  return { match, canonical };
}

/**
 * Drop stored pages (every app's in this process): by `path` (pathname, with or without the app's base; a trailing
 * `/**` drops everything below it) and / or `tag` (`CacheRule.tags`). The next request renders; a render already
 * running does not store its page. Returns how many pages were dropped here. Node `start({ workers })`: the other
 * workers drop theirs too (relayed by the primary, asynchronously). Other servers and CDNs keep theirs until they
 * expire.
 */
export function revalidate(target: { readonly path?: string; readonly tag?: string }): number {
  const dropped = dropLocal(target);
  (globalThis as unknown as Record<symbol, ((target: object) => void) | undefined>)[BROADCAST]?.({ ...target });
  return dropped;
}
// `adapters/cluster.ts`: a worker relays `revalidate()` (BROADCAST, set there) and drops what other workers revalidate (LOCAL).
const BROADCAST = Symbol.for("rivet.revalidate.broadcast");
(globalThis as unknown as Record<symbol, unknown>)[Symbol.for("rivet.revalidate.local")] = (target: { path?: string; tag?: string }) => dropLocal(target);

function dropLocal(target: { readonly path?: string; readonly tag?: string }): number {
  let dropped = 0;
  for (const ref of stores) {
    const store = ref.deref();
    if (!store) {
      stores.delete(ref);
      continue;
    }
    let path = target.path === undefined ? undefined : normalPath(target.path).match;
    if (path !== undefined && store.base && (path === store.base || path.startsWith(store.base + "/"))) path = path.slice(store.base.length) || "/";
    const below = path?.endsWith("/**") ? path.slice(0, -3) : undefined;
    const matches = (page: { readonly path: string; readonly tags: readonly string[] }) =>
      (path === undefined ||
        (below !== undefined ? page.path === (below || "/") || page.path.startsWith(below + "/") : page.path === path || page.path === path + "/")) &&
      (target.tag === undefined || page.tags.includes(target.tag));
    // Renders already running for a matching page: their result predates the change.
    for (const fill of store.filling) if (matches(fill)) fill.void = true;
    store.sticky.clear();
    for (const page of [...store.pages.values()]) if (matches(page) && store.delete(page.key)) dropped++;
  }
  return dropped;
}

/** `If-None-Match` (weak comparison) / `If-Modified-Since` (when no `If-None-Match`) hold for `page`. */
export function notModified(page: CachedPage, match: string | null | undefined, since: string | null | undefined): boolean {
  if (match) {
    if (match.trim() === "*") return true;
    const own = page.etag.slice(2);
    for (const tag of match.split(",")) if (tag.trim().replace(/^W\//, "") === own) return true;
    return false;
  }
  if (!since) return false;
  const date = Date.parse(since);
  return date === date && page.modifiedAt <= date;
}
/** Headers a 304 repeats (RFC 9110 15.4.5). */
const KEPT_304 = new Set(["cache-control", "etag", "last-modified", "vary", "expires", "content-location"]);

/** Content-Security-Policy handling of stored pages (from `createApp` `csp`). */
export interface CachePolicy {
  /** The app's policy for a nonce (`false`: none). A stored response whose policy differs (a route's own) is kept as rendered. */
  readonly policy: (nonce: string) => string | false;
  /**
   * Convert the app's nonce policy to hashes of the page's nonce'd inline code (default / `CSPOptions` apps); `null`:
   * no conversion (a `csp` function) — a page whose policy allows its nonce is then not stored (one nonce for every visitor).
   */
  readonly hash: CSPOptions | null;
}
/** Own property the app sets on a request whose render reported a failure (`onError`: an error fallback was rendered). */
export const RENDER_FAILED = Symbol.for("rivet.renderFailed");

const encoder = new TextEncoder();
const base64 = (bytes: Uint8Array): string => {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
};
// Node / Bun / Deno: the synchronous native hash (`process.getBuiltinModule`, no static Node import: the module stays
// web-standard); elsewhere Web Crypto. Web Crypto digests are thread-pool jobs on Node (~3× the cost of a miss's hashing).
type NodeHash = { createHash(algorithm: string): { update(data: Uint8Array | string): { digest(encoding: "base64"): string } } };
const native = (globalThis as { process?: { getBuiltinModule?(id: string): unknown } }).process?.getBuiltinModule?.("node:crypto") as NodeHash | undefined;
const digest = async (algorithm: "SHA-1" | "SHA-256", data: Uint8Array | string): Promise<string> =>
  native
    ? native
        .createHash(algorithm === "SHA-1" ? "sha1" : "sha256")
        .update(data)
        .digest("base64")
    : base64(new Uint8Array(await crypto.subtle.digest(algorithm, typeof data === "string" ? encoder.encode(data) : (data as Uint8Array<ArrayBuffer>))));
// Bytes as one character per byte (offsets stay byte offsets): Node's Buffer, else the WHATWG latin1 (windows-1252) decoder.
type NodeBuffer = { from(buffer: ArrayBufferLike, offset: number, length: number): { latin1Slice(): string } };
const NodeBuffer = (globalThis as unknown as { Buffer?: NodeBuffer }).Buffer;
const latin1Decoder = NodeBuffer ? null : new TextDecoder("latin1");
const latin1 = (bytes: Uint8Array): string =>
  NodeBuffer ? NodeBuffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).latin1Slice() : latin1Decoder!.decode(bytes);
const utf8 = new TextDecoder();

/** `[origin, pathname, search]` of an absolute request URL (`search` with its `?`, or ""). */
function split(url: string): [string, string, string] {
  const start = url.indexOf("/", url.indexOf("//") + 2);
  if (start < 0) return [url, "/", ""];
  const origin = url.slice(0, start);
  const query = url.indexOf("?", start);
  const end = url.indexOf("#", start);
  const stop = end < 0 ? url.length : end;
  return query < 0 || query > stop ? [origin, url.slice(start, stop), ""] : [origin, url.slice(start, query), url.slice(query, stop)];
}
/** Lower-case names of a `Vary` value. */
const varyNames = (value: string | null): string[] =>
  value
    ? value
        .split(",")
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean)
    : [];
/** The whole body of a rendered page: from the renderer's slabs (`DIRECT_BODY`) when it has them, else its stream. */
function bodyOf(response: Response): Promise<Uint8Array> {
  const direct = (response as { [DIRECT_BODY]?: DirectBody })[DIRECT_BODY];
  if (!direct || response.body?.locked) return response.arrayBuffer().then((buffer) => new Uint8Array(buffer));
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    const releases: (() => void)[] = [];
    let size = 0;
    const attached = direct({
      // Views into pooled slabs: held (not released) until the end, then copied once.
      write(chunk, done) {
        chunks.push(chunk);
        releases.push(done);
        size += chunk.byteLength;
        return undefined;
      },
      end() {
        const body = new Uint8Array(size);
        let at = 0;
        for (const chunk of chunks) body.set(chunk, (at += chunk.byteLength) - chunk.byteLength);
        for (const done of releases) done();
        resolve(body);
      },
      error(error) {
        for (const done of releases) done();
        reject(error);
      },
    });
    if (!attached) response.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject);
  });
}
/** A Response of known bytes that the node adapter writes without reading a stream (`DIRECT_BODY`). */
function bytesResponse(body: Uint8Array | null, init: ResponseInit): Response {
  const response = new Response(body as Uint8Array<ArrayBuffer> | null, init);
  if (body)
    Object.defineProperty(response, DIRECT_BODY, {
      value: ((sink) => {
        try {
          sink.write(body, () => {});
          sink.end();
        } catch {
          // The sink closed (client gone).
        }
        return true;
      }) satisfies DirectBody,
    });
  return response;
}
// Pages not stored for a reason worth a warning (a nonce outside the renderer's tags): once per path, bounded.
const warned = new Set<string>();
/** How long a key whose page varies by credentials renders without a fill attempt. */
const PERSONAL_MS = 10_000;
const warn = (path: string, why: string) => {
  if (warned.size >= 256 || warned.has(path)) return;
  warned.add(path);
  console.warn(`[rivet] routeRules: ${path} not cached: ${why}`);
};
/** Refresh backoff after `failures` failed background renders: 1 s doubling to 5 min. */
const backoff = (failures: number) => Math.min(1000 * 2 ** (failures - 1), 300_000);

/** A fill's stored page (null: not stored) and the response for its own request. */
interface Filled {
  readonly page: CachedPage | null;
  readonly response: Response;
}

/** @internal What `withRouteRules` hands the shell cache (`shell-cache.ts` `createShells`). */
export interface ShellHost {
  readonly handler: AppHandler;
  readonly store: Store;
  readonly csp: CachePolicy;
  readonly fixed: string | undefined;
  readonly dev: boolean;
  /** Build identity (the resume runtime's URL): part of each shell's `h`. */
  readonly build: string;
  keyOf(cache: Cache, origin: string, path: string, search: string, header: HeaderOf): string;
  secondMiss(cache: Cache, search: string, header: HeaderOf): boolean;
  readonly doorkeeper: Set<string>;
  withHeaders(response: Response, headers: Resolved["headers"]): Response;
}
/** @internal The shell cache's request entry (`shell-cache.ts`); undefined: render without it. */
export type ShellServe = (
  request: Request,
  context: Parameters<AppHandler>[1],
  resolved: Resolved,
  origin: string,
  path: string,
  search: string,
) => Promise<Response> | undefined;

/**
 * Wrap the app's handler with route rules. `base`: the app's base path (stripped before matching). The result
 * carries `ROUTE_CACHE` (node adapter fast path). `shells`: the shell cache module (`createApp` loads it only for
 * rules with `shell`); `internal.dev`: shell rules only probe (never store; reasons logged), `internal.build`: build id.
 */
export function withRouteRules(
  handler: AppHandler,
  rules: RouteRules,
  csp: CachePolicy,
  base = "",
  options: RouteCacheOptions = {},
  shells?: { createShells(host: ShellHost): ShellServe },
  internal: { dev?: boolean; build?: string } = {},
): CachingHandler {
  const fixed = options.origin === undefined ? undefined : new URL(options.origin).origin;
  const resolve = compileRules(rules, fixed !== undefined);
  const store = new Store(options.maxBytes ?? 32 * 1024 * 1024, options.maxEntries ?? 5000, base);
  stores.add(new WeakRef(store));
  // Keys of client-chosen input are stored on their second miss (`secondMiss`: attacker-chosen query strings,
  // hosts, header values never evict pages).
  const doorkeeper = new Set<string>();
  const flights = new Map<string, Promise<CachedPage | null>>();
  // Keys whose page the credentials choose (`cookies: true` + `Vary: cookie`): never stored, so for a while requests
  // render once, as themselves, instead of an anonymous fill first (two renders per cookie request).
  const personal = new Map<string, number>();
  /**
   * Keys made of client-chosen input are stored on their second miss: a query string, an origin without a fixed
   * `origin` (any `Host`), a value of a keyed header (`varies`, learned Vary names). Others on the first.
   */
  const secondMiss = (cache: Cache, search: string, header: HeaderOf): boolean => {
    if (search || fixed === undefined) return true;
    for (const name of cache.varies) if (header(name)) return true;
    for (const name of cache.learned) if (header(name)) return true;
    return false;
  };
  const below = (pathname: string): string | null =>
    !base ? pathname : pathname === base ? "/" : pathname.startsWith(base + "/") ? pathname.slice(base.length) : null;

  const keyOf = (cache: Cache, origin: string, path: string, search: string, header: HeaderOf): string => {
    let query = "";
    if (search && cache.query !== false) {
      if (cache.query === true) query = search;
      else {
        const params = new URLSearchParams(search);
        const kept = new URLSearchParams();
        for (const name of cache.query) for (const value of params.getAll(name)) kept.append(name, value);
        query = kept.size ? "?" + kept : "";
      }
    }
    let key = origin + path + "\0" + query;
    for (const name of cache.varies) key += "\0" + (header(name) ?? "");
    for (const name of cache.learned) key += "\0" + (header(name) ?? "");
    return key;
  };
  /** The rule's cache for a request, or undefined when it bypasses the cache. */
  const cacheFor = (
    resolved: Resolved | undefined,
    method: string,
    origin: string,
    canonical: boolean,
    search: string,
    header: HeaderOf,
  ): Cache | undefined => {
    const cache = resolved?.cache;
    if (!cache || !canonical || (method !== "GET" && method !== "HEAD") || (fixed !== undefined && origin !== fixed)) return undefined;
    // Data requests (client navigation JSON), credentials.
    if (search && search.includes(DATA_PARAM)) return undefined;
    if (header("authorization") != null || (!cache.cookies && header("cookie") != null)) return undefined;
    return cache;
  };

  const lookup: CacheLookup = (method, origin, pathname, search, header) => {
    const raw = below(pathname);
    if (raw === null) return undefined;
    const { match, canonical } = normalPath(raw);
    const cache = cacheFor(resolve(match), method, origin, canonical, search, header);
    if (!cache) return undefined;
    const page = store.get(keyOf(cache, origin, match, search, header));
    if (!page || Date.now() >= page.fresh) return undefined;
    page.used = true;
    return page;
  };

  const withHeaders = (response: Response, headers: Resolved["headers"]): Response => {
    if (!headers.length) return response;
    try {
      for (const [name, value] of headers) response.headers.set(name, value);
      return response;
    } catch {
      // Immutable headers (a fetched / redirect Response): copy.
      const copy = new Response(response.body, response);
      for (const [name, value] of headers) copy.headers.set(name, value);
      return copy;
    }
  };
  const shellServe = shells?.createShells({
    handler,
    store,
    csp,
    fixed,
    dev: internal.dev === true,
    build: internal.build ?? "",
    keyOf,
    secondMiss,
    doorkeeper,
    withHeaders,
  });
  const age = (page: CachedPage, now: number) => String(Math.max(0, Math.floor((now - page.created) / 1000)));
  /** Serve a stored page (`state`: HIT / STALE), 304 when the request's validators hold. */
  const serve = (page: CachedPage, request: Request, state: string): Response => {
    page.used = true;
    const headers = new Headers();
    const unchanged = notModified(page, request.headers.get("if-none-match"), request.headers.get("if-modified-since"));
    for (const [name, value] of page.headers) if (!unchanged || KEPT_304.has(name)) headers.set(name, value);
    headers.set("age", age(page, Date.now()));
    headers.set("x-rivet-cache", state);
    if (unchanged) return new Response(null, { status: 304, headers });
    return bytesResponse(request.method === "HEAD" ? null : page.body, { status: 200, headers });
  };

  /**
   * Render for the store: a request of its own (a client going away does not abort it), without the visitor's
   * `Cookie` / `Authorization` (stored pages are anonymous). Not stored: non-200, non-HTML, `Set-Cookie`, private /
   * no-store, a `Vary` the key cannot follow, a reported render failure (error fallback), a nonce the hash policy
   * cannot replace, a `revalidate()` since the render started.
   */
  async function fill(
    key: string,
    origin: string,
    path: string,
    search: string,
    cache: Cache,
    resolved: Resolved,
    request: Request,
    context: Parameters<AppHandler>[1],
  ): Promise<Filled> {
    const filling = { path, tags: cache.tags, void: false };
    store.filling.add(filling);
    // Anonymous, visitor-neutral render: no credentials, no client address / per-visitor proxy headers (unless keyed).
    const sent = new Headers();
    request.headers.forEach((value, name) => {
      if (!VISITOR.test(name) || cache.varies.includes(name)) sent.set(name, value);
    });
    const detached = new Request(request.url, { headers: sent });
    let response: Response;
    try {
      const { address: _address, ...neutral } = context ?? {};
      response = await handler(detached, neutral);
    } catch (error) {
      store.filling.delete(filling);
      throw error;
    }
    const type = response.headers.get("content-type") ?? "";
    const control = response.headers.get("cache-control") ?? "";
    const vary = varyNames(response.headers.get("vary"));
    if (
      response.status !== 200 ||
      !response.body ||
      !/^text\/html\b/i.test(type) ||
      response.headers.has("set-cookie") ||
      /\b(?:private|no-store)\b/i.test(control) ||
      vary.includes("*") ||
      // Chosen by credentials (the i18n guard's `Vary: cookie`): stored only when the rule keys the other inputs, and
      // never when cookie requests share the store (`cookies: true`: their cookie may choose another page).
      (vary.some((name) => CREDENTIALS.has(name)) && (!cache.varies.length || cache.cookies))
    ) {
      store.filling.delete(filling);
      if (vary.some((name) => CREDENTIALS.has(name))) {
        if (personal.size >= 10_000) personal.clear();
        personal.set(key, Date.now() + PERSONAL_MS);
      }
      // Not stored, so not shared: a visitor whose credentials the anonymous render left out (`cookies: true`) gets
      // a render of their own request (their cookie may choose the locale, the session, …).
      if (request.headers.has("cookie") || request.headers.has("authorization")) {
        void response.body?.cancel().catch(() => {});
        response = await handler(request, context);
      }
      return { page: null, response: withHeaders(response, resolved.headers) };
    }
    // The whole page (a stream failure rejects: a miss answers 500).
    let rendered: Uint8Array;
    try {
      rendered = await bodyOf(response);
    } finally {
      store.filling.delete(filling);
    }
    const nonce = context?.nonce?.replace(/[^\w+/=-]/g, "");
    const own = response.headers.get("content-security-policy");
    let body: Uint8Array | null = rendered;
    let policy = own;
    if (nonce) {
      if (csp.hash && own !== null && own === csp.policy(context!.nonce!)) {
        // The app's nonce policy → hashes of the elements carrying this render's nonce (never injected markup).
        const text = latin1(rendered);
        const found = noncedSources(text, nonce, !!csp.hash.directives, (from, to) => utf8.decode(rendered.subarray(from, to)));
        if (!found) {
          warn(path, "its CSP nonce appears outside the renderer's script / style tags");
          body = null;
        } else {
          const sha = async ([from, to]: [number, number]) => `'sha256-${await digest("SHA-256", rendered.subarray(from, to))}'`;
          policy = hashPolicy(await Promise.all(found.scripts.map(sha)), found.origins, await Promise.all(found.styles.map(sha)), csp.hash, false);
          // The stored body without its ` nonce="…"` attributes (byte ranges cut out, no re-encoding).
          const cut = nonce.length + 9;
          if (found.attrs.length) {
            body = new Uint8Array(rendered.byteLength - found.attrs.length * cut);
            let from = 0;
            let to = 0;
            for (const at of found.attrs) {
              body.set(rendered.subarray(from, at), to);
              to += at - from;
              from = at + cut;
            }
            body.set(rendered.subarray(from), to);
          }
        }
      } else if (own !== null && own.includes(`'nonce-${nonce}'`)) {
        // A policy that trusts this render's nonce (a `csp` function, a route's own): a stored copy would hand it to everyone.
        body = null;
      }
    }
    const stored = body !== null && (detached as unknown as Record<symbol, unknown>)[RENDER_FAILED] !== true && !filling.void;
    const now = Date.now();
    const modifiedAt = Math.floor(now / 1000) * 1000;
    const headers: [string, string][] = [];
    response.headers.forEach((value, name) => {
      if (name === "content-length" || name === "content-security-policy" || name === "age" || name === "vary") return;
      if (!stored || (name !== "cache-control" && name !== "etag" && name !== "last-modified")) headers.push([name, value]);
    });
    // Vary: the response's names and the rule's (CDNs keep one copy per value too).
    const varies = [...new Set([...vary, ...cache.varies])];
    if (varies.length) headers.push(["vary", varies.join(", ")]);
    const etag = stored ? `W/"${(await digest("SHA-1", body!)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")}"` : "";
    if (stored) headers.push(["cache-control", cache.control], ["etag", etag], ["last-modified", new Date(modifiedAt).toUTCString()]);
    for (const header of resolved.headers) {
      const at = headers.findIndex(([name]) => name === header[0]);
      if (at >= 0) headers.splice(at, 1);
      headers.push([header[0], header[1]]);
    }
    // This request's copy: its own nonce (and policy).
    const out = new Headers(headers);
    if (own !== null) out.set("content-security-policy", own);
    if (stored) {
      out.set("age", "0");
      out.set("x-rivet-cache", "MISS");
    }
    const answer = bytesResponse(request.method === "HEAD" ? null : rendered, { status: 200, headers: out });
    if (!stored) return { page: null, response: answer };
    // Response Vary names beyond the rule's: keyed from now on (this page under its full key).
    let storedKey = key;
    const extra = vary.filter((name) => name !== "accept-encoding" && !CREDENTIALS.has(name) && !cache.varies.includes(name) && !cache.learned.includes(name));
    if (extra.length) {
      cache.learned.push(...extra);
      storedKey = keyOf(cache, origin, path, search, (name) => request.headers.get(name));
    }
    const pageHeaders: [string, string][] = policy === null ? headers : [...headers, ["content-security-policy", policy]];
    let size = body!.byteLength + storedKey.length * 2;
    for (const [name, value] of pageHeaders) size += name.length + value.length;
    const page: CachedPage = {
      key: storedKey,
      path,
      tags: cache.tags,
      body: body!,
      headers: pageHeaders,
      etag,
      modified: new Date(modifiedAt).toUTCString(),
      modifiedAt,
      created: now,
      fresh: now + cache.maxAge * 1000,
      stale: now + (cache.maxAge + cache.swr) * 1000,
      used: false,
      size,
      failures: 0,
      retry: 0,
      charge: (bytes) => store.grow(page, bytes),
    };
    store.set(page);
    return { page, response: answer };
  }
  /**
   * One render per key at a time: the filler's promise, whose page concurrent misses are served. `stale`: the stored
   * page a background refresh replaces — a 404 / 410 drops it, any other failure keeps it and backs off.
   */
  const start = (
    key: string,
    origin: string,
    path: string,
    search: string,
    cache: Cache,
    resolved: Resolved,
    request: Request,
    context: Parameters<AppHandler>[1],
    stale?: CachedPage,
  ) => {
    const run = fill(key, origin, path, search, cache, resolved, request, context);
    // A page that is gone (404 / 410), moved (3xx) or now personal (Set-Cookie): drop it; else keep it and back off.
    const failed = (status: number, cookie: boolean) => {
      if (!stale || store.get(key) !== stale) return;
      if (status === 404 || status === 410 || (status >= 300 && status < 400) || cookie) store.delete(key);
      else stale.retry = Date.now() + backoff(++stale.failures);
    };
    const flight = run.then(
      (result) => {
        if (!result.page) failed(result.response.status, result.response.headers.has("set-cookie"));
        return result.page;
      },
      () => (failed(500, false), null),
    );
    flights.set(key, flight);
    void flight.then(() => flights.delete(key));
    return run;
  };

  const wrapped = async (request: Request, context?: Parameters<AppHandler>[1]): Promise<Response> => {
    const [origin, pathname, search] = split(request.url);
    const raw = below(pathname);
    const { match: path, canonical } = raw === null ? { match: "", canonical: false } : normalPath(raw);
    const resolved = raw === null ? undefined : resolve(path);
    if (!resolved) return handler(request, context);
    // Seeded `locals` (`context.locals`): the page depends on input that is not in the URL, so it is neither read
    // from nor written to the store (rule headers still apply).
    if (context?.locals) return withHeaders(await handler(request, context), resolved.headers);
    // Shell rules (documents): stored shell + live holes (`shell-cache.ts`); undefined = render as usual.
    if (resolved.shell && shellServe && canonical) {
      const served = shellServe(request, context, resolved, origin, path, search);
      if (served) return served;
    }
    const header: HeaderOf = (name) => request.headers.get(name);
    const cache = cacheFor(resolved, request.method, origin, canonical, search, header);
    if (!cache) return withHeaders(await handler(request, context), resolved.headers);
    const key = keyOf(cache, origin, path, search, header);
    const page = store.get(key);
    const now = Date.now();
    if (page) {
      if (now < page.fresh) return serve(page, request, "HIT");
      if (now < page.stale) {
        if (!flights.has(key) && now >= page.retry) start(key, origin, path, search, cache, resolved, request, context, page).catch(() => {});
        return serve(page, request, "STALE");
      }
      store.delete(key);
    }
    const until = personal.get(key);
    if (until !== undefined) {
      if (now < until) return withHeaders(await handler(request, context), resolved.headers);
      personal.delete(key);
    }
    const flight = flights.get(key);
    let admit = false;
    if (flight) {
      const filled = await flight;
      if (filled) return serve(filled, request, "HIT");
    } else if (request.method === "GET" && (!(admit = secondMiss(cache, search, header)) || doorkeeper.has(key))) {
      return (await start(key, origin, path, search, cache, resolved, request, context)).response;
    } else if (admit) {
      if (doorkeeper.size >= 10_000) doorkeeper.clear();
      doorkeeper.add(key);
    }
    return withHeaders(await handler(request, context), resolved.headers);
  };
  return Object.assign(wrapped, { [ROUTE_CACHE]: lookup });
}
