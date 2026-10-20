import { createRoot, getOwner, provide, _dispose } from "@rivetjs/reactivity";
import type { Context, Disposer, Owner } from "@rivetjs/reactivity";
import type { ListPlan, ServerScope, ServerValue } from "./server.ts";
import { attribute, template } from "./template.ts";
import { MEDIA_URLS } from "./url.ts";
import { _style, _styleAttr } from "./style.ts";

/** Row getters of a server For: constant values, resumable as such. */
export const CONSTANT: unique symbol = Symbol.for("rivet.constant");
/** A row getter carrying its constant value for resumable serialization. */
export type ConstantGetter<T> = (() => T) & { [CONSTANT]?: T };
const constant = <T>(value: T): ConstantGetter<T> => {
  const get: ConstantGetter<T> = () => value;
  get[CONSTANT] = value;
  return get;
};

/** Private response-owned region; never treated as trusted HTML. */
export const SCOPED: unique symbol = Symbol.for("rivet.server.scoped");
/** A response-owned region record: its value renders under `owner`, `dispose` ends the region. */
export interface ScopedRecord {
  readonly [SCOPED]: true;
  readonly owner: Owner | null | undefined;
  readonly value: unknown;
  readonly dispose: Disposer;
}

// A class (pinned shape), not a computed-key literal: see template.ts.
let scopedPin: Scoped | null = null;
class Scoped {
  declare [SCOPED]: true;
  declare owner: Owner | null | undefined;
  declare value: unknown;
  declare dispose: Disposer;
  constructor(owner: Owner | null | undefined, value: unknown, dispose: Disposer) {
    this[SCOPED] = true;
    this.owner = owner;
    this.value = value;
    this.dispose = dispose;
  }
}
/** Runtime-private: a response-owned region record. */
export function _scopedRecord(owner: Owner | null | undefined, value: unknown, dispose: Disposer): ScopedRecord & ServerScope {
  scopedPin ??= new Scoped(null, null, Object);
  return new Scoped(owner, value, dispose) as unknown as ScopedRecord & ServerScope;
}

function scoped(setup: (capture: (read: () => unknown) => unknown) => unknown): ScopedRecord {
  let owner: Owner | null | undefined;
  const root = createRoot(() =>
    setup((read) => {
      owner = getOwner();
      return read();
    }),
  );
  return _scopedRecord(owner, root.value, root.dispose);
}

/** Construct children under a synchronous logical provider. Consume once per response. */
export function Provider<T>({ token, value, children }: { token: Context<T>; value: T; children: ServerValue }): ServerScope {
  // The provide owner is the region (no extra root owner: one owner per provider, disposed with its parent).
  let owner: Owner | null = null;
  const content = provide(token, value, () => {
    owner = getOwner();
    return (children as () => unknown)();
  });
  return _scopedRecord(owner, content, () => _dispose(owner));
}

/** Row arrays a server For formed (data elements, never mutated): admitted once with the array, the
 * renderer dispatches their compiled rows without re-admitting them. */
export const ROWS = new WeakSet<readonly unknown[]>();
/** Resume row hook: renders the row through `render(itemGetter, indexGetter)`. */
export type ForRowHook = (
  list: object,
  item: unknown,
  key: unknown,
  index: number,
  render: (get: () => unknown, at: () => number) => ServerValue,
) => ServerValue;
let rowHook: ForRowHook | null = null;
/** Resume ABI: wrap each For row during resumable renders (row regions for browser adoption).
 * The hook renders the row through `render(itemGetter, indexGetter)`. */
export function _onForRow(fn: ForRowHook): void {
  rowHook = fn;
}

/** Resume rows hook (R-PLAN): renders a whole keyed list from its compiled row plan (`$rows`), or returns undefined (then
 * every row goes through the row hook). */
export type ForRowsHook = (
  list: object,
  items: readonly unknown[],
  keys: readonly unknown[],
  rows: readonly unknown[],
  render: (get: () => unknown, at: () => number) => ServerValue,
) => ServerValue | undefined;
let rowsHook: ForRowsHook | null = null;
/** Resume ABI: render compiled resumable row plans (`$rows`) during resumable renders. */
export function _onForRows(fn: ForRowsHook): void {
  rowsHook = fn;
}

/** Resume lazy rows hook (LAZY-ROWS T4): renders a `$lazy` For's rows as one row region record (no per-row records),
 * or returns undefined (then the rows plan / row hooks record every row, R3: one rule per For). */
export type ForLazyHook = (
  list: object,
  items: readonly unknown[],
  lazy: readonly unknown[],
  children: (item: () => unknown, index: () => number) => ServerValue,
  by: (item: never, index: number) => unknown,
  render: (get: () => unknown, at: () => number) => ServerValue,
) => ServerValue | undefined;
let lazyHook: ForLazyHook | null = null;
/** Resume ABI: render compiler-marked lazy Fors (`$lazy`, spec 2026-10-19 lazy collection rows §3.1) during resumable renders. */
export function _onForLazy(fn: ForLazyHook): void {
  lazyHook = fn;
}

type ListMount = (
  items: readonly unknown[],
  original: (item: unknown, index: number) => unknown,
  plan: ListPlan,
  each: (tape: unknown[], base: number, item: unknown, index: number) => void,
) => unknown;
// `_list` (server.ts), installed by server.ts at load: no import cycle (server.ts imports this module).
let listMount: ListMount | null = null;
/** Compiler ABI plumbing: server.ts hands For its list-mount writer. */
export function _forListMount(fn: ListMount): void {
  listMount = fn;
}

/** Resume list hook: reads a For's `each` (the prop getter, then an accessor value) for the recorder. */
export type ForEachHook = (props: { each: unknown }) => unknown;
let eachHook: ForEachHook | null = null;
/** Resume ABI: read every For's `each` through `fn` during resumable renders (the reads that only pick rows). */
export function _onForEach(fn: ForEachHook): void {
  eachHook = fn;
}

interface ForProps<T, K> {
  each: readonly T[] | (() => readonly T[]);
  by: (item: T, index: number) => K;
  children: (item: () => T, index: () => number) => ServerValue;
  /** Compiler-private list mount of the rows (`[plan, each]`, FLATTEN-CMP-3), used when no row hook is installed. */
  $list?: readonly [ListPlan, (tape: unknown[], base: number, item: T, index: number) => void];
  /** Compiler-private resumable row plan (`[plan, write, env]`, R-PLAN, `server-resume` `_rRowPlan`): rows written from one
   * tape with their resume records known up front; used by the resume rows hook. */
  $rows?: readonly unknown[];
  /** Compiler-private lazy row verdict (`[flags]` / `[flags, "key.path"]`, LAZY-ROWS T2): `children` is a resumable row
   * function (`_rFn`); the resume lazy hook may render the rows without per-row records. */
  $lazy?: readonly unknown[];
  /** Lazy rows opt-out (LAZY-T6): `false` (or an accessor returning false, read only by a lazy-rows render) — the rows are
   * never lazy rows even when the compiler marked the For (`$lazy`): a container loop whose rows hold the collection's own
   * row `For` (cdk virtualizer sections / table header + body), so the inner For's rows are the lazy ones. */
  lazy?: boolean | (() => boolean);
}
/** Snapshot a keyed list; constant row/index getters match the compiled DOM authoring ABI. */
export function For<T, K>(props: ForProps<T, K>): ServerScope {
  const each = eachHook === null ? props.each : (eachHook(props) as readonly T[]),
    { by, children, $list, $rows, $lazy, lazy } = props;
  return scoped((capture) => capture(() => forRows(each, by, children, $list, $rows, $lazy, lazy))) as unknown as ServerScope;
}

// The row loop lives in a module-level function, not in the per-For closure: V8 keeps a function's optimized
// code only while a closure using it is alive, so code of per-call closures is dropped at every full GC and
// re-tiered (interpreter → Maglev → TurboFan / OSR) on the next large list.
function forRows<T, K>(
  each: readonly T[] | (() => readonly T[]),
  by: (item: T, index: number) => K,
  children: (item: () => T, index: () => number) => ServerValue,
  $list: readonly [ListPlan, (tape: unknown[], base: number, item: T, index: number) => void] | undefined,
  $rows?: readonly unknown[],
  $lazy?: readonly unknown[],
  lazy?: boolean | (() => boolean),
): unknown {
  // A value (live-props getter, `each={xs()}`) or an accessor (`each={xs}`).
  const items = typeof each === "function" ? each() : each;
  if (!Array.isArray(items)) throw new TypeError("For each must return an array (or be one)");
  const hook = rowHook,
    keys = new Set<K>();
  for (let index = 0; index < items.length; index++) {
    const key = by(items[index]!, index);
    if (keys.has(key)) throw new Error("Duplicate For key");
    keys.add(key);
  }
  // No resume recorder module: rows share the For's root (their cleanups and contexts are the
  // same; the server never removes a row) and render as a plain array, like `.map` — no per-row
  // root, record or admission.
  if (hook === null) {
    // Compiled rows: one list record (same bytes, evaluation order and errors as the mapped records).
    if ($list !== undefined && listMount !== null)
      return listMount(
        items,
        (item, index) =>
          children(
            () => item as T,
            () => index,
          ),
        $list[0],
        $list[1] as (tape: unknown[], base: number, item: unknown, index: number) => void,
      );
    const rows = items.map((item, index) =>
      children(
        () => item,
        () => index,
      ),
    );
    ROWS.add(rows);
    return rows;
  }
  // Resumable renders: each row renders through the hook (row region, recorder scope), still under the
  // For's root — a per-row root would cost a root, a scoped record and its admission per row.
  const instance = {},
    list = [...keys],
    render = (get: () => unknown, at: () => number) => children(get as () => T, at);
  if ($lazy !== undefined && lazyHook !== null && (typeof lazy === "function" ? lazy() : lazy) !== false) {
    const value = lazyHook(instance, items, $lazy, children as never, by as never, render);
    if (value !== undefined) {
      if (Array.isArray(value)) ROWS.add(value);
      return value;
    }
  }
  if ($rows !== undefined && rowsHook !== null) {
    const value = rowsHook(instance, items, list, $rows, render);
    if (value !== undefined) return value;
  }
  const rows: unknown[] = new Array(items.length);
  for (let index = 0; index < items.length; index++) rows[index] = hook(instance, items[index], list[index], index, render);
  ROWS.add(rows);
  return rows;
}

/** Branch content: a function (lazy; gets the value accessor) or eager content. */
type BranchContent<T> = ServerValue | ((value: () => NonNullable<T>) => ServerValue);
/** Resume branch hook: picks the branch (`pick` → [index, value]; -1 = fallback) and renders it through
 * `render(index, value, getter)`. */
export type BranchHook = (
  pick: () => [number, unknown],
  keyed: (index: number) => boolean,
  render: (index: number, get: () => unknown) => ServerValue,
) => ServerValue;
let branchHook: BranchHook | null = null;
/** Resume ABI: wrap Show/Switch branch rendering during resumable renders (branch regions for browser adoption). */
export function _onBranch(fn: BranchHook): void {
  branchHook = fn;
}
// Only the active branch renders: the same HTML as the equivalent ternary.
function branches(pick: () => [number, unknown], keyed: (index: number) => boolean, content: (index: number) => unknown): ServerScope {
  const render = (index: number, get: () => unknown): ServerValue => {
    const value = content(index);
    return typeof value === "function" ? (value as (get: () => unknown) => ServerValue)(get) : (value as ServerValue);
  };
  return scoped((capture) =>
    capture(() => {
      if (branchHook !== null) return branchHook(pick, keyed, render);
      const [index, value] = pick();
      return render(index, constant(value));
    }),
  ) as unknown as ServerScope;
}
/** Render `children` when `when()` is truthy, else `fallback` (function content gets the value accessor). */
export function Show<T>(props: { when: T | (() => T); keyed?: boolean; fallback?: ServerValue; children?: BranchContent<T> }): ServerScope {
  return branches(
    () => {
      const value = when(props.when);
      return [value ? 0 : -1, value];
    },
    (index) => index === 0 && !!props.keyed,
    (index) => (index ? props.fallback : props.children),
  );
}
// `when`: a value (live-props getter, `when={c()}`) or an accessor (`when={c}`, `when={() => …}`).
const when = (v: unknown): unknown => (typeof v === "function" ? (v as () => unknown)() : v);
const MATCH: unique symbol = Symbol.for("rivet.match");
/** A Switch case record (only a Switch renders it). */
export interface MatchRecord {
  readonly [MATCH]: { when: unknown; keyed?: boolean; children?: unknown };
}
/** A Switch case: read by the enclosing Switch. */
export function Match<T>(props: { when: T | (() => T); keyed?: boolean; children?: BranchContent<T> }): MatchRecord {
  return { [MATCH]: props };
}
/** Render the first Match whose `when()` is truthy, else `fallback`. */
export function Switch(props: { fallback?: ServerValue; children?: MatchRecord | readonly unknown[] | ServerValue }): ServerScope {
  const cases: MatchRecord[typeof MATCH][] = [];
  const collect = (value: unknown): void => {
    if (Array.isArray(value)) for (const child of value) collect(child);
    else if (value != null && typeof value === "object" && MATCH in value) cases.push((value as MatchRecord)[MATCH]);
  };
  collect(props.children);
  return branches(
    () => {
      for (let index = 0; index < cases.length; index++) {
        const value = when(cases[index]!.when);
        if (value) return [index, value];
      }
      return [-1, undefined];
    },
    (index) => index >= 0 && !!cases[index]!.keyed,
    (index) => (index < 0 ? props.fallback : cases[index]!.children),
  );
}
// Same rule as the DOM Dynamic (dom.ts): one element name, no raw-text / RCDATA / document-level /
// embedding elements.
const UNSAFE_TAG =
    /^(script|style|template|textarea|title|i?frame|frameset|object|embed|no(script|embed|frames)|plaintext|xmp|base|meta|link|html|head|body)$/i,
  VOID_TAG = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;
/**
 * Render a component function (called with the remaining props) or an intrinsic tag (remaining props are
 * escaped attributes; a function value is an accessor read once; `style` a style object; `onX` and `ref` are
 * browser-only).
 */
export function Dynamic(props: { component: ((props: never) => unknown) | string } & Record<string, unknown>): ServerValue {
  const { component: type, ...rest } = props;
  if (typeof type === "function") return (type as (props: unknown) => ServerValue)(rest);
  if (typeof type !== "string" || !/^[A-Za-z][A-Za-z0-9]*(-[\w.-]+)*$/.test(type) || UNSAFE_TAG.test(type)) throw new TypeError("Unsafe dynamic tag");
  const { children, ref: _ref, ...attributes } = rest;
  const name = type,
    namespace = type === "svg" ? "svg" : type === "math" ? "mathml" : "html",
    fragments = ["<" + name],
    slots: ServerValue[] = [];
  for (const key in attributes) {
    if (/^on[A-Z]/.test(key)) continue;
    const value = attributes[key];
    // `style`: a style object, as the DOM Dynamic's `_spread` and server spreads take it (strings throw).
    if (key === "style") {
      slots.push(_styleAttr("style", _style(typeof value === "function" ? (value as () => unknown)() : value)) as unknown as ServerValue);
      fragments.push("");
      continue;
    }
    // Media sources allow data: images/video/audio, as bindAttribute does for the element in the DOM.
    const media = namespace === "html" && MEDIA_URLS.test(type.toLowerCase() + " " + key.toLowerCase());
    slots.push(attribute(key, typeof value === "function" ? (value as () => unknown)() : value, media ? "media" : namespace) as unknown as ServerValue);
    fragments.push("");
  }
  if (VOID_TAG.test(type)) {
    if (children != null) throw new TypeError("Void element has no children");
    fragments[fragments.length - 1] += ">";
  } else {
    fragments[fragments.length - 1] += ">";
    slots.push(children as ServerValue);
    fragments.push("</" + name + ">");
  }
  return template(fragments, slots);
}

let portalHook: (() => void) | null = null;
/** Resume ABI: observe server `Portal`s (a lazy For row holding one records its rows instead, LAZY-ROWS T4). */
export function _onPortal(fn: () => void): void {
  portalHook = fn;
}
/** `Portal` renders nothing on the server: its content is browser-only (see the DOM `Portal`). */
export function Portal(_props: { mount?: unknown; children?: unknown }): ServerValue {
  if (portalHook !== null) portalHook();
  return null;
}
