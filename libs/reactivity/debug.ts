// Read-only views of the reactive graph for development tools (`@rivetjs/reactivity/debug`). Kept out
// of index.ts so production entry bundles stay byte-identical; the field names below mirror index.ts
// (tests/debug.test.ts pins them). Views never evaluate, track or mutate anything.
import { computed, createRoot, effect, getOwner, signal, _observeBindings, _observeOwner, type Context, type Owner, type Signal } from "./index.ts";

/** Global key of the devtools hook (`globalThis[HOOK]`), created by a devtools host before app code. */
export const HOOK: unique symbol = Symbol.for("rivet.devtools");
/** Event sink shared by the development façades and a devtools agent. */
export interface DevtoolsHook {
  readonly v: 1;
  /** 0: rare events only; 1: + structure (creation, mount); 2: + writes, runs, DOM updates (recording). */
  level: 0 | 1 | 2;
  /** Capture creation stacks (`Error` objects, formatted on demand). */
  stacks: boolean;
  /** Set while the devtools writes a signal, so the write is reported `by: "devtools"`. */
  writing?: boolean;
  /** `_debug` of the reactivity copy the app runs, registered by its development façade. */
  debug?: (x: unknown) => DebugView | null;
  /** The computed / effect (bindings included) running now, while recording (`node.run` timing). */
  current?: object | null;
  /** Debug overrides on (set by a devtools agent before app code): computeds and props can be pinned. */
  edit?: boolean;
  /** Registered by the development façades (with `edit`): pin a computed's value (`null` resets),
   * re-notify a signal whose value was mutated in place, pin component props. */
  pins?: {
    computed?(node: object, pin: { value: unknown } | null): boolean;
    computedPin?(node: object): { value: unknown } | null | undefined;
    notify?(getter: Signal<unknown>): boolean;
    prop?(owner: object, key: string, pin: { value: unknown } | null): boolean;
    props?(owner: object): ReadonlyMap<string, { value: unknown }> | undefined;
  };
  emit(type: string, data: object): void;
}
/** The installed hook, if a devtools host created one. */
export const devtoolsHook = (): DevtoolsHook | undefined => (globalThis as { [HOOK]?: DevtoolsHook })[HOOK];

// With a devtools host (hook installed before this import), inert DOM bindings stay in the graph so
// the tree / graph views see them; otherwise they are released exactly as in production.
if (devtoolsHook() !== undefined) _observeBindings();

export type DebugKind = "owner" | "computed" | "effect" | "signal";
/** Frozen snapshot of one graph node; relations are read when called. */
export interface DebugView {
  readonly kind: DebugKind;
  /** Stable identity: the getter for signals, the internal node otherwise (use as a map key only). */
  readonly ref: object;
  /** Current value of a signal, or a computed's cached value (undefined before its first run). */
  readonly value?: unknown;
  readonly state: "clean" | "check" | "dirty";
  readonly failed: boolean;
  readonly disposed: boolean;
  /** Context token of a `provide` owner, and the value it provides. */
  readonly token?: Context<unknown>;
  readonly context?: unknown;
  /** A signal's getter. */
  readonly getter?: Signal<unknown>;
  parent(): DebugView | null;
  children(): DebugView[];
  sources(): DebugView[];
  observers(): DebugView[];
}

// Mirrors of index.ts internals (Owner / Node / Source fields).
interface RawOwner {
  kind: number;
  parent: RawOwner | null;
  first: RawOwner | null;
  next: RawOwner | null;
  // Nearest context frame (inherited); this owner provides only when the frame's `owner` is itself.
  ctx: { token: Context<unknown>; value: unknown; owner: RawOwner } | null;
  disposed: boolean;
  value?: unknown;
  state?: number;
  // RUNNING 1 | FAILED 2 | READY 4 (index.ts `flags`).
  flags?: number;
  sources?: RawOwner | RawSource | (RawOwner | RawSource)[] | null;
  observers?: RawOwner | RawOwner[] | null;
}
interface RawSource {
  kind: 4;
  value: unknown;
  observers: RawOwner | RawOwner[] | null;
  getter: Signal<unknown> | null;
}

// Internal symbols and prototypes, found through probes (not exported by index.ts).
const symbolNamed = (fn: object, name: string) => Object.getOwnPropertySymbols(fn).find((s) => s.description === name)!;
const probeSignal = signal(0),
  probeComputed = computed(() => 0);
const SIGNAL = symbolNamed(probeSignal, "rivet.signal"),
  COMPUTED = symbolNamed(probeComputed, "rivet.computed");
const sourceProto = Object.getPrototypeOf((probeSignal as unknown as { [k: symbol]: object })[SIGNAL]) as object;
const computedProto = Object.getPrototypeOf((probeComputed as unknown as { [k: symbol]: object })[COMPUTED]) as object;
const effectProto = (() => {
  let prototype!: object;
  const dispose = effect(() => {
    prototype = Object.getPrototypeOf(getOwner());
  });
  dispose();
  return prototype;
})();
const ownerProto = createRoot((dispose) => {
  const owner = getOwner() as object;
  dispose();
  return Object.getPrototypeOf(owner) as object;
}).value;
const KINDS: DebugKind[] = ["owner", "computed", "effect"];
/** Graph links are inline while single (see index.ts). */
const links = <T>(value: T | T[] | null | undefined): T[] => (value == null ? [] : Array.isArray(value) ? value : [value]);
const STATES = ["clean", "check", "dirty"] as const;

function sourceView(source: RawSource): DebugView {
  return Object.freeze({
    kind: "signal" as const,
    // A `selector` key source has no getter: the source itself is the identity.
    ref: source.getter ?? source,
    value: source.value,
    state: "clean" as const,
    failed: false,
    disposed: false,
    ...(source.getter ? { getter: source.getter } : {}),
    parent: () => null,
    children: () => [],
    sources: () => [],
    observers: () => links(source.observers).map(ownerView),
  });
}
function ownerView(owner: RawOwner): DebugView {
  _observeOwner(owner as unknown as Owner);
  const reactive = owner.kind !== 0;
  return Object.freeze({
    kind: KINDS[owner.kind]!,
    ref: owner,
    ...(owner.kind === 1 ? { value: owner.value } : {}),
    state: reactive ? STATES[owner.state!]! : "clean",
    failed: ((owner.flags ?? 0) & 2) !== 0,
    disposed: owner.disposed,
    ...(owner.ctx !== null && owner.ctx.owner === owner ? { token: owner.ctx.token, context: owner.ctx.value } : {}),
    parent: () => (owner.parent ? ownerView(owner.parent) : null),
    children: () => {
      const list: DebugView[] = [];
      // Owners link children newest first; views list them in creation order.
      for (let child = owner.first; child !== null; child = child.next) list.push(ownerView(child));
      return list.reverse();
    },
    sources: () => links(owner.sources).map((s) => (s.kind === 4 ? sourceView(s as RawSource) : ownerView(s as RawOwner))),
    observers: () => links(owner.observers).map(ownerView),
  });
}

/** Development tools: a view of a signal getter, computed getter, owner handle or internal node; else null. */
export function _debug(x: unknown): DebugView | null {
  if (typeof x === "function") {
    const source = (x as unknown as { [SIGNAL]?: RawSource })[SIGNAL];
    if (source !== undefined && source.getter === x) return sourceView(source);
    const node = (x as unknown as { [COMPUTED]?: RawOwner })[COMPUTED];
    return node !== undefined ? ownerView(node) : null;
  }
  if (typeof x !== "object" || x === null) return null;
  if (Object.getPrototypeOf(x) === sourceProto) return (x as RawSource).getter ? sourceView(x as RawSource) : null;
  const proto = Object.getPrototypeOf(x);
  return proto === ownerProto || proto === effectProto || proto === computedProto ? ownerView(x as RawOwner) : null;
}

/** One read path of a store (`_debugStore`): its value, signal and current observer count. */
export interface StoreTreeView {
  /** Dotted path from the store root (`""` for the root). */
  readonly path: string;
  readonly value: unknown;
  readonly signal: Signal<unknown>;
  readonly observers: number;
  readonly children: readonly StoreTreeView[];
}
/** Development tools: snapshot of a store's node tree (only paths that were read have nodes). */
// `Signal<any>`: Signal is invariant, any store node (`Store<T>`) is accepted.
export function _debugStore(store: { v: Signal<any>; c?: Record<string, unknown> }): StoreTreeView {
  const view = (node: { v: Signal<unknown>; c?: Record<string, unknown> }, path: string): StoreTreeView => {
    const source = (node.v as unknown as { [k: symbol]: RawSource })[SIGNAL]!;
    return Object.freeze({
      path,
      value: source.value,
      signal: node.v,
      observers: links(source.observers).length,
      children: Object.freeze(Object.keys(node.c ?? {}).map((key) => view(node.c![key] as typeof node, path ? path + "." + key : key))),
    });
  };
  return view(store, "");
}
