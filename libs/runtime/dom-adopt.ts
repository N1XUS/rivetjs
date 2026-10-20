// Resume adoption on DOM v2 (resume runtime only: `dom-resume.ts` imports it; `dom.ts` `_serverBranch` reads it
// through the `_adoption.key` hook, so no component chunk imports this module). A resumed region re-created on its first signal
// change becomes an `_insert` slot seeded with the server nodes between its markers: the first write reconciles
// them, so server rows / a server branch the new content adopts stay in place (focus, selection, media state
// survive) and everything else is removed. During the region read's first run, the first `_for` it creates
// directly (no nested binding in between) takes the server rows, the i-th `_show` / `_switch` it creates directly
// takes the server branch of slot i (the server records every direct Show/Switch of the region in creation order),
// and its direct `_regionState` calls get the values the server render created.
import { _dispose, _rootIn, _setRegionStateHook, getOwner, onCleanup, signal, untrack } from "@rivetjs/reactivity";
import type { Owner } from "@rivetjs/reactivity";
import { _adoption, _insert } from "./dom-v2.ts";
import { LAZY_ROWS } from "./lazy-rows.ts";
import type { AdoptedList, ForRow, InsertSlot } from "./dom-v2.ts";

/** A server row of a keyed list: its item, server index (and whether the row read it), markers (inclusive) and disposer. */
export interface AdoptedRow {
  item: unknown;
  index: number;
  /** 1: the server row read its index; 2: its own render read signals (no site binds them: re-created, unless the
   * region's `changed` check says they all still hold their server values). */
  flags: number;
  start: Node;
  end: Node;
  dispose(): void;
  /** A lazy row (LAZY-ROWS T5): told the client For's row that keeps it (its item / index sources, owner). */
  own?(row: ForRow): void;
}
/** A lazy For's rows (LAZY-ROWS T5): told the client For's row function and item reader, to materialise kept rows later. */
export type LazyHost = (children: (item: () => unknown, index: () => number) => unknown, read: (this: ForRow) => unknown) => void;
/** A server branch of a Show/Switch: `key` (match index, -1 fallback; null never adopts), its value when the
 * server branch read it (or the Show is keyed), its markers and disposer. `taken` once a Show/Switch took it. */
export interface AdoptedBranch {
  key: number | null;
  valued: boolean;
  value?: unknown;
  start: Node;
  end: Node;
  dispose(): void;
  taken?: boolean;
}
/** `_regionState` values the server render created in a region read (`_ABSENT_STATE`: created afresh), and how
 * many slots each value's own `create()` recorded (skipped when the value is adopted). */
export interface AdoptedState {
  values: unknown[];
  nested: number[] | undefined;
}
/** `_regionState` slot of a value the server could not serialize: created afresh. */
export const _ABSENT_STATE: unique symbol = Symbol();

interface Pending {
  /** Owner of the region read (the insertion's binding). */
  at: Owner | null;
  rows: readonly AdoptedRow[] | null;
  /** Whether a signal the rows' own renders read changed since the server render (null: unknown, re-create them). */
  changed: (() => boolean) | null;
  /** Lazy rows (LAZY-ROWS T5 builds): the hook the taking For calls with its row function. */
  host?: LazyHost | null;
  /** Server branches by slot (holes: direct Shows/Switches without one) and the next slot. */
  branches: readonly (AdoptedBranch | undefined)[] | null;
  next: number;
  took: boolean;
}
let pending: Pending | null = null;
// Created directly by the region read: only provide / catchError owners (context frames) between the creating
// owner and the read's own. Rows, branch content and nested bindings are
// owners of their own (`_rootIn` roots, effects): what they create belongs to them, as on the server. The dev
// runtime's per-component owners (`_adoption.dev`; production components own nothing) are transparent too.
const direct = (owner: Owner | null, at: Owner | null): boolean => {
  type Frame = { parent: Frame | null; ctx: { owner: Frame } | null };
  const dev = _adoption.dev;
  for (let o = owner as unknown as Frame | null; o !== (at as unknown as Frame); o = o.parent)
    if (o === null || (o.ctx?.owner !== o && (dev === null || !dev.has(o)))) return false;
  return true;
};
const hold = (dispose: () => void) => (_: { owner: Owner | null }) => onCleanup(dispose);
// Markers of adopted rows the list dropped during the region read's first run (RESUME-DROP-MARKERS, 2026-10-18): left in
// place as inert comments — `_region`'s seed skips them, so the first reconcile removes only the rows' content, one
// `removeChild` per element instead of three (resume-bench `filter`: 2,700 → 900 removals per first keystroke, the
// comment removals alone were ~1/3 of the input task at 4× CPU). A kept row keeps its markers as its anchors (they
// move with it, so a later row-template lookup — `dom-resume.ts` `build()`, `end.previousElementSibling` — still
// finds its element); rows dropped later remove theirs with their nodes, as before. Null outside such a first run.
let left: Set<Node> | null = null;
const holdRow = (r: AdoptedRow) => (_: { owner: Owner | null }) =>
  onCleanup(() => {
    if (left !== null) left.add(r.start).add(r.end);
    r.dispose();
  });
const nodes = (start: Node, end: Node): Node[] => {
  const out: Node[] = [];
  for (let n: Node | null = start; n !== null; n = n === end ? null : n.nextSibling) out.push(n);
  return out;
};
function takeRows(owner: Owner | null, by: (item: never, index: number) => unknown, indexed: boolean): AdoptedList | null {
  const p = pending;
  if (p === null || p.rows === null || !direct(owner, p.at)) return null;
  const spec = p.rows,
    items: unknown[] = [],
    list: ForRow[] = [],
    adopted = new Map<ForRow, number>();
  let watch = false;
  p.rows = null;
  p.took = true;
  for (let i = 0; i < spec.length; i++) {
    const r = spec[i]!;
    // The row keeps its server markers as its anchors (no DOM work to adopt it).
    const row: ForRow = {
      value: r.item,
      key: by(r.item as never, r.index),
      sig: null,
      index: indexed ? signal(r.index) : null,
      nodes: null,
      start: r.start,
      end: r.end,
      owner: null,
      pass: 0,
    };
    _rootIn(owner, holdRow(r), row);
    if (LAZY_ROWS) r.own?.(row);
    items.push(r.item);
    list.push(row);
    let at = r.flags & 1 ? r.index : -1;
    // Its own render read signals: re-created (-2), or kept while they hold their server values (-3, `AdoptedList.changed`;
    // a row that also read its index is re-created).
    if (r.flags & 2) at = p.changed !== null && !(r.flags & 1) ? ((watch = true), -3) : -2;
    adopted.set(row, at);
  }
  const out: AdoptedList = { items, rows: list, adopted, changed: watch ? p.changed : null };
  if (LAZY_ROWS) out.host = p.host;
  return out;
}
function takeBranch(owner: Owner | null): ReturnType<NonNullable<typeof _adoption.branch>> {
  const p = pending,
    list = p?.branches;
  // Every direct Show/Switch takes its slot (in creation order), adopting the branch there if any.
  if (!list || p!.next >= list.length || !direct(owner, p!.at)) return null;
  const b = list[p!.next++];
  if (!b || b.key === null) return null;
  b.taken = true;
  const holder = { owner: null as Owner | null };
  _rootIn(owner, hold(b.dispose), holder);
  return { i: b.key, v: b.value, valued: b.valued, owner: holder.owner, value: nodes(b.start, b.end) };
}
/**
 * `_adoption.key` (`dom-v2.ts` `_serverBranch`): while a resumed page re-creates a region (its read re-runs on the first change of a signal the
 * server render read), the server branch key (match index, -1 fallback; null: never adopted) of the next
 * Show/Switch that read creates directly; `undefined` in any other creation (or when that one has no server
 * branch). Lets a stateful component start from the state the server rendered (e.g. a transition that was shown).
 */
function serverBranch(): number | null | undefined {
  const p = pending,
    b = p?.branches && p.next < p.branches.length && direct(getOwner(), p.at) ? p.branches[p.next] : undefined;
  return b ? b.key : undefined;
}

// Data equality of a server row item and a fresh item of the same key (resume-encodable data: primitives, arrays,
// plain objects, Date, URL; anything else compares by identity). A refetched list (live page, revalidation) has new
// objects for unchanged rows: equal ones keep the adopted server row instead of re-creating it.
function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  const proto = Object.getPrototypeOf(a);
  if (proto !== Object.getPrototypeOf(b)) return false;
  if (Array.isArray(a)) {
    const y = b as unknown[];
    if (a.length !== y.length) return false;
    for (let i = 0; i < a.length; i++) if (!same(a[i], y[i])) return false;
    return true;
  }
  if (proto === Date.prototype) return (a as Date).getTime() === (b as Date).getTime();
  if (proto === URL.prototype) return (a as URL).href === (b as URL).href;
  if (proto !== Object.prototype && proto !== null) return false;
  const x = a as Record<string, unknown>,
    y = b as Record<string, unknown>;
  const keys = Object.keys(x);
  // `y`'s key count without a second keys array (plain / null-prototype objects: `for…in` = own enumerable keys).
  let count = 0;
  for (const _ in y) count++;
  if (keys.length !== count) return false;
  for (const key of keys) if (!Object.hasOwn(y, key) || !same(x[key], y[key])) return false;
  return true;
}

// The lazy rows host of the next `_region` call (`_regionHost`, LAZY-ROWS T5 builds).
let nextHost: LazyHost | null = null;
/** @internal Lazy rows (`dom-resume-lazy.ts`): the next `_region` call hands `host` to the For taking its rows. */
export const _regionHost = (host: LazyHost): void => void (nextHost = host);
/**
 * Re-create a resumed region between its server markers (`start` … `end`, exclusive) from `read`. On the read's
 * first run the first `_for` it creates directly adopts `rows`, the i-th `_show` / `_switch` `branches[i]`, and
 * its direct `_regionState` calls get `state`'s values in order; `changed` (RESUME-KEEP-ROWS): whether a signal the
 * rows' own renders read changed since the server render — false keeps those rows too, until it turns true. Lazy rows
 * (LAZY-ROWS T5 builds): the host `_regionHost` set just before is handed to the For that takes the rows
 * (`AdoptedList.host`). Returns whether a list took the rows (otherwise the caller disposes them).
 */
export function _region(
  start: Node,
  end: Node,
  read: () => unknown,
  rows: readonly AdoptedRow[] | null = null,
  branches: readonly (AdoptedBranch | undefined)[] | null = null,
  state: AdoptedState | null = null,
  changed: (() => boolean) | null = null,
): boolean {
  let host: LazyHost | null = null;
  if (LAZY_ROWS) ((host = nextHost), (nextHost = null));
  const seed: Node[] = [];
  // The server nodes between the markers when the first write happens (after the read: content it built may
  // have taken server nodes elsewhere).
  const collect = (): void => {
    seed.length = 0;
    for (let n = start.nextSibling; n !== null && n !== end; n = n.nextSibling) if (left === null || !left.has(n)) seed.push(n);
  };
  let first = true,
    took = false;
  const adopting = rows !== null || branches !== null || state !== null;
  const wrapped = () => {
    if (!first) return read();
    first = false;
    if (!adopting)
      try {
        return read();
      } finally {
        collect();
      }
    const outer = pending,
      outerLeft = left,
      p: Pending = (pending = { at: getOwner(), rows, changed, branches, next: 0, took: false });
    if (LAZY_ROWS) p.host = host;
    left = rows !== null ? new Set() : null;
    // Installed on first use: before it, no region is being re-created (`_serverBranch` → undefined).
    _adoption.rows = takeRows;
    _adoption.branch = takeBranch;
    _adoption.key = serverBranch;
    _adoption.same = same;
    let next = 0;
    type Hook = <T>(create: () => T) => T;
    const previous: Hook | null | undefined =
      state === null
        ? undefined
        : (_setRegionStateHook(<T>(create: () => T): T => {
            if (next < state.values.length && direct(getOwner(), p.at)) {
              const i = next++,
                value = state.values[i];
              // Adopted: the values its `create()` made on the server are not asked for again.
              if (value !== _ABSENT_STATE) return (state.nested && (next += state.nested[i]!), value) as never;
            }
            return previous ? previous(create) : create();
          }) as Hook | null);
    try {
      return read();
    } finally {
      if (state !== null) _setRegionStateHook(previous!);
      took = p.took;
      pending = outer;
      collect();
      left = outerLeft;
    }
  };
  _insert(null, wrapped, end, seed);
  return took;
}

// ---- LAZY-ROWS T5: adopt runs (spec docs/design/specs/2026-10-19-lazy-collection-rows-design.md §3.4) ----
// A lazy `<For>` row is server markup without resume records. Materialising it runs its row function over the server
// nodes ("adopt mode": the same compiled DOM code with the runtime in a mode flag, structural resume §3.5) so handlers,
// bindings, refs, effects, nested For / Show attach to the nodes the user sees: no element is created, replaced or
// moved, focus / selection / input values / media state survive. The server merges adjacent text and writes no
// placeholder comments, so the live markup is not template-shaped; the run has three passes:
// 1. probe: the row function runs in create mode into a detached fragment (same owner chain, id scope and
//    `_regionState` values as the adopt run); every node the runtime creates and every insertion slot is recorded in
//    creation order (`_adoption.node` / `_adoption.slot`), with each template clone's pristine shape;
// 2. align: the probe's nodes are paired with the server nodes, elements by tag (recursively), text / comment runs
//    between elements by type + data; a run that differs (merged server text, a value that changed) is replaced by
//    copies of the probe's nodes — text and comments only. An element level that differs (a branch that flipped since
//    the server render) is replaced by copies of the probe's elements (local swap); the probe is disposed;
// 3. adopt: the row function runs again; each creation returns the server node its probe twin maps to, each new slot
//    starts from the server nodes its probe twin held (the first write reconciles to "no change"), and the compiled
//    `firstChild` / `nextSibling` walk of a template sees the template's shape (own-property overrides on the server
//    nodes that differ, removed at the next creation / insertion and when the run ends).
// Cost ≈ 2 row creations + one alignment walk. Dev (`verify`): a structure / static attribute / text mismatch outside a
// wake names the first differing node and swaps the probe in for that row only (create + swap, the fallback).

/** A probe run's records: created nodes (creation order), their shapes (template clones: [node, firstChild, nextSibling]…), slots. */
interface Probe {
  /** Per kind (`_adoption.node`), creation order. */
  made: [Node[], Node[], Node[]];
  /** Template clones (kind 0): their shapes and (dev) pristine attributes, same order. */
  shapes: Node[][];
  attrs: [Element, string, string][][] | null;
  slots: InsertSlot[];
}
type Hooks = [node: typeof _adoption.node, slot: typeof _adoption.slot, live: boolean | undefined];
const save = (): Hooks => [_adoption.node, _adoption.slot, _adoption.live];
const restore = (h: Hooks): void => void ((_adoption.node = h[0]), (_adoption.slot = h[1]), (_adoption.live = h[2]));
const between = (start: Node, end: Node): Node[] => {
  const out: Node[] = [];
  for (let n = start.nextSibling; n !== null && n !== end; n = n.nextSibling) out.push(n);
  return out;
};
const kids = (node: Node): Node[] => {
  const out: Node[] = [];
  for (let n = node.firstChild; n !== null; n = n.nextSibling) out.push(n);
  return out;
};
// A template clone's pristine shape, depth first: each node, its first child and (not for the root) next sibling.
function shapeOf(root: Node): Node[] {
  const out: Node[] = [];
  const walk = (n: Node): void => {
    out.push(n, n.firstChild!, n === root ? null! : n.nextSibling!);
    for (let c = n.firstChild; c !== null; c = c.nextSibling) walk(c);
  };
  walk(root);
  return out;
}
const attrsOf = (root: Node): [Element, string, string][] => {
  const out: [Element, string, string][] = [];
  const walk = (n: Node): void => {
    if (n.nodeType === 1) for (const a of Array.from((n as Element).attributes)) out.push([n as Element, a.name, a.value]);
    for (let c = n.firstChild; c !== null; c = c.nextSibling) walk(c);
  };
  walk(root);
  return out;
};
const describe = (node: Node | null | undefined): string =>
  node == null
    ? "nothing"
    : node.nodeType === 1
      ? "<" + (node as Element).localName + ">"
      : node.nodeType === 3
        ? "text " + JSON.stringify((node as Text).data)
        : "#" + node.nodeName;
// Form controls the user changed (value / checked / selection differ from the markup's defaults): restored after the adopt
// run when one of its bindings wrote the server value back (a live page never had that write: the user's state wins).
type Dirty = [el: HTMLInputElement & HTMLSelectElement & HTMLTextAreaElement, value: string, checked: boolean, index: number];
function dirtyControls(nodes: readonly Node[]): Dirty[] {
  const out: Dirty[] = [];
  for (const node of nodes) {
    if (node.nodeType !== 1) continue;
    const list = [node as Element, ...Array.from((node as Element).querySelectorAll("input,textarea,select"))];
    for (const el of list as Dirty[0][]) {
      const tag = el.localName;
      if (
        tag === "input"
          ? el.value !== el.defaultValue || el.checked !== el.defaultChecked
          : tag === "textarea"
            ? el.value !== el.defaultValue
            : tag === "select"
              ? Array.from(el.options).some((o) => o.selected !== o.hasAttribute("selected"))
              : false
      )
        out.push([el, el.value, el.checked, tag === "select" ? el.selectedIndex : -1]);
    }
  }
  return out;
}

/**
 * Materialise one lazy row (LAZY-ROWS T5): run `rowFn` over the server nodes strictly between `start` and `end` (its
 * markers) in adopt mode, under a new root of `parent`; `enter` wraps each run (probe and adopt) in the row's
 * providers, id scope and `_regionState` values (a fresh scope / counter per call). `verify` (dev, not a wake): warn with
 * the first differing node and swap the probe in for the row. Returns the row root (dispose it with the row).
 */
export function _adoptRow(
  parent: Owner | null,
  enter: <T>(fn: () => T) => T,
  rowFn: () => unknown,
  start: Node,
  end: Node,
  verify: ((first: string) => void) | null = null,
): Owner | null {
  const doc = start.ownerDocument!,
    outer = save(),
    probe: Probe = { made: [[], [], []], shapes: [], attrs: verify && [], slots: [] },
    frag = doc.createDocumentFragment(),
    anchor = doc.createTextNode(""),
    held = { owner: null as Owner | null };
  frag.append(anchor);
  // 1. Probe (create mode, detached).
  _adoption.node = <N extends Node>(node: N, kind: number): N => {
    probe.made[kind as 0 | 1 | 2].push(node);
    if (kind === 0) (probe.shapes.push(shapeOf(node)), probe.attrs?.push(attrsOf(node)));
    return node;
  };
  _adoption.slot = (slot) => void probe.slots.push(slot);
  _adoption.live = false;
  try {
    untrack(() => _rootIn(parent, () => enter(() => _insert(null, rowFn(), anchor)), held));
  } finally {
    restore(outer);
  }
  const fresh = kids(frag);
  fresh.pop(); // the anchor
  const server = between(start, end),
    dirty = dirtyControls(server);
  // 2. Align.
  const map = new Map<Node, Node>();
  let first: string | null = null;
  // Copies of probe nodes put into the server markup (a run / level that differs): mapped node for node.
  const copy = (node: Node): Node => {
    const twin = node.cloneNode(true);
    const pair = (a: Node, b: Node): void => {
      map.set(a, b);
      for (let x = a.firstChild, y = b.firstChild; x !== null && y !== null; x = x.nextSibling, y = y.nextSibling) pair(x, y);
    };
    pair(node, twin);
    return twin;
  };
  const align = (fl: Node[], ll: Node[], at: Node, ref: Node | null): void => {
    const fe = fl.filter((n) => n.nodeType === 1),
      le = ll.filter((n) => n.nodeType === 1);
    let same = fe.length === le.length;
    for (let i = 0; same && i < fe.length; i++)
      same = (fe[i] as Element).localName === (le[i] as Element).localName && (fe[i] as Element).namespaceURI === (le[i] as Element).namespaceURI;
    if (!same) {
      first ??=
        "<" +
        (at.nodeType === 1 ? (at as Element).localName : "row") +
        "> children: " +
        describe(le.find((n, i) => describe(n) !== describe(fe[i]))) +
        " where the browser renders " +
        describe(fe.find((n, i) => describe(n) !== describe(le[i])));
      for (const n of ll) at.removeChild(n);
      for (const n of fl) at.insertBefore(copy(n), ref);
      return;
    }
    // Runs of text / comments between elements (run i ends before element i; the last run before `ref`).
    let fi = 0,
      li = 0;
    for (let e = 0; e <= fe.length; e++) {
      const fr: Node[] = [],
        lr: Node[] = [];
      while (fi < fl.length && fl[fi]!.nodeType !== 1) fr.push(fl[fi++]!);
      while (li < ll.length && ll[li]!.nodeType !== 1) lr.push(ll[li++]!);
      let equal = fr.length === lr.length;
      for (let i = 0; equal && i < fr.length; i++)
        equal = fr[i]!.nodeType === lr[i]!.nodeType && (fr[i] as CharacterData).data === (lr[i] as CharacterData).data;
      if (equal) for (let i = 0; i < fr.length; i++) map.set(fr[i]!, lr[i]!);
      else {
        if (verify && fr.map((n) => (n.nodeType === 3 ? (n as Text).data : "")).join("") !== lr.map((n) => (n.nodeType === 3 ? (n as Text).data : "")).join(""))
          first ??=
            "text " +
            JSON.stringify(lr.map((n) => (n as CharacterData).data).join("")) +
            " where the browser renders " +
            JSON.stringify(fr.map((n) => (n.nodeType === 3 ? (n as Text).data : "")).join(""));
        const before = e < fe.length ? le[e]! : ref;
        for (const n of lr) at.removeChild(n);
        for (const n of fr) at.insertBefore(copy(n), before);
      }
      if (e < fe.length) {
        const f = fl[fi++]!,
          l = ll[li++]!;
        map.set(f, l);
        align(kids(f), kids(l), l, null);
      }
    }
  };
  align(fresh, server, end.parentNode!, end);
  // Dev: static template attributes the bindings left alone must match the server's.
  if (verify && first === null && probe.attrs)
    for (const list of probe.attrs)
      for (const [el, name, value] of list) {
        const live = map.get(el) as Element | undefined;
        if (live && live !== el && el.getAttribute(name) === value && live.getAttribute(name) !== value) {
          first = "<" + el.localName + " " + name + "=" + JSON.stringify(live.getAttribute(name)) + "> where the template has " + JSON.stringify(value);
          break;
        }
      }
  if (verify && first !== null) {
    // Dev verifier: create + swap this row only.
    verify(first);
    for (const n of between(start, end)) n.parentNode!.removeChild(n);
    end.parentNode!.insertBefore(frag, end);
    return held.owner;
  }
  const mapped = (current: InsertSlot["current"]): InsertSlot["current"] =>
    current === null || current === undefined ? null : Array.isArray(current) ? current.map((n) => map.get(n) ?? n) : (map.get(current) ?? null);
  // `_t` / `_tx` state on the probe's nodes → their server twins (a slot: seeded with the twins of its nodes).
  for (const [f, l] of map) {
    if (f === l) continue;
    const from = f as unknown as { $$t?: string | InsertSlot; $$s?: InsertSlot },
      to = l as unknown as typeof from;
    if (from.$$t !== undefined) to.$$t = typeof from.$$t === "string" ? from.$$t : { current: mapped(from.$$t.current) };
    if (from.$$s !== undefined) to.$$s = { current: mapped(from.$$s.current) };
  }
  _dispose(held.owner);
  // 3. Adopt.
  const overridden: Node[] = [];
  const clear = (): void => {
    for (const n of overridden) (delete (n as { firstChild?: unknown; nextSibling?: unknown }).firstChild, delete (n as { nextSibling?: unknown }).nextSibling);
    overridden.length = 0;
  };
  const made = [0, 0, 0];
  let slots = 0;
  _adoption.node = <N extends Node>(node: N, kind: number): N => {
    clear();
    const i = made[kind]!++,
      twin = probe.made[kind as 0 | 1 | 2][i],
      live = twin && twin.nodeName === node.nodeName ? (map.get(twin) as N | undefined) : undefined;
    if (live === undefined) return node;
    const shape = kind === 0 ? probe.shapes[i] : null;
    if (shape)
      for (let k = 0; k < shape.length; k += 3) {
        const at = map.get(shape[k]!);
        if (at === undefined) continue;
        const firstChild = shape[k + 1] ? map.get(shape[k + 1]!) : null,
          nextSibling = k && shape[k + 2] ? map.get(shape[k + 2]!) : null;
        let own = false;
        if (firstChild !== undefined && at.firstChild !== firstChild)
          (Object.defineProperty(at, "firstChild", { value: firstChild, configurable: true }), (own = true));
        if (k && nextSibling !== undefined && at.nextSibling !== nextSibling)
          (Object.defineProperty(at, "nextSibling", { value: nextSibling, configurable: true }), (own = true));
        if (own) overridden.push(at);
      }
    return live;
  };
  _adoption.slot = (slot) => {
    clear();
    const twin = probe.slots[slots++];
    if (twin !== undefined) slot.current = mapped(twin.current);
  };
  _adoption.live = true;
  const row = { owner: null as Owner | null };
  try {
    untrack(() => _rootIn(parent, () => enter(() => _insert(null, rowFn(), end)), row));
  } finally {
    clear();
    restore(outer);
  }
  for (const [el, value, checked, index] of dirty) {
    if (!el.isConnected) continue;
    if (el.localName === "select") el.selectedIndex !== index && (el.selectedIndex = index);
    else {
      if (el.value !== value) el.value = value;
      if (el.checked !== checked) el.checked = checked;
    }
  }
  return row.owner;
}
