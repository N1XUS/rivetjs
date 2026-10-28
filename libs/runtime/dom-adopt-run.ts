import { _dispose, _rootIn, _settle, getOwner, onCleanup, signal, untrack } from "@rivetjs/reactivity";
import type { Owner } from "@rivetjs/reactivity";
import { _adoption, _insert } from "./dom-v2.ts";
import { LAZY_ROWS } from "./lazy-rows.ts";
import { DEV } from "#dev";
import type { AdoptedList, ForRow, InsertSlot } from "./dom-v2.ts";
import { same } from "./dom-adopt.ts";

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
export interface Probe {
  /** Per kind (`_adoption.node`), creation order. */
  made: [Node[], Node[], Node[]];
  /** Template clones (kind 0): their shapes and (dev) pristine attributes, same order. */
  shapes: Node[][];
  attrs: [Element, string, string][][] | null;
  slots: InsertSlot[];
  /** First class binding values: fallback for standalone rows without a server snapshot. */
  classes: Map<Element, string | null>;
  /** Pristine template classes, for spreads whose absent first value skips the class writer. */
  staticClasses: Map<Element, string>;
  /** The detached probe run (its markup, before an anchor) and its root (`_rootIn` holder). */
  frag: DocumentFragment;
  owner: Owner | null;
}
export type Hooks = [node: typeof _adoption.node, slot: typeof _adoption.slot, live: boolean | undefined, classValue: typeof _adoption.classValue];
// Entering an adoption (a unit's probe / adopt runs, a lazy row): first run a deferred first-click flush still pending
// (reactivity `_settle`). Any `batched` call inside the runs would otherwise run it there, with the unit current and the
// probe's creation hooks installed: another unit's update then renders its `_b` children as this unit's holes (COLD-FIX-A,
// WebKit: a tap's click is held, the next event's adoption probes before the held task: "an adopt run diverged from its
// probe", the popup never adopted).
export const save = (): Hooks => (_settle(), [_adoption.node, _adoption.slot, _adoption.live, _adoption.classValue]);
/** The owner an adoption runs under was disposed (by the flush `save` ran, e.g. a view switch replaced the subtree). */
export const gone = (parent: Owner | null): boolean => !!(parent as { disposed?: boolean } | null)?.disposed;
const restore = (h: Hooks): void => void ((_adoption.node = h[0]), (_adoption.slot = h[1]), (_adoption.live = h[2]), (_adoption.classValue = h[3]));
export const between = (start: Node, end: Node): Node[] => {
  const out: Node[] = [];
  for (let n = start.nextSibling; n !== null && n !== end; n = n.nextSibling) out.push(n);
  return out;
};
export const kids = (node: Node): Node[] => {
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
export const describe = (node: Node | null | undefined): string =>
  node == null
    ? "nothing"
    : node.nodeType === 1
      ? "<" + (node as Element).localName + ">"
      : node.nodeType === 3
        ? "text " + JSON.stringify((node as Text).data)
        : "#" + node.nodeName;
// Form controls the user changed (value / checked / selection differ from the markup's defaults): restored after the adopt
// run when one of its bindings wrote the server value back (a live page never had that write: the user's state wins).
export type Dirty = [
  el: HTMLInputElement & HTMLSelectElement & HTMLTextAreaElement,
  value: string,
  checked: boolean,
  /** -2 preserves only a pristine focused text selection; its model may initialize its value. */
  index: number,
  selection?: [start: number, end: number, direction: "forward" | "backward" | "none"],
];

/**
 * A row plan (LAZY-T6): the probe's answers of one row, as pre-order indexes into the row's server nodes (`flatRow`), reused
 * for the For's later rows whose server markup has the same structure (`sig`: element names, text / comment positions;
 * data and attributes left out) — they skip the probe and the alignment (cost ≈ 1 row creation + one walk). Built from a
 * row whose alignment paired every node (no copies). Same creations in the same order is what the structure match stands
 * for: a creation whose node name differs from the plan's (or a count that differs) is a miss — the row is disposed and
 * adopted again with the probe, and the For stops using plans.
 */
export interface RowPlan {
  sig: string;
  /** Per kind, creation order: index of the live node (-1: none, the created node itself) and the expected node name. */
  made: [number[], number[], number[]];
  names: [string[], string[], string[]];
  /** Per template clone (kind 0): its shape as indexes ([at, firstChild, nextSibling]…; -1 unknown, -2 null). */
  shapes: number[][];
  /** Per slot: what its probe held (-2 nothing, an index, or a list). */
  slots: (number | number[])[];
  /** `_t` / `_tx` state: [index, 0 `$$t` text | 1 `$$t` slot | 2 `$$s` slot, current (slots)]. */
  exp: [number, number, number | number[]][];
}
/** Per For (`dom-resume-lazy.ts`): its plan once built; false after a miss or when no row aligned exactly within 3 tries. */
export interface RowPlanCache {
  p?: RowPlan | false;
  tries?: number;
}
export type Current = InsertSlot["current"];
// The row's server nodes in pre-order (top-level nodes between the markers, each with its descendants), their structure
// signature and the form controls among them (dirty ones restored after the adopt run).
export function flatRow(start: Node, end: Node): { list: Node[]; sig: string; controls: Element[] } {
  const list: Node[] = [],
    controls: Element[] = [];
  let sig = "";
  const walk = (n: Node): void => {
    list.push(n);
    if (n.nodeType === 1) {
      const name = (n as Element).localName;
      sig += "<" + name;
      if (name === "input" || name === "textarea" || name === "select") controls.push(n as Element);
      for (let c = n.firstChild; c !== null; c = c.nextSibling) walk(c);
      sig += ">";
    } else sig += n.nodeType === 3 ? "t" : "c";
  };
  for (let n = start.nextSibling; n !== null && n !== end; n = n.nextSibling) walk(n);
  return { list, sig, controls };
}
// The dirty ones among a row's form controls.
export function dirtyOf(controls: readonly Element[]): Dirty[] {
  const out: Dirty[] = [];
  for (const node of controls) {
    const el = node as Dirty[0],
      tag = el.localName;
    const dirty =
      tag === "input"
        ? // A checkbox / radio without a `value` attribute reads `value` "on" against `defaultValue` "": only `checked`
          // tells (REDS-CDK 2026-10-28: every such control counted as changed, so an adopt run after a write put the
          // pre-adopt `checked` back over the binding's current one — a live `isSelected` checkbox stayed unchecked).
          ((el as HTMLInputElement).type === "checkbox" || (el as HTMLInputElement).type === "radio" ? false : el.value !== el.defaultValue) ||
          el.checked !== el.defaultChecked
        : tag === "textarea"
          ? el.value !== el.defaultValue
          : Array.from(el.options).some((o) => o.selected !== o.hasAttribute("selected"));
    const selected = tag !== "select" && el.selectionStart !== null && (dirty || el.ownerDocument.activeElement === el);
    if (dirty || selected)
      out.push([
        el,
        el.value,
        el.checked,
        dirty ? (tag === "select" ? el.selectedIndex : -1) : -2,
        selected ? [el.selectionStart!, el.selectionEnd!, el.selectionDirection!] : undefined,
      ]);
  }
  return out;
}
/** The adopt run's answers: per kind and creation, the live node (undefined: the created node) and the expected name. */
export interface Answers {
  made: [(Node | undefined)[], (Node | undefined)[], (Node | undefined)[]];
  names: [string[], string[], string[]];
  shapes: (Node | null | undefined)[][];
  slots: Current[];
  classes?: [Element, string | null][];
}

// Step 1 of `_adoptRow`: run the row in create mode, detached (under `frag`), recording what it creates (`_adoption`
// hooks); `attrs` (dev verifier) also records each template clone's pristine attributes.
export function probeRow(parent: Owner | null, enter: <T>(fn: () => T) => T, rowFn: () => unknown, doc: Document, attrs: boolean, outer: Hooks): Probe {
  const probe: Probe = {
      made: [[], [], []],
      shapes: [],
      attrs: attrs ? [] : null,
      slots: [],
      classes: new Map(),
      staticClasses: new Map(),
      frag: doc.createDocumentFragment(),
      owner: null,
    },
    anchor = doc.createTextNode("");
  probe.frag.append(anchor);
  _adoption.node = <N extends Node>(node: N, kind: number): N => {
    probe.made[kind as 0 | 1 | 2].push(node);
    if (kind === 0) {
      const shape = shapeOf(node);
      probe.shapes.push(shape);
      probe.attrs?.push(attrsOf(node));
      for (let i = 0; i < shape.length; i += 3) {
        const el = shape[i]!;
        if (el.nodeType !== 1) continue;
        const value = (el as Element).getAttribute("class");
        if (value !== null) probe.staticClasses.set(el as Element, value);
      }
    }
    return node;
  };
  _adoption.slot = (slot) => void probe.slots.push(slot);
  _adoption.live = false;
  _adoption.classValue = (el, value) => {
    if (!probe.classes.has(el) && primitiveClass(value)) probe.classes.set(el, value == null ? null : String(value));
    return value;
  };
  try {
    untrack(() => _rootIn(parent, () => enter(() => _insert(null, rowFn(), anchor)), probe));
  } finally {
    restore(outer);
  }
  return probe;
}
/** Step 2 of `_adoptRow`: probe node → server twin, the first difference (dev verifier), whether probe nodes were copied in. */
export interface Align {
  map: Map<Node, Node>;
  first: string | null;
  copied: boolean;
  /** Dev: name the first difference (`first`). */
  verify: boolean;
}
/** The text of a run of text / comment nodes (comments count as ""). */
export const textOf = (run: readonly Node[]): string => run.map((n) => (n.nodeType === 3 ? (n as Text).data : "")).join("");
// A copy of a probe node put into the server markup (a run / level that differs): mapped node for node.
export function copyIn(a: Align, node: Node): Node {
  a.copied = true;
  const twin = node.cloneNode(true);
  const pair = (x: Node, y: Node): void => {
    a.map.set(x, y);
    for (let c = x.firstChild, d = y.firstChild; c !== null && d !== null; c = c.nextSibling, d = d.nextSibling) pair(c, d);
  };
  pair(node, twin);
  return twin;
}
// Align the probe's children `fl` with the server's `ll` (children of `at`, before `ref`): same elements pair up level by
// level; a level whose elements differ, or a text run between elements that differs, is replaced by copies of the probe's.
function align(a: Align, fl: Node[], ll: Node[], at: Node, ref: Node | null): void {
  const fe = fl.filter((n) => n.nodeType === 1),
    le = ll.filter((n) => n.nodeType === 1);
  let same = fe.length === le.length;
  for (let i = 0; same && i < fe.length; i++)
    same = (fe[i] as Element).localName === (le[i] as Element).localName && (fe[i] as Element).namespaceURI === (le[i] as Element).namespaceURI;
  if (!same) {
    if (DEV && a.verify)
      a.first ??=
        "<" +
        (at.nodeType === 1 ? (at as Element).localName : "row") +
        "> children: " +
        describe(le.find((n, i) => describe(n) !== describe(fe[i]))) +
        " where the browser renders " +
        describe(fe.find((n, i) => describe(n) !== describe(le[i])));
    for (const n of ll) at.removeChild(n);
    for (const n of fl) at.insertBefore(copyIn(a, n), ref);
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
    for (let i = 0; equal && i < fr.length; i++) equal = fr[i]!.nodeType === lr[i]!.nodeType && (fr[i] as CharacterData).data === (lr[i] as CharacterData).data;
    if (equal) for (let i = 0; i < fr.length; i++) a.map.set(fr[i]!, lr[i]!);
    else {
      if (DEV && a.verify && textOf(fr) !== textOf(lr))
        a.first ??= "text " + JSON.stringify(lr.map((n) => (n as CharacterData).data).join("")) + " where the browser renders " + JSON.stringify(textOf(fr));
      const before = e < fe.length ? le[e]! : ref;
      for (const n of lr) at.removeChild(n);
      for (const n of fr) at.insertBefore(copyIn(a, n), before);
    }
    if (e < fe.length) {
      const f = fl[fi++]!,
        l = ll[li++]!;
      a.map.set(f, l);
      align(a, kids(f), kids(l), l, null);
    }
  }
}

/**
 * Materialise one lazy row (LAZY-ROWS T5): run `rowFn` over the server nodes strictly between `start` and `end` (its
 * markers) in adopt mode, under a new root of `parent`; `enter` wraps each run (probe and adopt) in the row's
 * providers, id scope and `_regionState` values (a fresh scope / counter per call). `verify` (dev, not a wake): warn with
 * the first differing node and swap the probe in for the row. `cache` (LAZY-T6, one per For): a row whose structure matches
 * the For's plan skips the probe (`RowPlan`); dev runs the probe anyway and warns when the plan disagrees with it. Returns
 * the row root (dispose it with the row).
 */
export function _adoptRow(
  parent: Owner | null,
  enter: <T>(fn: () => T) => T,
  rowFn: () => unknown,
  start: Node,
  end: Node,
  verify: ((first: string) => void) | null = null,
  cache: RowPlanCache | null = null,
): Owner | null {
  const outer = save();
  if (gone(parent)) return null;
  const row = flatRow(start, end),
    plan = cache?.p;
  if (plan && plan.sig === row.sig && !DEV) {
    const owner = adopt(parent, enter, rowFn, end, fromPlan(plan, row.list), row.controls, outer, true);
    if (owner !== MISS) return owner;
    // A creation the plan did not foresee: this For adopts with the probe from now on.
    cache!.p = false;
    return _adoptRow(parent, enter, rowFn, start, end, verify, null);
  }
  // 1. Probe (create mode, detached).
  const probe = probeRow(parent, enter, rowFn, start.ownerDocument!, DEV && verify !== null, outer);
  const fresh = kids(probe.frag);
  fresh.pop(); // the anchor
  const server = between(start, end),
    dirty = dirtyOf(row.controls);
  // 2. Align.
  const a: Align = { map: new Map<Node, Node>(), first: null, copied: false, verify: DEV && verify !== null };
  align(a, fresh, server, end.parentNode!, end);
  const map = a.map;
  if (DEV && verify) {
    // Static template attributes the bindings left alone must match the server's.
    if (a.first === null && probe.attrs)
      for (const list of probe.attrs)
        for (const [el, name, value] of list) {
          const live = map.get(el) as Element | undefined;
          if (live && live !== el && el.getAttribute(name) === value && live.getAttribute(name) !== value) {
            a.first = "<" + el.localName + " " + name + "=" + JSON.stringify(live.getAttribute(name)) + "> where the template has " + JSON.stringify(value);
            break;
          }
        }
    if (a.first !== null) {
      // Dev verifier: create + swap this row only.
      verify(a.first);
      for (const n of between(start, end)) n.parentNode!.removeChild(n);
      end.parentNode!.insertBefore(probe.frag, end);
      return probe.owner;
    }
  }
  const mapped = (current: Current): Current =>
    current === null || current === undefined ? null : Array.isArray(current) ? current.map((n) => map.get(n) ?? n) : (map.get(current) ?? null);
  // `_t` / `_tx` state on the probe's nodes → their server twins (a slot: seeded with the twins of its nodes).
  const exp: [Node, number, Current][] = [];
  for (const [f, l] of map) {
    if (f === l) continue;
    const from = f as unknown as { $$t?: string | InsertSlot; $$s?: InsertSlot },
      to = l as unknown as typeof from;
    if (from.$$t !== undefined)
      if (typeof from.$$t === "string") ((to.$$t = from.$$t), exp.push([l, 0, null]));
      else exp.push([l, 1, (to.$$t = { current: mapped(from.$$t.current) }).current]);
    if (from.$$s !== undefined) exp.push([l, 2, (to.$$s = { current: mapped(from.$$s.current) }).current]);
  }
  _dispose(probe.owner);
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
    classes: mappedClasses(probe, map),
  };
  // Class ownership is per row, not per structure: a plan cannot carry another row's first value.
  if (cache && probe.classes.size) cache.p = false;
  else if (cache && !a.copied && (cache.p === undefined || (DEV && cache.p && cache.p.sig === row.sig))) {
    const built = toPlan(answers, exp, row.list, row.sig);
    if (cache.p === undefined) {
      if (built) cache.p = built;
      else if ((cache.tries = (cache.tries ?? 0) + 1) >= 3) cache.p = false;
    } else if (DEV && JSON.stringify(built) !== JSON.stringify(cache.p)) {
      // Dev (which always probes): the plan must answer as the probe of a row with the same structure did.
      console.warn("Rivet resume: " + DEV.hint("a lazy row's plan differs from its probe (same structure): its For adopts with the probe", "lazy"));
      cache.p = false;
    }
  } else if (cache && cache.p === undefined && (cache.tries = (cache.tries ?? 0) + 1) >= 3) cache.p = false;
  return adopt(parent, enter, rowFn, end, answers, null, outer, false, dirty);
}
// The probe's answers as indexes into the row's pre-order node list (null: a live node outside it — no plan).
function toPlan(a: Answers, exp: [Node, number, Current][], list: Node[], sig: string): RowPlan | null {
  const index = new Map<Node, number>();
  list.forEach((n, i) => index.set(n, i));
  let ok = true;
  const at = (n: Node | null | undefined, missing: number): number => {
    if (n === undefined) return missing;
    if (n === null) return -2;
    const i = index.get(n);
    if (i === undefined) ok = false;
    return i ?? -1;
  };
  const cur = (c: Current): number | number[] => (Array.isArray(c) ? c.map((n) => at(n, -1)) : at(c ?? null, -2));
  const plan: RowPlan = {
    sig,
    made: a.made.map((l) => l.map((n) => at(n, -1))) as RowPlan["made"],
    names: a.names,
    shapes: a.shapes.map((shape) => shape.map((n) => at(n, -1))),
    slots: a.slots.map(cur),
    exp: exp.map(([n, kind, c]) => [at(n, -1), kind, kind ? cur(c) : -2]),
  };
  return ok ? plan : null;
}
function fromPlan(plan: RowPlan, list: Node[]): Answers {
  const node = (i: number): Node | null | undefined => (i === -2 ? null : i < 0 ? undefined : list[i]);
  const cur = (c: number | number[]): Current => (Array.isArray(c) ? (c.map(node) as Node[]) : (node(c) ?? null));
  for (const [i, kind, c] of plan.exp) {
    const to = list[i] as unknown as { $$t?: string | InsertSlot; $$s?: InsertSlot };
    // The server's text is what the binding writes for this row (a different value updates it in place).
    if (kind === 0) to.$$t = (to as unknown as Node).textContent!;
    else if (kind === 1) to.$$t = { current: cur(c) };
    else to.$$s = { current: cur(c) };
  }
  return {
    made: plan.made.map((l) => l.map((i) => (i < 0 ? undefined : list[i]))) as Answers["made"],
    names: plan.names,
    shapes: plan.shapes.map((shape) => shape.map(node)),
    slots: plan.slots.map(cur),
  };
}
// Capture before any boundary runs: a parent's refs can decorate a child whose chunk loads later, and its state can
// change before that child's probe. Neither the child's current DOM nor its probe value then represents the server.
// Weak keys do not retain removed server trees. An absent attribute is recorded too, so a later patch cannot capture
// a plugin addition as the baseline. Ordinary DOM builds never import this module.
const serverClasses = new WeakMap<Element, string | null>();
export function captureClasses(root: ParentNode): void {
  for (const el of root.querySelectorAll("*")) if (!serverClasses.has(el)) serverClasses.set(el, el.getAttribute("class"));
}
/** Transfer the captured server classes; standalone row adopters without a snapshot use the probe baseline. */
export function mappedClasses(probe: Probe, map: Map<Node, Node>): [Element, string | null][] {
  const out: [Element, string | null][] = [];
  for (const [node, live] of map) {
    if (node.nodeType !== 1) continue;
    const el = node as Element;
    // Without a server snapshot, an absent spread falls back to the pristine template, before refs/cleanup decorate it.
    out.push([
      live as Element,
      serverClasses.has(live as Element)
        ? serverClasses.get(live as Element)!
        : probe.classes.has(el)
          ? probe.classes.get(el)!
          : (probe.staticClasses.get(el) ?? null),
    ]);
  }
  return out;
}
const primitiveClass = (value: unknown): value is string | number | boolean | bigint | null | undefined =>
  value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean" || typeof value === "bigint";
const classTokens = (value: string | null): string[] => value?.match(/[^\t\n\f\r ]+/g) ?? [];
const MISS = {} as Owner;
// 3. Adopt: the row function again; each creation returns its live node, each new slot starts from what it held.
export function adopt(
  parent: Owner | null,
  enter: <T>(fn: () => T) => T,
  rowFn: () => unknown,
  end: Node,
  a: Answers,
  controls: Element[] | null,
  outer: Hooks,
  planned: boolean,
  dirty: Dirty[] = dirtyOf(controls!),
): Owner | null {
  const overridden: Node[] = [];
  const clear = (): void => {
    for (const n of overridden) (delete (n as { firstChild?: unknown; nextSibling?: unknown }).firstChild, delete (n as { nextSibling?: unknown }).nextSibling);
    overridden.length = 0;
  };
  const made = [0, 0, 0];
  let slots = 0,
    miss = false;
  _adoption.node = <N extends Node>(node: N, kind: number): N => {
    clear();
    const i = made[kind]!++,
      list = a.made[kind as 0 | 1 | 2];
    if (i >= list.length || a.names[kind as 0 | 1 | 2][i] !== node.nodeName) return ((miss = true), node);
    const live = list[i] as N | undefined;
    if (live === undefined) return node;
    const shape = kind === 0 ? a.shapes[i] : null;
    if (shape)
      for (let k = 0; k < shape.length; k += 3) {
        const at = shape[k];
        if (at == null) continue;
        const firstChild = shape[k + 1],
          nextSibling = k ? shape[k + 2] : undefined;
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
    const i = slots++;
    if (i < a.slots.length) slot.current = a.slots[i]!;
    else miss = true;
  };
  _adoption.live = true;
  // Only this synchronous adoption owns these sets. Later values extend ownership, so removing
  // a token still works. A class binding absent from the planned sample needs its own probe.
  const classes = new Map<Element, string | null | Set<string>>(a.classes);
  _adoption.classValue = (el, value) => {
    if (planned && a.shapes.some((shape) => shape.includes(el))) return ((miss = true), el.getAttribute("class"));
    if (!primitiveClass(value)) return value;
    let owned = classes.get(el);
    // A ref can synchronously update an already-live binding outside this unit. It still owns its whole class.
    if (owned === undefined) return value;
    if (owned === null || typeof owned === "string") classes.set(el, (owned = new Set(classTokens(owned))));
    const tokens = classTokens(value == null ? null : String(value));
    for (const token of tokens) owned.add(token);
    const count = tokens.length;
    for (const token of el.classList) if (!owned.has(token)) tokens.push(token);
    return tokens.length === count ? value : tokens.join(" ");
  };
  const row = { owner: null as Owner | null };
  try {
    untrack(() => _rootIn(parent, () => enter(() => _insert(null, rowFn(), end)), row));
  } finally {
    clear();
    restore(outer);
  }
  if (planned && (miss || made[0] !== a.made[0].length || made[1] !== a.made[1].length || made[2] !== a.made[2].length || slots !== a.slots.length)) {
    _dispose(row.owner);
    return MISS;
  }
  for (const [el, value, checked, index, selection] of dirty) {
    if (!el.isConnected) continue;
    if (el.localName === "select") el.selectedIndex !== index && (el.selectedIndex = index);
    else if (index !== -2) {
      if (el.value !== value) el.value = value;
      if (el.checked !== checked) el.checked = checked;
    }
    if (selection && (el.selectionStart !== selection[0] || el.selectionEnd !== selection[1] || el.selectionDirection !== selection[2]))
      el.setSelectionRange(...selection);
  }
  return row.owner;
}
