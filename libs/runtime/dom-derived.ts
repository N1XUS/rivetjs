// Derived model, browser side (milestone M2 lane R: R2 runtime half + R3; plan docs/design/plans/2026-10-18-derived-client.md,
// spec docs/design/specs/2026-10-18-structural-resume-design.md §3.4 / §3.5). Own subpath (`@rivetjs/runtime/dom-derived`,
// pay-per-use): compiled derived DOM modules import the component ABI from here, and the page's runtime URL (tail
// `data-rt`) default-exports the instance the inline loader (`resume-loader-derived.ts`) starts.
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
import type { EqualsOptions, Owner, Signal } from "@rivetjs/reactivity";
import { createStore } from "@rivetjs/reactivity/store";
import type { Store } from "@rivetjs/reactivity/store";
import { _adoption, _delegateBelow, _for, _insert } from "./dom-v2.ts";
import type { ForRow, InsertSlot } from "./dom-v2.ts";
import { _adoptRow, adopt, between, copyIn, describe, dirtyOf, kids, probeRow, same, save, textOf } from "./dom-adopt.ts";
import type { Align, Answers, Current, Probe, RowPlanCache } from "./dom-adopt.ts";
import { _setUnrecorded } from "./resume-format.ts";
import type { BoundaryTail } from "./resume-format.ts";
import { DEV } from "#dev";

/** Record flags (`BoundaryRecord[2]`, `server-derived.ts`). */
const INDEPENDENT = 1,
  ATTR = 2,
  UNKEYED = 4,
  LOAD = 32,
  IDLE = 64,
  VISIBLE = 128;
const PROBE = 0,
  ADOPT = 1,
  CLIENT = 2;
const R_OPEN = /^r\d*\[$/,
  B_OPEN = /^b\d+$/;

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
type Hole = BHole | FHole;
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
}
/**
 * A list adopted lazily (DERIVED-C: O(1) at adopt): no row object, no client `_for` until needed — its slot keeps the
 * server rows (`_adoption.keep`) while its items are the server's; rows are built from the server groups on the first
 * event inside one, keyed write or wake (`rowsOf`), the client `_for` on the first change of its items (`realFor`).
 */
interface Lazy {
  /** null: not built yet (`rowsOf`). */
  rows: LRow[] | null;
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
type WArg = [0, unknown] | [1, number[], string] | [2] | [3];
interface Writer {
  fn: (a: unknown, b: unknown, c: unknown) => void;
  args: WArg[];
  /** Element slot of this writer's element capture in `LRow.els` (one per writer with an element capture). */
  slot: number;
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
  doc: Document | null = null,
  api: DerivedLoaderApi | null = null,
  tail: BoundaryTail | null = null,
  openers: [Map<number, Node>, TreeWalker] | null = null;
const recs = new Map<number, Rec>(),
  modules = new Map<string, Record<string, unknown>>(),
  loads = new Map<string, Promise<void>>(),
  rowsByStart = new WeakMap<Node, LRow>(),
  // Sole lists (`FHole.sole`) by their element: their rows are built on the first event inside one (`listAt`).
  listsIn = new WeakMap<Node, Lazy>(),
  // `_sig` getters: the only non-row captures a keyed row writer may take (they are the same in every row).
  keyedGetters = new WeakSet<object>(),
  pending: HeldEvent[] = [];
const DIVERGED = "Rivet resume: an adopt run diverged from its probe";

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
});
const report = (error: unknown): void => (api ? api.f(error) : console.error(error));

/**
 * Compiler ABI (derived DOM target): an interactive component's body. Client render: `body()`. Adopt run: a hole the
 * unit's alignment pairs with the server range of this boundary (adopted next as a unit of its own, or deferred).
 */
export function _b<T>(name: string, body: () => T): T {
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
  if (u.depth) return body();
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

/** Compiler ABI (derived DOM target): keyed `signal(init)`; in an adopt run, the record's value. */
export function _sig<T>(key: string, init?: T, options?: EqualsOptions<T>): Signal<T> {
  const u = cur,
    rec = u?.rec;
  if (!u || !rec) return signal(init as T, options);
  const n = (u.counts.get(key) ?? 0) + 1;
  u.counts.set(key, n);
  const k = n > 1 ? key + "#" + n : key;
  const s = signal((rec.values.has(k) ? rec.values.get(k) : init) as T, options);
  const e: Keyed = { fors: null, wake: tail?.w?.[rec.id + "." + k], rows: null };
  const get = function () {
    collector?.add(e);
    return s();
  } as Signal<T>;
  keyedGetters.add(get);
  get.set = (value) => {
    before(e);
    const was = e.rows && untrack(s),
      out = s.set(value);
    if (e.rows && untrack(s) !== was) rewrite(e);
    return out;
  };
  get.update = (fn) => {
    before(e);
    const was = e.rows && untrack(s),
      out = s.update(fn);
    if (e.rows && untrack(s) !== was) rewrite(e);
    return out;
  };
  return get;
}

/** Compiler ABI (derived DOM target): keyed `createStore(init)`; in an adopt run, created from the record's value. */
export function _sigStore<T extends object>(key: string, init: T): Store<T> {
  const u = cur,
    rec = u?.rec;
  if (!u || !rec) return createStore(init);
  const n = (u.counts.get(key) ?? 0) + 1;
  u.counts.set(key, n);
  const k = n > 1 ? key + "#" + n : key;
  return createStore((rec.values.has(k) ? rec.values.get(k) : init) as T);
}

// The first write to a keyed signal: the lazy lists whose rows read it materialise every row, the boundaries on its
// wake list materialise — before the write notifies, so their bindings start from what the page shows.
function before(e: Keyed): void {
  const fors = e.fors,
    wake = e.wake;
  if (fors) {
    e.fors = null;
    for (const lazy of fors) wakeFor(lazy);
  }
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
    const hole: FHole = { kind: 1, n: items.length, nodes: pair(), groups: null, sole: null, span: null };
    u.holes.push(hole);
    return () => hole.nodes;
  }
  const hole = u.holes[u.at++];
  if (!hole || hole.kind !== 1) throw Error(DIVERGED);
  const lazy: Lazy = {
    rows: null,
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
    lazy.bad = true;
    if (lazy.real === null && !building) lazy.tick.set(1);
    return (lazy.rows = []);
  }
  return (lazy.rows = groups.map(([start, end], k) => {
    const item = items[k];
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
  }));
}
// The client `_for` of a lazy list, under the list's owner: takes the server rows (adopted by key, materialised ones keep
// their owners) unless they did not match (`bad`: rendered in the browser, the slot's server nodes replaced).
function realFor(lazy: Lazy): () => Node[] {
  building = true;
  let rows: LRow[];
  try {
    rows = rowsOf(lazy);
  } finally {
    building = false;
  }
  const outer = _adoption.rows;
  if (!lazy.bad)
    _adoption.rows = () => ({
      items: lazy.items.slice(),
      rows,
      adopted: new Map<ForRow, number>(rows.map((row) => [row, -1])),
      changed: null,
      host: null,
    });
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
// The lazy list whose server rows an element holds (sole lists), for a row opener the event path meets.
function listAt(opener: Node): LRow | undefined {
  const lazy = opener.parentNode ? listsIn.get(opener.parentNode) : undefined;
  if (lazy) rowsOf(lazy);
  return rowsByStart.get(opener);
}

// A sole list's hole start (its span is a lazy view of its element's children).
const soleOf = (a: UnitAlign, n: Node): boolean => {
  const hole = a.holes.get(n);
  return hole !== undefined && hole.kind === 1 && hole.sole !== null;
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
  return d !== null && (hole.kind ? R_OPEN : B_OPEN).test(d);
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
  const rec = recs.get(id);
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
function alignUnit(a: UnitAlign, fl: Node[], ll: Node[], at: Node, ref: Node | null): void {
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
    if (only !== undefined && only.kind === 1 && fk[1] === only.nodes[1]) {
      // The list is the element's only content: its rows stay unscanned until needed (`rowsOf`), the slot holds the
      // element's children through a lazy view (O(1) adopt for a page's long list).
      only.sole = l;
      a.span.set(only.nodes[0]!, lazyKids(l));
      a.span.set(only.nodes[1]!, []);
    } else alignUnit(a, fk, kids(l), l, null);
    if (a.fail) return;
    i++;
    j++;
  }
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
  // 1. Probe (create mode, detached; holes for child boundaries and lists). A child boundary whose output the run
  // discarded (its hole reached no node of the probe: a build pass that renders for side effects) runs inline instead,
  // probed again.
  let pu: Unit,
    probe: Probe,
    inline: Set<number> | null = null;
  for (;;) {
    pu = unit(PROBE, rec, self);
    pu.inline = inline;
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
  const fresh = kids(probe.frag);
  fresh.pop(); // the anchor
  // 2. Align.
  const a: UnitAlign = { map: new Map(), first: null, copied: false, verify, holes: new Map(), span: new Map(), fail: false };
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
  for (const lazy of au.fors) sample(lazy);
  shape = own;
  return owner;
}

// Render the unit in the browser in place of its server nodes (mismatch, a value that did not ship). Its own keyed
// state keeps the record's values; child boundaries render as plain client components.
function client(parent: Owner | null, run: () => unknown, start: Node, end: Node, rec: Rec | null, self: boolean): Owner | null {
  for (const n of between(start, end)) {
    dead(n);
    n.parentNode!.removeChild(n);
  }
  const previous = cur,
    holder = { owner: null as Owner | null };
  cur = unit(CLIENT, rec, self);
  try {
    untrack(() => _rootIn(parent, () => _insert(null, run(), end), holder));
  } finally {
    cur = previous;
  }
  return holder.owner;
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
  if (!(r.flags & INDEPENDENT)) return void runHole(r);
  trigger(r);
}
function runHole(r: Rec): void {
  const hole = r.hole!;
  r.done = true;
  if (hole.start) r.owner = adoptUnit(hole.owner, hole.body!, hole.start, hole.end!, r, false, r.name);
}

/** One detached sample run of a row: the keyed signals it read outside / inside `_fx1` bindings and those bindings. */
interface Sampled {
  frag: DocumentFragment;
  item: () => unknown;
  index: () => number;
  outside: Set<Keyed>;
  fxs: [fn: Writer["fn"], args: unknown[], reads: Set<Keyed>][];
}
function sampleRow(lazy: Lazy, k: number): Sampled | null {
  const value = lazy.items[k],
    frag = document.createDocumentFragment(),
    anchor = document.createTextNode(""),
    out: Sampled = { frag, item: () => value, index: () => k, outside: new Set(), fxs: [] },
    previous = cur,
    outer = collector,
    hook = _adoption.fx,
    holder = { owner: null as Owner | null };
  frag.append(anchor);
  cur = unit(PROBE, lazy.rec, false);
  collector = out.outside;
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
    out.fxs.push([fn, [a, b, c], reads]);
  };
  try {
    untrack(() => _rootIn(lazy.owner, () => _insert(null, lazy.children!(out.item, out.index), anchor), holder));
    return out;
  } catch {
    // A sample that throws reads nothing we can know: the list wakes on reconcile / events only.
    return null;
  } finally {
    cur = previous;
    collector = outer;
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
      if (n.parentNode === run.frag) return [1, path, a.localName];
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
  const writers: (Writer | null)[] = [];
  const same = first.fxs.length === last.fxs.length;
  for (let i = 0; i < first.fxs.length; i++) {
    const [fn, args, r] = first.fxs[i]!;
    for (const e of r) reads.add(e);
    const other = same ? last.fxs[i]! : null;
    if (other) for (const e of other[2]) reads.add(e);
    let w: Writer | null = other && other[0] === fn ? { fn, args: [], slot: -1 } : null;
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
// A write to a keyed signal with row writers: rerun them over every lazy row still on the page (materialised rows have
// their own bindings). A row whose element capture does not resolve to the sampled element materialises instead.
function rewrite(e: Keyed): void {
  for (const [lazy, writers] of e.rows!)
    rows: for (const row of rowsOf(lazy)) {
      if (row.done || !row.start!.isConnected) continue;
      for (const w of writers) {
        let a: unknown, b: unknown, c: unknown;
        for (let j = 0; j < 3; j++) {
          const arg = w.args[j]!;
          let v: unknown;
          if (arg[0] === 0) v = arg[1];
          else if (arg[0] === 2) v = row.get ??= lazy.read ? lazy.read.bind(row) : () => row.value;
          else if (arg[0] === 3) v = row.index ?? null;
          else v = element(row, w.slot, arg[1], arg[2]);
          if (v === null) {
            materialiseRow(row);
            continue rows;
          }
          j === 0 ? (a = v) : j === 1 ? (b = v) : (c = v);
        }
        try {
          untrack(() => w.fn(a, b, c));
        } catch (error) {
          report(error);
        }
      }
    }
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
    const p = hook ? hook(r.props ?? {}) : undefined;
    r.ready = p && typeof (p as Promise<unknown>).then === "function" ? Promise.resolve(p).then(() => void (r.ready = true)) : true;
  }
  return r.ready;
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
  r.owner = adoptUnit(null, () => fn(r.props ?? {}), range[0]!, range[range.length - 1]!, r, true, r.name);
}
const load = (name: string): Promise<void> => {
  let p = loads.get(name);
  if (!p) {
    const url = tail?.m?.[name];
    p = url ? api!.m(url).then((module) => void modules.set(name, module)) : Promise.reject(Error("Rivet resume: no chunk for boundary " + name));
    loads.set(name, p);
  }
  return p;
};
/** Materialise `r` and what it needs first: true when done now, a promise while a chunk loads. */
function need(r: Rec): true | Promise<void> {
  if (r.done) return true;
  if (r.hole) return (runHole(r), true);
  for (const s of r.sources ?? [])
    if (!s.done) {
      const p = need(s);
      if (p !== true) return p.then(() => void need(r));
      if (r.done || r.hole) return need(r);
    }
  if (r.parent && !(r.flags & INDEPENDENT)) {
    const p = need(r.parent);
    if (p !== true) return p.then(() => void need(r));
    // Claimed by the parent's run (dependent: adopted with it); else inside a lazy row (the event path's next unit).
    return r.hole && !r.done ? need(r) : true;
  }
  const module = modules.get(r.name);
  if (!module) return (r.loading ??= load(r.name).then(() => void need(r)));
  const ready = prepare(r, module);
  if (ready !== true) return ready.then(() => void need(r));
  standalone(r, module);
  return true;
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
// openers (`<!--rN[-->`: lazy rows; Show branches are no units and are skipped by the caller).
function enclosing(node: Node | null): [kind: number, id: number, at: Node][] {
  const out: [number, number, Node][] = [];
  for (let n = node; n !== null && n.nodeType !== 9; n = n.parentNode ?? (n as unknown as ShadowRoot).host ?? null) {
    if (n.nodeType === 1 && (n as Element).hasAttribute("data-b")) out.push([0, +(n as Element).getAttribute("data-b")!, n]);
    let b = 0,
      r = 0;
    for (let s = n.previousSibling; s !== null; s = s.previousSibling) {
      const d = data(s);
      if (d === null) continue;
      if (d === "/b") b++;
      else if (d === "]") r++;
      else if (B_OPEN.test(d)) b ? b-- : out.push([0, +d.slice(1), s]);
      else if (R_OPEN.test(d)) r ? r-- : out.push([1, 0, s]);
    }
  }
  return out.reverse();
}
// Materialise every unit around `target`, outermost first: true when done now, a promise while a chunk loads.
function around(target: EventTarget | null): true | Promise<void> {
  for (let guard = 0; guard < 256; guard++) {
    let step: true | Promise<void> | null = null;
    for (const [kind, id, at] of enclosing(target as Node | null)) {
      if (kind) {
        const row = rowsByStart.get(at) ?? listAt(at);
        if (row && !row.done) {
          materialiseRow(row);
          step = true;
          break;
        }
      } else {
        const r = recs.get(id);
        if (r && !r.done) {
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

// Document click listeners (tail `g`, server `_rListen`: the router's link clicks): materialise the boundaries listening
// for a click wherever its target is, before the units around the target. True when done now, a promise while a chunk loads.
function listeners(event: Event): true | Promise<void> {
  const target = event.target as Element | null;
  if (event.type !== "click") return true;
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
  back: [Element | null] | undefined;
const captures = (o: unknown): boolean => !!(typeof o == "object" ? (o as AddEventListenerOptions | null)?.capture : o);
const sameAdded = (r: Added, t: EventTarget, type: string, fn: unknown, o: unknown) => r[0] === t && r[1] === type && r[2] === fn && r[3] === captures(o);
function addRecorded(this: EventTarget, type: string, fn: EventListenerOrEventListenerObject | null, o?: boolean | AddEventListenerOptions): void {
  nativeAdd.call(this, type, fn, o);
  if (replayed !== undefined && fn && !added.some((r) => sameAdded(r, this, type, fn, o)))
    added.push([this, type, fn, captures(o), performance.now(), replayed, o]);
}
function removeRecorded(this: EventTarget, type: string, fn: EventListenerOrEventListenerObject | null, o?: boolean | EventListenerOptions): void {
  nativeRemove.call(this, type, fn, o);
  added = added.filter((r) => !sameAdded(r, this, type, fn, o));
}
const record = (on: unknown): void => {
  if (on) ((proto.addEventListener = addRecorded), (proto.removeEventListener = removeRecorded));
  else if (proto.addEventListener === addRecorded) ((proto.addEventListener = nativeAdd), (proto.removeEventListener = nativeRemove), (added = []));
};
function late(event: Event, path: EventTarget[]): void {
  const list = added.filter((r) => r[1] === event.type && r[5] !== event && event.timeStamp < r[4]),
    stopped = event.cancelBubble;
  if (!list.length) return;
  const order: [EventTarget, boolean][] = [...path].reverse().map((t) => [t, true]);
  for (const t of path.slice(0, event.bubbles ? path.length : 1)) order.push([t, false]);
  for (const [t, capture] of order) {
    if (event.cancelBubble && (!stopped || !capture || ((t as Node).nodeType > 0 && (t as Node).nodeType != 9))) break;
    for (const r of list)
      if (r[0] === t && r[3] === capture && added.includes(r)) {
        const o = r[6] as AddEventListenerOptions | undefined,
          aborted = typeof o == "object" && o?.signal?.aborted;
        if (aborted || (typeof o == "object" && o?.once)) t.removeEventListener(r[1], r[2], capture);
        if (!aborted) {
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
}
const linked = new WeakSet<Event>(),
  // Cold focus / blur events of a cold press's native mouse focus: the replay re-creates that move, they never replay.
  moved = new WeakSet<Event>(),
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
// A cold event as it is queued (dom-resume `cold`'s synchronous part): link a press's pointerdown + mousedown, mark the
// focus events of a pre-boot press's native move, hide the move of a press queued while it dispatches.
function queued([event, , , state]: HeldEvent): void {
  if (event.type === "pointerdown") down = (event as PointerEvent).pointerType !== "touch" ? event : undefined;
  else if (event.type === "mousedown" && down?.target === event.target) (linked.add(down).add(event), (down = undefined));
  const dispatching = event.eventPhase !== 0;
  if (/^(focus|blur)/.test(event.type)) pressed && !dispatching && (/^(blur|focusout)$/.test(event.type) || pressed[0] === event.target) && moved.add(event);
  else if ((pressed = isPress(event)) && dispatching) (hide(1), (back = [state[2]]), setTimeout(hide));
}

// Run a held event's delegated handlers over its path (then the listeners replays attached since its dispatch), with the
// form state its target had at dispatch; a cold press puts focus back first and focuses as its default afterwards; the
// event's default replays unless a handler canceled it. Resolves once the press's default focus ran (a microtask).
function replay([event, path, again, state]: HeldEvent): Promise<void> | void {
  let canceled = false;
  const target = event.target as HTMLInputElement;
  // Its boundary rendered in the browser instead of adopting (mismatch): the target left the page, the event is dropped.
  if (target && !target.isConnected) return;
  hide();
  const type = event.type,
    press = isPress(event),
    pair = linked.has(event);
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
  const control = target && "value" in target && target.localName !== "button",
    now = control ? [target.value, target.checked] : null;
  Object.defineProperty(event, "composedPath", { configurable: true, value: () => path });
  Object.defineProperty(event, "defaultPrevented", { configurable: true, get: () => canceled });
  Object.defineProperty(event, "preventDefault", { configurable: true, value: () => void (canceled = true) });
  if (now && (now[0] !== state[0] || now[1] !== state[1])) ((target.value = state[0] as string), (target.checked = state[1] as boolean));
  replaying = true;
  replayed = event;
  try {
    if (!moved.has(event)) (_delegateBelow(event, doc!), late(event, path));
  } finally {
    replaying = false;
    delete (event as { composedPath?: unknown }).composedPath;
    delete (event as { defaultPrevented?: unknown }).defaultPrevented;
    delete (event as { preventDefault?: unknown }).preventDefault;
    to && delete (event as { target?: unknown }).target;
    if (now && (target.value !== now[0] || target.checked !== now[1])) ((target.value = now[0] as string), (target.checked = now[1] as boolean));
  }
  const kept = canceled;
  return Promise.resolve().then(() => {
    replayed = undefined;
    // The press's default focus (an unpaired pointerdown focuses even when canceled; a canceled mousedown keeps focus).
    replaying = true;
    try {
      if (press && !(pair && type === "pointerdown"))
        if (!kept || type === "pointerdown")
          press[0] ? press[0].focus({ preventScroll: true, focusVisible: false } as FocusOptions) : (doc!.activeElement as HTMLElement | null)?.blur?.();
        else if (press[0]) {
          const list = undone.get(press[0]) ?? [];
          (undone.set(press[0], list), list.push([state[2], performance.now(), event.timeStamp]));
        }
      kept || again?.();
    } finally {
      replaying = false;
    }
  });
}
// Cold hover (DERIVED-C): the pointer entered the units an event just adopted before their hover listeners existed (RA
// useHover's `pointerenter`: direct, non-bubbling listeners): a mouse / pen event that adopted something gives the
// elements on its path the enter events a loaded page had seen (outermost first, once per element): the first mouse /
// pen event after an adopt run (`adopted`; a focus or key event may have adopted them).
const entered = new WeakSet<EventTarget>();
let adopted = false;
function enter(event: Event, path: EventTarget[]): void {
  const type = (event as PointerEvent).pointerType;
  if (!adopted || !/^(pointer|mouse)(down|over|move|up)$|^click$/.test(event.type) || type === "touch") return;
  adopted = false;
  const { clientX, clientY } = event as MouseEvent,
    init = { clientX, clientY, pointerType: type || "mouse", pointerId: (event as PointerEvent).pointerId || 1, isPrimary: true };
  for (let i = path.length; i--;) {
    const el = path[i] as Element;
    if (el.nodeType !== 1 || entered.has(el)) continue;
    entered.add(el);
    el.dispatchEvent(new PointerEvent("pointerenter", init));
    el.dispatchEvent(new MouseEvent("mouseenter", init));
  }
}
async function drain(): Promise<void> {
  while (pending.length) {
    const item = pending[0]!;
    try {
      for (let step = listeners(item[0]); step !== true; step = listeners(item[0])) await step;
      for (let step = around(item[0].target); step !== true; step = around(item[0].target)) await step;
      enter(item[0], item[1]);
      await replay(item);
    } catch (error) {
      report(error);
    }
    pending.shift();
  }
  record(0);
}

const runtime: DerivedRuntime = {
  start(t, d, loader) {
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
    for (const [id, parent, flags, name, signals, props] of t.b) {
      const values = new Map<string, unknown>();
      for (let i = 0; i < signals.length; i += 2) values.set(signals[i] as string, signals[i + 1]);
      recs.set(id, {
        id,
        parent: recs.get(parent) ?? null,
        flags,
        name,
        values,
        props: props ?? null,
        done: false,
        owner: null,
        hole: null,
        loading: null,
        ready: null,
        sources: null,
      });
    }
    for (const key in t.w ?? {}) {
      const source = recs.get(+key.slice(0, key.indexOf(".")));
      if (source) for (const id of t.w![key]!) recs.get(id) && (recs.get(id)!.sources ??= []).push(source);
    }
    for (const r of recs.values()) if (r.flags & (LOAD | IDLE | VISIBLE) && !r.hole) trigger(r);
    for (const item of loader.q.splice(0)) runtime.cold(item);
  },
  on(event) {
    if (pending.length && !replaying) return false;
    const listening = listeners(event);
    if (listening !== true) return (listening.catch(() => {}), false);
    const step = around(event.target);
    if (step === true) return (enter(event, event.composedPath()), true);
    step.catch(() => {});
    return false;
  },
  cold(item) {
    queued(item);
    record(1);
    if (pending.push(item) === 1) void drain();
  },
  w(target) {
    for (const [kind, id] of enclosing(target as Node | null)) {
      if (kind) continue;
      let r = recs.get(id);
      while (r && !r.done && !r.hole && r.parent && !(r.flags & INDEPENDENT) && !r.parent.done) r = r.parent;
      // Intent: the chunk, then what its component needs before adopting (`ready`), nothing runs.
      if (r && !r.done && !r.hole) load(r.name).then(() => void prepare(r!, modules.get(r!.name)!), report);
      return;
    }
  },
  m(id) {
    const r = recs.get(id);
    const p = r ? need(r) : true;
    return p === true ? Promise.resolve() : p;
  },
};
export default runtime;
