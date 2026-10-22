// Cross-request render cache (`@rivetjs/runtime/server-cache`, spec docs/design/specs/2026-10-07-render-cache-design.md).
//
// - `cached(Component)`: a component whose server output depends only on its props (+ module constants)
//   renders once per distinct props key; later requests get the same frozen compiled record, whose UTF-8
//   bytes the byte writers encode once per process (`server.ts` encode cache) — a hit is one key build,
//   one Map lookup and a memcpy.
// - `shell(Layout, { holes })`: the layout renders once with sentinel holes; requests splice their own
//   hole values (children) into the cached fragments.
// - Request scope (`withRenderCache`): the cache, locale variant, CSP nonce, partition. No scope → every
//   wrapper renders normally (safe default: an integrator that forgot the scope never serves cached bytes).
// - Ids (`createId`): a probe counts in its own namespace `rv-<hash of the key>-` (deterministic, apart
//   from the render's `rv` ids); a fragment holding ids is replayed at most once per render (`claim`), a
//   second use in the same page renders normally. Wrappers inside a probe render normally (an entry's
//   bytes never depend on which page populated the cache).
// - Conservative at run time too: a render that reads signals, turns async, carries resume markers or the
//   request's nonce is used for this request only and never stored (the wrapper turns itself off).
//
// Pay-per-use: only apps importing this subpath carry it (and its AsyncLocalStorage).
import { AsyncLocalStorage } from "node:async_hooks";
import { DEV } from "#dev";
import { getOwner } from "@rivetjs/reactivity";
import { _trackReads } from "@rivetjs/reactivity/track";
import { _compiledRecord, template } from "./template.ts";
import { renderToString } from "./server.ts";
import { isSlot, _slot } from "./slot.ts";
import { _rUnrecorded } from "./resume-format.ts";
import { _idScope, _inIdScope, type IdScope } from "./id.ts";
import type { ServerValue } from "./server.ts";

/** Cache bounds and policy. */
export interface RenderCacheOptions {
  /** Approximate retained bytes (keys + HTML + its UTF-8 encoding); least recently used entries go first. Default 16 MiB. */
  maxBytes?: number;
  /** Entry count bound. Default 10,000. */
  maxEntries?: number;
  /** Default time to live in ms (per wrapper `ttl` overrides). Default: no expiry. */
  ttl?: number;
  /**
   * `"second"` (default): a key is stored the second time it is seen (a doorkeeper set of recent keys), so a
   * stream of unique keys (attacker-chosen props, per-user data) never displaces useful entries. `"first"`: store at once.
   */
  admit?: "first" | "second";
  /**
   * Development verification: every hit also renders fresh and compares (mismatch → console.warn, entry
   * evicted, wrapper off); every miss renders twice (non-deterministic output → wrapper off). Default:
   * on under the `development` condition.
   */
  verify?: boolean;
  /** Longest props key (characters) worth caching; longer → rendered normally. Default 8,192. */
  maxKey?: number;
}
/** Counters (since creation or `clear()`). */
export interface RenderCacheStats {
  hits: number;
  misses: number;
  /** Calls rendered normally: no scope, unkeyable props, wrapper off. */
  bypass: number;
  stores: number;
  evictions: number;
  entries: number;
  bytes: number;
}
interface Entry {
  key: string;
  /** Frozen fragments (one more than holes); `cached`: one fragment. */
  fragments: readonly string[];
  /** Shells: slot j = hole order[j]. */
  order: readonly number[] | null;
  /** `cached`: the shared zero-slot record every hit returns. */
  record: ServerValue;
  html: string;
  /** Id prefix of the ids inside (usable once per render); null: no ids. */
  ids: string | null;
  expires: number;
  used: boolean;
  size: number;
}

/** A bounded process-local LRU (CLOCK) of rendered fragments. Never shared across processes. */
export class RenderCache {
  declare readonly stats: RenderCacheStats;
  declare readonly verify: boolean;
  declare readonly maxKey: number;
  declare ttl: number;
  declare private entries: Map<string, Entry>;
  declare private seen: Set<string> | null;
  declare private maxBytes: number;
  declare private maxEntries: number;
  constructor(options: RenderCacheOptions = {}) {
    this.stats = { hits: 0, misses: 0, bypass: 0, stores: 0, evictions: 0, entries: 0, bytes: 0 };
    this.verify = options.verify ?? DEV !== false;
    this.maxKey = options.maxKey ?? 8192;
    this.ttl = options.ttl ?? 0;
    this.entries = new Map();
    this.seen = options.admit === "first" ? null : new Set();
    this.maxBytes = options.maxBytes ?? 16 * 1024 * 1024;
    this.maxEntries = options.maxEntries ?? 10_000;
  }
  /** @internal */
  get(key: string): Entry | undefined {
    const entry = this.entries.get(key);
    if (entry === undefined) return undefined;
    if (entry.expires !== 0 && entry.expires <= Date.now()) {
      this.remove(entry);
      return undefined;
    }
    entry.used = true;
    return entry;
  }
  /** @internal Store unless the doorkeeper has not seen the key yet; returns the stored entry. */
  put(key: string, fragments: readonly string[], order: readonly number[] | null, ttl: number, ids: string | null, html = fragments.join("")): Entry | null {
    const seen = this.seen;
    if (seen !== null && !seen.has(key)) {
      if (seen.size >= this.maxEntries) seen.clear();
      seen.add(key);
      return null;
    }
    seen?.delete(key);
    // UTF-16 key + string HTML + its UTF-8 encoding (≤ 3 bytes / unit, latin-1 mostly 1) + object overhead.
    const size = 2 * key.length + 3 * html.length + 160;
    if (size > this.maxBytes) return null;
    const old = this.entries.get(key);
    if (old) this.remove(old);
    const entry: Entry = {
      key,
      fragments,
      order,
      record: order === null ? (_compiledRecord(fragments, []) as ServerValue) : null,
      html,
      ids,
      expires: ttl > 0 ? Date.now() + ttl : 0,
      used: false,
      size,
    };
    this.entries.set(key, entry);
    this.stats.stores++;
    this.stats.entries++;
    this.stats.bytes += size;
    while (this.stats.bytes > this.maxBytes || this.stats.entries > this.maxEntries) this.evict();
    return entry;
  }
  /** @internal */
  remove(entry: Entry): void {
    if (this.entries.get(entry.key) !== entry) return;
    this.entries.delete(entry.key);
    this.stats.entries--;
    this.stats.bytes -= entry.size;
  }
  // CLOCK: the oldest entry goes unless it was used since the last pass (then it moves to the end, unmarked).
  private evict(): void {
    for (const entry of this.entries.values()) {
      if (entry.used) {
        entry.used = false;
        this.entries.delete(entry.key);
        this.entries.set(entry.key, entry);
        continue;
      }
      this.remove(entry);
      this.stats.evictions++;
      return;
    }
  }
  /** Drop every entry (deploy, data change) and reset the counters. */
  clear(): void {
    this.entries.clear();
    this.seen?.clear();
    Object.assign(this.stats, { hits: 0, misses: 0, bypass: 0, stores: 0, evictions: 0, entries: 0, bytes: 0 });
  }
}

/** Create a render cache (one per process / app; pass it to `withRenderCache` per request). */
export function createRenderCache(options?: RenderCacheOptions): RenderCache {
  return new RenderCache(options);
}

/** Per-request cache scope: everything outside props a cached fragment may depend on, or must never contain. */
export interface RenderCacheScope {
  cache: RenderCache;
  /** Locale variant of this render (`RenderOptions.variant`): part of every key; fragments render with it. */
  variant?: number;
  /** This response's CSP nonce: a fragment containing it is never stored. */
  nonce?: string;
  /** Key namespace (tenant, host, build hash, A/B bucket): entries never cross partitions. */
  partition?: string;
  /** The render's abort signal: an aborted render stores nothing. */
  signal?: AbortSignal;
  /**
   * A resumable render (`renderResumable`): only wrappers marked `inert` (compiler-proven, or asserted: no
   * handlers, bindings, refs, effects, client events, `_regionState`) are cached; others render normally.
   */
  resumable?: boolean;
  /** Off switch (e.g. preview / draft mode): every wrapper renders normally. */
  disabled?: boolean;
}
const store = new AsyncLocalStorage<RenderCacheScope>();
/** Run `fn` (a render) with a cache scope. Wrappers outside any scope render normally. */
export function withRenderCache<T>(scope: RenderCacheScope, fn: () => T): T {
  return store.run(scope, fn);
}

/** Options of `cached` / `shell`. */
export interface CachedOptions<P> {
  /** Diagnostics name (compiler: `<module>#<Component>`). */
  id?: string;
  /** Key from props (default: all props). Must capture everything the output depends on. */
  key?: (props: P) => unknown;
  /** Time to live in ms (default: the cache's). */
  ttl?: number;
  /** No resume activity inside (compiler-proven or asserted): cacheable in resumable renders too. */
  inert?: boolean;
}
export interface ShellOptions<P> extends CachedOptions<P> {
  /** Props rendered per request (holes); default `["children"]`. Each must be lazy content (a slot / function). */
  holes?: readonly (keyof P & string)[];
}

let serial = 0;
// Self-delimiting, injective encoding of plain data (no escaping needed): strings length-prefixed,
// numbers / bigints `;`-terminated, brackets for arrays / objects. `false`: not plain data (functions,
// signals, class instances, slots, records, symbols, too deep / too long) → not cacheable.
const MAX_DEPTH = 32;
let budget = 0;
function encode(value: unknown, depth: number): string | false {
  switch (typeof value) {
    case "string":
      return (budget -= value.length) < 0 ? false : "s" + value.length + ":" + value;
    case "number":
      return Object.is(value, -0) ? "n-0;" : "n" + value + ";";
    case "boolean":
      return value ? "t" : "f";
    case "undefined":
      return "U";
    case "bigint":
      return "b" + value + ";";
    case "object":
      break;
    default:
      return false;
  }
  if (value === null) return "N";
  if (depth >= MAX_DEPTH || --budget < 0) return false;
  if (Array.isArray(value)) {
    let out = "[";
    for (let i = 0; i < value.length; i++) {
      const item = encode(value[i], depth + 1);
      if (item === false) return false;
      out += item;
    }
    return out + "]";
  }
  const proto = Object.getPrototypeOf(value);
  if (proto === Date.prototype) return "D" + (value as Date).getTime() + ";";
  if (proto !== Object.prototype && proto !== null) return false;
  let out = "{";
  for (const key in value) {
    const item = encode((value as Record<string, unknown>)[key], depth + 1);
    if (item === false) return false;
    out += "s" + key.length + ":" + key + item;
  }
  return out + "}";
}
/** Key of `props` (or `key(props)`); false: not plain data. Getters run; reading a signal makes it unkeyable. */
function keyOf<P>(props: P, key: ((props: P) => unknown) | undefined, skip: readonly string[] | null, max: number): string | false {
  const { value, signals } = _trackReads(() => {
    budget = max;
    if (key) return encode(key(props), 0);
    if (skip === null) return encode(props, 0);
    // Shells: every prop except the holes; a hole's presence is part of the key (absent holes are no slot).
    let out = "{";
    for (const name in props as object) {
      const hole = skip.indexOf(name);
      const item = hole >= 0 ? ((props as Record<string, unknown>)[name] == null ? "N" : "H") : encode((props as Record<string, unknown>)[name], 1);
      if (item === false) return false;
      out += "s" + name.length + ":" + name + item;
    }
    return out + "}";
  });
  // A signal read is a dependency the browser tracks (enclosing region) and the key cannot hold.
  if (signals.length) {
    for (const read of signals) read();
    return false;
  }
  return value;
}

// Resume markers a resumable render writes (`data-r` ids, region / text markers): such a fragment recorded
// state for this page and can never be replayed into another one.
const RESUMED = /\sdata-r=|<!--r\d|<!--\]-->|<!--\/-->/;
interface Probe {
  /** The probe's id prefix when it created ids synchronously; null: none. */
  ids: string | null;
  /** Rendered HTML, or null when it must not be stored (also when async: `later`). */
  html: string | null;
  /** Rendered HTML regardless of storability (sync renders). */
  output: string | null;
  /** Async render: the HTML once settled (never stored). */
  later: Promise<string> | null;
  /** Why it is not storable (dev diagnostics, wrapper turned off). */
  reason: string | null;
}
// Ids. A probe renders under its own counter `prefix` (`rv-<hash of the entry key>-`): the fragment's ids
// do not depend on the request's `rv` counter, and replaying it consumes none of the request's ids. Its
// bytes are fixed, so it may appear at most once per render: `claim` reserves its prefix in the render's
// set (keyed by the render's id scope, else by the cache scope). A taken prefix (same fragment twice in
// one page, or a hash collision) → the call renders normally. Wrappers called inside a probe render
// normally (`probing`): the probe's own counter numbers their ids, so an entry's bytes and prefix never
// depend on what else the page that populated the cache rendered.
const claims = new WeakMap<object, Set<string>>();
let probing = 0;
function claimsOf(scope: RenderCacheScope): Set<string> {
  const owner: object = _idScope() ?? scope;
  let set = claims.get(owner);
  if (set === undefined) claims.set(owner, (set = new Set()));
  return set;
}
function claim(set: Set<string>, prefix: string | null): boolean {
  if (prefix === null) return true;
  if (set.has(prefix)) return false;
  set.add(prefix);
  return true;
}
// FNV-1a over the key: deterministic across processes (the key holds the wrapper serial, variant,
// partition and props); uniqueness within a page is `claim`'s job, not the hash's.
function prefixOf(key: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 0x01000193);
  return "rv-" + (hash >>> 0).toString(36) + "-";
}
// Render `fn()` to HTML in the current owner / recorder. Signal reads are re-read so enclosing trackers
// (a resumable region) still see them.
function probe(scope: RenderCacheScope, prefix: string, set: Set<string>, fn: () => ServerValue): Probe {
  const counter: IdScope = { prefix, n: 0 };
  // Async continuations (never stored, used for this request only) claim in the render's set.
  claims.set(counter, set);
  probing++;
  let tracked;
  try {
    tracked = _trackReads(() => _inIdScope(counter, () => renderToString(fn(), { signal: scope.signal, variant: scope.variant ?? 0 })));
  } finally {
    probing--;
  }
  const ids = counter.n > 0 ? prefix : null;
  const { value, signals } = tracked;
  for (const read of signals) read();
  if (typeof value !== "string") return { ids, html: null, output: null, later: value, reason: "async render" };
  let reason: string | null = null;
  if (signals.length) reason = "reads signals";
  else if (RESUMED.test(value)) reason = "records resume state";
  else if (scope.nonce && value.includes(scope.nonce)) reason = "contains the CSP nonce";
  return { ids, html: reason === null ? value : null, output: value, later: null, reason };
}
const warn = (id: string, message: string): void => console.warn(`[rivet] render cache: ${id} ${message}; rendering it uncached from now on`);

interface Wrapper {
  serial: string;
  id: string;
  off: boolean;
}
function off(wrapper: Wrapper, cache: RenderCache, reason: string): void {
  if (!wrapper.off && cache.verify) warn(wrapper.id, reason);
  wrapper.off = true;
}

/**
 * Memoize a component's server output across requests by its props. Only for components whose output
 * depends on nothing but props and module constants (the compiler proves it for `_cached` call sites);
 * see the spec's purity rules. Returns the component unchanged in behaviour when no scope is active.
 */
export function cached<P>(component: (props: P) => ServerValue, options: CachedOptions<P> = {}): (props: P) => ServerValue {
  const wrapper: Wrapper = { serial: (serial++).toString(36), id: options.id ?? (component.name || "anonymous"), off: false };
  const inert = options.inert === true,
    key = options.key;
  return (props: P): ServerValue => {
    const scope = store.getStore();
    if (scope === undefined || scope.disabled || wrapper.off || (scope.resumable && !inert) || probing > 0) {
      if (scope) scope.cache.stats.bypass++;
      return component(props);
    }
    const cache = scope.cache;
    const own = keyOf(props, key, null, cache.maxKey);
    if (own === false) {
      cache.stats.bypass++;
      return component(props);
    }
    const k = wrapper.serial + "\0" + (scope.variant ?? 0) + "\0" + (scope.partition ?? "") + "\0" + own;
    const hit = cache.get(k);
    if (hit !== undefined) {
      // Its ids are this page's once: a second use in the same render renders normally.
      if (hit.ids !== null && !claim(claimsOf(scope), hit.ids)) {
        cache.stats.bypass++;
        return component(props);
      }
      cache.stats.hits++;
      if (!cache.verify) return hit.record;
      const fresh = render(scope, wrapper, prefixOf(k), claimsOf(scope), () => component(props));
      if (fresh.output !== null && fresh.output !== hit.html) {
        cache.remove(hit);
        off(wrapper, cache, "rendered different HTML for the same key (output depends on something outside its key)");
      }
      return fresh.value;
    }
    const prefix = prefixOf(k),
      set = claimsOf(scope);
    if (!claim(set, prefix)) {
      cache.stats.bypass++;
      return component(props);
    }
    cache.stats.misses++;
    const result = render(scope, wrapper, prefix, set, () => component(props));
    // No ids in a synchronous render: nothing to reserve (the same props may render again in this page).
    if (result.output !== null && result.ids === null) set.delete(prefix);
    if (result.html === null || scope.signal?.aborted) return result.value;
    const entry = cache.put(k, Object.freeze([result.html]), null, options.ttl ?? cache.ttl, result.ids);
    return entry ? entry.record : result.value;
  };
}
// A probe render as this request's value; `html` only when storable (dev: rendered twice, equal).
function render(
  scope: RenderCacheScope,
  wrapper: Wrapper,
  prefix: string,
  set: Set<string>,
  fn: () => ServerValue,
): { html: string | null; output: string | null; ids: string | null; value: ServerValue } {
  const cache = scope.cache;
  const first = probe(scope, prefix, set, fn);
  if (first.later) {
    off(wrapper, cache, "rendered asynchronously");
    return { html: null, output: null, ids: null, value: first.later.then((html) => template([html])) as ServerValue };
  }
  const value = template([first.output!]);
  if (first.reason !== null) {
    off(wrapper, cache, first.reason);
    return { html: null, output: first.output, ids: first.ids, value };
  }
  // Dev: a second render (outside resume recording: it is discarded) must match — catches clocks, random
  // values, process-wide id counters, mutable module state.
  if (cache.verify) {
    const second = _rUnrecorded(() => probe(scope, prefix, set, fn));
    if (second.output !== first.output) {
      off(wrapper, cache, "is not deterministic (two renders differ)");
      return { html: null, output: first.output, ids: first.ids, value };
    }
  }
  return { html: first.html, output: first.output, ids: first.ids, value };
}

// Hole sentinels: comments no escaped user content can produce (`<` is always escaped), with a per-process
// random tag, so a layout's own text can never be mistaken for a hole.
const TAG = "@rvhole" + Math.random().toString(36).slice(2) + Date.now().toString(36);
const MARKS: ServerValue[] = [];
const markOf = (i: number): string => "<!--" + TAG + ":" + i + "-->";
function sentinel(i: number): ServerValue {
  return (MARKS[i] ??= template([markOf(i)]) as ServerValue);
}
type Frame = unknown;
const frameOf = (): Frame => (getOwner() as unknown as { ctx?: Frame } | null)?.ctx ?? null;

/**
 * Static shell: render `layout` once per key with its `holes` (default `children`) left open, then splice
 * each request's own hole values into the cached fragments. Holes must be lazy content (slots / functions)
 * the layout places exactly once as a child, outside any provider / error boundary of its own (checked on
 * every miss; otherwise the layout renders normally and the wrapper turns off).
 */
export function shell<P>(layout: (props: P) => ServerValue, options: ShellOptions<P> = {}): (props: P) => ServerValue {
  const wrapper: Wrapper = { serial: (serial++).toString(36), id: options.id ?? (layout.name || "anonymous"), off: false };
  const holes: readonly string[] = options.holes ?? ["children"];
  const inert = options.inert === true,
    key = options.key;
  return (props: P): ServerValue => {
    const scope = store.getStore();
    if (scope === undefined || scope.disabled || wrapper.off || (scope.resumable && !inert) || probing > 0) {
      if (scope) scope.cache.stats.bypass++;
      return layout(props);
    }
    const cache = scope.cache;
    const values: unknown[] = new Array(holes.length);
    for (let i = 0; i < holes.length; i++) {
      const value = (values[i] = (props as Record<string, unknown>)[holes[i]!]);
      if (value != null && typeof value !== "function") {
        cache.stats.bypass++;
        return layout(props);
      }
    }
    const own = key ? keyOf(props, key, null, cache.maxKey) : keyOf(props, undefined, holes, cache.maxKey);
    if (own === false) {
      cache.stats.bypass++;
      return layout(props);
    }
    const k = wrapper.serial + "\0" + (scope.variant ?? 0) + "\0" + (scope.partition ?? "") + "\0" + own;
    const hit = cache.get(k);
    // The layout's own ids are this page's once (holes render live, with the request's ids).
    if (hit !== undefined && hit.ids !== null && !claim(claimsOf(scope), hit.ids)) {
      cache.stats.bypass++;
      return layout(props);
    }
    if (hit !== undefined && !cache.verify) {
      cache.stats.hits++;
      return splice(hit.fragments, hit.order!, values);
    }
    const set = claimsOf(scope),
      prefix = prefixOf(k);
    if (hit === undefined && !claim(set, prefix)) {
      cache.stats.bypass++;
      return layout(props);
    }
    if (hit === undefined) cache.stats.misses++;
    else cache.stats.hits++;
    // Probe: the layout with sentinel holes (slots stay slots, so `isSlot` / `renderSlot` behave the same).
    // The probe's own frame (it runs under its id counter's provider): holes must render in it.
    let frame: Frame = null;
    let foreign = false;
    const open = { ...(props as object) } as Record<string, unknown>;
    for (let i = 0; i < holes.length; i++) {
      const value = values[i];
      if (value == null) continue;
      const mark = (): ServerValue => {
        if (frameOf() !== frame) foreign = true;
        return sentinel(i);
      };
      open[holes[i]!] = isSlot(value) ? _slot(mark) : mark;
    }
    const first = probe(scope, prefix, set, () => {
      frame = frameOf();
      return layout(open as P);
    });
    if (first.later) {
      off(wrapper, cache, "rendered asynchronously");
      return first.later.then((html) => {
        const parts = split(html, values, foreign);
        if (parts === null) throw new Error(`Render cache shell ${wrapper.id}: each hole must render exactly once as a child`);
        return splice(parts.fragments, parts.order, values);
      }) as ServerValue;
    }
    if (hit === undefined && first.ids === null) set.delete(prefix);
    const parts = split(first.output!, values, foreign);
    if (parts === null) {
      // Recorded resume state with sentinel holes cannot be redone: fail loudly instead of a corrupt page.
      if (RESUMED.test(first.output!)) throw new Error(`Render cache shell ${wrapper.id}: each hole must render exactly once as a child`);
      off(wrapper, cache, "does not place each hole exactly once as a child outside its own providers");
      return layout(props);
    }
    let storable = first.html !== null;
    if (first.reason !== null) off(wrapper, cache, first.reason);
    if (storable && cache.verify) {
      const second = _rUnrecorded(() =>
        probe(scope, prefix, set, () => {
          frame = frameOf();
          return layout(open as P);
        }),
      );
      if (second.output !== first.output) {
        off(wrapper, cache, "is not deterministic (two renders differ)");
        storable = false;
      } else if (hit !== undefined && hit.html !== first.output) {
        cache.remove(hit);
        off(wrapper, cache, "rendered different HTML for the same key (output depends on something outside its key)");
        storable = false;
      }
    }
    if (storable && hit === undefined && !scope.signal?.aborted) cache.put(k, parts.fragments, parts.order, options.ttl ?? cache.ttl, first.ids, first.output!);
    return splice(parts.fragments, parts.order, values);
  };
}
function split(html: string, values: readonly unknown[], foreign: boolean): { fragments: readonly string[]; order: number[] } | null {
  if (foreign) return null;
  const found: [at: number, hole: number][] = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] == null) continue;
    const mark = markOf(i),
      at = html.indexOf(mark);
    if (at < 0 || html.indexOf(mark, at + mark.length) >= 0) return null;
    found.push([at, i]);
  }
  found.sort((a, b) => a[0] - b[0]);
  const fragments: string[] = [];
  let from = 0;
  for (const [at, i] of found) {
    fragments.push(html.slice(from, at));
    from = at + markOf(i).length;
  }
  fragments.push(html.slice(from));
  return { fragments: Object.freeze(fragments), order: found.map(([, i]) => i) };
}
function splice(fragments: readonly string[], order: readonly number[], values: readonly unknown[]): ServerValue {
  const slots: ServerValue[] = new Array(order.length);
  for (let j = 0; j < order.length; j++) slots[j] = values[order[j]!] as ServerValue;
  return _compiledRecord(fragments, slots) as ServerValue;
}

/** Compiler ABI (`renderCache` option): a call site of a component the compiler proved prop-pure and resume-inert. */
export function _cached<P>(component: (props: P) => ServerValue, id: string): (props: P) => ServerValue {
  return cached(component, { id, inert: true });
}
