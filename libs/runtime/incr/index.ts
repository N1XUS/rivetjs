// Incremental server rendering of keyed lists (`@rivetjs/runtime/server-incr`, lane INCR2, opt-in).
//
// A `<For>` whose row function the compiler proved pure (`$incr` fact, `libs/compiler/rust/src/incr/`: the row reads its
// item only through static field paths, its index only when the fact says so, no outer signal / context / call / component /
// control flow; its keyed signals are literal-initialised and never written while rendering; the key function reads item
// fields only) renders the same bytes for the same field values. The cache keeps, per list (site + locale variant +
// occurrence in the page + partition), the last items' field values and each row's UTF-8 bytes; a request renders only the
// rows whose fields changed, and the renderer writes the rest as byte runs (`server.ts` `runWrite`).
//
// - Byte-identical to an uncached render: rows the cache writes are the bytes the renderer wrote for the same field values
//   (`encode.ts` reproduces the record writer), marker ids follow the render's marker chain, the rows' keyed state is what
//   their `_rSig` calls leave (`server-derived.ts` `_incrState`), duplicate keys still throw. Rows compare by position;
//   when many differ (or the length changed) and rows do not read their index, by key (`realign`: moved / inserted /
//   removed rows keep their bytes — marker ids are written per position, not stored).
// - No cross-user data: an entry is a memo of a pure function of the fields the requesting render presents; it serves bytes
//   only for exactly those values. `partition` keeps tenants apart anyway (also their timing).
// - Bounded: per list its items' field values + row bytes; lists least recently used go first past `maxBytes` / `maxLists`.
// - `verify`: every row renders and is compared with the stored bytes (a mismatch logs and counts; output stays the fresh render).
import { _onForIncr } from "../server-structural.ts";
import { CONSTANT } from "../server-structural.ts";
import type { ConstantGetter, ForIncrHook } from "../server-structural.ts";
import { _incrFrame, _incrStamp, _incrState } from "../server-derived.ts";
import { compiledTemplate, _markFragments, MARK_CHAIN } from "../template.ts";
import type { ServerValue } from "../server.ts";
import { recordHtml } from "./encode.ts";
import { installDataMemo } from "./data.ts";

/** Cache bounds and policy. */
export interface IncrCacheOptions {
  /** Approximate retained bytes (row bytes + field values); least recently used lists go first. Default 32 MiB. */
  maxBytes?: number;
  /** List count bound. Default 1000. */
  maxLists?: number;
  /** Render every row and compare it with the stored bytes (tests, DEV checks): output is always the fresh render. */
  verify?: boolean;
}
/** Counters (cumulative). */
export interface IncrStats {
  lists: number;
  bytes: number;
  /** Rows written from the cache / rendered. */
  hits: number;
  misses: number;
  /** Lists rendered without the cache (most rows changed, or no state yet). */
  bypass: number;
  evictions: number;
  /** `verify` mismatches. */
  mismatches: number;
}
/** A process-local incremental list cache (`createApp({ incr })` makes one). */
export interface IncrCache {
  readonly options: Readonly<IncrCacheOptions>;
  stats(): IncrStats;
  clear(): void;
}

/** The compiler fact of a proven `<For>` (`$incr`). */
interface Site {
  /** Site id (module + position). */
  readonly i: string;
  /** The item's read field values (row + key paths), in a fixed order. */
  readonly v: (item: unknown) => unknown[];
  /** `item`'s read fields equal `values` (`v`'s output for an earlier item). */
  readonly c: (item: unknown, values: readonly unknown[]) => boolean;
  /** Keyed signals each row makes: `[key, init, key, init, …]`. */
  readonly s: readonly unknown[];
  /** 1: rows read their index. */
  readonly x: number;
}
const validSite = (site: unknown): site is Site =>
  typeof site === "object" &&
  site !== null &&
  typeof (site as Site).i === "string" &&
  typeof (site as Site).v === "function" &&
  typeof (site as Site).c === "function";

/**
 * One list's state. Warm: per position its item's read field values (null: the row is not reused) and its row bytes —
 * buffer `bi[i]` of `bufs`, bytes `st[i]`..`en[i]` (`bi[i]` < 0: not stored). Cold (`cold` > 0, after most rows changed):
 * only the last items (identity), to notice when the list settles.
 */
interface ListState {
  n: number;
  values: (unknown[] | null)[];
  keys: unknown[];
  keyAt: Map<unknown, number> | null;
  bufs: Uint8Array[];
  bi: Int32Array;
  st: Int32Array;
  en: Int32Array;
  /** `bufs` / `bi` / `st` / `en` were handed to a run record: copy before writing. */
  shared: boolean;
  bytes: number;
  /** Keyed entries / weight one row leaves on its boundary (measured on the first rendered row; -1 unknown). */
  reg: number;
  cold: number;
  /** Cold: renders until the next probe. */
  probe: number;
  items: readonly unknown[] | null;
}

const RUN = Symbol.for("rivet.incr.run");
/** The renderer's run record (`server.ts` `runWrite`): rows `from`..`to` of a list, row `r` = `bufs[bi[r]]` bytes `st[r]`..`en[r]`. */
interface Run {
  readonly [RUN]: true;
  readonly bufs: readonly Uint8Array[];
  readonly bi: Int32Array;
  readonly st: Int32Array;
  readonly en: Int32Array;
  readonly from: number;
  readonly to: number;
  /** Row `from`'s marker id (the next rows count on); -1: tape rows (no ids). */
  readonly first: number;
}
const REGION = /* @__PURE__ */ _markFragments(["<!--r", "[-->", "<!--]-->"], MARK_CHAIN);
const ROW = /* @__PURE__ */ Object.freeze(["<!--r[-->", "<!--]-->"]);
const HEAD = "<!--r[-->",
  END = "<!--]-->";
const encoder = new TextEncoder();

// Brand (not `instanceof`): a cache made by the app's copy of this module (`serve.js` imports `@rivetjs/runtime/server-incr`)
// serves the copy bundled into the server build, whose hooks the compiled facts installed (`_incrSite`).
const CACHE = Symbol.for("rivet.incr.cache");
class Cache implements IncrCache {
  readonly [CACHE] = true;
  readonly options: Readonly<IncrCacheOptions>;
  readonly lists = new Map<string, ListState>();
  readonly maxBytes: number;
  readonly maxLists: number;
  readonly verify: boolean;
  readonly broken = new WeakSet<object>();
  total = 0;
  readonly counts: IncrStats = { lists: 0, bytes: 0, hits: 0, misses: 0, bypass: 0, evictions: 0, mismatches: 0 };
  constructor(options: IncrCacheOptions) {
    this.options = Object.freeze({ ...options });
    this.maxBytes = options.maxBytes ?? 32 * 1024 * 1024;
    this.maxLists = options.maxLists ?? 1000;
    this.verify = !!options.verify;
  }
  stats(): IncrStats {
    return { ...this.counts, lists: this.lists.size, bytes: this.total };
  }
  clear(): void {
    this.lists.clear();
    this.total = 0;
  }
  /** The list's state, most recently used last. */
  take(key: string): ListState | undefined {
    const state = this.lists.get(key);
    if (state !== undefined) {
      this.lists.delete(key);
      this.lists.set(key, state);
    }
    return state;
  }
  /** Account `state` (its bytes were `before`) and evict least recently used lists past the bounds. */
  put(key: string, state: ListState, before: number): void {
    this.total += state.bytes - before;
    if (!this.lists.has(key)) this.lists.set(key, state);
    if (this.total <= this.maxBytes && this.lists.size <= this.maxLists) return;
    for (const [k, old] of this.lists) {
      if (this.total <= this.maxBytes && this.lists.size <= this.maxLists) break;
      if (old === state) continue;
      this.lists.delete(k);
      this.total -= old.bytes;
      this.counts.evictions++;
    }
    // A list larger than the whole budget is not kept (this render still writes it).
    if (this.total > this.maxBytes && this.lists.get(key) === state) {
      this.drop(key);
      this.counts.evictions++;
    }
  }
  drop(key: string): void {
    const state = this.lists.get(key);
    if (state === undefined) return;
    this.lists.delete(key);
    this.total -= state.bytes;
  }
}

/** A cache for `createApp({ incr })` / the resumable render options' `incr`. */
export function createIncrCache(options: IncrCacheOptions = {}): IncrCache {
  return new Cache(options);
}

let installed = false;
/**
 * @internal Compiler ABI (`compile/incr.rs`): a proven list's fact, frozen; the first one installs the list / data hooks
 * into the runtime it is bundled with (an app without facts bundles none of this module).
 */
export function _incrSite<T extends object>(fact: T): Readonly<T> {
  if (!installed) {
    installed = true;
    _onForIncr(listRows);
    installDataMemo();
  }
  return Object.freeze(fact);
}

const before: number[] = [0, 0, 0, 0, 0, 0, 0, 0],
  after: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
/** Bookkeeping bytes counted per row (field values, offsets, key). */
const ROW_BYTES = 96;
/** A cold list (most rows changed last time) tries the cache again when half its items are the last ones, or every
 * `PROBE`th render (items rebuilt per request: identity never repeats). */
const PROBE = 16;
/** Compact a list's rows into one buffer when they point into more. */
const MAX_BUFFERS = 16;

const listRows: ForIncrHook = (site, items, by, children, tape) => {
  const n = items.length;
  if (n === 0 || !validSite(site)) return undefined;
  const frame = _incrFrame();
  if (frame === null) return undefined;
  const options = frame.options as { incr?: unknown; incrPartition?: string; variant?: unknown };
  const cache = options.incr as Cache | undefined;
  if (typeof cache !== "object" || cache === null || cache[CACHE] !== true || cache.broken.has(site)) return undefined;
  const occurrences = ((frame as { incrSeen?: Map<Site, number> }).incrSeen ??= new Map());
  const occurrence = occurrences.get(site) ?? 0;
  occurrences.set(site, occurrence + 1);
  const key = (options.incrPartition ?? "") + "\0" + site.i + "\0" + (options.variant ?? 0) + "\0" + occurrence;
  let state = cache.take(key);
  const counts = cache.counts;
  if (state !== undefined && state.cold > 0) {
    // Cold: the renderer's own path until the list settles (most sampled items are the last render's), or a probe is due.
    const sample = state.items!;
    let kept = 0;
    if (state.n === n) for (let k = 0; k < sample.length; k++) if (items[sampleAt(k, sample.length, n)] === sample[k]) kept++;
    if (2 * kept <= sample.length && ++state.cold < state.probe) {
      sampleOf(state, items);
      counts.bypass++;
      return undefined;
    }
    // A probe that finds the list churning again backs off (16, 32, … 256 renders).
    if (probes.size >= 4096) probes.clear();
    probes.set(key, kept * 2 > sample.length ? PROBE : Math.min(state.probe * 2, 16 * PROBE));
    cache.drop(key);
    state = undefined;
  }
  // Positions to render (`miss`) and, among them, those whose fields changed (`changed`: their key may have).
  const miss: number[] = [];
  let changed: Uint8Array | null = null,
    nchanged = 0;
  // A state rebuilt for the new order (rows matched by key): the bytes the cache accounted for the list before.
  let prior = -1;
  if (state !== undefined) {
    if (state.n !== n) {
      // Rows inserted / removed: matched by key (index-free rows), else the list starts over.
      const next = site.x === 0 ? realign(cache, key, state, site, items, by) : null;
      if (next === null) {
        cache.drop(key);
        state = undefined;
      } else {
        prior = state.bytes;
        state = adopt(cache, key, next.s);
        for (const i of next.miss) miss.push(i);
        nchanged = next.miss.length;
      }
    } else {
      const values = state.values,
        bi = state.bi,
        c = site.c;
      // (One try around the loop, resumed past a row whose fields threw: a try per row keeps V8 from inlining `c`.)
      for (let i = 0; i < n;) {
        try {
          for (; i < n; i++) {
            const v = values[i],
              item = items[i];
            if (v !== null && (typeof item !== "object" || item === null || plainProto(Object.getPrototypeOf(item))) && (c(item, v) as boolean)) {
              if (bi[i]! < 0) miss.push(i);
              continue;
            }
            miss.push(i);
            (changed ??= new Uint8Array(n))[i] = 1;
            nchanged++;
          }
        } catch {
          miss.push(i);
          (changed ??= new Uint8Array(n))[i] = 1;
          nchanged++;
          i++;
        }
      }
      // Many rows changed in place: maybe moved (a row inserted / removed / reordered); index-free rows match by key.
      if (8 * nchanged > n && site.x === 0) {
        const next = realign(cache, key, state, site, items, by);
        if (next !== null && next.miss.length < nchanged) {
          prior = state.bytes;
          state = adopt(cache, key, next.s);
          miss.length = 0;
          for (const i of next.miss) miss.push(i);
          nchanged = next.miss.length;
          changed = null;
        }
      }
    }
    // Mostly new rows: the renderer's own path; the list goes cold (keeps only the items, to see it settle).
    if (state !== undefined) {
      if (2 * nchanged > n) {
        const before = prior >= 0 ? prior : state.bytes;
        cold(state, items, probes.get(key) ?? PROBE);
        cache.put(key, state, before);
        counts.bypass++;
        return undefined;
      }
      // A realigned state: its keys are the new order's (`realign` ran `by` on every row).
      if (prior >= 0) changed = null;
    }
  }
  const fresh = state === undefined;
  const s = state ?? blank(n);
  if (prior < 0) prior = fresh ? 0 : s.bytes;
  if (fresh) for (let i = 0; i < n; i++) miss.push(i);
  // Verify: every row renders (the output is the fresh render); the rows the cache would have written are compared below.
  let check: number[] | null = null;
  if (cache.verify && miss.length < n) {
    check = [];
    for (let i = 0, m = 0; i < n; i++) {
      if (miss[m] === i) m++;
      else check.push(i);
    }
    miss.length = 0;
    for (let i = 0; i < n; i++) miss.push(i);
  }
  // Keys: the rows whose fields changed (or every row of a fresh list) run `by`; a key equal to one still held throws as
  // `For` does (before any row renders).
  try {
    if (fresh || s.keyAt === null) {
      const keyAt = new Map<unknown, number>();
      for (let i = 0; i < n; i++) {
        const k = by(items[i], i);
        if (keyAt.has(k)) throw new Error("Duplicate For key");
        keyAt.set(k, i);
        s.keys[i] = k;
      }
      s.keyAt = keyAt;
    } else if (changed !== null) {
      const keyAt = s.keyAt,
        next: unknown[] = [];
      for (const i of miss) if (changed![i]) next.push(by(items[i], i));
      for (const i of miss) if (changed![i] && keyAt.get(s.keys[i]) === i) keyAt.delete(s.keys[i]);
      let j = 0;
      for (const i of miss) {
        if (!changed![i]) continue;
        const k = next[j++];
        if (keyAt.has(k)) throw new Error("Duplicate For key");
        keyAt.set(k, i);
        s.keys[i] = k;
      }
    }
  } catch (error) {
    cache.drop(key);
    throw error;
  }
  // Render the rows to render (index order), each checked against its proof's effects, and encode them.
  const first = tape ? -1 : frame.next;
  if (!tape) frame.next += n;
  const html: (string | null)[] = new Array(miss.length);
  const records: ServerValue[] = new Array(miss.length);
  const perRow = site.s.length >> 1;
  for (let m = 0; m < miss.length; m++) {
    const i = miss[m]!,
      item = items[i];
    const get: ConstantGetter<unknown> = () => item;
    get[CONSTANT] = item;
    const at: ConstantGetter<number> = () => i;
    at[CONSTANT] = i;
    _incrStamp(frame, before);
    const record = children(get, at);
    _incrStamp(frame, after);
    const reg = after[6]! - before[6]!;
    if (
      after[0] !== before[0] ||
      after[1] !== before[1] ||
      after[2] !== before[2] ||
      after[3] !== before[3] ||
      after[4] !== before[4] ||
      after[5] !== before[5] ||
      (reg !== 0 && reg !== perRow) ||
      after[7]! - before[7]! !== reg ||
      (s.reg >= 0 && reg !== s.reg)
    ) {
      cache.broken.add(site);
      cache.drop(key);
      throw new Error("Internal error: an incremental list row (" + site.i + ") changed render state outside its compiler proof");
    }
    s.reg = reg;
    records[m] = record;
    html[m] = recordHtml(record);
  }
  // Rows written from the cache: their keyed state, as their `_rSig` calls would have left it.
  const hits = n - miss.length;
  if (hits && s.reg > 0) for (let k = 0; k < site.s.length; k += 2) _incrState(site.s[k] as string, site.s[k + 1], hits);
  counts.hits += hits;
  counts.misses += miss.length;
  if (check !== null) verifyRows(cache, site, check, html, s);
  // Encode the rendered rows into one buffer; their read fields' values become the state.
  let fallback = false;
  if (miss.length) {
    if (s.shared) unshare(s);
    let text = "";
    const ends = new Int32Array(miss.length);
    for (let m = 0; m < miss.length; m++) {
      if (html[m] !== null) text += HEAD + html[m] + END;
      else fallback = true;
      ends[m] = text.length;
    }
    let buffer = encoder.encode(text);
    if (buffer.length !== text.length) {
      // Not ASCII: row by row (byte offsets differ from string offsets).
      const parts: Uint8Array[] = [];
      let length = 0;
      for (let m = 0; m < miss.length; m++) {
        if (html[m] !== null) length += parts[parts.push(encoder.encode(HEAD + html[m] + END)) - 1]!.length;
        ends[m] = length;
      }
      buffer = new Uint8Array(length);
      for (let p = 0, at = 0; p < parts.length; at += parts[p]!.length, p++) buffer.set(parts[p]!, at);
    }
    const b = s.bufs.push(buffer) - 1;
    for (let m = 0, start = 0; m < miss.length; start = ends[m]!, m++) {
      const i = miss[m]!;
      if (html[m] === null) {
        s.bi[i] = -1;
        s.values[i] = null;
        continue;
      }
      s.bi[i] = b;
      s.st[i] = start;
      s.en[i] = ends[m]!;
      // A row whose read fields are not all scalars is written but not reused.
      s.values[i] = valuesOf(site, items[i]);
    }
    s.bytes += buffer.byteLength;
    if (s.bufs.length > MAX_BUFFERS) compact(s);
  }
  s.n = n;
  cache.put(key, s, prior);
  s.shared = true;
  if (!fallback) return { [RUN]: true, bufs: s.bufs, bi: s.bi, st: s.st, en: s.en, from: 0, to: n, first } satisfies Run;
  return mixed(s, records, miss, html, first, tape);
};

/** The cache's entry for `key` becomes `s` (accounted at the next `put` against the replaced state's bytes). */
function adopt(cache: Cache, key: string, s: ListState): ListState {
  cache.lists.set(key, s);
  return s;
}
/**
 * Rows matched by key (index-free rows: their bytes depend on their item only, marker ids are written per position): the
 * state for the new order — a stored row whose key is in the new list at any position, with equal read fields, is reused
 * there. Runs `by` on every row (a duplicate key throws as `For` does, dropping the list). The caller adopts it
 * (`adopt`); null: no keys stored.
 */
function realign(cache: Cache, key: string, s: ListState, site: Site, items: readonly unknown[], by: unknown): { s: ListState; miss: number[] } | null {
  const keyAt = s.keyAt;
  if (keyAt === null || typeof by !== "function") return null;
  const n = items.length,
    values = s.values,
    bi = s.bi,
    st = s.st,
    en = s.en,
    c = site.c;
  const next = blank(n);
  next.bufs = s.bufs.slice();
  next.reg = s.reg;
  next.probe = s.probe;
  // The stored buffers stay (rows no longer listed are dropped at the next compaction).
  next.bytes = s.bytes - s.n * ROW_BYTES + n * ROW_BYTES;
  const at = new Map<unknown, number>();
  const miss: number[] = [];
  try {
    for (let i = 0; i < n; i++) {
      const item = items[i];
      const k = (by as (item: unknown, index: number) => unknown)(item, i);
      if (at.has(k)) throw new Error("Duplicate For key");
      at.set(k, i);
      next.keys[i] = k;
      const j = keyAt.get(k);
      let hit = false;
      if (j !== undefined && bi[j]! >= 0) {
        const v = values[j]!;
        try {
          hit = v !== null && (typeof item !== "object" || item === null || plainProto(Object.getPrototypeOf(item))) && (c(item, v) as boolean);
        } catch {
          hit = false;
        }
        if (hit) {
          next.values[i] = v;
          next.bi[i] = bi[j]!;
          next.st[i] = st[j]!;
          next.en[i] = en[j]!;
        }
      }
      if (!hit) miss.push(i);
    }
  } catch (error) {
    cache.drop(key);
    throw error;
  }
  next.keyAt = at;
  return { s: next, miss };
}

/** The read fields of `item` as stored: null when one is not a scalar (or reading them throws). */
function valuesOf(site: Site, item: unknown): unknown[] | null {
  if (!plain(item)) return null;
  let values: unknown[];
  try {
    values = site.v(item);
  } catch {
    return null;
  }
  for (let k = 0; k < values.length; k++) {
    const v = values[k];
    if (v !== null && (typeof v === "object" || typeof v === "function")) return null;
  }
  return values;
}
const plainProto = (proto: unknown): boolean => proto === Object.prototype || proto === null || proto === Array.prototype;
/** Items read through field paths: primitives and plain objects / arrays (class instances may compute their fields). */
function plain(item: unknown): boolean {
  if (typeof item !== "object") return typeof item !== "function";
  if (item === null) return true;
  const proto = Object.getPrototypeOf(item);
  return proto === Object.prototype || proto === null || proto === Array.prototype;
}
function blank(n: number): ListState {
  return {
    n,
    values: new Array<unknown[] | null>(n).fill(null),
    keys: new Array<unknown>(n),
    keyAt: null,
    bufs: [],
    bi: new Int32Array(n).fill(-1),
    st: new Int32Array(n),
    en: new Int32Array(n),
    shared: false,
    bytes: n * ROW_BYTES,
    reg: -1,
    cold: 0,
    probe: PROBE,
    items: null,
  };
}
/** Most rows changed: keep only a sample of the items (identity, to see the list settle), drop the rows. */
function cold(s: ListState, items: readonly unknown[], probe: number): void {
  s.values = [];
  s.keys = [];
  s.keyAt = null;
  s.bufs = [];
  s.bi = s.st = s.en = new Int32Array(0);
  s.items = null;
  sampleOf(s, items);
  s.cold = 1;
  s.probe = probe;
  s.bytes = SAMPLE * 8;
}
// A cold list keeps `SAMPLE` items, spread over it: keeping all of them would keep every churned row alive a render longer
// (old-generation garbage).
const SAMPLE = 16;
const sampleAt = (k: number, size: number, n: number): number => Math.floor(((k + 0.5) * n) / size);
function sampleOf(s: ListState, items: readonly unknown[]): void {
  const n = items.length,
    size = Math.min(SAMPLE, n),
    sample = (s.items as unknown[] | null) ?? new Array<unknown>(size);
  sample.length = size;
  for (let k = 0; k < size; k++) sample[k] = items[sampleAt(k, size, n)];
  s.items = sample;
  s.n = n;
}
/** Per cold list: renders between probes (backs off while probes find it churning). */
const probes = new Map<string, number>();
function unshare(s: ListState): void {
  s.bufs = s.bufs.slice();
  s.bi = s.bi.slice();
  s.st = s.st.slice();
  s.en = s.en.slice();
  s.shared = false;
}
/** Copy every stored row into one buffer (a list's rows otherwise point into one buffer per render that changed rows). */
function compact(s: ListState): void {
  let total = 0;
  const n = s.bi.length;
  for (let i = 0; i < n; i++) if (s.bi[i]! >= 0) total += s.en[i]! - s.st[i]!;
  const buffer = new Uint8Array(total);
  for (let i = 0, offset = 0; i < n; i++) {
    const b = s.bi[i]!;
    if (b < 0) continue;
    const length = s.en[i]! - s.st[i]!;
    buffer.set(s.bufs[b]!.subarray(s.st[i]!, s.en[i]!), offset);
    s.bi[i] = 0;
    s.st[i] = offset;
    s.en[i] = offset += length;
  }
  s.bufs = [buffer];
  s.bytes = total + n * ROW_BYTES;
}
/** A list with rows the encoder does not write (rendered as records this render): runs between them. */
function mixed(s: ListState, records: ServerValue[], miss: number[], html: (string | null)[], first: number, tape: boolean): ServerValue {
  const parts: unknown[] = [];
  const own = new Map<number, ServerValue>();
  for (let m = 0; m < miss.length; m++) if (html[m] === null) own.set(miss[m]!, records[m]!);
  let from = 0;
  const run = (to: number) => {
    if (to > from) parts.push({ [RUN]: true, bufs: s.bufs, bi: s.bi, st: s.st, en: s.en, from, to, first: first < 0 ? -1 : first + from } satisfies Run);
  };
  for (let i = 0; i < s.bi.length; i++) {
    const record = own.get(i);
    if (record === undefined) continue;
    run(i);
    parts.push(tape ? compiledTemplate(ROW, [record]) : compiledTemplate(REGION, [first + i, record]));
    from = i + 1;
  }
  run(s.bi.length);
  return parts as unknown as ServerValue;
}
const decoder = /* @__PURE__ */ new TextDecoder();
/** Verify: the stored bytes of the rows the cache would have written, against this render's (every row rendered: `html[i]`). */
function verifyRows(cache: Cache, site: Site, check: number[], html: (string | null)[], s: ListState): void {
  for (const i of check) {
    const b = s.bi[i]!,
      fresh = html[i];
    if (b < 0 || fresh === null || fresh === undefined) continue;
    if (HEAD + fresh + END !== decoder.decode(s.bufs[b]!.subarray(s.st[i]!, s.en[i]!))) {
      cache.counts.mismatches++;
      console.error("Rivet incr: stored row " + i + " of " + site.i + " differs from a fresh render");
    }
  }
}
