// Lazy collection rows in the browser (LAZY-ROWS T5, spec docs/design/specs/2026-10-19-lazy-collection-rows-design.md
// §3.4): the resume runtime's half of state `L`. Only builds with `rivet({ resume: { lazyRows: true } })` contain it:
// `dom-resume.ts` creates it under the build-time constant `LAZY_ROWS` (`lazy-rows.ts`, which the compiler plugin
// replaces with `true` for those builds), so every other build drops this module and the adopt-run hooks of the DOM
// runtime (0 bytes; LAZY-T5B).
//
// Row k of a lazy For is plain server markup between the marker pair of id m = forId + 1 + k. It materialises — its row
// function runs in adopt mode over those nodes (`dom-adopt.ts` `_adoptRow`) — on the first event inside it (the lazy
// add-on / `q` give the loader a synthetic `["L", [], chunks]` capture entry per event type the rows handle), when a
// signal the rows read changes (a wake: every row of the For; flag 8 = the reads did not encode: at idle), and on
// `_materialise(node)` (cdk focus / `aria-activedescendant` targets). A re-created For region keys the rows like adopted
// server rows: kept rows stay as they are (inert or materialised), rows it keeps materialise later through its row
// function. State: 0 inert, 1 materialised, 2 dead (dropped, or its region died).
import {
  _bindingEffect1,
  _dispose,
  _rootIn,
  getOwner,
  _setRegionStateHook,
  _wrapEffects,
  effect,
  memberKeys,
  provide,
  runWithOwner,
  untrack,
} from "@rivetjs/reactivity";
import { _trackReads } from "@rivetjs/reactivity/track";
import { _adoption, _delegateBelow, _insert } from "./dom-v2.ts";
import { _region, _regionHost, _ABSENT_STATE } from "./dom-adopt.ts";
import { _adoptRow } from "./dom-adopt-run.ts";
import { _inIdScope, _rowIdPrefix } from "./id.ts";
import { _keyAt, _placeholderContext } from "./resume-format.ts";
import { DEV } from "#dev";
import type { Owner, Signal } from "@rivetjs/reactivity";
import type { ForRow } from "./dom-v2.ts";
import type { AdoptedBranch, AdoptedRow, AdoptedState, LazyHost } from "./dom-adopt.ts";
import type { RowPlanCache } from "./dom-adopt-run.ts";
import type { LazyRowsEntry, LoaderApi, RegionLocals, RegionProviders, ResumeState, SymbolRef } from "./resume-format.ts";

interface Markers {
  start: Comment;
  end: Comment | null;
}
/** What the lazy rows need of one `createResume` instance (its closure state; getters for what `start` assigns). */
export interface LazyContext {
  readonly state: ResumeState;
  readonly doc: Document;
  readonly api: LoaderApi;
  readonly root: Owner | null;
  /** Whether table entry `ref` was decoded already. */
  decoded(ref: number): boolean;
  get(ref: number): unknown;
  markers(): Map<number, Markers>;
  ready(chunks: number[]): boolean;
  report(ref: SymbolRef, error: unknown): void;
  isDead(region: number | undefined): boolean;
  ownerOf(region: number | undefined): Owner | null;
  /** Region id → parent region id. */
  parents: Map<number, number>;
  named(ref: SymbolRef): string;
  idle(fn: () => void): unknown;
  /** Run `fn` outside the cold replay's listener recording (the replay's `replayed` cleared, as `drain` does). */
  unrecorded(fn: () => void): void;
  /** A replayed handler moved focus away from `element` (cold key events dispatched before retarget to the focus). */
  blurred(element: Element): void;
}
/** The hooks `dom-resume.ts` calls (each behind `LAZY_ROWS`). */
export interface LazyRows {
  /** Register the lazy row records of the state / a streamed patch (`start`, `patch`). */
  register(): void;
  /** A signal was armed (decoded): rows reading it wake on its first change. */
  arm(ref: number, source: Signal<unknown>): void;
  /** Re-create a lazy For's region (`activate`): true when `node` is one (its rows keyed by the re-created For). */
  region(
    node: number,
    range: Markers,
    read: () => unknown,
    kept: (AdoptedBranch | undefined)[] | null,
    state: AdoptedState | null,
    provided: <T>(fn: () => T) => T,
    log: ((took: boolean) => void) | null,
  ): boolean;
  /** `q`: an element directly in an inert lazy row → the row's id, with its synthetic entries. */
  id(x: Element): string | undefined;
  /** `ResumeInstance.L`: true when a cold replay's delegated handler canceled the event. */
  L(event: Event, m: number, next: Element | null): boolean;
  /** A cold key event replayed where focus is now (`dispatch`): materialise the lazy row holding the focused element. */
  focus(node: Node): void;
  /** Cold events → their path at dispatch (`cold`): a lazy row's delegated handlers run over it in the replay. */
  paths: WeakMap<Event, EventTarget[]>;
}

interface LazyRow {
  f: LazyFor;
  k: number;
  m: number;
  state: 0 | 1 | 2;
  owner: Owner | null;
  /** The re-created For's row keeping it (its item / index sources and owner). */
  row: ForRow | null;
  loading: boolean;
  /** Row writers (LAZY-BLOCKERS): the server elements their element captures resolve to (null: not the sampled ones). */
  els: (Element | null)[] | null;
}
/**
 * A row writer (LAZY-BLOCKERS, the lazy rows twin of DERIVED-C's keyed row writers): a hoisted `_fx1` binding of a lazy
 * For's row reading a signal the rows share (entry [7]), with captures every inert row supplies without running —
 * `[0, value]` the same object / function in every sampled row (the signal, a context value) or undefined, `[1, path,
 * name]` the row's element at an element-index path from its start, `[2]` its item getter, `[3]` its index getter. A
 * change of the signal reruns the writers over the inert rows (on their server nodes) instead of materialising every row.
 */
type WArg = [0, unknown] | [1, number[], string] | [2] | [3];
interface LazyWriter {
  fn: (a: unknown, b: unknown, c: unknown) => void;
  args: WArg[];
  /** Its element capture's slot in `LazyRow.els` (-1: none). */
  slot: number;
}
const some = (x: unknown): boolean => Array.isArray(x) && x.length > 0;
/** One detached sample run of a row: the signals it read outside `_fx1` bindings, and those bindings with their reads. */
interface Sample {
  frag: DocumentFragment;
  item: () => unknown;
  index: () => number;
  outside: Set<unknown>;
  fxs: [fn: LazyWriter["fn"], args: unknown[], reads: Set<unknown>][];
}
/** Keyed reads of one selector source (entry [12]): the rows by the key they read. */
interface KeyedWake {
  f: LazyFor;
  kind: number;
  byKey: Map<unknown, LazyRow[]>;
  rows: LazyRow[];
}
interface LazyFor {
  e: LazyRowsEntry;
  rows: LazyRow[];
  /** The re-created For's row function and item reader. */
  host: Parameters<LazyHost> | null;
  woken: boolean;
  state: Map<number, RegionLocals> | null;
  /** Row plan (T6): rows of the same structure adopt without a probe run. */
  plan: RowPlanCache;
  /** Row writers per read signal (null: that signal wakes the For); the first and last rows' samples (null: unusable). */
  writers: Map<Signal<unknown>, LazyWriter[] | null> | null;
  samples: [Sample, Sample] | null | undefined;
}

// Created directly by the row run (`enterRow`): only provide / catchError owners (context frames) and the dev runtime's
// per-component owners between the creating owner and the row's — as `dom-adopt.ts` `direct` for a region's `_adoptState`
// (a copy: this chunk only, the eager runtime keeps its bytes).
const direct = (owner: Owner | null, at: Owner | null): boolean => {
  type Frame = { parent: Frame | null; ctx: { owner: Frame } | null };
  const dev = _adoption.dev;
  for (let o = owner as unknown as Frame | null; o !== (at as unknown as Frame); o = o.parent)
    if (o === null || (o.ctx?.owner !== o && (dev === null || !dev.has(o)))) return false;
  return true;
};

/** @internal The lazy rows of one resume runtime (`createResume`, `LAZY_ROWS` builds only). */
export function _lazyRows(c: LazyContext): LazyRows {
  const { get, markers, parents } = c;
  const lazyRows = new Map<number, LazyRow>(),
    lazyOf = new Map<number, LazyFor[]>(), // region id → its lazy Fors (server order), until the region re-creates
    wakes = new Map<number, LazyFor[]>(), // signal ref → lazy Fors whose rows read it
    keyedWakes = new Map<number, KeyedWake[]>(); // signal ref → keyed reads of it (T6)
  let lazySeen = 0,
    lazyEnds: WeakMap<Node, number> | null = null;
  const provideList = <T>(providers: RegionProviders, fn: () => T, i = 0): T =>
    i === providers.length
      ? fn()
      : provide(
          _placeholderContext(typeof providers[i] === "number" ? (c.state.t[providers[i] as number] as string) : (providers[i] as string)),
          get(providers[i + 1] as number),
          () => provideList(providers, fn, i + 2),
        );
  function register(): void {
    const state = c.state,
      list = state.L;
    if (!list) return;
    for (; lazySeen < list.length; lazySeen++) {
      const e = list[lazySeen]!,
        held = state.t[e[3]] as { j?: unknown[] } | unknown[] | null,
        // The row count [13] when the items entry does not show it: a module static data reference (DIET-STATE 1) decodes
        // only once its chunk is loaded (with the rows' chunks, `e[6]`), a DOM-backed tree from the page.
        count = Array.isArray(held) ? held.length : held?.j ? held.j.length : (((e as unknown[])[13] as number | undefined) ?? (get(e[3]) as unknown[]).length),
        f: LazyFor = { e, rows: [], host: null, woken: false, state: null, plan: {}, writers: null, samples: undefined };
      for (let k = 0; k < count; k++) {
        const row: LazyRow = { f, k, m: e[0] + 1 + k, state: 0, owner: null, row: null, loading: false, els: null };
        lazyRows.set(row.m, row);
        f.rows.push(row);
      }
      if (Array.isArray(e[8])) {
        f.state = new Map();
        for (let i = 0; i < e[8].length; i += 2) f.state.set(e[8][i] as number, e[8][i + 1] as RegionLocals);
      }
      (lazyOf.get(e[1]) ?? lazyOf.set(e[1], []).get(e[1])!).push(f);
      if (e[7])
        for (const ref of e[7])
          if (c.decoded(ref)) armWake(get(ref) as Signal<unknown>, [f]);
          else (wakes.get(ref) ?? wakes.set(ref, []).get(ref)!).push(f);
      const keyed = e[12];
      if (keyed)
        for (let i = 0; i < keyed.length; i += 3) {
          const ref = keyed[i] as number,
            list = keyed[i + 2] as unknown[] | 1,
            w: KeyedWake = { f, kind: keyed[i + 1] as number, byKey: new Map(), rows: [] },
            add = (row: LazyRow | undefined, key: unknown) => {
              if (!row) return;
              w.rows.push(row);
              (w.byKey.get(key) ?? w.byKey.set(key, []).get(key)!).push(row);
            };
          if (list === 1) {
            // Every row reads its own key (key path `by`).
            const items = get(e[3]) as unknown[];
            for (const row of f.rows) add(row, _keyAt(items[row.k], e[4] as string));
          } else for (let j = 0; j < list.length; j += 2) add(f.rows[list[j] as number], list[j + 1]);
          if (c.decoded(ref)) armKeyed(get(ref) as Signal<unknown>, [w]);
          else (keyedWakes.get(ref) ?? keyedWakes.set(ref, []).get(ref)!).push(w);
        }
      // Rows reading signals (LAZY-BLOCKERS): their row chunks evaluate now (the runtime starts at the first interaction),
      // so a write wakes them in the writer's flush, not one chunk load later. A recorded row's binding chunks load with
      // the writing handler's (its entry's extras, which `lazyReaders` gives lazy rows' chunks too), but a lazy row's own
      // handlers are client ones whose captures were never encoded (cdk Tabs: a tab's press selects, the panel rows woke
      // with their chunk still loading — the panel showed a frame later; masonry Space right after a click: the rows'
      // `resume-builtins` chunk was still evaluating).
      if ((e[7] || keyed) && !c.ready(e[6])) c.api.ensure(e[6]).catch((error: unknown) => c.report("lazy rows r" + e[0], error));
      if (e[5] & 8) c.idle(() => wake(f));
      // Rows with client effects / listeners: materialised at idle, as a recorded effect runs (`effects` [11]).
      const effects = e[11];
      if (effects) c.idle(() => effects.forEach((k) => materialise(f.rows[k]!)));
    }
    lazyEnds = null;
    _adoption.materialise = (node) => {
      const row = rowOf(node);
      return !!row && materialise(row);
    };
  }
  // A read signal's first change wakes its Fors — unless their rows read it only through row writers (LAZY-BLOCKERS): each
  // change then reruns those over the inert rows (after the change: the writers read the new value), nothing materialises.
  function armWake(source: Signal<unknown>, fors: LazyFor[]): void {
    beforeWrite(source, () => untrack(() => fors.forEach((f) => f.woken || writersFor(f, source) || wake(f))));
    runWithOwner(c.root, () => {
      let first = true;
      effect(() => {
        source();
        if (first) return void (first = false);
        untrack(() =>
          fors.forEach((f) => {
            if (f.woken) return;
            const writers = writersFor(f, source);
            if (writers) rewrite(f, writers);
            else wake(f);
          }),
        );
      });
    });
  }
  // The row writers of `f` for `source` (null: it wakes the For), from detached sample runs of its first and last rows:
  // every `_fx1` binding reading it must have captures each row supplies, and no other read of it (outside a binding:
  // the row body, a nested Show / For, a component's effect) may exist. Rows of a chunk still loading: null, not kept.
  function writersFor(f: LazyFor, source: Signal<unknown>): LazyWriter[] | null {
    const known = f.writers?.get(source);
    if (known !== undefined) return known;
    if (f.rows.length < 2 || !c.ready(f.e[6])) return null;
    if (f.samples === undefined) {
      // Component rows (row locals, providers, client effects or keyed selector reads: cdk collection items) are never
      // sampled — a detached run of their components registers with shared state (collection / focus managers).
      const e = f.e,
        first = some(e[8]) || some(e[10]) || some(e[11]) || some(e[12]) ? null : sampleRow(f, 0),
        last = first && sampleRow(f, f.rows.length - 1);
      f.samples = first && last ? [first, last] : null;
    }
    const writers = f.samples && sampled(f.samples, source);
    (f.writers ??= new Map()).set(source, writers);
    return writers;
  }
  function sampled([x, y]: [Sample, Sample], source: Signal<unknown>): LazyWriter[] | null {
    if (x.outside.has(source) || y.outside.has(source) || x.fxs.length !== y.fxs.length) return null;
    const writers: LazyWriter[] = [];
    let slots = 0;
    for (let i = 0; i < x.fxs.length; i++) {
      const [fn, xs, reads] = x.fxs[i]!,
        [other, ys, more] = y.fxs[i]!;
      if (!reads.has(source) && !more.has(source)) continue;
      if (fn !== other) return null;
      const w: LazyWriter = { fn, args: [], slot: -1 };
      for (let j = 0; j < 3; j++) {
        const a = describeArg(x, xs[j]),
          b = describeArg(y, ys[j]);
        if (!a || !b || !sameArg(a, b)) return null;
        w.args.push(a);
      }
      const elements = w.args.filter((arg) => arg[0] === 1).length;
      if (elements > 1) return null;
      if (elements) w.slot = slots++;
      writers.push(w);
    }
    return writers.length ? writers : null;
  }
  // Row k's row function run detached (create mode, the row's providers / id scope / `_regionState` values) with every
  // effect's reads recorded: those of `_fx1` bindings per binding (`_adoption.fx`), the rest as `outside`.
  function sampleRow(f: LazyFor, k: number): Sample | null {
    const e = f.e,
      fn = get(e[2]) as (item: () => unknown, index: () => number) => unknown,
      value = (get(e[3]) as unknown[])[k],
      frag = c.doc.createDocumentFragment(),
      anchor = c.doc.createTextNode(""),
      out: Sample = { frag, item: () => value, index: () => k, outside: new Set(), fxs: [] },
      hook = _adoption.fx,
      holder = { owner: null as Owner | null };
    let tag: Set<unknown> | null = null;
    frag.append(anchor);
    const wrap = _wrapEffects((run) => {
      const reads = tag ?? out.outside;
      return () => {
        const tracked = _trackReads(run);
        for (const s of tracked.signals) reads.add(s);
        return tracked.value;
      };
    });
    _adoption.fx = (g, a, b, d) => {
      const reads = new Set<unknown>(),
        at = tag;
      out.fxs.push([g, [a, b, d], reads]);
      tag = reads;
      try {
        _bindingEffect1(g, a, b, d);
      } finally {
        tag = at;
      }
    };
    try {
      // `enterRow` inside the root, as a probe / adopt run (`_adoptRow`): its direct creations are the row root's.
      const run = () => _rootIn(c.ownerOf(parents.get(e[1])), () => enterRow(f.rows[k]!, true)(() => _insert(null, fn(out.item, out.index), anchor)), holder);
      for (const s of _trackReads(run).signals) out.outside.add(s);
      return out;
    } catch {
      return null;
    } finally {
      _adoption.fx = hook;
      _wrapEffects(wrap);
      _dispose(holder.owner);
    }
  }
  // A writer capture as a row-independent descriptor (null: no inert row could supply it). Primitives never are (a row's
  // local value equal in both samples by chance).
  function describeArg(s: Sample, a: unknown): WArg | null {
    if (a === s.item) return [2];
    if (a === s.index) return [3];
    if (a instanceof Element) {
      if (!s.frag.contains(a)) return null;
      const path: number[] = [];
      for (let n: Element = a; ; n = n.parentNode as Element) {
        let i = 0;
        for (let p = n.previousElementSibling; p !== null; p = p.previousElementSibling) i++;
        path.unshift(i);
        if (n.parentNode === s.frag) return [1, path, a.localName];
      }
    }
    return a === undefined || (a !== null && (typeof a === "object" || typeof a === "function")) ? [0, a] : null;
  }
  const sameArg = (x: WArg, y: WArg): boolean =>
    x[0] === y[0] && (x[0] === 0 ? x[1] === y[1] : x[0] === 1 ? x[2] === (y as typeof x)[2] && x[1].join() === (y as typeof x)[1].join() : true);
  // Rerun `writers` over every inert row of `f` still on the page (materialised rows have their own bindings; a kept row
  // reads its item / index from the re-created For). A row whose element capture is not the sampled element materialises.
  function rewrite(f: LazyFor, writers: LazyWriter[]): void {
    const items = get(f.e[3]) as unknown[],
      host = f.host;
    rows: for (const row of f.rows) {
      if (row.state || (row.row === null && c.isDead(f.e[1]))) continue;
      const marks = markers().get(row.m);
      if (!marks?.end || !marks.start.isConnected) continue;
      const kept = row.row,
        item = kept && host ? (host[1].bind(kept) as () => unknown) : () => items[row.k],
        index = kept ? (kept.index as unknown as () => number) : () => row.k;
      for (const w of writers) {
        const v: unknown[] = [];
        for (const arg of w.args) {
          const x = arg[0] === 0 ? arg[1] : arg[0] === 2 ? item : arg[0] === 3 ? index : element(row, marks, w.slot, arg[1], arg[2]);
          if (x === null) {
            materialise(row, true);
            continue rows;
          }
          v.push(x);
        }
        try {
          w.fn(v[0], v[1], v[2]);
        } catch (error) {
          c.report("lazy row " + row.m, error);
        }
      }
    }
  }
  // The row's server element at an element-index path from its start marker (cached per writer slot), null when it is not
  // the sampled element (another tag, missing).
  function element(row: LazyRow, marks: Markers, slot: number, path: number[], name: string): Element | null {
    const els = (row.els ??= []);
    let el = els[slot];
    if (el === undefined) {
      let n: Node | null = marks.start.nextSibling;
      for (let i = path[0]!; n !== null && n !== marks.end; n = n.nextSibling) if (n.nodeType === 1 && i-- === 0) break;
      el = n !== null && n !== marks.end ? (n as Element) : null;
      for (let d = 1; el !== null && d < path.length; d++) el = el.children[path[d]!] ?? null;
      els[slot] = el = el !== null && el.localName === name ? el : null;
    }
    return el;
  }
  // Keyed reads (T6): a change materialises only the rows whose key may have flipped — the previous and next value
  // (kind 0) or `memberKeys` of the two (kind 1; null: every row of the read). Writes through the signal's `set` /
  // `update` materialise those rows before the value changes (LAZY-BLOCKERS: rows adopt the server markup with the values
  // it was rendered from, then their own bindings see the change — the row losing a selection keeps its server
  // `SelectionIndicator` as a live instance, which snapshots for the new one's move instead of the new one entering);
  // the effect covers any other write (after the change, as before).
  function armKeyed(source: Signal<unknown>, list: KeyedWake[]): void {
    const flip = (next: unknown, before: unknown): void =>
      untrack(() => {
        for (const w of list) {
          if (w.f.woken) continue;
          const keys = w.kind === 0 ? [next, before] : memberKeys(next, before);
          if (keys === null) for (const row of w.rows) materialise(row, true);
          else for (const key of keys) w.byKey.get(key)?.forEach((row) => materialise(row, true));
        }
      });
    beforeWrite(source, (next) => flip(next, untrack(source)));
    runWithOwner(c.root, () => {
      let first = true,
        previous: unknown;
      effect(() => {
        const next = source();
        if (first) return void ((first = false), (previous = next));
        const before = previous;
        previous = next;
        flip(next, before);
      });
    });
  }
  // Run `fn(next)` before each `set` / `update` (`update` calls `set`) of a read signal that changes its value.
  function beforeWrite(source: Signal<unknown>, fn: (next: unknown) => void): void {
    const write = source.set;
    source.set = function (this: Signal<unknown>, value: unknown) {
      if (!Object.is(untrack(source), value)) fn(value);
      return write.call(this, value);
    } as Signal<unknown>["set"];
  }
  function wake(f: LazyFor): void {
    if (f.woken) return;
    f.woken = true;
    for (const row of f.rows) materialise(row, true);
  }
  // The lazy row whose markers enclose `node` directly (its next comment sibling is the row's end marker), from `node` up.
  const endId = (node: Node): number | undefined => {
    // (`q` also sees the window / document of an event path: no siblings.)
    let end = node.nextSibling;
    while (end != null && end.nodeType !== 8) end = end.nextSibling;
    if (end == null || (end as Comment).data !== "]") return;
    if (lazyEnds === null) {
      lazyEnds = new WeakMap();
      for (const id of lazyRows.keys()) {
        const marks = markers().get(id);
        if (marks?.end) lazyEnds.set(marks.end, id);
      }
    }
    return lazyEnds.get(end);
  };
  const rowOf = (node: Node | null): LazyRow | undefined => {
    for (let n = node; n !== null && n.nodeType !== 9; n = n.parentNode) {
      const id = endId(n),
        row = id === undefined ? undefined : lazyRows.get(id);
      if (row) return row;
    }
  };
  // Row k's providers, id scope and `_regionState` values around one run of its row function (probe or adopt), called
  // under the row's own owner. The server ships the values the row created directly (`server-resume-lazy.ts` `lazyLocal`);
  // they go by position to the row's direct creations only (`direct`: not inside a binding, branch or nested row — the
  // browser runs those in insertion order, the server in document order), the others are created afresh.
  const enterRow =
    (row: LazyRow, outer: boolean) =>
    <T>(fn: () => T): T => {
      const e = row.f.e,
        locals = row.f.state?.get(row.k),
        values = locals ? locals.l.map((ref) => (ref === null ? _ABSENT_STATE : get(ref))) : null,
        nested = locals?.n,
        at = getOwner();
      let next = 0;
      type Hook = <V>(create: () => V) => V;
      const previous: Hook | null | undefined =
        values === null
          ? undefined
          : (_setRegionStateHook(<V>(create: () => V): V => {
              if (next < values.length && direct(getOwner(), at)) {
                const i = next++,
                  value = values[i];
                if (value !== _ABSENT_STATE) return (nested && (next += nested[i]!), value) as V;
              }
              return previous ? previous(create) : create();
            }) as Hook | null);
      try {
        const run = () => _inIdScope({ prefix: _rowIdPrefix(e[0], row.k), n: 0 }, fn);
        // Before its region re-creates, a row runs under the server's providers (after: the re-created For's own).
        return outer && Array.isArray(e[10]) ? provideList(e[10], run) : run();
      } finally {
        if (values !== null) _setRegionStateHook(previous!);
      }
    };
  // Materialise a row now (true: it is materialised) — or once its chunk loaded (false meanwhile).
  function materialise(row: LazyRow, woken = false): boolean {
    if (row.state) return row.state === 1;
    const f = row.f,
      e = f.e;
    if (row.row === null && c.isDead(e[1])) return ((row.state = 2), false);
    if (!c.ready(e[6])) {
      if (!row.loading) {
        row.loading = true;
        c.api.ensure(e[6]).then(
          () => ((row.loading = false), materialise(row, woken)),
          (error: unknown) => c.report("lazy row " + row.m, error),
        );
      }
      return false;
    }
    const marks = markers().get(row.m);
    if (!marks?.end) {
      if (DEV) console.warn("Rivet resume: " + DEV.hint("missing lazy row r" + row.m, "drift"));
      return ((row.state = 2), false);
    }
    row.state = 1;
    try {
      const kept = row.row,
        host = f.host;
      let rowFn: () => unknown, parent: Owner | null;
      if (kept !== null && host !== null) {
        rowFn = () => host[0](host[1].bind(kept) as () => unknown, kept.index as unknown as () => number);
        parent = kept.owner;
      } else {
        const fn = get(e[2]) as (item: () => unknown, index: () => number) => unknown,
          item = (get(e[3]) as unknown[])[row.k],
          k = row.k;
        rowFn = () =>
          fn(
            () => item,
            () => k,
          );
        // Under the For region's parent: a materialised row outlives the region's re-creation (the For keeps it).
        parent = c.ownerOf(parents.get(e[1]));
      }
      const verify =
        DEV && !woken
          ? (first: string) => {
              if (DEV)
                console.warn(
                  "Rivet resume: " +
                    DEV.hint(
                      "lazy row " +
                        row.k +
                        " (r" +
                        row.m +
                        ") of <For> r" +
                        e[0] +
                        " (" +
                        c.named((c.state.t[e[2]] as { f?: SymbolRef } | null)?.f as SymbolRef) +
                        "): server " +
                        first,
                      "lazy",
                    ),
                );
            }
          : null;
      row.owner = _adoptRow(parent, enterRow(row, kept === null), rowFn, marks.start, marks.end, verify, f.plan);
    } catch (error) {
      c.report("lazy row " + row.m, error);
    }
    return true;
  }
  // A row the re-created For dropped (or never took): its materialised content dies with it.
  const lazyDrop = (row: LazyRow): void => {
    row.state = 2;
    _dispose(row.owner);
    row.owner = null;
  };
  const paths = new WeakMap<Event, EventTarget[]>();
  return {
    register,
    paths,
    arm(ref, source) {
      // Lazy rows reading it (entry [7]): its first change materialises every row of those Fors (a wake).
      const fors = wakes.get(ref),
        keyed = keyedWakes.get(ref);
      if (fors) (wakes.delete(ref), armWake(source, fors));
      if (keyed) (keyedWakes.delete(ref), armKeyed(source, keyed));
    },
    region(node, range, read, kept, state, provided, log) {
      // A lazy For's region: the re-created For keys its server rows (inert ones stay inert, materialised ones keep their
      // bindings); rows it keeps materialise later through its row function (`LazyHost`). One `_region` adopts one list:
      // the region's first lazy For keys its rows, a further one's rows are re-created.
      const fors = lazyOf.get(node);
      if (!fors) return false;
      const [f, ...rest] = fors;
      lazyOf.delete(node);
      for (const g of rest) for (const r of g.rows) lazyDrop(r);
      const items = get(f!.e[3]) as unknown[],
        adopted: AdoptedRow[] = [];
      for (const r of f!.rows) {
        const marks = r.state === 2 ? undefined : markers().get(r.m);
        if (!marks?.end) continue;
        adopted.push({
          item: items[r.k],
          index: r.k,
          flags: f!.e[5] & 1,
          start: marks.start,
          end: marks.end,
          dispose: () => lazyDrop(r),
          own: (row) => void (r.row = row),
        });
      }
      const host: LazyHost = (children, read) => void (f!.host = [children, read]);
      const took = provided(() => (_regionHost(host), _region(range.start, range.end!, read, adopted, kept, state)));
      if (!took) for (const row of adopted) row.dispose();
      log?.(took);
      return true;
    },
    // Twin: the inline add-on's `$rw` (`resume-lazy.ts`) answers the same before the runtime started.
    id(x) {
      if (!lazyRows.size) return;
      const id = endId(x),
        row = id === undefined ? undefined : lazyRows.get(id);
      if (!row || row.state) return;
      const h = (c.state.e[id!] ??= {});
      for (const type of (row.f.e[9] || "").split(" ")) if (type) h[type + "!"] ??= ["L", [], row.f.e[6]];
      return "" + id;
    },
    // A lazy row's synthetic entry on the event's path (`deliver`): materialise the row. A live event then reaches its
    // handlers natively (they attached inside the loader's capture listener); a cold replay (dispatch over) runs its
    // delegated ones over the recorded path, up to `next` (the next target's element), and its direct listeners through
    // `late` (attached as the loader's `drain` would: seen by this event). The replayed handlers see their own
    // `preventDefault` only, as `dispatch`'s replays do: the loader canceled the cold event, and a handler canceling it
    // must stop its held default's replay (LAZY-BLOCKERS: a CheckboxButton label's `onClick` preventDefault + press
    // toggle, then the replayed label activation toggled the input back — ui `/pro-forms` `#sh-cbg`).
    L(event, m, next) {
      const row = lazyRows.get(m);
      if (!row) return false;
      c.unrecorded(() => void materialise(row));
      const path = paths.get(event);
      if (event.eventPhase !== 0 || !path || row.state !== 1 || !event.bubbles) return false;
      let prevented = false;
      Object.defineProperties(event, {
        composedPath: { configurable: true, value: () => path },
        preventDefault: { configurable: true, value: () => void (prevented = true) },
        defaultPrevented: { configurable: true, get: () => prevented },
      });
      // A handler moving focus (sync or in a microtask) retargets the cold key events queued before (`dispatch`).
      const before = c.doc.activeElement;
      if (before) queueMicrotask(() => c.doc.activeElement !== before && c.blurred(before));
      try {
        _delegateBelow(event, next ?? c.doc);
      } finally {
        delete (event as { composedPath?: unknown }).composedPath;
        delete (event as { preventDefault?: unknown }).preventDefault;
        delete (event as { defaultPrevented?: unknown }).defaultPrevented;
      }
      return prevented;
    },
    focus(node) {
      const row = rowOf(node);
      if (row) c.unrecorded(() => void materialise(row));
    },
  };
}
