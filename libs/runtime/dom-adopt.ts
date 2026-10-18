// Resume adoption on DOM v2 (resume runtime only: `dom-resume.ts` imports it; `dom.ts` `_serverBranch` reads it
// through the `_adoption.key` hook, so no component chunk imports this module). A resumed region re-created on its first signal
// change becomes an `_insert` slot seeded with the server nodes between its markers: the first write reconciles
// them, so server rows / a server branch the new content adopts stay in place (focus, selection, media state
// survive) and everything else is removed. During the region read's first run, the first `_for` it creates
// directly (no nested binding in between) takes the server rows, the i-th `_show` / `_switch` it creates directly
// takes the server branch of slot i (the server records every direct Show/Switch of the region in creation order),
// and its direct `_regionState` calls get the values the server render created.
import { _rootIn, _setRegionStateHook, getOwner, onCleanup, signal } from "@rivetjs/reactivity";
import type { Owner } from "@rivetjs/reactivity";
import { _adoption, _insert } from "./dom-v2.ts";
import type { AdoptedList, ForRow } from "./dom-v2.ts";

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
}
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
    items.push(r.item);
    list.push(row);
    let at = r.flags & 1 ? r.index : -1;
    // Its own render read signals: re-created (-2), or kept while they hold their server values (-3, `AdoptedList.changed`;
    // a row that also read its index is re-created).
    if (r.flags & 2) at = p.changed !== null && !(r.flags & 1) ? ((watch = true), -3) : -2;
    adopted.set(row, at);
  }
  return { items, rows: list, adopted, changed: watch ? p.changed : null };
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

/**
 * Re-create a resumed region between its server markers (`start` … `end`, exclusive) from `read`. On the read's
 * first run the first `_for` it creates directly adopts `rows`, the i-th `_show` / `_switch` `branches[i]`, and
 * its direct `_regionState` calls get `state`'s values in order; `changed` (RESUME-KEEP-ROWS): whether a signal the
 * rows' own renders read changed since the server render — false keeps those rows too, until it turns true. Returns
 * whether a list took the rows (otherwise the caller disposes them).
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
