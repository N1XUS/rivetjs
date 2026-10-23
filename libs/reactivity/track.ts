// `_trackReads` (resume ABI): the reads of a function, through computeds. Its own module (DIET-CODE 2026-10-22) so a
// client build puts it next to its only callers (derived runtime lazy lists, server derived recording, dev tools) instead of the eager reactivity chunk.
import { _COLLECTOR, _SOURCE, _keyedRead, _swapObserver } from "./index.ts";
import type { _Collector, _Getter, _KeySource, _Node, _Selector, _Source, _Tracked, KeyedRead, Signal } from "./index.ts";

// Dedupe by linear scan up to this many entries, then by a Set (most bindings read 1–3 signals).
const SCAN = 16;
const EMPTY: Signal<unknown>[] = Object.freeze([]) as never;
// Append `item` unless present; returns the (possibly promoted) index Set.
function unique(list: unknown[], index: Set<unknown> | null, item: unknown): Set<unknown> | null {
  if (index !== null) {
    if (index.has(item)) return index;
    index.add(item);
  } else if (list.includes(item)) return null;
  else if (list.length === SCAN) (index = new Set(list)).add(item);
  list.push(item);
  return index;
}
// The collector's `add` (track() calls `node.add(source)`): one shared function, no closure per
// `_trackReads` call; referenced only from `_trackReads`, so bundles without it drop `collect` too.
function collectThis(this: _Collector, source: _Tracked): void {
  collect(this, source);
}
// A selector read inside the collector (`selectorRead`): reported to the keyed hook when the wake can be the key's own —
// the source is a signal and the selector's change hint one resume knows (`KeyedRead` kinds) — and then read without
// listing the signal; otherwise the source's reads are the collector's, as any read.
function collectKey(this: _Collector, selector: _Selector, key: unknown): unknown {
  if (this.keyed === null || !_keyedRead(this.keyed, selector, key)) return selector.fn(key, selector.source());
  _swapObserver(null);
  try {
    return selector.fn(key, selector.source());
  } finally {
    _swapObserver(this);
  }
}
function collect(collector: _Collector, source: _Tracked): void {
  let item: _Getter | _Node;
  if (source.kind === _SOURCE) item = (source as _Source).getter!;
  else {
    item = source as _Node;
    collector.computed = true;
  }
  if (collector.reads === null) collector.reads = [item];
  else collector.index = unique(collector.reads, collector.index, item);
}
// Leaf signals below the collected reads, depth-first in first-read order (computeds visited once).
interface Walk {
  signals: Signal<unknown>[];
  index: Set<unknown> | null;
  visited: _Node[];
  vindex: Set<unknown> | null;
  keyed: KeyedRead | null;
}
function walk(state: Walk, item: _Getter | _Tracked): void {
  if (typeof item === "function") state.index = unique(state.signals, state.index, item);
  else if (item.kind === _SOURCE) {
    const getter = (item as _Source).getter;
    if (getter !== null) state.index = unique(state.signals, state.index, getter);
    // A `selector` key source (no getter, `value` = its _Selector): keyed (the collector's hook took it), else the signals
    // behind it are its watcher's.
    else {
      const selector = (item as _Source).value as _Selector;
      if (state.keyed !== null && _keyedRead(state.keyed, selector, (item as _KeySource).key)) return;
      const watcher = selector.node;
      if (watcher !== null) walk(state, watcher);
    }
  } else {
    const visited = state.visited,
      length = visited.length;
    state.vindex = unique(visited, state.vindex, item);
    if (visited.length === length) return;
    const sources = (item as _Node).sources;
    if (sources === null) return;
    if (!Array.isArray(sources)) walk(state, sources);
    else for (let i = 0; i < sources.length; i++) walk(state, sources[i]);
  }
}

/** Resume ABI: run fn untracked by the caller and report the signals it read, through computeds.
 * `signals` is read-only (a shared frozen empty array when nothing was read). `arg` is passed to fn
 * (compiled server attribute reads are module-level functions over their captures array). */
export function _trackReads<T, A = undefined>(fn: (arg: A) => T, arg?: A, keyed?: KeyedRead | null): { value: T; signals: Signal<unknown>[] } {
  const collector: _Collector = {
    kind: _COLLECTOR,
    disposed: false,
    add: collectThis,
    key: collectKey,
    keyed: keyed ?? null,
    reads: null,
    index: null,
    computed: false,
  };
  const previousObserver = _swapObserver(collector);
  let value: T;
  try {
    value = fn(arg as A);
  } finally {
    _swapObserver(previousObserver);
  }
  const reads = collector.reads;
  if (reads === null) return { value, signals: EMPTY };
  if (!collector.computed) return { value, signals: reads as Signal<unknown>[] };
  const state: Walk = { signals: [], index: null, visited: [], vindex: null, keyed: collector.keyed };
  for (let i = 0; i < reads.length; i++) walk(state, reads[i]);
  return { value, signals: state.signals.length ? state.signals : EMPTY };
}

/** Resume ABI: the signals the reactive nodes owned under `owner` (effects, computeds, at any depth) read, through
 * computeds — a derived lazy list's sample row: reads of bindings the row writers do not see (spread / attribute
 * effects of child components) wake the list too. */
export function _ownedReads(owner: unknown): Signal<unknown>[] {
  if (owner === null || typeof owner !== "object") return EMPTY;
  const state: Walk = { signals: [], index: null, visited: [], vindex: null, keyed: null };
  const visit = (o: { first: unknown }): void => {
    for (let c = o.first as { first: unknown; next: unknown; sources?: unknown } | null; c !== null; c = c.next as typeof c) {
      if (c.sources !== undefined) walk(state, c as unknown as _Node);
      visit(c);
    }
  };
  visit(owner as { first: unknown });
  return state.signals.length ? state.signals : EMPTY;
}
