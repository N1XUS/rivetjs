// Derived model, browser side (milestone M2 lane R: R2 runtime half + R3; plan docs/design/plans/2026-10-18-derived-client.md,
// spec docs/design/specs/2026-10-18-structural-resume-design.md §3.4 / §3.5). Own subpath
// (`@rivetjs/runtime/dom-derived-runtime`, pay-per-use): the page's runtime URL (tail `data-rt`) default-exports the
// instance the inline loader (`resume-loader-derived.ts`) starts. Compiled derived DOM modules import the component ABI
// from `@rivetjs/runtime/dom-derived` (`dom-derived-abi.ts`, ZERO ABI-SPLIT): a client render needs no adopt runtime;
// evaluating this module installs the implementations below (`_abi`).
//
// Component ABI (the DOM twin of `server-derived.ts`'s `_rB` / `_rSig` / `_rSigStore`):
//
//   export function Page(props) { return _b("src/page.tsx#Page", () => { const n = _sig("k3x9a-0", 0); …compiled body… }); }
//
// Boundary names are module-qualified (`<resume module id>#<export name>`, the compiler's derived DOM / server targets,
// M2 C3): the tail's `m` maps a name to its chunk, whose export is the part after the last `#` (a bare name is its own
// export, as in hand-lowered fixtures).
//
// `_b(name, body)`: outside an adopt run the body runs (client render, 1 call). In an adopt run of the enclosing unit
// it is a hole: the alignment pairs it with the server's boundary range (`<!--b<id>-->…<!--/b-->` or the `data-b`
// element), which names the server record, and the boundary is adopted after its parent as a unit of its own —
// at once when it is dependent, deferred (on its own event / trigger / wake) when its record is independent.
// `_sig(key, init)` / `_sigStore(key, init)`: keyed state; in an adopt run the value is the record's (adopted), and a
// keyed signal remembers its wake list (`w`) and the lazy lists whose rows read it.
//
// Adopt run (`adoptUnit`): the LAZY-ROWS probe / align / adopt machinery of `dom-adopt.ts` (`_adoptRow`) applied to a
// boundary: the unit's function runs detached (probe), its nodes are paired with the live server nodes, then it runs
// again with every creation returning its live twin (`_adoption.node`, the lazy rows switch's hooks) — no node is created,
// moved or replaced. Holes keep the run O(spine): child boundaries (above) and `<For>` lists (`_adoption.list`, the
// `DERIVED` switch in `_for`), which take their server rows lazily (O(1) per row, no row function runs): a row
// materialises on an event inside it, on a write to a keyed signal its rows read (sampled from one detached row run),
// or through the client For (reconcile). Show / Switch branches adopt by node identity. A structural mismatch renders
// the unit in the browser instead (dev: the adopt verifier warns first, naming the boundary).
import { _bindingEffect1, _dispose, _rootIn, _tracking, getOwner, runWithOwner, signal, untrack } from "@rivetjs/reactivity";
import { _ownedReads, _trackReads } from "@rivetjs/reactivity/track";
import type { EqualsOptions, Owner, Signal } from "@rivetjs/reactivity";
import { createStore } from "@rivetjs/reactivity/store";
import type { Store } from "@rivetjs/reactivity/store";
import { _adoption, _delegateBelow, _for, _insert, _on } from "./dom-v2.ts";
import { _delegated } from "./dom-events.ts";
import type { ForRow, InsertSlot } from "./dom-v2.ts";
import { same } from "./dom-adopt.ts";
import { _adoptRow, adopt, between, copyIn, describe, dirtyOf, gone, kids, probeRow, save, textOf } from "./dom-adopt-run.ts";
import type { Align, Answers, Current, Probe, RowPlanCache } from "./dom-adopt-run.ts";
import { _setUnrecorded, _tableDecoder } from "./resume-format.ts";
import type { BoundaryTail, DerivedAsync, DerivedDom } from "./resume-format.ts";
import { eachRecord } from "./resume-tail.ts";
import { DOM_DATA, DOM_READER } from "./dom-data.ts";
import { DEV } from "#dev";
import { _abi, _guard as guard } from "./dom-derived-abi.ts";

/** Record flags (`BoundaryRecord[2]`, `server-derived.ts`). */
const INDEPENDENT = 1,
  ATTR = 2,
  UNKEYED = 4,
  LOAD = 32,
  IDLE = 64,
  VISIBLE = 128,
  DEFER = 256,
  MOD = 512,
  BROWSER = 2048,
  CTXFREE = 4096;
const PROBE = 0,
  ADOPT = 1,
  CLIENT = 2;
const R_OPEN = /^r\d*\[$/,
  B_OPEN = /^b\d+$/,
  A_OPEN = /^a\d+$/,
  HTML_NS = "http://www.w3.org/1999/xhtml";

/** A server boundary record, as the browser tracks it. */
interface Rec {
  id: number;
  parent: Rec | null;
  flags: number;
  name: string;
  values: Map<string, unknown>;
  props: object | null;
  done: boolean;
  owner: Owner | null;
  /** Claimed by a materialised parent's adopt run: its body, owner and server range (adopted from there). */
  hole: BHole | null;
  loading: Promise<void> | null;
  /** Its component's `ready(props)` (standalone runs): settled → true, pending → the promise, none run yet → null. */
  ready: Promise<void> | true | null;
  /** Boundaries whose keyed signals this one read on the server (wake lists): materialised before it runs alone. */
  sources: Rec[] | null;
}
/** A child boundary in an adopt run: probe nodes (a comment pair), then the server range and record it pairs with. */
interface BHole {
  kind: 0;
  name: string;
  nodes: Node[];
  rec: Rec | null;
  range: Node[];
  start: Node | null;
  end: Node | null;
  body: (() => unknown) | null;
  owner: Owner | null;
  /** Its `_b` call's index in the unit run (`Unit.n`). */
  k: number;
}
/** A `<For>` in an adopt run: its row count, probe nodes, then the server row groups (`<!--rN[-->` … `<!--]-->`). */
interface FHole {
  kind: 1;
  n: number;
  nodes: Node[];
  groups: [Node, Node][] | null;
  /** The list is its element's only content (the probe's element holds just the hole): the live element, rows unscanned. */
  sole: Element | null;
  /** The server nodes `claim` gave it (not a sole list). */
  span: Node[] | null;
}
/**
 * An `Async` the server streamed or awaited (DERIVED-C2; tail / patch `a` names it by its unit and place `k`): the probe
 * gets a comment pair, the alignment its server range `<!--a<id>-->…<!--/a-->` (fallback, or the content once swapped in),
 * the adopt run a keep token for it; once its value is known its content adopts as a unit of its own (`landAsync`).
 */
interface AHole {
  kind: 2;
  id: number;
  nodes: Node[];
  start: Node | null;
  end: Node | null;
  props: { load: (work: unknown) => unknown; fallback?: unknown } | null;
  self: ((props: never) => unknown) | null;
  owner: Owner | null;
  token: { n(): Node[] };
  done: boolean;
}
/**
 * A framework island (M6-PARITY, `@rivetjs/bridge/dom` `_island` through the `rivet.island` hook): the probe gets a comment
 * pair, the alignment its server root (`<rivet-island data-ri>`), the adopt run a keep token for it; after the run the
 * bridge's `adopt` hydrates it under the unit's owner when tail `i` names it (else the lean boot owns it, or it is static).
 */
interface IHole {
  kind: 3;
  nodes: Node[];
  el: Element | null;
  run: ((root: Element, swap: typeof retarget) => void) | null;
  owner: Owner | null;
  token: { n(): Node[] };
}
type Hole = BHole | FHole | AHole | IHole;
/** One run (probe / adopt / client fallback) of a unit. */
interface Unit {
  mode: number;
  rec: Rec | null;
  holes: Hole[];
  at: number;
  counts: Map<string, number>;
  /** The unit is the boundary itself (a standalone run of its component): its own `_b` runs the body. */
  self: boolean;
  fors: Lazy[];
  /** `_b` calls so far (outside inline bodies). */
  n: number;
  /**
   * The `_b` calls (by index) whose output the probe discarded (a hole that never reached the probe's nodes: a cdk
   * collection build pass renders its items for their registration only): their bodies run inline in both runs, they
   * have no server range to adopt.
   */
  inline: Set<number> | null;
  /** Inside an inline body: every `_b` runs its body. */
  depth: number;
  /** `Async`s with a fallback so far (their place `k`, DERIVED-C2). */
  an: number;
  /** An `Async`'s content unit: its id (its own `Async`s are keyed `-aid`). */
  aid: number;
  /**
   * A `<For>` row (M6-PARITY task 4): the server numbers a boundary's `Async`s across all its rows, the row counts from
   * 0 — its `Async` holes take their ids from the server markers they claim instead.
   */
  row: boolean;
  /** A lazy list's sample run (`sampleRow`): child boundaries run inline (no holes), their `Async`s / islands stay holes. */
  all: boolean;
  /** A load suspended a `Suspense` during the probe (DERIVED-C3): the unit renders in the browser. */
  sus: boolean;
  /** Plain signals made so far (DERIVED-C4: numbered as the server did, `_dsignal`). */
  made: number;
}
/**
 * A list adopted lazily (DERIVED-C: O(1) at adopt): no row object, no client `_for` until needed — its slot keeps the
 * server rows (`_adoption.keep`) while its items are the server's; rows are built from the server groups on the first
 * event inside one, keyed write or wake (`rowsOf`), the client `_for` on the first change of its items (`realFor`).
 */
interface Lazy {
  /** Every row (null: not built yet, `rowsOf`). */
  rows: LRow[] | null;
  /** The rows built on demand before that (sparse, by index: `rowAt`), null before the first. */
  part: LRow[] | null;
  items: unknown[];
  props: { each: unknown; by: unknown; children: (item: () => never, index: () => number) => unknown };
  hole: FHole;
  /** The client `_for` (items changed), null before. */
  real: (() => Node[]) | null;
  /** The server rows do not match the items (count): the list renders in the browser on its first need. */
  bad: boolean;
  /** Set when `bad` turns up after adopt: the slot's accessor builds the client `_for`. */
  tick: Signal<number>;
  /** What the slot's accessor returns while the server rows stay (`_adoption.keep`; `n()`: those rows' nodes). */
  token: { n(): Node[] };
  children: ((item: () => unknown, index: () => number) => unknown) | null;
  read: ((this: ForRow) => unknown) | null;
  owner: Owner | null;
  rec: Rec | null;
  woken: boolean;
  /**
   * Rows adopt as plain lazy rows (`_adoptRow` + the For's row plan, LAZY-T6: no probe / alignment per row once a plan
   * holds) after a row's adopt run met no hole (child boundary, list) and no keyed state; null until a row ran.
   */
  plain: RowPlanCache | null | false;
}
interface LRow extends ForRow {
  lz: Lazy;
  done: boolean;
  /** Keyed row writers: the row's elements each writer's element captures resolve to (null: not resolved yet). */
  els: (Element | null)[] | null;
  /** Its item getter for the writers (the list's `read` bound to the row). */
  get: (() => unknown) | null;
}
/**
 * A keyed row writer (DERIVED-C): a hoisted `_fx1` binding of a list's row that reads a keyed signal, with captures
 * every row can supply without running — `[0, value]` the same value in every row (a keyed signal, undefined),
 * `[1, path, name]` the row's element at an element-index path from the row start, `[2]` the row's item getter, `[3]`
 * its index getter. A write to the signal runs the writer over each lazy row (untracked, on the server nodes) instead
 * of materialising every row.
 */
type WArg = [0, unknown] | [1, number[], string, string | null] | [2] | [3];
interface Writer {
  fn: (a: unknown, b: unknown, c: unknown) => void;
  args: WArg[];
  /** Element slot of this writer's element capture in `LRow.els` (one per writer with an element capture). */
  slot: number;
  /** A blank detached element like the captured one: the writer's dry runs (`touched`) start from clones of it. */
  stub: Element | null;
  /** The dry runs' elements (before / after the write), kept while equal (`touched`). */
  dry: [Element, Element] | null;
  /** Its dry runs left an expando (compared too); `2`: a non-scalar one (a slot: dry runs are not used). */
  keys: number;
}
/** A keyed signal: its wake list (first write) and the lazy lists whose rows read it. */
interface Keyed {
  fors: Set<Lazy> | null;
  wake: number[] | undefined;
  /** Lists whose rows read it only through keyed row writers: every write reruns them over the lazy rows. */
  rows: Map<Lazy, Writer[]> | null;
}
/** A cold event the loader held: the event, its path at dispatch, its default's replay, the target's form state then. */
export type HeldEvent = [
  event: Event,
  path: EventTarget[],
  replay: (() => void) | undefined,
  /** The target's form state and the focused element at dispatch (a cold press's focus-back). */
  state: [value: unknown, checked: unknown, active: Element | null],
];
/** What the inline loader hands the runtime. */
export interface DerivedLoaderApi {
  /** Cold events held before the runtime started (replayed first, in order). */
  q: HeldEvent[];
  /** Import a module URL (one retry under a new URL). */
  m(url: string): Promise<Record<string, unknown>>;
  /** Report a failure (`rivet:resume-error`, reload unless prevented). */
  f(error: unknown): void;
  /** The ids of the boundaries around `node` whose name listens to `type` ("": any), innermost first (the loader's walk). */
  i(node: Node | null, type: string): string[];
}
/** The runtime instance (`default` export) the loader starts. */
export interface DerivedRuntime {
  start(tail: BoundaryTail, doc: Document, api: DerivedLoaderApi): void;
  /** A live event: true when everything around its target is materialised now (its handlers see it natively). */
  on(event: Event): boolean;
  /** A held event: materialised (chunks loaded), then its delegated handlers run over its path and its default replays. */
  cold(item: HeldEvent): void;
  /** Intent (pointerdown / focus): load the chunk the target's boundary needs, nothing runs. */
  w(target: EventTarget | null): void;
  /** Materialise boundary `id` (and what it needs first). */
  m(id: number): Promise<void>;
  /** Dev only: stop resuming — dispose every adopted unit; later events are left to the page (the dev server's client-render
   * fallback, `entry.dev.tsx`, on the first code update or `rivet:devtools-inspect`). */
  dispose?(): void;
}

let cur: Unit | null = null,
  // The last adopt run's holes + keyed state sites (0: a plain unit, its list's rows can adopt as plain lazy rows).
  shape = -1,
  // `realFor` is reading the rows (a `bad` list found then needs no tick).
  building = false,
  // Inside the derived For hook's own `_for` call.
  inner = false,
  // A row sample run (`sample`): keyed signals read.
  collector: Set<Keyed> | null = null,
  // A row sample run (`sample`): the `each` of every list its row renders (read through computeds after the run).
  sampled: unknown[] | null = null,
  doc: Document | null = null,
  api: DerivedLoaderApi | null = null,
  tail: BoundaryTail | null = null,
  openers: [Map<number, Node>, TreeWalker] | null = null,
  // D5: boundary name → its listened types (tail v2 `n[i][2]`); null while no name lists any (every record listens).
  listened: Map<string, string> | null = null;
const recs = new Map<number, Rec>(),
  // Boundary name → its chunk URL (tail / patch names tables `n` + `u`, as written: the loader resolves the short form).
  chunks = new Map<string, string>(),
  // Boundary name → its props read back from the markup (names table `n[i][3]`, ZERO REGRESS: `propsOf`).
  readBack = new Map<string, string>(),
  modules = new Map<string, Record<string, unknown>>(),
  loads = new Map<string, Promise<void>>(),
  rowsByStart = new WeakMap<Node, LRow>(),
  // Sole lists (`FHole.sole`) by their element: their rows are built on the first event inside one (`listAt`).
  listsIn = new WeakMap<Node, Lazy>(),
  // `_sig` getters: the only non-row captures a keyed row writer may take (they are the same in every row).
  keyedGetters = new WeakSet<object>(),
  // `_sig`'s underlying signal → its keyed entry (a sample's reads through computeds reach the signal, not `get`).
  keyedOf = new WeakMap<object, Keyed>(),
  pending: HeldEvent[] = [],
  // Streamed / awaited `Async`s (tail + patches `a`): entry by id, id by unit key (record id, `-id` of an Async) and
  // place, holes adopted before their value arrived.
  asyncs = new Map<number, DerivedAsync>(),
  asyncAt = new Map<number, Map<number, number>>(),
  waiting = new Map<number, AHole>();
// The next `Async` call is a landed hole's own run (`landAsync`): it runs as usual.
let asyncRun = false;
const DIVERGED = "Rivet resume: an adopt run diverged from its probe";
/** `@rivetjs/bridge/dom` `_island` asks this hook first (M6-PARITY). */
const ISLAND = Symbol.for("rivet.island");
/** Bubbling event types the loader holds by default (`resume-loader-derived.ts`): delegated from the start. */
const DELEGATED = ["click", "input", "change", "submit", "keydown", "pointerdown", "pointerup", "mousedown", "mouseup", "focusin", "focusout"];

const pair = (): Node[] => [document.createComment("b?"), document.createComment("/b?")];
const unit = (mode: number, rec: Rec | null, self: boolean, holes: Hole[] = []): Unit => ({
  mode,
  rec,
  holes,
  at: 0,
  counts: new Map(),
  self,
  fors: [],
  n: 0,
  inline: null,
  depth: 0,
  an: 0,
  aid: 0,
  row: false,
  all: false,
  sus: false,
  made: 0,
});
const report = (error: unknown): void => (api ? api.f(error) : console.error(error));

/**
 * `_b` (`dom-derived-abi.ts`) once this runtime is evaluated: an interactive component's body. Client render: `body()`. Adopt run: a hole the
 * unit's alignment pairs with the server range of this boundary (adopted next as a unit of its own, or deferred).
 */
function b<T>(name: string, body: () => T): T {
  const u = cur;
  if (u === null) return body();
  if (u.self) {
    u.self = false;
    return body();
  }
  if (u.mode === CLIENT) {
    cur = null;
    try {
      return body();
    } finally {
      cur = u;
    }
  }
  if (u.depth || u.all) return body();
  const k = u.n++;
  if (u.inline?.has(k)) {
    u.depth++;
    try {
      return body();
    } finally {
      u.depth--;
    }
  }
  if (u.mode === PROBE) {
    const hole: BHole = { kind: 0, name, nodes: pair(), rec: null, range: [], start: null, end: null, body: null, owner: null, k };
    u.holes.push(hole);
    return hole.nodes as T;
  }
  const hole = u.holes[u.at++];
  if (!hole || hole.kind !== 0) throw Error(DIVERGED);
  hole.body = body;
  hole.owner = getOwner();
  return hole.range.slice() as T;
}

/** `_sig` (`dom-derived-abi.ts`) once this runtime is evaluated: keyed `signal(init)`; in an adopt run, the record's value. */
function sig<T>(key: string, init?: T, options?: EqualsOptions<T>): Signal<T> {
  const u = cur,
    rec = u?.rec,
    make = (DEV && _adoption.signal) || signal;
  if (!u || !rec) return make(init as T, options);
  const n = (u.counts.get(key) ?? 0) + 1;
  u.counts.set(key, n);
  const k = n > 1 ? key + "#" + n : key;
  const s = make((rec.values.has(k) ? rec.values.get(k) : init) as T, options);
  const e: Keyed = { fors: null, wake: tail?.w?.[rec.id + "." + k], rows: null };
  const get = function () {
    collector?.add(e);
    return s();
  } as Signal<T>;
  keyedGetters.add(get);
  keyedOf.set(s, e);
  get.set = (value) => {
    before(e);
    const was = e.rows && untrack(s),
      out = s.set(value);
    if (e.rows && untrack(s) !== was) rewrite(e, get, was);
    return out;
  };
  get.update = (fn) => {
    before(e);
    const was = e.rows && untrack(s),
      out = s.update(fn);
    if (e.rows && untrack(s) !== was) rewrite(e, get, was);
    return out;
  };
  return get;
}

/** `_sigStore` (`dom-derived-abi.ts`) once this runtime is evaluated: keyed `createStore(init)`; in an adopt run, created from the record's value. */
function sigStore<T extends object>(key: string, init: T): Store<T> {
  const u = cur,
    rec = u?.rec;
  if (!u || !rec) return createStore(init);
  const n = (u.counts.get(key) ?? 0) + 1;
  u.counts.set(key, n);
  const k = n > 1 ? key + "#" + n : key;
  return createStore((rec.values.has(k) ? rec.values.get(k) : init) as T);
}

// ---- Dependency facts (DERIVED-C4) ----
// A dependent record the server flagged `DEFER` (its subtree closed: `server-derived.ts` "Dependency facts") is claimed by
// its parent's adopt run but adopted on its own: on an event inside it, a write its wake lists name, at idle — not with its
// parent (a cdk collection host builds its collection in both of its adopt runs). The derived alias of `signal` (every
// module but the runtime's, Vite plugin) numbers the plain signals of an adopt run as the server numbered them and guards
// the first write of one a wake key `"<id>.$<n>"` names; a signal no key can name (outside an adopt run: module level,
// build passes, client renders) wakes the `MOD` records on a write. A unit whose count differs from the server's (tail `c`)
// adopts the readers of its keys at once.
/** Deferred `MOD` records: adopted before the first write to a signal no wake key names. */
let loose: Set<Rec> | null = null;
/** The derived alias of `signal` (`@rivetjs/runtime/derived-reactivity`; `_dsignal` in `dom-derived-abi.ts` runs it). */
function dsignal<T>(init?: T, options?: EqualsOptions<T>): Signal<T> {
  const s = signal(init as T, options),
    u = cur;
  if (u === null || u.rec === null || u.depth || _tracking()) return guard(s, wakeLoose);
  const n = u.made++,
    ids = u.mode === PROBE ? undefined : tail?.w?.[u.rec.id + ".$" + n];
  return ids ? guard(s, () => wakeAll(ids)) : s;
}
function wakeAll(ids: number[]): void {
  for (const id of ids) {
    const r = recs.get(id);
    if (r && !r.done) {
      const p = need(r);
      if (p !== true) p.catch(report);
    }
  }
}
function wakeLoose(): void {
  if (!loose?.size) return;
  const all = [...loose];
  loose.clear();
  wakeAll(all.map((r) => r.id));
}
/** After a unit's run: its plain signal count against the server's (tail `c`); a difference adopts its keys' readers now. */
function counted(rec: Rec | null, n: number): void {
  const want = rec && tail?.c?.[rec.id];
  if (want === undefined || want === null || want === n) return;
  const prefix = rec!.id + ".$";
  for (const key in tail!.w) if (key.startsWith(prefix)) wakeAll(tail!.w![key]!);
}

// The first write to a keyed signal: the boundaries on its wake list materialise, then the lazy lists whose rows read it
// materialise every row — before the write notifies, so their bindings start from what the page shows. Wake list first:
// a woken record's run may create a lazy list whose rows read this signal (it joins `e.fors`), and that list must take
// this write too (TOGGLE-TABS-COLD: a cold arrow key selected a tab, the force-mounted panels' list — created by the
// TabPanels wake — kept the server's visible panel until the second change).
function before(e: Keyed): void {
  const wake = e.wake;
  if (wake) {
    e.wake = undefined;
    for (const id of wake) {
      const r = recs.get(id);
      if (r && !r.done) {
        const p = need(r);
        if (p !== true) p.catch(report);
      }
    }
  }
  const fors = e.fors;
  if (fors) {
    e.fors = null;
    for (const lazy of fors) wakeFor(lazy);
  }
}

// `_for` in a unit's runs (`_adoption.list`): probe → a hole; adopt run → the list over the claimed server rows, lazily.
function forHook(props: { each: unknown; by: unknown; children: (item: () => never, index: () => number) => unknown }): (() => Node[]) | undefined {
  const u = cur;
  if (u === null || u.mode === CLIENT || inner) return undefined;
  const items = untrack(() => {
    const each = props.each;
    return ((typeof each === "function" ? (each as () => unknown)() : each) ?? []) as unknown[];
  });
  if (u.mode === PROBE) {
    sampled?.push(props.each);
    const hole: FHole = { kind: 1, n: items.length, nodes: pair(), groups: null, sole: null, span: null };
    u.holes.push(hole);
    return () => hole.nodes;
  }
  const hole = u.holes[u.at++];
  if (!hole || hole.kind !== 1) throw Error(DIVERGED);
  const lazy: Lazy = {
    rows: null,
    part: null,
    items,
    props,
    hole,
    real: null,
    bad: false,
    tick: signal(0),
    token: { n: () => (hole.sole ? kids(hole.sole) : hole.span!) },
    children: props.children as Lazy["children"],
    read: itemRead,
    owner: getOwner(),
    rec: u.rec,
    woken: false,
    plain: null,
  };
  _adoption.keep!.add(lazy.token);
  if (hole.sole) listsIn.set(hole.sole, lazy);
  else rowsOf(lazy);
  u.fors.push(lazy);
  // While the items are the server's the slot keeps its server rows; their first change builds the client `_for`
  // (over the server rows, adopted by key) and the slot follows it from then on.
  return () => {
    const each = props.each,
      next = typeof each === "function" ? (each as () => unknown)() : each;
    if (lazy.real === null && !lazy.tick()) {
      // A fresh array of the same items (an `each` building its array per read) is no change.
      const list = (next ?? []) as unknown[],
        now = lazy.items;
      if (list === now || (list.length === now.length && list.every((item, i) => item === now[i]))) return ((lazy.items = list), lazy.token as never);
      // Changed while a unit adopts (a collection's build pass went on after the list was made): its rows render once
      // the adopt run is over (as client rows, never inside the run — their boundaries would take its holes).
      if (cur !== null) return (queueMicrotask(() => lazy.tick.set(1)), lazy.token as never);
    }
    lazy.real ??= realFor(lazy);
    return lazy.real();
  };
}
// `Async` in a unit's runs (`_adoption.async`, DERIVED-C2): one the server streamed or awaited (tail `a`, by the unit's key
// and the place among its `Async`s with a fallback — or any app `<Async>`, M6-PARITY task 4 — as the server counted them)
// is a hole: probe → a comment pair, adopt run → its server range (kept: a token), landed after the run; any other runs as
// usual. In a row (`u.row`) the id is the marker the hole claims (0 until then).
function asyncHook(props: NonNullable<AHole["props"]>, self: (props: never) => unknown, user: boolean): unknown {
  if (asyncRun) return void (asyncRun = false);
  const u = cur;
  if (u === null || u.mode === CLIENT || inner || u.depth || (!user && typeof props.fallback !== "function")) return undefined;
  const k = u.an++,
    id = u.row ? 0 : asyncAt.get(u.aid ? -u.aid : (u.rec?.id ?? 0))?.get(k);
  if (id === undefined) return undefined;
  if (u.mode === PROBE) {
    const hole: AHole = { kind: 2, id, nodes: pair(), start: null, end: null, props: null, self: null, owner: null, token: { n: () => [] }, done: false };
    hole.token = { n: () => (hole.start ? spanOf(hole.start, hole.end!) : []) };
    u.holes.push(hole);
    return hole.nodes;
  }
  const hole = u.holes[u.at++];
  if (!hole || hole.kind !== 2 || (!u.row && hole.id !== id)) throw Error(DIVERGED);
  hole.props = props;
  hole.self = self;
  hole.owner = getOwner();
  _adoption.keep!.add(hole.token);
  return hole.token;
}
// `_island` in a unit's runs (M6-PARITY): probe → a comment pair, adopt run → a keep token over the server root.
function islandHook(run: (root: Element, swap: typeof retarget) => void): unknown {
  const u = cur;
  if (u === null || u.mode === CLIENT || inner || u.depth) return undefined;
  if (u.mode === PROBE) {
    const hole: IHole = { kind: 3, nodes: pair(), el: null, run: null, owner: null, token: { n: () => [] } };
    hole.token = { n: () => (hole.el ? [hole.el] : []) };
    u.holes.push(hole);
    return hole.nodes;
  }
  const hole = u.holes[u.at++];
  if (!hole || hole.kind !== 3) throw Error(DIVERGED);
  hole.run = run;
  hole.owner = getOwner();
  _adoption.keep!.add(hole.token);
  return hole.token;
}
/** Island roots (`data-ri`) the adopt run hydrates (tail / patch `i`). */
const islandIds = new Set<string>();
function landIsland(h: IHole): void {
  const el = h.el;
  if (!el || !islandIds.delete(el.getAttribute("data-ri")!)) return;
  try {
    runWithOwner(h.owner, () => h.run!(el, retarget));
  } catch (error) {
    report(error);
  }
}
// The nodes from `start` to `end`, both included (an `Async` hole's server range as it is now).
function spanOf(start: Node, end: Node): Node[] {
  const out: Node[] = [];
  for (let n: Node | null = start; n !== null; n = n === end ? null : n.nextSibling) out.push(n);
  return out;
}
// A slot's current holding an `Async` hole's range: read live (a streamed segment swaps its content in later).
function liveSpan(hole: AHole): Node[] {
  return new Proxy([] as Node[], {
    get: (_, key) => Reflect.get(spanOf(hole.start!, hole.end!), key),
    has: (_, key) => Reflect.has(spanOf(hole.start!, hole.end!), key),
    ownKeys: () => Reflect.ownKeys(spanOf(hole.start!, hole.end!)),
    getOwnPropertyDescriptor: (_, key) => Reflect.getOwnPropertyDescriptor(spanOf(hole.start!, hole.end!), key),
  });
}
// After the adopt run of the unit holding it: the hole's content adopts with its value (a unit of its own, its `load`
// not run: the first call answers the server's value), waits for its segment (the document still parses), or renders
// in the browser (no value: failed, not data, the stream ended first).
function landAsync(h: AHole): void {
  if (h.done || !h.start) return;
  const e = asyncs.get(h.id);
  // Settled 2: a value that is not JSON data, as its resume table (decoded with the router `Root`'s decoder, if any).
  const table = e && e[3] === 2 && _tableDecoder ? (e[4] as { t: unknown[]; r: number }) : null;
  if (e && (e[3] === 1 || table)) {
    h.done = true;
    waiting.delete(h.id);
    // Its probe, adopt (and fallback client) runs answer the server's value without running `load` (which therefore
    // tracks nothing: the resumed boundary does not reload on a change of what its load read on the server — gap).
    const value = table ? _tableDecoder!(table.t).get(table.r) : e[4],
      props = h.props!;
    let live = false;
    queueMicrotask(() => (live = true));
    const once = Object.create(props, { load: { value: (work: unknown) => (live ? props.load(work) : value) } });
    const run = (): unknown => {
      asyncRun = true;
      const u = cur;
      if (u) u.aid = h.id;
      return h.self!(once as never);
    };
    try {
      adoptUnit(h.owner, run, h.start, h.end!, null, false, "Async");
    } catch (error) {
      report(error);
    }
    return;
  }
  if ((!e || e.length < 4) && doc!.readyState === "loading") return void waiting.set(h.id, h);
  h.done = true;
  waiting.delete(h.id);
  try {
    client(h.owner, () => ((asyncRun = true), h.self!(h.props as never)), h.start, h.end!, null, false);
  } catch (error) {
    report(error);
  }
}
// Tail / patch `a` entries: known holes; a waiting hole whose entry settled lands.
function asyncEntries(list: DerivedAsync[] | undefined): void {
  for (const e of list ?? []) {
    asyncs.set(e[0], e);
    let at = asyncAt.get(e[1]);
    if (!at) asyncAt.set(e[1], (at = new Map()));
    at.set(e[2], e[0]);
    const h = waiting.get(e[0]);
    if (h && e.length > 3) landAsync(h);
  }
}

// A lazy row's item accessor (the client `_for`'s `itemRead`: a signal once read tracked).
function itemRead(this: ForRow): unknown {
  return this.sig !== null ? this.sig() : _tracking() ? (this.sig = signal(this.value))() : this.value;
}
// The list's rows over its server groups (built once; a sole list scans its element's children now).
function rowsOf(lazy: Lazy): LRow[] {
  if (lazy.rows) return lazy.rows;
  const { items, hole } = lazy,
    props = lazy.props,
    by = props.by as ((item: unknown, index: number) => unknown) | undefined,
    indexed = props.children.length > 1;
  let groups = hole.groups;
  if (!groups) {
    // A sole list: its element's children are its row groups (claim's scan, deferred to now).
    const ll = kids(hole.sole!);
    groups = [];
    for (let j = 0; j < ll.length;) {
      const d = data(ll[j]);
      if (d === null || !R_OPEN.test(d)) {
        j++;
        continue;
      }
      const e = closeAt(ll, j, R_OPEN, "]");
      if (e < 0) break;
      groups.push([ll[j]!, ll[e]!]);
      j = e + 1;
    }
    hole.groups = groups;
  }
  if (groups.length !== items.length) {
    // The server rows are not the items' (count): the list renders in the browser (its slot's accessor builds the
    // client `_for` without adopted rows).
    bad(lazy);
    return (lazy.rows = []);
  }
  const part = lazy.part;
  return (lazy.rows = groups.map(([start, end], k) => {
    const row = part?.[k];
    // A row built on demand stands for the same server group (`rowAt` counts the groups the same way).
    return row && row.start === start ? row : makeRow(lazy, k, start, end, by, indexed);
  }));
}
function makeRow(lazy: Lazy, k: number, start: Node, end: Node, by: ((item: unknown, index: number) => unknown) | undefined, indexed: boolean): LRow {
  const item = lazy.items[k];
  const row: LRow = {
    value: item,
    key: by ? by(item, k) : item,
    sig: null,
    index: indexed ? signal(k) : null,
    nodes: null,
    start,
    end,
    owner: null,
    pass: 0,
    lz: lazy,
    done: false,
    els: null,
    get: null,
  };
  rowsByStart.set(start, row);
  return row;
}
function bad(lazy: Lazy): void {
  lazy.bad = true;
  if (lazy.real === null && !building) lazy.tick.set(1);
}
// Row `k` of a list, built on demand (DERIVED-C2: the first event builds its target's row, a keyed write the rows whose
// output it changes — not the whole list). A sole list's groups are counted on its element's children from the nearest
// row built before (`start`: the group's opener when the caller counted it, `enclosing`). Null: no such server row
// (the list renders in the browser, `bad`).
function rowAt(lazy: Lazy, k: number, start?: Node): LRow | null {
  if (lazy.rows) return lazy.rows[k] ?? null;
  const part = (lazy.part ??= []),
    known = part[k];
  if (known) return known;
  const props = lazy.props,
    by = props.by as ((item: unknown, index: number) => unknown) | undefined,
    indexed = props.children.length > 1,
    groups = lazy.hole.groups;
  let s: Node | null = null,
    e: Node | null = null;
  if (k < lazy.items.length) {
    if (groups) [s, e] = groups[k] ?? [null, null];
    else {
      s = start ?? seek(lazy, part, k);
      // The group's close (balanced: rows of a nested list sit at the same level).
      for (let n = s, depth = 0; n !== null; n = n.nextSibling) {
        const d = data(n);
        if (d === null) continue;
        if (R_OPEN.test(d)) depth++;
        else if (d === "]" && --depth === 0) {
          e = n;
          break;
        }
      }
    }
  }
  if (!s || !e) return (bad(lazy), null);
  return (part[k] = makeRow(lazy, k, s, e, by, indexed));
}
// The opener of group `k` of a sole list: counted from the nearest row built before it (else the element's first child).
function seek(lazy: Lazy, part: LRow[], k: number): Node | null {
  let j = k - 1;
  while (j >= 0 && !part[j]) j--;
  let count = j + 1,
    depth = 0;
  for (let n = j >= 0 ? part[j]!.end!.nextSibling : lazy.hole.sole!.firstChild; n !== null; n = n.nextSibling) {
    const d = data(n);
    if (d === null) continue;
    if (R_OPEN.test(d)) {
      if (!depth && count === k) return n;
      depth++;
    } else if (d === "]" && --depth === 0) count++;
  }
  return null;
}
// The client `_for` of a lazy list, under the list's owner: takes the server rows (adopted by key, materialised ones keep
// their owners) unless they did not match (`bad`: rendered in the browser, the slot's server nodes replaced).
function realFor(lazy: Lazy): () => Node[] {
  // Rows are about to move / change: the DOM data still unread is read first (snapshot rule).
  if (DOM_DATA && domReader) domReader.sweep();
  building = true;
  let rows: LRow[];
  try {
    rows = rowsOf(lazy);
  } finally {
    building = false;
  }
  // Rows the browser never ran (server nodes, no binding) show their server index: the first write of another index
  // adopts the row first (RESUME-FIX D1: kept as "did not read its index", it kept "2." after the first row left).
  if (lazy.props.children.length > 1) for (const row of rows) row.done || follow(row);
  const outer = _adoption.rows;
  if (!lazy.bad)
    _adoption.rows = () => {
      // Only this list may take these rows. Its first reconcile can synchronously build a row
      // containing another For; that child must create its own rows, not stamp this list's rows.
      _adoption.rows = outer;
      return {
        items: lazy.items.slice(),
        rows,
        adopted: new Map<ForRow, number>(rows.map((row) => [row, -1])),
        changed: null,
        host: null,
      };
    };
  const unitOuter = cur;
  inner = true;
  cur = null;
  try {
    return runWithOwner(lazy.owner, () => untrack(() => _for(lazy.props as never)));
  } finally {
    inner = false;
    cur = unitOuter;
    _adoption.rows = outer;
  }
}
// An unrun row's index signal: a write of another index materialises the row over its server nodes (at the index they
// show), then writes it. Outside the client `_for`'s own creation (`inner`): the row's lists and boundaries adopt.
function follow(row: LRow): void {
  const index = row.index!,
    set = index.set,
    k = untrack(index);
  index.set = ((value: number) => {
    if (value !== k) {
      index.set = set;
      const was = inner;
      inner = false;
      try {
        materialiseRow(row);
      } finally {
        inner = was;
      }
    }
    return set.call(index, value);
  }) as typeof set;
}
// The row of a sole list (by the element holding its server rows) a row opener the event path meets stands for: `k`
// groups before it (`enclosing` counted them).
function listAt(opener: Node, k: number): LRow | null | undefined {
  const lazy = opener.parentNode ? listsIn.get(opener.parentNode) : undefined;
  return lazy && rowAt(lazy, k, opener);
}

// A sole list's hole start (its span is a lazy view of its element's children), or an `Async` hole's (a live view).
const soleOf = (a: UnitAlign, n: Node): boolean => {
  const hole = a.holes.get(n);
  return hole !== undefined && ((hole.kind === 1 && hole.sole !== null) || hole.kind === 2);
};
// An element's children, read on first use (a slot's current that stays untouched while a lazy list keeps its rows).
function lazyKids(el: Element): Node[] {
  let got: Node[] | null = null;
  const at = (): Node[] => (got ??= kids(el));
  return new Proxy([] as Node[], {
    get: (_, key) => Reflect.get(at(), key),
    has: (_, key) => Reflect.has(at(), key),
    ownKeys: () => Reflect.ownKeys(at()),
    getOwnPropertyDescriptor: (_, key) => Reflect.getOwnPropertyDescriptor(at(), key),
    set: (_, key, value) => Reflect.set(at(), key, value),
  });
}

/** The alignment of one unit (`_adoptRow`'s, plus holes and server structure markers). */
interface UnitAlign extends Align {
  holes: Map<Node, Hole>;
  /** Hole start comment → the server nodes it stands for (its end comment → none). */
  span: Map<Node, Node[]>;
  /** The server markup does not have the probe's structure: render the unit instead. */
  fail: boolean;
  /** The probe's created nodes (built on first use, `decorated`). */
  made: () => Set<Node>;
}
const data = (n: Node | undefined): string | null => (n !== undefined && n.nodeType === 8 ? (n as Comment).data : null);
// The index of the comment closing the range `ll[j]` opens (same kind, balanced), -1 when none.
function closeAt(ll: Node[], j: number, open: RegExp, close: string): number {
  for (let k = j, depth = 0; k < ll.length; k++) {
    const d = data(ll[k]);
    if (d === null) continue;
    if (open.test(d)) depth++;
    else if (d === close && --depth === 0) return k;
  }
  return -1;
}
const claimable = (hole: Hole, n: Node): boolean => {
  const d = data(n);
  return hole.kind !== 3 && d !== null && (hole.kind === 2 ? A_OPEN : hole.kind ? R_OPEN : B_OPEN).test(d);
};
function mismatch(a: UnitAlign, at: Node, server: Node | undefined, probe: Node | undefined): void {
  a.fail = true;
  if (DEV)
    a.first ??=
      "<" + (at.nodeType === 1 ? (at as Element).localName : "boundary") + "> children: " + describe(server) + " where the browser renders " + describe(probe);
}
// A run of text / comments between elements: equal runs pair up (comments by position whatever their data: an anchor is
// an anchor — the server's content markers `<!--[-->` / `<!--]-->` and branch markers stand where the template has its
// `<!>` slot markers), else the server's is replaced by copies of the probe's.
function runs(a: UnitAlign, fr: Node[], lr: Node[], at: Node, before: Node | null): void {
  let equal = fr.length === lr.length;
  for (let i = 0; equal && i < fr.length; i++)
    equal = fr[i]!.nodeType === lr[i]!.nodeType && (fr[i]!.nodeType === 8 || (fr[i] as CharacterData).data === (lr[i] as CharacterData).data);
  if (equal) {
    for (let i = 0; i < fr.length; i++) a.map.set(fr[i]!, lr[i]!);
    return;
  }
  // The server run has comments the probe's has not (content markers `<!--[-->` / `<!--]-->` around a slot, branch
  // markers): the probe's nodes pair in order with the server's of the same kind (a comment with the next comment, a text
  // with an equal text) and the server's extra comments stay in place (inert). Replacing the run instead moved nodes in
  // containers on the spine (a nav's link markers, a list's `<section>`: the first click relaid out and prepainted every
  // row below, DERIVED-C).
  if (lr.length > fr.length) {
    const pairs: Node[] = [];
    let j = 0;
    for (let i = 0; i < fr.length && j <= lr.length; i++, j++) {
      const f = fr[i]!;
      while (j < lr.length && lr[j]!.nodeType === 8 && f.nodeType !== 8) j++;
      const l = lr[j];
      if (l === undefined || l.nodeType !== f.nodeType || (f.nodeType !== 8 && (f as CharacterData).data !== (l as CharacterData).data)) break;
      pairs.push(l);
    }
    if (pairs.length === fr.length && lr.every((n) => n.nodeType === 8 || pairs.includes(n))) {
      for (let i = 0; i < fr.length; i++) a.map.set(fr[i]!, pairs[i]!);
      return;
    }
  }
  if (DEV && a.verify && textOf(fr) !== textOf(lr))
    a.first ??=
      "text " + JSON.stringify(lr.map((n) => (n.nodeType === 3 ? (n as Text).data : "")).join("")) + " where the browser renders " + JSON.stringify(textOf(fr));
  for (const n of lr) at.removeChild(n);
  for (const n of fr) at.insertBefore(copyIn(a, n), before);
}
// A hole takes its server range at `ll[j]`: a For its `n` row groups, a boundary its `<!--bN-->` range or `data-b` element.
function claim(a: UnitAlign, hole: Hole, ll: Node[], j: number, at: Node): number {
  if (hole.kind === 3) {
    const n = ll[j] as Element | undefined;
    if (n === undefined || n.nodeType !== 1 || n.localName !== "rivet-island" || !n.hasAttribute("data-ri")) return (mismatch(a, at, n, hole.nodes[0]), j);
    hole.el = n;
    a.span.set(hole.nodes[0]!, [n]);
    a.span.set(hole.nodes[1]!, []);
    return j + 1;
  }
  if (hole.kind === 2) {
    const d = data(ll[j]);
    // A row's hole (id 0): the marker it meets names it.
    if (hole.id === 0 && d !== null && A_OPEN.test(d)) hole.id = +d.slice(1);
    const e = d === "a" + hole.id ? closeAt(ll, j, A_OPEN, "/a") : -1;
    if (e < 0) return (mismatch(a, at, ll[j], hole.nodes[0]), j);
    hole.start = ll[j]!;
    hole.end = ll[e]!;
    a.span.set(hole.nodes[0]!, liveSpan(hole));
    a.span.set(hole.nodes[1]!, []);
    return e + 1;
  }
  if (hole.kind === 1) {
    const groups: [Node, Node][] = [],
      nodes: Node[] = [];
    for (let k = 0; k < hole.n; k++) {
      const d = data(ll[j]),
        e = d !== null && R_OPEN.test(d) ? closeAt(ll, j, R_OPEN, "]") : -1;
      if (e < 0) return (mismatch(a, at, ll[j], hole.nodes[0]), j);
      groups.push([ll[j]!, ll[e]!]);
      for (let x = j; x <= e; x++) nodes.push(ll[x]!);
      j = e + 1;
    }
    hole.groups = groups;
    hole.span = nodes;
    a.span.set(hole.nodes[0]!, nodes);
    a.span.set(hole.nodes[1]!, []);
    return j;
  }
  const n = ll[j],
    d = data(n);
  let id = 0;
  if (d !== null && B_OPEN.test(d)) {
    const e = closeAt(ll, j, B_OPEN, "/b");
    if (e < 0) return (mismatch(a, at, n, hole.nodes[0]), j);
    id = +d.slice(1);
    hole.range = ll.slice(j, e + 1);
    j = e + 1;
  } else if (n !== undefined && n.nodeType === 1 && (n as Element).hasAttribute("data-b")) {
    id = +(n as Element).getAttribute("data-b")!;
    hole.range = anchored(n as Element);
    j++;
  }
  let rec = recs.get(id);
  // A conditional boundary the server found static (no record, M6-PARITY 6b): a materialised parent adopts it as a
  // dependent unit of its own, from an empty record (it has no keyed state; its props come from the parent's run).
  if (id && rec === undefined)
    recs.set(
      id,
      (rec = {
        id,
        parent: null,
        flags: 0,
        name: hole.name,
        values: new Map(),
        props: null,
        done: false,
        owner: null,
        hole: null,
        loading: null,
        ready: null,
        sources: null,
      }),
    );
  if (id && rec?.name === hole.name) {
    hole.rec = rec;
    hole.start = hole.range[0]!;
    hole.end = hole.range[hole.range.length - 1]!;
  } else if (id) return (mismatch(a, at, n, hole.nodes[0]), j);
  // (No range: the server rendered nothing for it, a SILENT record; it stays inert.)
  a.span.set(hole.nodes[0]!, hole.range);
  a.span.set(hole.nodes[1]!, []);
  return j;
}
// Empty comment anchors around a `data-b` element: the range a unit runs between (comments: an inserted text node next to
// a block made the browser rebuild the layout of its container — a page root's every row relaid out and prepainted at
// the first click, DERIVED-C).
function anchored(el: Element): Node[] {
  const d = el.ownerDocument,
    s = d.createComment(""),
    e = d.createComment("");
  el.parentNode!.insertBefore(s, el);
  el.parentNode!.insertBefore(e, el.nextSibling);
  return [s, el, e];
}
// Pair the probe's children `fl` with the server's `ll` (children of `at`, before `ref`), level by level.
function alignUnit(a: UnitAlign, fl: Node[], ll: Node[], at: Node, ref: Node | null, deco = false): void {
  let i = 0,
    j = 0;
  for (;;) {
    const fr: Node[] = [],
      lr: Node[] = [];
    while (i < fl.length && fl[i]!.nodeType !== 1 && !a.holes.has(fl[i]!)) fr.push(fl[i++]!);
    const hole = i < fl.length ? a.holes.get(fl[i]!) : undefined;
    while (j < ll.length && ll[j]!.nodeType !== 1 && !(hole && claimable(hole, ll[j]!))) lr.push(ll[j++]!);
    runs(a, fr, lr, at, j < ll.length ? ll[j]! : ref);
    if (i >= fl.length) return j < ll.length ? mismatch(a, at, ll[j], undefined) : undefined;
    if (hole) {
      j = claim(a, hole, ll, j, at);
      if (a.fail) return;
      i += 2;
      continue;
    }
    const f = fl[i] as Element,
      l = ll[j] as Element | undefined;
    if (l === undefined || l.nodeType !== 1 || l.localName !== f.localName || l.namespaceURI !== f.namespaceURI) return mismatch(a, at, l, f);
    a.map.set(f, l);
    const fk = kids(f),
      only = fk.length === 2 ? a.holes.get(fk[0]!) : undefined;
    const marked = deco || l.hasAttribute(DECORATED);
    if (marked && decorated(a, f, l)) {
      // Kept as the server has it (no pairs below: nothing of the probe's subtree is live).
    } else if (only !== undefined && only.kind === 1 && fk[1] === only.nodes[1]) {
      // The list is the element's only content: its rows stay unscanned until needed (`rowsOf`), the slot holds the
      // element's children through a lazy view (O(1) adopt for a page's long list).
      only.sole = l;
      a.span.set(only.nodes[0]!, lazyKids(l));
      a.span.set(only.nodes[1]!, []);
    } else alignUnit(a, fk, kids(l), l, null, marked);
    if (a.fail) return;
    i++;
    j++;
  }
}

/**
 * Build decoration (ADOPT-CONTENT 2026-10-26): an element carrying `data-rv-text` says the build wrapped markup around
 * the rendered text below it (a docs build's syntax-highlight token spans in `span.line`s, docs-kit
 * `highlight-pages.ts`). Under it, a server element whose children differ from the probe's but whose text is equal is
 * adopted as it is when the probe's subtree is static (no hole, no comment marker, no node the run creates). Was: a
 * mismatch — the unit rendered in the browser (the first chrome click rebuilt a docs page's whole content).
 */
const DECORATED = "data-rv-text";
function decorated(a: UnitAlign, f: Element, l: Element): boolean {
  return f.textContent === l.textContent && fixed(a, f);
}
function fixed(a: UnitAlign, n: Node): boolean {
  for (let c = n.firstChild; c !== null; c = c.nextSibling)
    if (c.nodeType === 8 || a.holes.has(c) || a.made().has(c) || (c.nodeType === 1 && !fixed(a, c))) return false;
  return true;
}

// The form controls among a unit's own live elements (the alignment's map values: never a hole's range, which its own
// unit adopts — DERIVED-C: was a `querySelectorAll` over the unit's whole server range, so a page root and every unit
// on the spine scanned every row): dirty ones are restored after the adopt run.
function controlsOf(map: Map<Node, Node>): Element[] {
  const out: Element[] = [];
  for (const l of map.values()) {
    const name = (l as Element).localName;
    if (name === "input" || name === "textarea" || name === "select") out.push(l as Element);
  }
  return out;
}

/**
 * Adopt one unit (a boundary's body, a standalone component run, a lazy row): `run` over the live nodes strictly between
 * `start` and `end`, under a new root of `parent`; `rec` keys its `_sig` calls. Returns the unit's root.
 */
function adoptUnit(parent: Owner | null, run: () => unknown, start: Node, end: Node, rec: Rec | null, self: boolean, label: string): Owner | null {
  shape = -1;
  adopted = true;
  // UNKEYED (a keyed value was not data, left out of the record): adopted anyway — that signal starts from the browser's
  // init (the server's value at flush, unless the render changed it); a structural mismatch still renders it in the
  // browser (DERIVED-C: every cdk page root holding a selection `Set` rendered in the browser on its first event).
  const outer = save(),
    previous = cur,
    verify = !!DEV;
  // The held flush `save` ran removed the unit (its claiming owner disposed): its range left the page, nothing to adopt.
  if (gone(parent)) return null;
  // 1. Probe (create mode, detached; holes for child boundaries and lists). A child boundary whose output the run
  // discarded (its hole reached no node of the probe: a build pass that renders for side effects) runs inline instead,
  // probed again.
  let pu: Unit,
    probe: Probe,
    inline: Set<number> | null = null;
  for (;;) {
    pu = unit(PROBE, rec, self);
    pu.inline = inline;
    pu.row = label === "row";
    cur = pu;
    try {
      probe = probeRow(parent, (fn) => fn(), run, start.ownerDocument!, verify, outer);
    } finally {
      cur = previous;
    }
    let again = false;
    for (const hole of pu.holes) if (hole.kind === 0 && hole.nodes[0]!.parentNode === null) ((inline ??= new Set()).add(hole.k), (again = true));
    if (!again) break;
    _dispose(probe.owner);
  }
  // `Suspense` under the derived model (DERIVED-C3): its content was awaited in place on the server; the resources it read
  // adopt the server's state (`$r`, M6-PARITY task 3), so it suspends here only for a load the server could not ship (a
  // value that is not JSON data, a resource made outside a boundary): then the unit renders in the browser.
  if (pu.sus) {
    if (DEV)
      DEV.adopt(label + (rec ? " (b" + rec.id + ")" : ""), "a load suspended a <Suspense> (Suspense content renders in the browser on the derived model)");
    _dispose(probe.owner);
    return client(parent, run, start, end, rec, self);
  }
  const fresh = kids(probe.frag);
  fresh.pop(); // the anchor
  // 2. Align.
  let made: Set<Node> | null = null;
  const a: UnitAlign = {
    map: new Map(),
    first: null,
    copied: false,
    verify,
    holes: new Map(),
    span: new Map(),
    fail: false,
    made: () => (made ??= new Set(probe.made.flat())),
  };
  for (const hole of pu.holes) a.holes.set(hole.nodes[0]!, hole);
  alignUnit(a, fresh, between(start, end), end.parentNode!, end);
  const map = a.map;
  if (DEV && !a.fail && a.first === null && probe.attrs)
    for (const list of probe.attrs)
      for (const [el, name, value] of list) {
        const live = map.get(el) as Element | undefined;
        if (live && live !== el && el.getAttribute(name) === value && live.getAttribute(name) !== value) {
          a.first ??= "<" + el.localName + " " + name + "=" + JSON.stringify(live.getAttribute(name)) + "> where the template has " + JSON.stringify(value);
          break;
        }
      }
  if (a.fail || (DEV && a.first !== null)) {
    if (DEV) DEV.adopt(label + (rec ? " (b" + rec.id + ")" : ""), a.first ?? "markup");
    _dispose(probe.owner);
    return client(parent, run, start, end, rec, self);
  }
  // 3. Answers: per creation its live node, per slot what it holds (holes: the server nodes they stand for).
  const one = (n: Node): Node[] => a.span.get(n) ?? [map.get(n) ?? n];
  const mapped = (current: Current): Current =>
    current === null || current === undefined
      ? null
      : Array.isArray(current)
        ? current.length === 2 && soleOf(a, current[0]!) && a.holes.get(current[0]!)!.nodes[1] === current[1]
          ? a.span.get(current[0]!)!
          : current.flatMap(one)
        : a.span.has(current)
          ? a.span.get(current)!.slice()
          : (map.get(current) ?? null);
  for (const [f, l] of map) {
    if (f === l) continue;
    const from = f as unknown as { $$t?: string | InsertSlot; $$s?: InsertSlot },
      to = l as unknown as typeof from;
    if (from.$$t !== undefined) to.$$t = typeof from.$$t === "string" ? from.$$t : { current: mapped(from.$$t.current) };
    if (from.$$s !== undefined) to.$$s = { current: mapped(from.$$s.current) };
  }
  const answers: Answers = {
    made: probe.made.map((list) => list.map((n) => map.get(n))) as Answers["made"],
    names: probe.made.map((list) => list.map((n) => n.nodeName)) as Answers["names"],
    shapes: probe.shapes.map((shape) => {
      const out: (Node | null | undefined)[] = [];
      for (let k = 0; k < shape.length; k += 3)
        out.push(map.get(shape[k]!), shape[k + 1] ? map.get(shape[k + 1]!) : null, k && shape[k + 2] ? map.get(shape[k + 2]!) : null);
      return out;
    }),
    slots: probe.slots.map((slot) => mapped(slot.current)),
  };
  _dispose(probe.owner);
  const dirty = dirtyOf(controlsOf(map));
  // 4. Adopt: the run again, every creation returns its live node; holes take their server nodes.
  const au = unit(ADOPT, rec, self, pu.holes);
  au.row = pu.row;
  au.inline = inline;
  let owner: Owner | null;
  cur = au;
  try {
    owner = adopt(parent, (fn) => fn(), run, end, answers, null, outer, false, dirty);
  } finally {
    cur = previous;
  }
  if (au.at !== au.holes.length) throw Error(DIVERGED);
  const own = pu.holes.length + pu.counts.size;
  // 5. Child boundaries: dependent ones now, independent ones deferred; lists: which keyed signals their rows read.
  for (const hole of au.holes) if (hole.kind === 0 && hole.rec && !hole.rec.done) child(hole.rec, hole);
  for (const hole of au.holes) if (hole.kind === 2) landAsync(hole);
  for (const hole of au.holes) if (hole.kind === 3) landIsland(hole);
  for (const lazy of au.fors) sample(lazy);
  counted(rec, au.made);
  shape = own;
  return owner;
}

// Render the unit in the browser in place of its server nodes (mismatch, a value that did not ship). Its own keyed
// state keeps the record's values; child boundaries render as plain client components.
function client(parent: Owner | null, run: () => unknown, start: Node, end: Node, rec: Rec | null, self: boolean): Owner | null {
  if (DOM_DATA && domReader) domReader.sweep();
  const old = between(start, end),
    held = addresses(old);
  for (const n of old) {
    dead(n);
    n.parentNode!.removeChild(n);
  }
  const previous = cur,
    holder = { owner: null as Owner | null },
    u = (cur = unit(CLIENT, rec, self));
  try {
    untrack(() => _rootIn(parent, () => _insert(null, run(), end), holder));
  } finally {
    cur = previous;
  }
  if (held) resolve(held, between(start, end));
  counted(rec, u.made);
  return holder.owner;
}
// Retarget (M6-PARITY task 5): an event held on a server node (or the live event being dispatched) whose unit rendered in
// the browser instead of adopting is replayed on the node at the same place in the browser's render — the element path
// from the unit's top-level elements (comments and text differ: markers, split text), a text target by its element.
const retargets = new WeakMap<Node, Node>();
let live: Event | null = null,
  pressTo: HTMLInputElement | null = null;
function addresses(old: Node[]): [Node, number[]][] | null {
  let out: [Node, number[]][] | null = null;
  const tops = old.filter((n) => n.nodeType === 1);
  for (const event of live ? [live, ...pending.map((item) => item[0])] : pending.map((item) => item[0])) {
    const target = event.target as Node | null;
    if (!target || retargets.has(target)) continue;
    const steps: number[] = [];
    let el = (target.nodeType === 1 ? target : target.parentNode) as Element | null;
    while (el && !tops.includes(el)) {
      const up: Element | null = el.parentElement;
      steps.unshift(up ? Array.prototype.indexOf.call(up.children, el) : -1);
      el = up;
    }
    if (el) (out ??= []).push([target, [tops.indexOf(el), ...steps]]);
  }
  return out;
}
/**
 * @internal Nodes replaced after an adopt run (the bridge's island slot content, rendered again into its `rivet-slot`
 * holes: `@rivetjs/bridge/dom` `adopt`, handed over through the island hook): `swap()` removes `old` and returns the
 * nodes standing in their place; a held event (or the one being dispatched) whose target was in `old` replays on the
 * node at the same element path in the fresh nodes (`retargets`, as a unit rendered in the browser does).
 */
export function retarget(old: Node[], swap: () => Node[]): void {
  const held = addresses(old);
  const fresh = swap();
  if (held) resolve(held, fresh);
}
function resolve(held: [Node, number[]][], fresh: Node[]): void {
  const tops = fresh.filter((n) => n.nodeType === 1) as Element[];
  for (const [target, [top, ...steps]] of held) {
    let el: Element | undefined = tops[top!];
    for (const i of steps) el = el?.children[i];
    if (el) retargets.set(target, el);
  }
}
/** The propagation path of a node in the page (as `composedPath` lists it: node, ancestors, document, window). */
function pathOf(n: Node): EventTarget[] {
  const out: EventTarget[] = [];
  for (let x: Node | null = n; x !== null; x = x.parentNode ?? (x as unknown as ShadowRoot).host ?? null) out.push(x);
  out.push(window);
  return out;
}
// Records whose markup leaves the page (a unit rendered in the browser instead): nothing to adopt any more.
function dead(n: Node): void {
  const d = data(n),
    id = d !== null && B_OPEN.test(d) ? +d.slice(1) : n.nodeType === 1 ? +((n as Element).getAttribute("data-b") ?? 0) : 0;
  const r = id ? recs.get(id) : undefined;
  if (r) r.done = true;
  for (let c = n.firstChild; c !== null; c = c.nextSibling) dead(c);
}

function child(r: Rec, hole: BHole): void {
  r.hole = hole;
  if (r.flags & INDEPENDENT) return trigger(r);
  if (!(r.flags & DEFER)) return void runHole(r);
  // Deferred (DERIVED-C4): its own event, a wake, a loose write (`MOD`), else idle.
  if (r.flags & MOD) (loose ??= new Set()).add(r);
  ((window.requestIdleCallback as ((fn: () => void) => number) | undefined) || setTimeout)(() => {
    if (!r.done) {
      const p = need(r);
      if (p !== true) p.catch(report);
    }
  });
}
function runHole(r: Rec): void {
  const hole = r.hole!;
  r.done = true;
  loose?.delete(r);
  // The unit that claimed the hole is gone (a revalidation / navigation re-rendered the page before its idle / visible /
  // event trigger fired): its range left the page too, nothing to adopt (forms drawer: "Cannot run with a disposed owner").
  if (hole.start && !(hole.owner as { disposed?: boolean } | null)?.disposed)
    r.owner = adoptUnit(hole.owner, hole.body!, hole.start, hole.end!, r, false, r.name);
}

/** One detached sample run of a row: the keyed signals it read outside / inside `_fx1` bindings and those bindings. */
interface Sampled {
  frag: DocumentFragment;
  item: () => unknown;
  index: () => number;
  outside: Set<Keyed>;
  fxs: [fn: Writer["fn"], args: unknown[], reads: Set<Keyed>][];
  /** Plain (unkeyed) signals it read, through computeds too: their first write wakes the list. */
  plain: Set<Signal<unknown>>;
}
function sampleRow(lazy: Lazy, k: number): Sampled | null {
  const value = lazy.items[k],
    frag = document.createDocumentFragment(),
    anchor = document.createTextNode(""),
    out: Sampled = { frag, item: () => value, index: () => k, outside: new Set(), fxs: [], plain: new Set() },
    previous = cur,
    outer = collector,
    outerSampled = sampled,
    hook = _adoption.fx,
    holder = { owner: null as Owner | null };
  frag.append(anchor);
  cur = unit(PROBE, lazy.rec, false);
  cur.row = true;
  // Child boundaries in the row run inline (a probe makes them holes): their bindings' reads are the row's too.
  cur.all = true;
  collector = out.outside;
  sampled = [];
  // Each hoisted binding: created as usual, the keyed reads of its first run kept apart (DERIVED-C row writers).
  _adoption.fx = (fn, a, b, c) => {
    const reads = new Set<Keyed>(),
      at = collector;
    collector = reads;
    try {
      _bindingEffect1(fn, a, b, c);
    } finally {
      collector = at;
    }
    // Keyed state the binding reads through computeds only (a selector, `page() === n` behind a memo): it wakes the
    // whole list (rows adopt before the write), the row writers only rerun bindings that read keyed signals directly.
    collector = null;
    try {
      for (const sig of _trackReads(() => fn(a, b, c)).signals) {
        const e = keyedOf.get(sig);
        if (!e) out.plain.add(sig);
        else if (!reads.has(e)) out.outside.add(e);
      }
    } finally {
      collector = at;
    }
    out.fxs.push([fn, [a, b, c], reads]);
  };
  try {
    untrack(() => _rootIn(lazy.owner, () => _insert(null, lazy.children!(out.item, out.index), anchor), holder));
    // Plain signals read by any effect the row made (a child component's spread / attribute bindings — `CarouselDot`'s
    // `aria-selected` — run no row writer): their first write wakes the list (M6-CUT: resumed carousel dots stayed stale).
    for (const sig of _ownedReads(holder.owner)) if (!keyedOf.has(sig)) out.plain.add(sig);
    // A nested list's items read keyed state through computeds the row did not run (cached: a collection built from a
    // sorted / filtered computed): those keyed signals wake this list too, so its rows — and the nested list — adopt
    // over the server's items before the write (M6-CUT: a resumed table's sort kept the server row order).
    for (const each of sampled)
      if (typeof each === "function")
        for (const sig of _trackReads(each as () => unknown).signals) {
          const e = keyedOf.get(sig);
          if (e) out.outside.add(e);
          else out.plain.add(sig);
        }
    return out;
  } catch {
    // A sample that throws reads nothing we can know: the list wakes on reconcile / events only.
    return null;
  } finally {
    cur = previous;
    collector = outer;
    sampled = outerSampled;
    _adoption.fx = hook;
    _dispose(holder.owner);
  }
}
// A writer capture as a row-independent descriptor (null: no row could supply it without running).
function describeArg(run: Sampled, a: unknown): WArg | null {
  if (a === run.item) return [2];
  if (a === run.index) return [3];
  if (a === undefined || (typeof a === "function" && keyedGetters.has(a))) return [0, a];
  if (a instanceof Element && run.frag.contains(a)) {
    const path: number[] = [];
    for (let n: Element = a; ; n = n.parentNode as Element) {
      let i = 0;
      for (let p = n.previousElementSibling; p !== null; p = p.previousElementSibling) i++;
      path.unshift(i);
      if (n.parentNode === run.frag) return [1, path, a.localName, a.namespaceURI];
    }
  }
  return null;
}
const sameArg = (x: WArg, y: WArg): boolean =>
  x[0] === y[0] && (x[0] === 0 ? x[1] === y[1] : x[0] === 1 ? x[2] === (y as typeof x)[2] && x[1].join() === (y as typeof x)[1].join() : true);
// Detached sample runs of a list's first and last rows: a keyed signal they read only through hoisted bindings whose
// captures every row supplies (row writers) reruns those writers over the lazy rows on each write; any other read wakes
// the whole list on its first write (every row materialises).
function sample(lazy: Lazy): void {
  const n = lazy.items.length;
  if (!n || !lazy.children) return;
  const first = sampleRow(lazy, 0),
    last = n > 1 ? sampleRow(lazy, n - 1) : first;
  if (!first || !last) return;
  const reads = new Set<Keyed>([...first.outside, ...last.outside]);
  for (const sig of first.plain) wakeOnWrite(sig, lazy);
  for (const sig of last.plain) wakeOnWrite(sig, lazy);
  const writers: (Writer | null)[] = [];
  const same = first.fxs.length === last.fxs.length;
  for (let i = 0; i < first.fxs.length; i++) {
    const [fn, args, r] = first.fxs[i]!;
    for (const e of r) reads.add(e);
    const other = same ? last.fxs[i]! : null;
    if (other) for (const e of other[2]) reads.add(e);
    let w: Writer | null = other && other[0] === fn ? { fn, args: [], slot: -1, stub: null, dry: null, keys: 0 } : null;
    for (let j = 0; w && j < 3; j++) {
      const x = describeArg(first, args[j]),
        y = describeArg(last, other![1][j]);
      if (!x || !y || !sameArg(x, y)) w = null;
      else w.args.push(x);
    }
    // One element capture per writer (its `LRow.els` slot).
    if (w && w.args.filter((arg) => arg[0] === 1).length > 1) w = null;
    writers.push(w);
  }
  let slots = 0;
  for (const e of reads) {
    let mine: Writer[] | null = same && !first.outside.has(e) && !last.outside.has(e) ? [] : null;
    for (let i = 0; mine && i < first.fxs.length; i++)
      if (first.fxs[i]![2].has(e) || last.fxs[i]![2].has(e)) {
        const w = writers[i];
        if (!w) mine = null;
        else {
          if (w.slot < 0 && w.args.some((arg) => arg[0] === 1)) w.slot = slots++;
          mine.push(w);
        }
      }
    if (mine?.length) (e.rows ??= new Map()).set(lazy, mine);
    else (e.fors ??= new Set()).add(lazy);
  }
}
// Plain signals a lazy list's rows read (a `.ts` helper's state, `createCarouselState`: not keyed, no wake list): the
// first write materialises those lists' rows before it notifies, like a keyed signal's `fors` (M6-CUT: a resumed
// carousel's dots kept the server's selected dot).
const plainFors = new WeakMap<Signal<unknown>, Set<Lazy>>();
function wakeOnWrite(sig: Signal<unknown>, lazy: Lazy): void {
  let fors = plainFors.get(sig);
  if (fors) return void fors.add(lazy);
  plainFors.set(sig, (fors = new Set([lazy])));
  const set = sig.set;
  sig.set = function (this: Signal<unknown>, value: unknown) {
    const waiting = plainFors.get(sig);
    if (waiting) {
      plainFors.delete(sig);
      sig.set = set;
      for (const l of waiting) wakeFor(l);
    }
    return set.call(this, value);
  } as Signal<unknown>["set"];
}
// A write to a keyed signal (`get`, its value before: `was`) with row writers: rerun them over the lazy rows still on
// the page (materialised rows have their own bindings). While the items are the server's, only the rows whose output
// the write changes are built and written (`touched`). A row whose element capture does not resolve to the sampled
// element materialises instead.
function rewrite(e: Keyed, get: unknown, was: unknown): void {
  for (const [lazy, writers] of e.rows!)
    if (lazy.real === null && !lazy.bad && writers.every((w) => w.slot >= 0 && w.keys < 2 && !w.args.some((arg) => arg[0] === 3)))
      touched(lazy, writers, get, was);
    else for (const row of rowsOf(lazy)) if (!row.done && row.start!.isConnected) writeRow(lazy, row, writers);
}
function writeRow(lazy: Lazy, row: LRow, writers: Writer[]): void {
  // The row's DOM data is read before anything writes into the row (its text may show a non-data value next).
  if (DOM_DATA && domReader) domReader.readRow(row.value);
  for (const w of writers) {
    let a: unknown, b: unknown, c: unknown;
    for (let j = 0; j < 3; j++) {
      const arg = w.args[j]!;
      let v: unknown;
      if (arg[0] === 0) v = arg[1];
      else if (arg[0] === 2) v = row.get ??= lazy.read ? lazy.read.bind(row) : () => row.value;
      else if (arg[0] === 3) v = row.index ?? null;
      else v = element(row, w.slot, arg[1], arg[2]);
      if (v === null) return materialiseRow(row);
      j === 0 ? (a = v) : j === 1 ? (b = v) : (c = v);
    }
    try {
      untrack(() => w.fn(a, b, c));
    } catch (error) {
      report(error);
    }
  }
}
// Each row's writers run twice into detached elements (`Writer.dry`: no page node, no row object) — with the written
// signal's value before and after; a row whose output differs (attributes, children, form state, expandos) is built
// (`rowAt`) and written. Rows the write does not change keep their server nodes untouched: their output is the same
// function of the same values (the page shows what the values before it produce). The two elements carry on from row
// to row while equal: the writers overwrite what they write (attribute, class, style, text, form property), so equal
// elements before a run end unequal exactly when the run's writes differ.
function touched(lazy: Lazy, writers: Writer[], get: unknown, was: unknown): void {
  const items = lazy.items,
    known = lazy.rows ?? lazy.part,
    before = () => was;
  for (let k = 0; k < items.length; k++) {
    const row = known?.[k];
    if (row && (row.done || !row.start!.isConnected)) continue;
    const item = row ? (row.get ??= lazy.read ? lazy.read.bind(row) : () => row.value) : () => items[k];
    let changed = false;
    for (let i = 0; !changed && i < writers.length; i++) changed = differs(writers[i]!, item, get, before);
    if (!changed) continue;
    const at = row ?? rowAt(lazy, k);
    if (!at) return;
    writeRow(lazy, at, writers);
    if (lazy.real !== null || lazy.bad) return rewriteRest(lazy, writers, k);
  }
}
// A write built the list's client `_for` / found its rows wrong: the rows after `k` are written as before DERIVED-C2.
function rewriteRest(lazy: Lazy, writers: Writer[], k: number): void {
  const rows = rowsOf(lazy);
  for (let j = k + 1; j < rows.length; j++) if (!rows[j]!.done && rows[j]!.start!.isConnected) writeRow(lazy, rows[j]!, writers);
}
// The writer's dry runs for one row (`get` answered by its value before, then as now): true when they wrote differently
// (or threw).
function differs(w: Writer, item: () => unknown, get: unknown, before: () => unknown): boolean {
  let pair = w.dry;
  if (!pair) {
    const arg = w.args.find((x) => x[0] === 1) as [1, number[], string, string | null];
    w.stub ??= arg[3] === HTML_NS ? doc!.createElement(arg[2]) : doc!.createElementNS(arg[3], arg[2]);
    pair = w.dry = [w.stub.cloneNode(false) as Element, w.stub.cloneNode(false) as Element];
  }
  const [x, y] = pair;
  if (!dryRun(w, x, item, get, before) || !dryRun(w, y, item, get, get) || !x.isEqualNode(y) || !alike(w, x, y)) {
    w.dry = null;
    return true;
  }
  return false;
}
function dryRun(w: Writer, el: Element, item: () => unknown, get: unknown, value: unknown): boolean {
  let a: unknown, b: unknown, c: unknown;
  for (let j = 0; j < 3; j++) {
    const arg = w.args[j]!,
      v = arg[0] === 0 ? (arg[1] === get ? value : arg[1]) : arg[0] === 2 ? item : el;
    j === 0 ? (a = v) : j === 1 ? (b = v) : (c = v);
  }
  try {
    untrack(() => w.fn(a, b, c));
    return true;
  } catch {
    return false;
  }
}
// Form state and expandos (`_t`'s `$$t`) of two dry-run elements `isEqualNode` found equal.
function alike(w: Writer, x: Element, y: Element): boolean {
  const p = x as unknown as Record<string, unknown>,
    q = y as unknown as Record<string, unknown>;
  if ("value" in x && (p.value !== q.value || p.checked !== q.checked || p.selected !== q.selected)) return false;
  if (w.keys === 0) {
    // The first dry run tells whether this writer leaves expandos at all.
    const own = Object.keys(x);
    if (!own.length) return ((w.keys = -1), true);
    w.keys = own.some((key) => (typeof p[key] === "object" && p[key] !== null) || typeof p[key] === "function") ? 2 : 1;
  }
  if (w.keys === 1) for (const key of Object.keys(x)) if (p[key] !== q[key]) return false;
  return w.keys !== 2;
}
// The row's element at an element-index path from its start (cached per writer slot), null when the server row's
// elements are not the sampled ones.
function element(row: LRow, slot: number, path: number[], name: string): Element | null {
  const els = (row.els ??= []);
  let el = els[slot];
  if (el === undefined) {
    let n: Node | null = row.start!.nextSibling;
    for (let i = path[0]!; n !== null && n !== row.end; n = n.nextSibling) if (n.nodeType === 1 && i-- === 0) break;
    el = n !== null && n !== row.end ? (n as Element) : null;
    for (let d = 1; el !== null && d < path.length; d++) el = el.children[path[d]!] ?? null;
    els[slot] = el = el !== null && el.localName === name ? el : null;
  }
  return el;
}
function wakeFor(lazy: Lazy): void {
  if (lazy.woken) return;
  lazy.woken = true;
  for (const row of rowsOf(lazy)) if (!row.done && row.start!.isConnected) materialiseRow(row);
}
function materialiseRow(row: LRow): void {
  const lazy = row.lz;
  if (row.done || !lazy.children) return;
  row.done = true;
  if (DOM_DATA && domReader) domReader.readRow(row.value);
  const run = () => lazy.children!(lazy.read!.bind(row) as () => unknown, row.index as unknown as () => number);
  try {
    if (lazy.plain) row.owner = _adoptRow(lazy.owner, (fn) => fn(), run, row.start!, row.end!, null, lazy.plain);
    else {
      row.owner = adoptUnit(lazy.owner, run, row.start!, row.end!, lazy.rec, false, "row");
      if (lazy.plain === null) lazy.plain = shape === 0 ? {} : false;
    }
  } catch (error) {
    report(error);
  }
}

// The opening comment of record `id` (`<!--b<id>-->`): one walk over the page's comments in document order, resumed
// where it stopped (DERIVED-C: a top-level root opener is found at once, not after the whole page's comments).
function opener(id: number): Node | undefined {
  openers ??= [new Map(), doc!.createTreeWalker(doc!.body ?? doc!, 128)];
  const [found, walk] = openers;
  for (let n = found.has(id) ? null : walk.nextNode(); n !== null; n = found.has(id) ? null : walk.nextNode())
    if (B_OPEN.test((n as Comment).data)) found.set(+(n as Comment).data.slice(1), n);
  return found.get(id);
}
// The server range of a record: [start, end] (inclusive markers, or anchors around its `data-b` element: `ATTR` records).
function rangeOf(r: Rec): Node[] | null {
  // `ATTR` records carry `data-b` on their element root (a comment pair when it had none); others the comment pair.
  let start = r.flags & ATTR ? undefined : opener(r.id);
  const el = start ? null : doc!.querySelector('[data-b="' + r.id + '"]');
  if (el) return anchored(el);
  start ??= opener(r.id);
  if (!start?.parentNode) return null;
  const list = kids(start.parentNode);
  const at = list.indexOf(start),
    e = closeAt(list, at, B_OPEN, "/b");
  return e < 0 ? null : [start, list[e]!];
}
/**
 * A standalone record's props (ZERO REGRESS): its record's, plus each read-back key (names table `n[i][3]`, `"key=path …"`)
 * the record left out, read from its markup — the `textContent` of the element at `path` from its `data-b` element (`f`
 * firstChild, `n` nextSibling): the compiler proved that text is all the component does with the value, the server
 * rendered it from that very value. Read before the first run (the `ready` hook, the adopt or a browser render) and kept on
 * the record (`r.props`), so later calls reuse it.
 */
function propsOf(r: Rec): object {
  const spec = readBack.get(r.name),
    root = spec && doc!.querySelector('[data-b="' + r.id + '"]');
  let p = r.props as Record<string, unknown> | null;
  // (A key already in the record: read before, or shipped — a value that was no string / number.)
  if (root)
    for (const entry of spec.split(" ")) {
      const [key, path] = entry.split("=") as [string, string];
      let x: Node | null = root;
      if (p && key in p) continue;
      for (const c of path) x = x && (c == "f" ? x.firstChild : x.nextSibling);
      if (x) (p ??= {})[key] = x.textContent;
      else if (DEV) console.warn("Rivet resume: boundary " + r.name + " (b" + r.id + ") has no markup to read prop " + key + " from");
    }
  return (r.props = p) ?? {};
}
/** A standalone boundary's component in its chunk (the export named after the last `#`). */
type Exported = ((props: object) => unknown) & { ready?: (props: object) => unknown };
const exported = (r: Rec, module: Record<string, unknown>): Exported | undefined => module[r.name.slice(r.name.lastIndexOf("#") + 1)] as Exported | undefined;
/**
 * A component's `ready(props)` (optional, e.g. the router's generated `Root`: the shown URL's page modules) runs before its
 * standalone adopt run, which must render synchronously over the server nodes: true when settled, else the promise.
 */
function prepare(r: Rec, module: Record<string, unknown>): true | Promise<void> {
  if (r.ready === null) {
    const hook = exported(r, module)?.ready;
    const p = hook ? hook(propsOf(r)) : undefined;
    r.ready = p && typeof (p as Promise<unknown>).then === "function" ? Promise.resolve(p).then(() => void (r.ready = true)) : true;
  }
  return r.ready;
}
function demotedRoot(r: Rec, module: Record<string, unknown>): void {
  r.done = true;
  const range = rangeOf(r),
    fn = exported(r, module);
  if (!range || !fn) return;
  if (DEV)
    DEV.adopt(
      r.name + " (b" + r.id + ")",
      "a root boundary was given props that are not data (functions, class instances, signals): it renders in the browser",
    );
  r.owner = client(null, () => fn(propsOf(r)), range[0]!, range[range.length - 1]!, r, true);
  if (DEV && r.owner) roots.push(r.owner);
}
function standalone(r: Rec, module: Record<string, unknown>): void {
  if (r.done) return;
  r.done = true;
  const range = rangeOf(r),
    fn = exported(r, module);
  if (!range || !fn) {
    if (DEV) console.warn("Rivet resume: boundary " + r.name + " (b" + r.id + ") has no " + (fn ? "markup" : "export in its chunk") + " to adopt");
    return;
  }
  r.owner = adoptUnit(null, () => fn(propsOf(r)), range[0]!, range[range.length - 1]!, r, true, r.name);
  if (DEV && r.owner) roots.push(r.owner);
}
// Lite residual (ZERO R5, ownership §3.1): a standalone boundary whose chunk exports `<Name>$a` (a compiled lite chunk)
// adopts through it — handlers, live bindings and keyed state over the server nodes, no template, no probe. A residual
// that throws leaves the boundary to its ordinary component for good (`fallen`; the chunk's `<Name>$c()` imports it when
// the chunk has no `<Name>`). True when adopted, a promise while the ordinary module loads, false: not lite.
const fallen = new Set<Rec>();
function lite(r: Rec, module: Record<string, unknown>): true | false | Promise<void> {
  const name = r.name.slice(r.name.lastIndexOf("#") + 1),
    residual = module[name + "$a"] as ((node: Node, rec: object) => void) | undefined;
  if (!residual) return false;
  if (!fallen.has(r)) {
    const node = r.flags & ATTR ? doc!.querySelector('[data-b="' + r.id + '"]') : opener(r.id);
    const holder = { owner: null as Owner | null };
    try {
      if (!node) throw Error("LiteMiss");
      _rootIn(null, () => residual(node, { id: r.id, v: Object.fromEntries(r.values), w: tail?.w }), holder);
      r.owner = holder.owner;
      r.done = true;
      return true;
    } catch (error) {
      // (`_rootIn` disposed what the residual made.)
      if (DEV) console.warn("Rivet resume: lite residual of " + r.name + " (b" + r.id + ") fell back", error);
      fallen.add(r);
    }
  }
  if (module[name]) return false;
  return (r.loading = Promise.resolve((module[name + "$c"] as () => Promise<Record<string, unknown>>)()).then((ordinary) => {
    modules.set(r.name, ordinary);
    r.loading = null;
    return void need(r);
  }));
}
/** Dev (`dispose`): the standalone units' owners, the roots of everything adopted. */
const roots: Owner[] = [];
let disposed = false;
const load = (name: string): Promise<void> => {
  let p = loads.get(name);
  if (!p) {
    const url = chunks.get(name);
    p = url ? api!.m(url).then((module) => void modules.set(name, module)) : Promise.reject(Error("Rivet resume: no chunk for boundary " + name));
    loads.set(name, p);
  }
  return p;
};
/** Records whose sources `need` is walking (DERIVED-C5): wake lists can be cyclic — an ancestor reading a signal its
 * descendant made (the descendant adopts inside the ancestor's run), siblings reading each other's — a record met again
 * on the walk is left to whichever run adopts it first. */
const needing = new Set<Rec>();
/** Materialise `r` and what it needs first: true when done now, a promise while a chunk loads. */
function need(r: Rec): true | Promise<void> {
  if (r.done) return true;
  // DOM data: no unit runs before the reader rebuilt the tail's items (its props hold `0` there until then).
  if (DOM_DATA && domWait) return domWait.then(() => void need(r));
  if (r.hole) return (runHole(r), true);
  if (r.sources !== null) {
    if (needing.has(r)) return true;
    needing.add(r);
    try {
      for (const s of r.sources)
        if (!s.done) {
          const p = need(s);
          if (p !== true) return p.then(() => void need(r));
          if (r.done || r.hole) return need(r);
        }
    } finally {
      needing.delete(r);
    }
  }
  if (r.parent && !(r.flags & INDEPENDENT)) {
    const p = need(r.parent);
    if (p !== true) return p.then(() => void need(r));
    // Claimed by the parent's run (dependent: adopted with it); else inside a lazy row (the event path's next unit).
    return r.hole && !r.done ? need(r) : true;
  }
  const module = modules.get(r.name);
  if (!module) return (r.loading ??= load(r.name).then(() => void need(r)));
  // A root whose props hand it behaviour (`BROWSER` 2048, server-set on a demoted root, ruling R-22): no parent to adopt
  // with and no props to adopt it from — it renders in the browser (dev: warned, as a mismatch), never adopts silently
  // with `{}` (a dead page). A root demoted by a promise prop still adopts (its `Async` holes ship the values).
  if (r.flags & BROWSER && !r.parent) {
    const name = r.name.slice(r.name.lastIndexOf("#") + 1);
    if (module[name] || !module[name + "$c"]) return (demotedRoot(r, module), true);
    // A lite chunk (no component export, RT-DIET: a demoted root may be lite-picked): its ordinary module renders it.
    fallen.add(r);
  }
  const residual = lite(r, module);
  if (residual !== false) return residual;
  const ready = prepare(r, module);
  if (ready !== true) return ready.then(() => void need(r));
  standalone(r, module);
  return true;
}
// ---- DOM data (DERIVED-C5, `DOM_DATA` builds only: builds with a qualifying list, unless `resume: { domData: false }`) ----
// The reader is its own chunk (`dom-data-reader.ts`, DOMDATA-DEFAULT v2, URL `DOM_READER` from the switch), imported with
// the first tail that has `d` entries; every unit waits for it (`need`). The build lists it in the runtime's fetch-ahead
// closure (manifest `deps`).
type DomReader = typeof import("./dom-data-reader.ts");
let domReader: DomReader | null = null,
  domWait: Promise<void> | null = null,
  domPending: DerivedDom[] | null = null;
function domEntries(t: BoundaryTail): void {
  if (domReader) return domReader.entries(t.d!, recs, doc!);
  (domPending ??= []).push(...t.d!);
  domWait ??= api!.m(DOM_READER).then((module) => {
    domReader = module as unknown as DomReader;
    const all = domPending!;
    domPending = domWait = null;
    domReader.entries(all, recs, doc!);
  });
}

// The records of the tail or of a streamed segment's patch (its names, keys and wake lists merged into the tail), then
// its `Async` entries.
function records(t: BoundaryTail, patch: boolean): void {
  const added: Rec[] = [],
    n = t.n;
  for (let i = 0; i < n.length; i++) {
    const url = n[i]![1];
    if (url >= 0 && !chunks.has(n[i]![0])) chunks.set(n[i]![0], t.u![url]!);
    if (n[i]![3]) readBack.set(n[i]![0], n[i]![3]!);
    // D5: a patch re-sends a name whose union grew.
    if (n[i]![2]) (listened ??= new Map()).set(n[i]![0], n[i]![2]!);
  }
  eachRecord(t, (id, parent, flags, name, signals, props) => {
    const values = new Map<string, unknown>();
    for (let i = 0; i < signals.length; i += 2) values.set(signals[i] as string, signals[i + 1]);
    const r: Rec = {
      id,
      parent: recs.get(parent) ?? null,
      flags,
      name: n[name]![0],
      values,
      props: props ?? null,
      done: false,
      owner: null,
      hole: null,
      loading: null,
      ready: null,
      sources: null,
    };
    recs.set(id, r);
    added.push(r);
  });
  if (patch) {
    // The segment's markup is in the page now: the opener walk starts over (it may have passed where it went).
    openers = null;
    if (t.k) Object.assign((tail!.k ??= {}), t.k);
    if (t.w) Object.assign((tail!.w ??= {}), t.w);
  }
  for (const key in t.w ?? {}) {
    const source = recs.get(+key.slice(0, key.indexOf(".")));
    if (source) for (const id of t.w![key]!) recs.get(id) && (recs.get(id)!.sources ??= []).push(source);
  }
  if (DOM_DATA && t.d) domEntries(t);
  for (const id of t.i ?? []) islandIds.add(id);
  for (const r of added) if (r.flags & (LOAD | IDLE | VISIBLE) && !r.hole) trigger(r);
  asyncEntries(t.a);
}
function trigger(r: Rec): void {
  const go = () => {
    const p = need(r);
    if (p !== true) p.catch(report);
  };
  if (r.flags & LOAD) go();
  else if (r.flags & IDLE) ((window.requestIdleCallback as ((fn: () => void) => number) | undefined) || setTimeout)(go);
  else if (r.flags & VISIBLE) {
    const range = r.hole ? r.hole.range : rangeOf(r);
    const el = range?.find((n) => n.nodeType === 1) as Element | undefined;
    if (!el) return go();
    const io = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) (io.disconnect(), go());
    });
    io.observe(el);
  }
}

// The units around `node`, outermost first: boundary ranges (`data-b` elements, `<!--bN-->` openers) and region
// openers (`<!--rN[-->`: lazy rows, with the count of row groups before them at their level; Show branches are no
// units and are skipped by the caller).
function enclosing(node: Node | null): [kind: number, id: number, at: Node][] {
  const out: [number, number, Node][] = [];
  for (let n = node; n !== null && n.nodeType !== 9; n = n.parentNode ?? (n as unknown as ShadowRoot).host ?? null) {
    if (n.nodeType === 1 && (n as Element).hasAttribute("data-b")) out.push([0, +(n as Element).getAttribute("data-b")!, n]);
    let b = 0,
      r = 0,
      row: [number, number, Node] | null = null;
    for (let s = n.previousSibling; s !== null; s = s.previousSibling) {
      const d = data(s);
      if (d === null) continue;
      if (d === "/b") b++;
      else if (d === "]") r++;
      else if (B_OPEN.test(d)) b ? b-- : out.push([0, +d.slice(1), s]);
      else if (R_OPEN.test(d)) {
        if (!r) out.push((row = [1, 0, s]));
        else if (!--r && row) row[1]++;
      }
    }
  }
  return out.reverse();
}
// D5 listening records (ZERO R2, ruling R-30): the record's unit listens to `type` (tail v2 `n[i][2]`, by boundary NAME —
// the union over that name's instances; any type when `type` is undefined; every record while no name lists types). An
// event adopts only the listening records around its target — and what they need (`need`: a dependent one's parent chain,
// its wake-list sources) — not every enclosing record: a click on a page's static text or a native control no handler
// listens to acts natively, a click in an independent boundary adopts just its unit.
function listens(r: Rec, type?: string): boolean {
  if (!listened) return true;
  const x = listened.get(r.name);
  return x !== undefined && (type === undefined || x === "*" || (" " + x + " ").includes(" " + type + " "));
}
// Materialise the units around `target` an event of `type` needs, outermost first (records: those listening to it; lazy
// rows of adopted lists: every one): true when done now, a promise while a chunk loads.
function around(target: EventTarget | null, type?: string): true | Promise<void> {
  // Intake 3: once a record around the target listens to the event, every record around it adopts (outermost first, as
  // before D5): an independent unit's dependent descendants may read a context an ancestor unit provides (a `use…` hook
  // the facts cannot see: ui `Stepper` / `ChainOfThought`), which a standalone adopt would run without its provider.
  // ZERO CALLSITE: not when the listening record's unit (it, or its nearest independent ancestor: the one `need` adopts
  // standalone) is `CTXFREE` (the build proved no provider above it sets a context its unit reads).
  let all = false;
  for (const [kind, id] of enclosing(target as Node | null)) {
    const r = kind ? undefined : recs.get(id);
    if (r && listens(r, type)) {
      let u = r;
      while (u.parent && !(u.flags & INDEPENDENT)) u = u.parent;
      if (!(u.flags & CTXFREE)) {
        all = true;
        break;
      }
    }
  }
  for (let guard = 0; guard < 256; guard++) {
    let step: true | Promise<void> | null = null;
    for (const [kind, id, at] of enclosing(target as Node | null)) {
      if (kind) {
        const row = rowsByStart.get(at) ?? listAt(at, id);
        if (row && !row.done) {
          materialiseRow(row);
          step = true;
          break;
        }
      } else {
        const r = recs.get(id);
        if (r && !r.done && (all || listens(r, type))) {
          step = need(r);
          // A dependent record inside a lazy row of its parent: the row is the next unit.
          if (step === true && !r.done) continue;
          break;
        }
      }
    }
    if (step === null) return true;
    if (step !== true) return step;
  }
  return true;
}

// A form's submit / reset (a click on its submit / image / reset control, or the event itself) runs its controls'
// `invalid` / `reset` listeners, which no delegated type covers: the deferred units inside it adopt first (DERIVED-C5,
// fuzz `/checkbox`: a deferred CheckboxField missed the submit's `invalid`).
function formOf(event: Event, target: Element | null): HTMLFormElement | null {
  if (event.type === "submit" || event.type === "reset") return target as HTMLFormElement | null;
  if (event.type !== "click") return null;
  const control = target?.closest?.("button,input") as HTMLButtonElement | HTMLInputElement | null | undefined;
  return control?.form && /^(submit|image|reset)$/.test(control.type) ? control.form : null;
}
// Document click listeners (tail `g`, server `_rListen`: the router's link clicks): materialise the boundaries listening
// for a click (D5 listening records: any delegated event) wherever its target is, before the units around the target. True when done now, a promise while a chunk loads.
const gAdopts = (target: Element | null): boolean =>
  (tail?.g ?? []).some(([id, match]) => {
    const r = recs.get(id);
    return !!r && !r.done && !!target?.closest?.(match);
  });
function listeners(event: Event): true | Promise<void> {
  const target = event.target as Element | null;
  const form = formOf(event, target);
  if (form !== null)
    for (const r of recs.values())
      if (r.flags & DEFER && r.hole?.start && !r.done && form.contains(r.hole.start)) {
        const p = need(r);
        if (p !== true) return p;
      }
  // D5: a link intent (pointerdown / focusin / any delegated event on a match) adopts them too — no enclosing record that
  // listens adopts them any more (before D5 every record listened: `around` did).
  if (event.type !== "click" && !listened) return true;
  for (const [id, match] of tail?.g ?? []) {
    const r = recs.get(id);
    if (r && !r.done && target?.closest?.(match)) {
      const p = need(r);
      if (p !== true) return p;
    }
  }
  return true;
}

// ---- Cold press (DERIVED-C: dom-resume's cold-press replay, ported; `libs/runtime/CLAUDE.md` "Cold press") ----
// A mousedown's default focus target: the nearest focusable inclusive ancestor, `[null]` when focus just leaves;
// undefined where the default does more than focus (text entry, selects, range thumbs, drags) or for another button.
const pressTarget = (event: Event): [HTMLElement | null] | undefined => {
  let el = event.target as HTMLElement | null;
  if (
    (event as MouseEvent).button ||
    (event as PointerEvent).isPrimary === false ||
    el?.closest?.(":read-write,select,[draggable=true]") ||
    (el as HTMLInputElement)?.type == "range"
  )
    return;
  while (el && (!(el.tabIndex >= 0 || el.hasAttribute?.("tabindex")) || el.matches?.(":disabled,a:not([href],[tabindex])"))) el = el.parentElement;
  return [el];
};
const isPress = (event: Event): [HTMLElement | null] | false | undefined =>
  (event.type === "mousedown" || (event.type === "pointerdown" && (event as PointerEvent).pointerType !== "touch")) && pressTarget(event);
// Listeners a replayed handler attaches (RA usePress's document `pointerup` on press start, a tooltip's close-on-press
// capture `pointerdown`): while cold events are queued `EventTarget.prototype` add / remove record them; each later
// replayed event dispatched before one was added runs it after its delegated handlers, in path order (`late`).
type Added = [target: EventTarget, type: string, fn: EventListenerOrEventListenerObject, capture: boolean, at: number, during: Event | null, options: unknown];
const proto = EventTarget.prototype,
  nativeAdd = proto.addEventListener,
  nativeRemove = proto.removeEventListener;
let added: Added[] = [],
  replayed: Event | null | undefined,
  // A replay is running (its handlers' own events — a `focus()`'s focusin — are live, not queued behind the chain).
  replaying = false,
  // Cold press bookkeeping (dom-resume `cold`): the last cold pointerdown press (its mousedown links to it); whether the
  // last cold event was a press whose native focus move follows; the last replayed press start's coordinates + hits.
  down: Event | undefined,
  pressed: [HTMLElement | null] | false | undefined,
  start: [x: number, y: number, before: Element | null, after?: Element | null] | undefined,
  back: [Element | null] | undefined,
  // The focus verdict of the last replayed linked pointerdown (`replay` `fresh`), for its mousedown.
  pairFresh = false;
const captures = (o: unknown): boolean => !!(typeof o == "object" ? (o as AddEventListenerOptions | null)?.capture : o);
const sameAdded = (r: Added, t: EventTarget, type: string, fn: unknown, o: unknown) => r[0] === t && r[1] === type && r[2] === fn && r[3] === captures(o);
function addRecorded(this: EventTarget, type: string, fn: EventListenerOrEventListenerObject | null, o?: boolean | AddEventListenerOptions): void {
  nativeAdd.call(this, type, fn, o);
  // During a replay, and while events are held: an adopt run (a chunk's `load` resolving outside any replay) adds a
  // `model:value` input listener, a ref's library listener — the held events dispatched before it reach it too (ai-eval
  // filter-list: the cold input that adopted the field updates its signal).
  if ((replayed !== undefined || pending.length) && fn && !added.some((r) => sameAdded(r, this, type, fn, o)))
    added.push([this, type, fn, captures(o), performance.now(), replayed ?? null, o]);
}
function removeRecorded(this: EventTarget, type: string, fn: EventListenerOrEventListenerObject | null, o?: boolean | EventListenerOptions): void {
  nativeRemove.call(this, type, fn, o);
  added = added.filter((r) => !sameAdded(r, this, type, fn, o));
}
const record = (on: unknown): void => {
  if (on) ((proto.addEventListener = addRecorded), (proto.removeEventListener = removeRecorded));
  else if (proto.addEventListener === addRecorded) ((proto.addEventListener = nativeAdd), (proto.removeEventListener = nativeRemove), (added = []));
};
function late(event: Event, path: EventTarget[]): Added[] {
  const list = added.filter((r) => r[1] === event.type && r[5] !== event && event.timeStamp < r[4]),
    stopped = event.cancelBubble,
    ran: Added[] = [];
  if (!list.length) return ran;
  const order: [EventTarget, boolean][] = [...path].reverse().map((t) => [t, true]);
  for (const t of path.slice(0, event.bubbles ? path.length : 1)) order.push([t, false]);
  for (const [t, capture] of order) {
    if (event.cancelBubble && (!stopped || !capture || ((t as Node).nodeType > 0 && (t as Node).nodeType != 9))) break;
    for (const r of list)
      if (r[0] === t && r[3] === capture && added.includes(r)) {
        const o = r[6] as AddEventListenerOptions | undefined,
          aborted = typeof o == "object" && o?.signal?.aborted,
          once = typeof o == "object" && o?.once;
        if (aborted || once) t.removeEventListener(r[1], r[2], capture);
        if (!aborted) {
          // (A `once` listener is gone: nothing to take off for the default, `defaulted`.)
          once || ran.push(r);
          Object.defineProperty(event, "currentTarget", { configurable: true, value: t });
          try {
            typeof r[2] == "function" ? r[2].call(t, event) : r[2].handleEvent(event);
          } catch (error) {
            reportError(error);
          } finally {
            delete (event as { currentTarget?: unknown }).currentTarget;
          }
        }
      }
  }
  return ran;
}
const linked = new WeakSet<Event>(),
  // Cold focus / blur events of a cold press's native mouse focus: the replay re-creates that move, they never replay.
  moved = new WeakSet<Event>(),
  // Presses queued while they dispatched: their native focus move is undone as it lands (`hidden`), focus stays put.
  hiddenMove = new WeakSet<Event>(),
  // A pressed element whose native focus move a replayed handler canceled → [element focused at its dispatch, undo time,
  // dispatch time] per canceled press (a later press dispatched before the undo puts focus back past it).
  undone = new WeakMap<Element, [was: Element | null, at: number, dispatched: number][]>();
// The native mouse focus move of a press queued while it dispatches, and its focus-back, reach no listener (window
// capture, `stopImmediatePropagation`); the move is undone as it lands (`back`), as RA `preventFocus` does.
const hidden = (event: Event): void => {
    event.stopImmediatePropagation();
    moved.add(event);
    const was = back?.[0];
    if (event.type == "focusin" && back)
      ((back = undefined), was && was !== doc!.body ? (was as HTMLElement).focus({ preventScroll: true }) : (event.target as HTMLElement).blur?.());
  },
  hide = (on?: unknown): void => {
    for (const type of ["focus", "blur", "focusin", "focusout"]) (on ? nativeAdd : nativeRemove).call(window, type, hidden, true);
    on || (back = undefined);
  };
// The latest form state a held `input` / `change` recorded per control (value, checked): what a replay puts back after
// writing an earlier event's state. Not the live state at the replay: a replayed event before it may re-assert a
// controlled value that still lags the held input (a focus replay's spread re-run wrote a TextArea's "" over the typed
// "hey"; the input replay then restored "", so Enter typed into an empty field). Only events the browser fired after the
// change landed: a held click's state is its pre-activation `checked`, which the canceled default reverted (the replayed
// default toggles it again). Every event is held while the queue drains (`on`), so no newer state is skipped; reset when
// the queue is empty.
let typed = new WeakMap<EventTarget, [unknown, unknown]>();
// Held keys follow the focus their replays move (COLD-FIX-B): keys typed before boot all went to the element focused
// then (the loader held them, so no native default moved focus); a replayed key whose handler moves focus (a date
// segment advancing after two digits) sends the next held keys dispatched to that same element to where focus went,
// as a loaded page had — before, the rest of a cold "01/01/2020" retyped the month. [dispatch target, element a replay
// focused].
// Reset by any other held event (a press or input between them was the user's own focus move) and when the queue empties.
let keyed: [EventTarget, Element] | undefined;
// A cold event as it is queued (dom-resume `cold`'s synchronous part): link a press's pointerdown + mousedown, mark the
// focus events of a pre-boot press's native move, hide the move of a press queued while it dispatches.
function queued([event, , , state]: HeldEvent): void {
  const t = event.target as HTMLInputElement | null;
  if (t && "value" in t && /^(input|change)$/.test(event.type)) typed.set(t, [state[0], state[1]]);
  if (event.type === "pointerdown") down = (event as PointerEvent).pointerType !== "touch" ? event : undefined;
  else if (event.type === "mousedown" && down?.target === event.target) (linked.add(down).add(event), (down = undefined));
  const dispatching = event.eventPhase !== 0;
  if (/^(focus|blur)/.test(event.type)) pressed && !dispatching && (/^(blur|focusout)$/.test(event.type) || pressed[0] === event.target) && moved.add(event);
  else if ((pressed = isPress(event)) && dispatching) (hide(1), (back = [state[2]]), hiddenMove.add(event), setTimeout(hide));
}

// Run a held event's delegated handlers over its path (then the listeners replays attached since its dispatch), with the
// form state its target had at dispatch; a cold press puts focus back first and focuses as its default afterwards; the
// event's default replays unless a handler canceled it. Resolves once the press's default focus ran (a microtask).
function replay([event, path, again, state]: HeldEvent): Promise<void> | void {
  let canceled = false,
    target = event.target as HTMLInputElement;
  const type = event.type,
    key = /^key/.test(type),
    sent = target,
    // Its boundary rendered in the browser instead of adopting (mismatch): the target left the page — replayed on the
    // node at its place in the browser's render (`retargets`), dropped when there is none.
    shifted = target && !target.isConnected,
    // A held key sent where an earlier key's replay moved focus from (`keyed`): replayed there.
    follow = key && keyed?.[0] === target && keyed[1].isConnected && keyed[1];
  if (shifted || follow) {
    const to = (follow || retargets.get(target)) as HTMLInputElement | undefined;
    if (!to?.isConnected) return;
    Object.defineProperty(event, "target", { configurable: true, value: (target = to) });
    path = pathOf(to);
  }
  if (!key && !/^(focus|blur)/.test(type)) keyed = undefined;
  hide();
  const press = isPress(event),
    pair = linked.has(event),
    before = doc!.activeElement,
    // Focus sits where the press left it: on its target (the native move landed) or where it was at dispatch (the move
    // was undone, `hidden`). Elsewhere, focus moved on after the press (a script focus, a Tab, a later press's own
    // move): its default focus already happened and is not replayed over that move (TOGGLE-TABS-COLD: a cold click
    // then a focus + ArrowDown in another toolbar pulled focus back to the clicked button before the key replayed).
    // A linked mousedown follows its pointerdown's verdict (that replay already put focus back).
    fresh = pair && type === "mousedown" ? pairFresh : !!press && before === ((hiddenMove.has(event) ? state[2] : press[0]) ?? doc!.body);
  if (pair && type === "pointerdown") pairFresh = fresh;
  if (press && !(pair && type === "mousedown") && doc!.activeElement === (press[0] ?? doc!.body)) {
    let was = state[2] as HTMLElement | null,
      ts = event.timeStamp,
      u: [Element | null, number, number] | undefined;
    while (was && (u = undone.get(was)?.findLast((e) => e[2] < ts && event.timeStamp < e[1]))) ((was = u[0] as HTMLElement | null), (ts = u[2]));
    hide(1);
    try {
      was && was !== doc!.body ? was.focus({ preventScroll: true }) : press[0]?.blur();
    } finally {
      hide(0);
    }
  }
  // A press's up / click lands on what covers the press target once its press start ran (a popover opened at pointerdown).
  let to: Node | null | undefined;
  const { clientX: x, clientY: y } = event as MouseEvent;
  if (press && !(pair && type === "mousedown")) start = [x, y, doc!.elementFromPoint(x, y)];
  else if (
    /^(pointerup|mouseup|click)$/.test(type) &&
    start &&
    (start[0] - x) ** 2 + (start[1] - y) ** 2 < 2 &&
    (type != "click" || (event as MouseEvent).detail)
  ) {
    const at = (to = type == "pointerup" || start.length < 4 ? (start[3] = doc!.elementFromPoint(x, y)) : start[3]),
      from = event.target as Node;
    if (at && at !== start[2] && from.isConnected && !from.contains(at)) {
      if (type == "click") while (to && !to.contains(from)) to = to.parentNode;
      path = path.filter((n) => !(n as Node).contains || (n as Node).contains(at));
      Object.defineProperty(event, "target", { configurable: true, value: to });
    } else to = null;
    if (type == "click") start = undefined;
  }
  // The control's value / checked at the event's dispatch, for its handlers (an input / change / click replayed after
  // later typing). Not for focus events: their handlers read no value, and writing a date input's value while focus is
  // in its fields focuses it (a trusted focusin) — each replayed focusin queued two more (cdk /date-picker autofill hung).
  // A followed key (`keyed`): its dispatch state is the first element's, not the one it now goes to.
  const control = !follow && target && "value" in target && target.localName !== "button" && !/^(focus|blur)/.test(type),
    at = control ? [target.value, target.checked] : null,
    // Put back afterwards: the latest held state of the control (later typing), else the live one (`typed`).
    now = at && (typed.get(target) ?? at),
    // The state is put back afterwards only when it was written here (later typing, or a value re-asserted since): otherwise
    // a value the handlers wrote stays (a number field's step — restoring the pre-replay value over it left a cold
    // ArrowUp's input on the old number).
    wrote = at && (at[0] !== state[0] || at[1] !== state[1]);
  Object.defineProperty(event, "composedPath", { configurable: true, value: () => path });
  Object.defineProperty(event, "defaultPrevented", { configurable: true, get: () => canceled });
  Object.defineProperty(event, "preventDefault", { configurable: true, value: () => void (canceled = true) });
  if (wrote) ((target.value = state[0] as string), (target.checked = state[1] as boolean));
  replaying = true;
  replayed = event;
  let ran: Added[] = [];
  try {
    if (!moved.has(event)) (_delegateBelow(event, doc!), (ran = late(event, path)));
  } finally {
    replaying = false;
    delete (event as { composedPath?: unknown }).composedPath;
    delete (event as { defaultPrevented?: unknown }).defaultPrevented;
    delete (event as { preventDefault?: unknown }).preventDefault;
    (to || shifted || follow) && delete (event as { target?: unknown }).target;
    // Only a move this replay made (the live focus may sit where the user moved it after typing).
    const moved = doc!.activeElement;
    if (key && moved !== before) keyed = moved && moved !== doc!.body && moved !== sent ? [sent, moved] : undefined;
    if (wrote && (target.value !== now![0] || target.checked !== now![1])) ((target.value = now![0] as string), (target.checked = now![1] as boolean));
  }
  const kept = canceled;
  return Promise.resolve().then(() => {
    replayed = undefined;
    // The press's default focus (an unpaired pointerdown focuses even when canceled; a canceled mousedown keeps focus).
    replaying = true;
    try {
      if (press && !(pair && type === "pointerdown"))
        if (!kept || type === "pointerdown")
          fresh &&
            (press[0] ? press[0].focus({ preventScroll: true, focusVisible: false } as FocusOptions) : (doc!.activeElement as HTMLElement | null)?.blur?.());
        else if (press[0]) {
          const list = undone.get(press[0]) ?? [];
          (undone.set(press[0], list), list.push([state[2], performance.now(), event.timeStamp]));
        }
      kept || (again && defaulted(type, again, ran));
    } finally {
      replaying = false;
    }
  });
}
// A held event's default (the loader's `requestSubmit()`, a link's re-dispatched click): native listeners and the browser
// see it, the handlers that just ran on the held event do not run again (RESUME-FIX A1: a cold `onSubmit` without
// `preventDefault` ran twice) — the delegated ones (`_delegated`), and the listeners added since its dispatch that `late`
// ran (a compiled `onSubmit`: a direct `_listen` listener), off while it propagates. Its event = the first of the held type
// the window's capture phase sees; a re-dispatched control click (no link) stops at the loader's document listener, and
// what its activation fires (a label's click on its control, a submit button's submit) is live.
function defaulted(type: string, again: () => void, ran: Added[]): void {
  const win = doc!.defaultView!;
  let off: Added[] = [];
  const mark = (event: Event): void => {
    nativeRemove.call(win, type, mark, true);
    _delegated(event);
    if (type !== "click" || (event.target as Element).localName === "a") for (const r of (off = ran)) nativeRemove.call(r[0], r[1], r[2], r[3]);
  };
  nativeAdd.call(win, type, mark, true);
  try {
    again();
  } finally {
    nativeRemove.call(win, type, mark, true);
    for (const r of off) nativeAdd.call(r[0], r[1], r[2], r[6] as AddEventListenerOptions);
  }
}
// Cold hover (DERIVED-C): the pointer entered the units an event just adopted before their hover listeners existed (RA
// useHover's `pointerenter`: direct, non-bubbling listeners): a mouse / pen event that adopted something gives the
// elements on its path the enter events a loaded page had seen, in the browser's order (DERIVED-C3: every
// `pointerenter`, outermost first, then every `mouseenter` likewise; once per element): the first mouse / pen event
// after an adopt run (`adopted`; a focus or key event may have adopted them). `pointerover` / `mouseover` are not
// replayed: they bubble to delegated listeners that may have seen the native one (a page running since before). Held
// enters (`pointerenter` / `mouseenter`: the loader holds them until the pointer rests, ZERO ONDEMAND) are not replayed
// either: a run of them (one pointer move enters outermost first) adopts around the innermost target and gives the
// synthetic enters over its path (`drain`) — one enter per element, in the browser's order, not a replayed one plus a
// synthetic one on the next mouse event.
const entered = new WeakSet<EventTarget>();
let adopted = false;
function enter(event: Event, path: EventTarget[]): void {
  const type = (event as PointerEvent).pointerType;
  if (!adopted || !/^(pointer|mouse)(down|over|move|up|enter)$|^click$/.test(event.type) || type === "touch") return;
  adopted = false;
  const { clientX, clientY } = event as MouseEvent,
    init = { clientX, clientY, pointerType: type || "mouse", pointerId: (event as PointerEvent).pointerId || 1, isPrimary: true },
    els: Element[] = [];
  for (let i = path.length; i--;) {
    const el = path[i] as Element;
    if (el.nodeType === 1 && !entered.has(el)) (entered.add(el), els.push(el));
  }
  for (const el of els) el.dispatchEvent(new PointerEvent("pointerenter", init));
  for (const el of els) el.dispatchEvent(new MouseEvent("mouseenter", init));
}
async function drain(): Promise<void> {
  while (pending.length) {
    let item = pending[0]!;
    const run = /enter$/.test(item[0].type),
      next = (): boolean => run && !!pending[1] && /enter$/.test(pending[1][0].type);
    try {
      do {
        // A run of held enters: its innermost one stands for the run (its path holds the others' targets) — also the
        // ones queued while the outer ones adopted (one pointer move dispatches them all before the first adopt ends).
        while (next()) (pending.shift(), (item = pending[0]!));
        for (let step = listeners(item[0]); step !== true; step = listeners(item[0])) await step;
        for (let step = around(item[0].target, item[0].type); step !== true; step = around(item[0].target, item[0].type)) await step;
        // D5: the units around the target may adopt only now (a press's earlier events no longer adopt a record that does
        // not listen to them): the deferred units its run claimed inside a submitted form adopt before the replay.
        for (let step = listeners(item[0]); step !== true; step = listeners(item[0])) await step;
      } while (next());
      enter(item[0], item[1]);
      if (!/enter$/.test(item[0].type)) await replay(item);
    } catch (error) {
      report(error);
    }
    pending.shift();
  }
  typed = new WeakMap();
  keyed = undefined;
  record(0);
}

const runtime: DerivedRuntime = {
  start(t, d, loader) {
    // Dev: disposed before the loader booted it (DevTools inspection, then a first event): held events act natively.
    if (DEV && disposed) return void loader.q.splice(0).forEach((item) => item[2]?.());
    tail = t;
    doc = d;
    api = loader;
    _adoption.same = same;
    _adoption.list = forHook as typeof _adoption.list;
    _adoption.keep = new WeakSet();
    // A pass whose output is inspected and discarded (`_rUnrecorded`: cdk's collection build pass, often first evaluated
    // inside a cached `computed` read by a later unit's probe) runs outside every unit, as the server renders it outside
    // its recorder: its boundaries run their bodies (they register), its `signal()`s are plain (no key counted) and its
    // lists are client lists — a build pass run inside a probe left its items as holes and cached an empty collection
    // that the adopt run then rendered (collection-host recreate, DERIVED-C).
    _setUnrecorded((fn) => {
      const u = cur;
      cur = null;
      try {
        return fn();
      } finally {
        cur = u;
      }
    });
    _adoption.async = asyncHook as typeof _adoption.async;
    (globalThis as { [ISLAND]?: typeof islandHook })[ISLAND] = islandHook;
    _adoption.resource = () => {
      const u = cur,
        rec = u?.rec;
      if (!u || !rec) return undefined;
      const n = (u.counts.get("$r") ?? 0) + 1;
      u.counts.set("$r", n);
      return rec.values.get(n > 1 ? "$r#" + n : "$r");
    };
    _adoption.suspense = () => {
      if (cur !== null && cur.mode === PROBE) cur.sus = true;
    };
    // Rivet's delegated listeners go on the document before any adopt run adds its own document listeners (the router's
    // `clientEvent(document, "click", interceptClick)`): natively they then run in a client render's order — a link's own
    // `onClick` `preventDefault()` before the router's bubbling listener (M6-PARITY, forms drawer: a live click on an
    // `<a href="?new">` whose handler opens a drawer navigated, because the page's first delegated `click` registered
    // after the router's).
    const probe = d.createElement("i");
    for (const type of DELEGATED) _on(probe, type, null);
    // The page's delegation (RT-DIET): a lite residual this runtime adopts (R5) or a lite runtime that handed over binds
    // its handlers through it (`dom-lite.ts` `on`), never a second document listener.
    (d as Document & { $$rvOn?: typeof _on }).$$rvOn = _on;
    if (DEV) _adoption.probe = () => cur !== null && cur.mode === PROBE;
    records(t, false);
    // Handed over by the lite runtime (`dom-lite.ts` fallback, ZERO R4): the boundaries it adopted stay its own, the
    // ones whose residual threw adopt through their ordinary component.
    const lite = loader as DerivedLoaderApi & { l?: Map<number, unknown>; x?: number[] };
    for (const id of lite.l?.keys() ?? []) recs.get(id) && (recs.get(id)!.done = true);
    for (const id of lite.x ?? []) recs.get(id) && fallen.add(recs.get(id)!);
    // Streamed segments (DERIVED-C2): patches that landed before the runtime started, then each one as it lands.
    const sd = d as Document & { $rd?: BoundaryTail[]; $rdp?: (patch: BoundaryTail) => void };
    for (const x of sd.$rd ?? []) records(x, true);
    sd.$rdp = (x: BoundaryTail) => records(x, true);
    // Stream over (document parsed) with `Async` holes still waiting: they render in the browser.
    if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", () => [...waiting.values()].forEach(landAsync));
    for (const item of loader.q.splice(0)) runtime.cold(item);
  },
  on(event) {
    if (DEV && disposed) return true;
    if (pending.length && !replaying) return false;
    // A click that adopts a document click listener's boundary (tail `g`, the router's `App`) is held: listeners
    // added to the document while the click is at the document are skipped natively (the router's capture listener
    // that routes a link whose own handler stopped propagation); its replay reaches them (`late`).
    if (event.type === "click" && !replaying && gAdopts(event.target as Element | null)) return false;
    const listening = listeners(event);
    if (listening !== true) return (listening.catch(() => {}), false);
    live = event;
    let step: true | Promise<void>;
    try {
      step = around(event.target, event.type);
    } finally {
      live = null;
    }
    // D5: what that run claimed inside a submitted form adopts first (`listeners`): the event waits for it.
    const claimed = step === true ? listeners(event) : true;
    if (claimed !== true) return (claimed.catch(() => {}), false);
    const target = event.target as HTMLInputElement | null;
    if (step === true && target && !target.isConnected && retargets.has(target)) {
      // Its unit rendered in the browser while adopting: the native dispatch would reach the removed server nodes only.
      event.stopImmediatePropagation();
      if (/^(pointer|mouse)down$/.test(event.type)) pressTo = retargets.get(target) as HTMLInputElement;
      runtime.cold([event, event.composedPath(), undefined, [target.value, target.checked, doc!.activeElement]]);
      return true;
    }
    // The press that adopted it started on a removed server node (its pointerdown retargeted): Chrome then sends the
    // compatibility mousedown to the nearest connected ancestor and fires no click — the mousedown (and a click a browser
    // does send to that ancestor) is replayed on the browser's node the press was retargeted to, and its release clicks
    // that node when no click follows (`click()`: handlers + default action).
    const to = pressTo;
    if (step === true && to && to.isConnected && target) {
      if (/^(mousedown|click)$/.test(event.type) && target !== to && target.contains(to)) {
        if (event.type === "click") pressTo = null;
        event.stopImmediatePropagation();
        Object.defineProperty(event, "target", { configurable: true, value: to });
        runtime.cold([event, pathOf(to), undefined, [to.value, to.checked, doc!.activeElement]]);
        return true;
      }
      // (An SVG node has no `click()`: a dispatched click runs its handlers; SVG has no activation behaviour.)
      if (event.type === "mouseup" && (target === to || to.contains(target)))
        setTimeout(
          () =>
            pressTo === to &&
            ((pressTo = null),
            to.isConnected && (to.click ? to.click() : to.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, composed: true })))),
        );
    }
    if (event.type === "click" || event.type === "pointerdown") pressTo = null;
    if (step === true) return (enter(event, event.composedPath()), true);
    step.catch(() => {});
    return false;
  },
  cold(item) {
    if (DEV && disposed) return;
    queued(item);
    record(1);
    if (pending.push(item) === 1) void drain();
  },
  w(target) {
    // Intent (D5): the units of the listening records around the target (innermost first; while no name lists types the
    // outermost record's), else of the document click listeners matching it (tail `g`): the chunk, then what its component needs
    // before adopting (`ready`), nothing runs.
    const warm = (r: Rec | undefined): void => {
      while (r && !r.done && !r.hole && r.parent && !(r.flags & INDEPENDENT) && !r.parent.done) r = r.parent;
      if (r && !r.done && !r.hole) load(r.name).then(() => void prepare(r!, modules.get(r!.name)!), report);
    };
    const units = enclosing(target as Node | null).filter(([kind, id]) => !kind && recs.has(id));
    if (!listened) return warm(recs.get(units[0]?.[1]!));
    let found = false;
    for (let i = units.length; i--;) {
      const r = recs.get(units[i]![1])!;
      if (listens(r)) ((found = true), warm(r));
    }
    if (!found) for (const [id, match] of tail?.g ?? []) if ((target as Element | null)?.closest?.(match)) warm(recs.get(id));
  },
  m(id) {
    const r = recs.get(id);
    const p = r ? need(r) : true;
    return p === true ? Promise.resolve() : p;
  },
};
if (DEV)
  runtime.dispose = () => {
    disposed = true;
    pending.length = 0;
    // The loader then leaves links outside every boundary to the page (the client-rendered router's listener).
    globalThis.document.querySelector('script[type="rivet/boundaries"]')?.removeAttribute("data-g");
    for (const owner of roots.splice(0)) _dispose(owner);
  };
// The component ABI (`dom-derived-abi.ts`, `@rivetjs/runtime/dom-derived`) runs these from now on.
_abi({ b, s: sig, st: sigStore, d: dsignal, l: wakeLoose });
export { _b, _sig, _sigStore, _dsignal } from "./dom-derived-abi.ts";
export default runtime;
