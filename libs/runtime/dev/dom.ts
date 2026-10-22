// Development façade of `@rivetjs/runtime/dom` (`development` export condition; compiled DOM modules
// import that entry, so all compiled output is covered). Production resolution never reaches this file.
// With a devtools hook installed, component and mount owners are reported with their DOM spans, and
// binding re-runs (not their first run) are reported while recording. Always (hook or not): a props
// expression that reads a signal warns once (props are values), runtime errors name the nearest
// component, the attribute and the value type, and the document is audited for common accessibility
// mistakes (dev/a11y.ts).
import * as dom from "../dom.ts";
import { _adoption } from "../dom-v2.ts";
import { getOwner, onCleanup, signal, untrack, _rootIn, _scoped, _inspect, type Disposer, type Signal } from "@rivetjs/reactivity";
import { _trackReads } from "@rivetjs/reactivity/track";
import { _debug, devtoolsHook, type DevtoolsHook } from "@rivetjs/reactivity/debug";
import type { ClientOnlyOptions, Component, DOMValue, LazyComponentOptions } from "../dom.ts";
export * from "../dom.ts";
import { MEDIA_URLS, URLS, unsafeUrl } from "../url.ts";
import { DEV } from "./on.ts";
import { noteEvent, start as startA11y } from "./a11y.ts";
import { chain, components, DOCS, hidden, nameOf as declaredName, noteNode } from "./where.ts";

// Structural built-ins (and `Provider`, whose context shows under the component rendering it) render
// through `_c` / `_cp` but are not app components (`For` / `Show` / `Switch` / `Match` are `_for` / `_show` / …).
const installed = devtoolsHook();
const builtins = [dom.ChunkGroup, dom.Provider, dom.Suspense, Suspense, dom._for, dom._show, dom._switch, dom._match];
for (const fn of builtins) hidden.add(fn as never);
if (installed !== undefined) for (const fn of builtins) installed.emit("comp.hide", { fn });

// Component owner → component (`where.ts`), for warnings and error messages (`in <Card> (src/card.tsx:3:17) ← <Page> (…)`).
// Also the resume adoption's dev owners: production components own nothing, so a re-created region's Show / For /
// `_regionState` under a component still counts as direct.
_adoption.dev = components;
/** Declared name (dev source stamps see through hot wrappers), else `fn.name`. */
const nameOf = (fn: Component<never>): string => declaredName(fn as never);
/** Dev warning tail: `\n  in <Name> (file:line:col) ← …` (when inside a component) + `\n  docs: …`. */
const at = (owner: unknown): string => {
  const text = chain(owner);
  return (text ? "\n  in " + text : "") + "\n  docs: " + DOCS.warnings;
};
/** ` in <Name> (file:line:col) ← <Parent> (…)` for the components owning `owner` (nearest first), or "". */
function where(owner: unknown): string {
  const text = chain(owner);
  return text ? " in " + text : "";
}
const located = new WeakSet<object>();
/** A production runtime error thrown inside a component gains the component's name (once). */
function locate(error: unknown, owner: unknown): unknown {
  if (error instanceof TypeError && !located.has(error) && error.message === "Unsupported DOM child value") {
    located.add(error);
    error.message += where(owner);
  }
  return error;
}
const typeName = (value: unknown): string =>
  typeof value !== "object" ? typeof value : ((Object.getPrototypeOf(value) as { constructor?: { name?: string } } | null)?.constructor?.name ?? "object");
// What a checked value currently renders, for v2 component spans (`spanOf`): the latest result of each
// accessor `guard` wrapped, and the roots of each fragment it saw (insertion empties a fragment).
const latest = new WeakMap<object, unknown>();
const fragments = new WeakMap<Node, Node[]>();
/** Child values dom.ts accepts, checked before it sees them (functions re-checked when read). */
function guard(value: unknown, owner: unknown): unknown {
  if (typeof value === "function") {
    const read = (): unknown => {
      const next = guard((value as () => unknown)(), owner);
      latest.set(read, next);
      return next;
    };
    return read;
  }
  if (Array.isArray(value)) return value.map((child) => guard(child, owner));
  if (value == null || ["string", "number", "bigint", "boolean"].includes(typeof value) || typeof (value as PromiseLike<unknown>).then === "function")
    return value;
  if (typeof (value as Node).nodeType === "number" && typeof (value as Node).nodeName === "string") {
    if ((value as Node).nodeType === 11) fragments.set(value as Node, Array.from((value as Node).childNodes));
    // Which component rendered it (a11y warnings, `where.ts`): the first owner to check a node is the innermost one.
    noteNode(value as Node, owner);
    return value;
  }
  const error = TypeError(
    "Unsupported DOM child value (" + typeName(value) + ")" + where(owner) + " — render text, numbers, nodes or JSX; pick a field or format the value",
  );
  located.add(error);
  throw error;
}
/** Collect the nodes `value` (a checked value, see `guard`) renders now, in order. */
function nodesOf(value: unknown, out: Node[]): void {
  if (typeof value === "function") {
    if (latest.has(value)) nodesOf(latest.get(value), out);
  } else if (Array.isArray(value)) for (const item of value) nodesOf(item, out);
  else if (value !== null && typeof value === "object") {
    if ((value as Node).nodeType === 11) out.push(...(fragments.get(value as Node) ?? []));
    else if (typeof (value as Node).nodeType === "number") out.push(value as Node);
  }
}
/** The DOM span of a component's output: its first and last connected node (devtools read both ends inclusively). */
function spanOf(value: unknown): { start: Node; end: Node } | undefined {
  const nodes: Node[] = [];
  nodesOf(value, nodes);
  const live = nodes.filter((node) => node.isConnected);
  return live.length ? { start: live[0]!, end: live[live.length - 1]! } : undefined;
}

// Props are values: a props expression that reads a signal is a snapshot that never updates.
const warned = new WeakMap<Component<never>, Set<string>>();
function snapshot<P>(fn: Component<P>, props: () => P): P {
  const { value, signals } = _trackReads(props);
  if (!signals.length) return value;
  const name = nameOf(fn as Component<never>),
    record = value as Record<string, unknown>,
    current = signals.map((read) => (_inspect(read) as { value?: unknown } | null)?.value),
    keys = record && typeof record === "object" ? Object.keys(record).filter((key) => typeof record[key] !== "function") : [],
    hits = keys.filter((key) => current.some((v) => Object.is(v, record[key])));
  let seen = warned.get(fn as Component<never>);
  if (!seen) warned.set(fn as Component<never>, (seen = new Set()));
  const known = seen;
  for (const key of hits.length ? hits : [""]) {
    if (seen.has(key)) continue;
    seen.add(key);
    console.warn(
      key
        ? `Rivet: <${name} ${key}={…}> read a signal, but props are values: ${key} is a snapshot and never updates. ` +
            `To keep it live, pass the accessor: ${key}={count} rather than ${key}={count()}, and call props.${key}() inside ${name}.` +
            at(getOwner())
        : `Rivet: the props of <${name}> read a signal, but props are values: they are snapshots and never update` +
            (keys.length ? ` (value props: ${keys.join(", ")})` : "") +
            `. Pass accessors (${keys[0] ?? "n"}={() => …} or a signal) and read signals inside the child.` +
            at(getOwner()),
    );
  }
  // A derived value (`n={count() * 2}`) cannot be told apart from its siblings here: name the value
  // prop the child reads reactively (expecting it to stay live), once per component and prop.
  if (hits.length || keys.every((key) => seen.has(key))) return value;
  return new Proxy(record, {
    get(target, key) {
      // Receiver = the props object itself: slot-object getters brand-check `this` (runtime/props.ts).
      const read = Reflect.get(target, key);
      if (typeof key === "string" && keys.includes(key) && !known.has(key) && reactive()) {
        known.add(key);
        console.warn(
          `Rivet: props.${key} of <${name}> is a value snapshot; reading it inside an effect, computed or binding won't update. ` +
            `Pass an accessor (${key}={count}) and call props.${key}().` +
            at(getOwner()),
        );
      }
      return read;
    },
  }) as P;
}
// Inside an effect or computed run (bindings are effects) its node is the current owner.
const reactive = (): boolean => {
  const kind = _debug(getOwner())?.kind;
  return kind === "effect" || kind === "computed";
};

// Debug prop overrides (agent with `edit`): a component's props read through a proxy that answers a
// pinned key with its pin (bindings reading props subscribe to the component's internal pin signal).
// A pinned accessor prop (a function the child calls) gives way at its next real change.
type Pin = { value: unknown; real?: unknown };
const propPins = new WeakMap<object, { target: Record<string, unknown>; pins: Signal<ReadonlyMap<string, Pin> | null> }>();
if (installed !== undefined && installed.edit) {
  const table = (installed.pins ??= {});
  table.prop = (owner, key, pin) => {
    const entry = propPins.get(owner);
    if (!entry || key === "children") return false;
    const next = new Map(untrack(entry.pins) ?? []);
    if (pin === null) next.delete(key);
    else {
      const current = entry.target[key];
      next.set(key, typeof current === "function" ? { value: pin.value, real: untrack(current as () => unknown) } : { value: pin.value });
    }
    entry.pins.set(next.size ? next : null);
    return true;
  };
  table.props = (owner) => {
    const map = propPins.get(owner);
    return map ? (untrack(map.pins) ?? undefined) : undefined;
  };
}
function overridable<P>(hook: DevtoolsHook | undefined, value: P): P {
  if (hook === undefined || !hook.edit || typeof value !== "object" || value === null) return value;
  const owner = getOwner();
  if (owner === null) return value;
  const pins = signal<ReadonlyMap<string, Pin> | null>(null);
  hook.emit("sig.internal", { sig: pins });
  const target = value as Record<string, unknown>;
  propPins.set(owner, { target, pins });
  const clear = (key: string) => hook.pins?.prop?.(owner, key, null);
  return new Proxy(target, {
    get(object, key) {
      const read = Reflect.get(object, key);
      if (typeof key !== "string" || key === "children") return read;
      const pin = pins()?.get(key);
      if (!pin) return read;
      const descriptor = Object.getOwnPropertyDescriptor(object, key);
      if (descriptor && !descriptor.configurable && !(descriptor as { writable?: boolean }).writable) return read;
      if (typeof read !== "function") return pin.value;
      return () => {
        const real = (read as () => unknown)();
        if (Object.is(real, pin.real)) return pin.value;
        // A real change: the override gives way (outside the running computation).
        queueMicrotask(() => {
          if (pins()?.get(key) === pin) clear(key);
        });
        return real;
      };
    },
  }) as P;
}

// Components that lazyComponent / clientOnly select render through dom.ts's own `_c` (no owner of
// their own): a wrapper (one per function) renders them like a compiled `_c` call here — own owner,
// reported, errors named.
const tags = new WeakMap<Component<never>, Component<never>>();
function tagged<P>(fn: Component<P>): Component<P> {
  let wrapper = tags.get(fn as Component<never>) as Component<P> | undefined;
  if (!wrapper) {
    wrapper = (value: P) => component2(fn, value, false) as DOMValue;
    tags.set(fn as Component<never>, wrapper as Component<never>);
  }
  return wrapper;
}
const pickDefault = (module: unknown) => (module as { default: Component<unknown> }).default;

/** `lazyComponent`; the loaded component is reported, the loading wrapper is hidden (`comp.hide`). */
export function lazyComponent<P>(
  importer: () => { default: Component<P> } | PromiseLike<{ default: Component<P> }>,
  select?: undefined,
  options?: LazyComponentOptions,
): Component<P>;
export function lazyComponent<M, P>(importer: () => M | PromiseLike<M>, select: (module: M) => Component<P>, options?: LazyComponentOptions): Component<P>;
export function lazyComponent<M, P>(importer: () => M | PromiseLike<M>, select?: (module: M) => Component<P>, options?: LazyComponentOptions): Component<P> {
  const hook = devtoolsHook();
  if (hook === undefined || hook.level < 1) return dom.lazyComponent(importer, select!, options);
  const pick = select ?? (pickDefault as (module: M) => Component<P>);
  const inner = dom.lazyComponent(importer, (module: M) => tagged(pick(module)), options);
  hook.emit("comp.hide", { fn: inner });
  return inner;
}

/** `clientOnly`; reported like `lazyComponent`. */
export function clientOnly<P>(
  importer: () => { default: Component<P> } | PromiseLike<{ default: Component<P> }>,
  select?: undefined,
  options?: ClientOnlyOptions<P>,
): Component<P>;
export function clientOnly<M, P>(importer: () => M | PromiseLike<M>, select: (module: M) => Component<P>, options?: ClientOnlyOptions<P>): Component<P>;
export function clientOnly<M, P>(importer: () => M | PromiseLike<M>, select?: (module: M) => Component<P>, options?: ClientOnlyOptions<P>): Component<P> {
  const hook = devtoolsHook();
  if (hook === undefined || hook.level < 1) return dom.clientOnly(importer, select!, options);
  const pick = select ?? (pickDefault as (module: M) => Component<P>);
  const inner = dom.clientOnly(importer, (module: M) => tagged(pick(module)), options);
  hook.emit("comp.hide", { fn: inner });
  return inner;
}

let eagerSuspense = false;
/** `Suspense`; eager (non-function) children warn once: their Asyncs were created outside the boundary. */
export function Suspense(props: { fallback?: () => DOMValue; children: DOMValue }): DOMValue {
  if (typeof props.children !== "function" && !eagerSuspense) {
    eagerSuspense = true;
    console.warn(
      "Rivet: <Suspense> got eager children, so the Asyncs inside were created before the boundary and are not coordinated. " +
        "Pass a thunk: <Suspense fallback={…}>{() => <>…</>}</Suspense>." +
        at(getOwner()),
    );
  }
  return dom.Suspense(props);
}

/** `mount`; reports `root.mount { owner, container }` and `root.unmount { owner }`. */
export function mount(factory: () => DOMValue, container: Element | DocumentFragment): Disposer {
  startA11y();
  const hook = devtoolsHook();
  if (hook === undefined || hook.level < 1) return dom.mount(() => guard(factory(), getOwner()) as DOMValue, container);
  let owner: unknown = null;
  const stop = dom.mount(() => {
    owner = getOwner();
    return guard(factory(), owner) as DOMValue;
  }, container);
  hook.emit("root.mount", { owner, container });
  let active = true;
  return () => {
    if (active) hook.emit("root.unmount", { owner });
    active = false;
    stop();
  };
}

// A binding read that reports its re-runs (`dom.update`) while recording; the owner is the binding's scope.
function reported<T>(hook: DevtoolsHook, read: () => T, node: object, kind: "child" | "attr" | "text", name: string | null): () => T {
  const owner = getOwner();
  let first = true;
  return () => {
    const value = read();
    if (first) first = false;
    else if (hook.level >= 2) hook.emit("dom.update", { node, kind, name, owner });
    return value;
  };
}

/**
 * A spread value's URL keys checked (warn once, naming the component) — static values now, accessor values
 * when read (wrapped once each, so a key's binding sees a stable function). Same keys and order.
 */
function urlKeys(target: Element, owner: unknown): (value: unknown) => unknown {
  const html = target.namespaceURI === "http://www.w3.org/1999/xhtml",
    wrapped = new WeakMap<() => unknown, () => unknown>();
  const check = (name: string, lower: string, value: unknown): void => {
    const scheme = value == null ? undefined : unsafeUrl(lower, String(value), html && MEDIA_URLS.test(target.localName + " " + lower));
    if (scheme) DEV.unsafeUrl(name, scheme, where(owner));
  };
  return (value) => {
    const next = value as Record<string, unknown> | null | undefined;
    let out = next;
    for (const name in next) {
      const lower = name.toLowerCase(),
        item = next[name];
      if (!URLS.has(lower)) continue;
      if (typeof item !== "function") {
        check(name, lower, item);
        continue;
      }
      // Same keys and order as `next` (for-in, inherited keys included), accessors checked when read.
      if (out === next) {
        out = {};
        for (const key in next) out[key] = next[key];
      }
      let fn = wrapped.get(item as () => unknown);
      if (!fn) wrapped.set(item as () => unknown, (fn = () => ((v) => (check(name, lower, v), v))((item as () => unknown)())));
      out![name] = fn;
    }
    return out;
  };
}

/** Dev: `clientEvent`'s `match` selector is validated at registration (`DEV.selector`). */
export const clientEvent = ((target: never, type: string, handler: never, options?: { match?: string }) => {
  if (options?.match) DEV.selector(options.match);
  (dom.clientEvent as (...args: unknown[]) => void)(target, type, handler, options);
}) as typeof dom.clientEvent;

/**
 * DOM v2 compiler ABI `_on` / `_listen`; record the type for the dev a11y checks (explicit
 * handlers only: `_spread` binds through `dom-v2.ts` directly).
 */
export function _on(el: Element, type: string, handler: ((event: Event) => unknown) | null | undefined): void {
  if (handler != null) noteEvent(el, type);
  dom._on(el, type, handler);
}
export function _listen(el: Element, type: string, handler: ((event: Event) => unknown) | null | undefined, options?: AddEventListenerOptions): void {
  if (handler != null) noteEvent(el, type);
  dom._listen(el, type, handler, options);
}

// ---- compiler ABI (spec 2026-10-06 §2.4) ----
// Production v2 components run under the caller's scope (no owner per component, Q5). Here each `_c` /
// `_cp` gets its own owner (a root under the current owner, disposed with it), so devtools see the
// component tree and errors name the component; writers report re-runs and check values.

/** `_c` / `_cp`: a component under its own owner; reports `comp.mount { owner, fn, props, spanOf }` and `comp.unmount`. */
function component2<P>(fn: Component<P>, input: P | (() => P), thunk: boolean): unknown {
  startA11y();
  const hook = devtoolsHook(),
    report = hook !== undefined && hook.level >= 1,
    parent = getOwner(),
    holder: { owner: unknown } = { owner: null };
  let props: unknown;
  // A disposed scope cannot own a new root: run as production does (no owner, no report).
  if (parent !== null && _debug(parent)?.disposed) return thunk ? dom._cp(fn, input as () => P) : dom._c(fn, input as P);
  let out: unknown;
  try {
    out = _rootIn(
      parent as never,
      (h: { owner: unknown }) => {
        const own = h.owner as object;
        components.set(own, fn as Component<never>);
        if (report) onCleanup(() => hook.emit("comp.unmount", { owner: own }));
        // Props (and eager children of `_cp`) are built under the component owner.
        props = overridable(hook, thunk ? snapshot(fn, input as () => P) : (input as P));
        return guard(scoped(untrack(() => fn(props as P))), own);
      },
      holder as never,
    );
  } catch (error) {
    throw locate(error, holder.owner ?? parent);
  }
  if (report) hook.emit("comp.mount", { owner: holder.owner, fn, props, spanOf: () => spanOf(out) });
  return out;
}
/**
 * A component's accessor output (a hot wrapper's render, a `_show`'s branch) is read by the caller's
 * insertion: each read runs in a fresh child scope of the component owner (reactivity `_scoped`, disposed on
 * the next read and with the reader), so what it renders stays under the component in the owner tree.
 * Arrays: per accessor item.
 */
function scoped(value: unknown): unknown {
  return typeof value === "function" ? _scoped(value as () => unknown) : Array.isArray(value) ? value.map(scoped) : value;
}
/** Compiler ABI `_c` (static props), see `component2`. `_c(_propsOf, props)` (a resumed live props recipe, LIVE-PROPS P3)
 * is no component: it returns the props object as production does (no owner, no child-value check). */
export function _c<P>(fn: (props: P) => unknown, props: P): unknown {
  // By name, not identity: dev cache-busted runtime copies may load `props.ts` twice (no import of it here either).
  if (fn.name === "_propsOf") return props;
  return component2(fn as Component<P>, props, false);
}
/** Compiler ABI `_cp` (props read reactive state: snapshot warning), see `component2`. */
export function _cp<P>(fn: (props: P) => unknown, props: () => P): unknown {
  return component2(fn as Component<P>, props, true);
}

// Writers are called inside their binding effect (`_fx(() => _t(el, expr))`), once per run: the first
// write of an (element, kind, name) is the creation, later ones are reported as `dom.update`.
const writes = new WeakMap<object, Set<string>>();
function wrote(hook: DevtoolsHook | undefined, node: object, kind: "child" | "attr" | "text", name: string | null): void {
  if (hook === undefined || hook.level < 1) return;
  const key = kind + ":" + (name ?? "");
  let seen = writes.get(node);
  if (!seen) writes.set(node, (seen = new Set()));
  if (!seen.has(key)) seen.add(key);
  else if (hook.level >= 2) hook.emit("dom.update", { node, kind, name, owner: getOwner() });
}
/** `read` (an accessor) or `value` checked by `check`; an accessor also reports its re-runs. */
function bound(value: unknown, check: (value: unknown) => unknown, node: object, kind: "child" | "attr" | "text", name: string | null): unknown {
  if (typeof value !== "function") return check(value);
  const hook = devtoolsHook(),
    read = () => check((value as () => unknown)());
  return hook === undefined || hook.level < 1 ? read : reported(hook, read, node, kind, name);
}
/** The attribute value check: an unsafe URL warns once (naming the component), a class object warns. */
function attrCheck(target: Element, name: string, owner: unknown): (value: unknown) => unknown {
  const lower = name.toLowerCase();
  if (lower === "class")
    return (value) => {
      if (value !== null && typeof value === "object") DEV.classObject();
      return value;
    };
  if (!URLS.has(lower)) return (value) => value;
  const media = target.namespaceURI === "http://www.w3.org/1999/xhtml" && MEDIA_URLS.test(target.localName + " " + lower);
  return (value) => {
    // Coerced once, so dom.ts / dom-v2.ts check (and write) the string checked here.
    if (value == null) return value;
    const text = String(value),
      scheme = unsafeUrl(lower, text, media);
    if (scheme) DEV.unsafeUrl(name, scheme, where(owner));
    return text;
  };
}

/** Compiler ABI `_t` (sole dynamic child, called per binding run): unsupported values name their type and component; re-runs report. */
export function _t(el: Element, value: unknown): void {
  const owner = getOwner(),
    checked = guard(value, owner);
  wrote(devtoolsHook(), el, "child", null);
  dom._t(el, checked);
}
/** Compiler ABI `_tx` (sole dynamic text child on its template's placeholder Text): `_t`'s checks + reports. */
export function _tx(text: Text, value: unknown): void {
  const owner = getOwner(),
    checked = guard(value, owner);
  wrote(devtoolsHook(), text.parentNode ?? text, "child", null);
  dom._tx(text, checked);
}
/** Compiler ABI `_textValue` (sole static child or accessor). */
export function _textValue(el: Element, value: unknown): void {
  const owner = getOwner();
  dom._textValue(el, bound(value, (v) => guard(v, owner), el, "child", null) as never);
}
/** Compiler ABI `_insert`: values checked (`guard`); an accessor reports its re-runs (node: the parent). */
export function _insert(parent: (Node & ParentNode) | null, value: unknown, marker?: Node | null): void {
  const owner = getOwner();
  const checked = typeof value === "function" ? bound(value, (v) => guard(v, owner), parent ?? marker!, "child", null) : guard(value, owner);
  dom._insert(parent, checked, marker);
}
/** Compiler ABI `_cls` (per binding run): a class object warns once; re-runs report. */
export function _cls(el: Element, value: unknown): void {
  if (value !== null && typeof value === "object") DEV.classObject();
  wrote(devtoolsHook(), el, "attr", "class");
  dom._cls(el, value);
}
/** Compiler ABI `_className` (value or accessor). */
export function _className(el: Element, value: unknown): void {
  dom._className(el, bound(value, attrCheck(el, "class", null), el, "attr", "class"));
}
/** Compiler ABI `_attrWrite` (per binding run): unsafe URLs warn once naming the component; re-runs report. */
export function _attrWrite(el: Element, name: string, value: unknown): void {
  const checked = attrCheck(el, name, getOwner())(value);
  wrote(devtoolsHook(), el, "attr", name);
  dom._attrWrite(el, name, checked);
}
/** Compiler ABI `_attrValue` (value or accessor, full attribute semantics). */
export function _attrValue(el: Element, name: string, value: unknown): void {
  dom._attrValue(el, name, bound(value, attrCheck(el, name, getOwner()), el, "attr", name));
}
/** Compiler ABI `_attrSet` (plain attribute, per binding run): re-runs report. */
export function _attrSet(el: Element, name: string, value: unknown): void {
  wrote(devtoolsHook(), el, "attr", name);
  dom._attrSet(el, name, value);
}
/** Compiler ABI `_setAttr` (plain attribute, value or accessor). */
export function _setAttr(el: Element, name: string, value: unknown): void {
  dom._setAttr(
    el,
    name,
    bound(value, (v) => v, el, "attr", name),
  );
}
/** Compiler ABI `_rcdata`: dynamic parts report their re-runs. */
export function _rcdata(
  target: HTMLTextAreaElement | HTMLTitleElement | SVGTitleElement,
  parts: readonly (string | (() => string | number | bigint | boolean | null | undefined))[],
): void {
  const hook = devtoolsHook();
  dom._rcdata(
    target,
    hook === undefined || hook.level < 1 ? parts : parts.map((part) => (typeof part === "function" ? reported(hook, part, target, "text", null) : part)),
  );
}
/** Compiler ABI `_spread`: URL keys warn like `_attrWrite` (dom-v2-spread.ts neutralizes them). */
export function _spread(
  el: Element,
  value: object | (() => object | null | undefined) | null | undefined,
  flags?: number,
  rendered?: string | null,
  exclude?: string,
): void {
  const check = urlKeys(el, getOwner());
  // `flags & 2` (an uncopied object that may hold live getters): checked when read, like a thunk's result.
  // `rendered` (resumed spread: the server's names / class baseline) passes through.
  if (typeof value === "function" || (flags ?? 0) & 2)
    dom._spread(
      el,
      () => check(typeof value === "function" ? (value as () => object | null | undefined)() : value) as object | null | undefined,
      flags,
      rendered,
      exclude,
    );
  else dom._spread(el, check(value) as object | null | undefined, flags, rendered, exclude);
}
/** Compiler ABI `_attrs` (explicit attributes after a spread): URL values warn like `_attrWrite`, accessors checked when read. */
export function _attrs(el: Element, value: unknown[] | (() => unknown[]), names: string): void {
  const owner = getOwner(),
    checks = names.split(" ").map((name) => attrCheck(el, name, owner));
  const checked = (values: unknown[]): unknown[] => values.map((v, i) => (typeof v === "function" ? () => checks[i]!((v as () => unknown)()) : checks[i]!(v)));
  dom._attrs(el, typeof value === "function" ? () => checked((value as () => unknown[])()) : checked(value), names);
}
