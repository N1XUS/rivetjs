// `@rivetjs/runtime/dom`: client entry. `mount` / `render`, structural components and the compiler's DOM ABI
// (re-exported from `dom-v2.ts`, the only DOM lowering). Components return DOM values — nodes, arrays and
// accessors an insertion (`_insert`) reconciles — and own nothing: what they create belongs to the nearest
// reactive scope (spec docs/design/specs/2026-10-06-dom-v2-only-design.md).
import { createRoot, effect, onCleanup, getOwner, runWithOwner, untrack, signal, provide, _scoped, _dispatch, computed } from "@rivetjs/reactivity";
import { _constructionDoc, _root } from "./dom-base.ts";
import { _adoption, _anchor, _c, _for, _insert, _match, _show, _spread, _switch } from "./dom-v2.ts";
import { LAZY_ROWS } from "./lazy-rows.ts";
import { _restProps } from "./props.ts";
import type { Slot } from "./slot.ts";
// Pinned branded function: see slot.ts.
let slotPin: { [key: symbol]: 1 } | null = null;
/**
 * Compiler ABI (DOM target): brand a lazy-children thunk. Defined here, not re-exported from
 * `slot.ts`, so compiled modules reach it through this entry and rolldown keeps it in the dom
 * chunk (a re-export would still split `slot.ts` into its own 100 B request). Same brand as
 * `slot.ts` (`Symbol.for`), which stays the server / `.ts` entry (`isSlot`, `renderSlot`).
 */
export function _slot<T>(fn: () => T): Slot<T> {
  if (slotPin === null) (slotPin = (() => {}) as unknown as { [key: symbol]: 1 })[Symbol.for("rivet.slot")] = 1;
  (fn as unknown as { [key: symbol]: 1 })[Symbol.for("rivet.slot")] = 1;
  return fn as Slot<T>;
}
import type { Context, Disposer, Owner, Signal } from "@rivetjs/reactivity";
import type { CompiledElement, Ref } from "./jsx-runtime.ts";
export type { Ref, RefProp } from "./jsx-runtime.ts";
import type { AsyncContext } from "./async.ts";
import type { LazyFunction } from "./lazy.ts";

/** A DOM child value: nodes (raw nodes transfer placement, not unrelated owners), text, arrays, accessors. Promises require an `Async` boundary. */
export type DOMValue = Node | CompiledElement | string | number | bigint | boolean | null | undefined | readonly DOMValue[] | (() => DOMValue);
export type Component<P> = (props: P) => DOMValue;
/** Explicit captured ownership and context. Calls reject after generation disposal. */
export interface AsyncWork extends AsyncContext {
  readonly signal: AbortSignal;
}
export interface LazyComponentOptions {
  fallback?: () => DOMValue;
  error?: (error: unknown) => DOMValue;
}
export interface ClientOnlyOptions<P> {
  fallback?: (props: P) => DOMValue;
  error?: (error: unknown) => DOMValue;
  /** Resumed pages: when the browser mounts it (default `visible`). Client-rendered: on render. */
  when?: ClientWhen;
}
/** When browser-only work starts on a resumed page (CSR runs after mount). */
export type ClientWhen = "load" | "visible" | "idle" | "interaction" | `media:${string}`;

const HTML = "http://www.w3.org/1999/xhtml",
  SVG = "http://www.w3.org/2000/svg",
  MATH = "http://www.w3.org/1998/Math/MathML";
export { _booleans, _constructionDoc, _setProp, _writeDefault } from "./dom-base.ts";
/** Mount compiled output: run `factory` in a new root and append its value to `container`. The disposer disposes the root and removes the appended nodes. */
export function mount(factory: () => DOMValue, container: Element | DocumentFragment): Disposer {
  return attach(factory, container, "mount");
}
/** `mount` under its DOM v2 name. */
export function render(factory: () => unknown, container: Element | DocumentFragment): Disposer {
  return attach(factory, container, "render");
}
function attach(factory: () => unknown, container: Element | DocumentFragment, name: string): Disposer {
  const doc = container?.ownerDocument;
  if (!doc || ![1, 11].includes(container.nodeType)) throw TypeError(`${name} requires an Element or DocumentFragment`);
  const before = container.lastChild,
    previousRoot = _root.c;
  let root: { value: unknown; dispose: Disposer } | undefined;
  const remove = () => {
    if (!before && container.firstChild) {
      container.textContent = "";
      return;
    }
    for (let node = before ? before.nextSibling : container.firstChild; node;) {
      const next = node.nextSibling;
      container.removeChild(node);
      node = next;
    }
  };
  _root.c = container;
  try {
    root = createRoot(() => _insert(container as Element, factory()));
  } catch (error) {
    try {
      root?.dispose();
    } catch {}
    remove();
    throw error;
  } finally {
    _root.c = previousRoot;
  }
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    try {
      root!.dispose();
    } finally {
      remove();
    }
  };
}

// Trusted Types: template HTML is compiler output (static markup with escaped text), the one HTML
// sink the runtime writes. Pages enforcing `require-trusted-types-for 'script'` allow policy "rivet".
// The policy stays private (SEC2): its TrustedHTML only ever lands in a fresh inert `<template>`, so no
// export mints values for other sinks (`srcdoc`, `document.write`, `innerHTML`). A second runtime
// instance (dev cache-buster, two bundles) shares the first one's writer through a `Symbol.for` brand,
// since CSP `trusted-types` without 'allow-duplicates' refuses a second "rivet" policy.
type HTMLWriter = (t: HTMLTemplateElement, html: string) => void;
const HTML_WRITER = Symbol.for("rivet.html");
let writeHTML: HTMLWriter | undefined;
const htmlWriter = (): HTMLWriter => {
  const g = globalThis as { [HTML_WRITER]?: HTMLWriter; trustedTypes?: { createPolicy(name: string, rules: object): { createHTML(html: string): string } } };
  let writer = g[HTML_WRITER];
  if (!writer) {
    let policy: { createHTML(html: string): string } | undefined;
    try {
      policy = g.trustedTypes?.createPolicy("rivet", { createHTML: (value: string) => value });
    } catch {
      // Not allowed by the page's CSP: plain strings (the sink then reports the violation).
    }
    writer = policy ? (t, html) => void (t.innerHTML = policy.createHTML(html)) : (t, html) => void (t.innerHTML = html);
    Object.defineProperty(g, HTML_WRITER, { value: writer });
  }
  return writer;
};
/** @internal Template markup parsed into the content of a new inert `<template>` of `doc`. */
export const _parseHTML = (doc: Document, html: string): DocumentFragment => {
  const t = doc.createElement("template");
  (writeHTML ??= htmlWriter())(t, html);
  return t.content;
};

/**
 * @internal A structural component's output: content inserted between two empty Text anchors (the `_for`
 * inserted-row technique), built detached in a fragment under its own root. Its nodes are collected when an
 * insertion reads it (`nodes`), so updates inside it need no re-read; disposal removes them.
 */
export interface Output {
  start: Text;
  end: Text;
  dispose: Disposer;
}
function output(doc: Document, fn: () => unknown): Output {
  return createRoot((dispose) => {
    // Adopt run (LAZY-ROWS T5 builds): the anchors are the server's nodes, already in place.
    const start = _anchor(doc),
      end = _anchor(doc),
      out = { start, end, dispose };
    if (!LAZY_ROWS || start.parentNode === null) doc.createDocumentFragment().append(start, end);
    onCleanup(() => park(out, null));
    _insert(null, fn(), end);
    return out;
  }).value;
}
/** The output's nodes, anchors included, in document order. */
function nodes(out: Output): Node[] {
  const list: Node[] = [];
  for (let node: Node | null = out.start; node !== null; node = node === out.end ? null : node.nextSibling) list.push(node);
  return list;
}
/** Move the output's nodes into `into` (detached, still live), or remove them (null). */
function park(out: Output, into: DocumentFragment | null): void {
  for (const node of nodes(out))
    if (into) into.appendChild(node);
    else (node as ChildNode).remove();
}
/** @internal Output primitives for dom-suspense.ts. */
export const _dom = { output, nodes, park };

/**
 * Explicit deferred context boundary; value is a snapshot. Plain content (nodes / scalars / arrays of them)
 * is returned as is (no markers), so nested providers do not re-stage their subtree. Content holding
 * accessors is bound right here in an output under the provide owner: eager, in construction order (cdk
 * Autocomplete / TagGroup: the collection's items bind before the siblings after the provider read them),
 * and every later read sees the value.
 */
export function Provider<T>(props: { token: Context<T>; value: T; children: DOMValue }): DOMValue {
  const doc = _constructionDoc();
  return provide(props.token, props.value, () => {
    const value = typeof props.children === "function" ? (props.children as () => DOMValue)() : props.children;
    return dynamic(value) ? nodes(output(doc, () => value)) : value;
  });
}
const dynamic = (value: unknown): boolean => typeof value === "function" || (Array.isArray(value) && value.some(dynamic));

/** `Async` props. */
export interface AsyncProps<T> {
  load: (work: AsyncWork) => T | PromiseLike<T>;
  children: (value: T) => DOMValue;
  fallback?: () => DOMValue;
  error?: (error: unknown) => DOMValue;
  /** Keep committed output mounted and live until the next generation commits (no fallback after the first commit). */
  hold?: boolean;
  /** Wraps each non-fallback commit: `apply()` (now or later) swaps in `next`, the detached output. */
  swap?: (apply: () => void, next: ParentNode) => void;
}
export { Suspense, startTransition, useTransition } from "./dom-suspense.ts";
export { resource } from "./dom-resource.ts";
export type { Resource, ResourceFetcher, ResourceInfo, ResourceOptions, ResourceSource, ResourceState } from "./dom-resource.ts";

export { Async, ErrorBoundary, lazyComponent, clientOnly } from "./dom-async.ts";

// A listener can fire while its owner is mid-disposal (removing a focused control fires focusout
// before the owner's cleanups detach it); events reaching a disposed owner are dropped.
const live = (owner: Owner | null): boolean => !(owner as unknown as { disposed?: boolean } | null)?.disposed;
// Resume chunk-grouping boundary (`resume.chunks: "group"`): renders its children unchanged.
export const ChunkGroup: (props: { name?: string; preload?: "eager" | "idle" | "visible" | "intent" | "interaction"; children?: DOMValue }) => DOMValue = (
  props,
) => props.children;

/**
 * Keyed list: one row per key (`by`), created once and kept while its key is present; a row's item
 * updates in place when its key keeps a different item; `index` exists when `children` declares it.
 * The compiler lowers `<For>` to the same function (`_for`).
 */
export const For: <T, K>(props: {
  each: readonly T[] | (() => readonly T[]);
  by: (item: T, index: number) => K;
  children: (item: () => T, index: () => number) => DOMValue;
}) => DOMValue = _for as never;
/** Branch content: a function (lazy; gets the value accessor) or eager content (created once, kept). */
type BranchContent<T> = Exclude<DOMValue, () => DOMValue> | ((value: () => NonNullable<T>) => DOMValue);
/**
 * Render `children` while `when` (a value — live props: `when={c()}` — or an accessor) is truthy, else `fallback`. The condition is memoized by truthiness:
 * the branch is created once and kept while truthy. `keyed`: re-created when the value identity changes.
 * Function children are lazy and get the value accessor; eager content is created once and kept.
 */
export const Show: <T>(props: {
  when: T | (() => T);
  keyed?: boolean;
  fallback?: BranchContent<T> | (() => DOMValue);
  children?: BranchContent<T>;
}) => DOMValue = _show as never;
/** One case of a Switch; renders nothing elsewhere. */
export interface MatchProps<T> {
  when: T | (() => T);
  keyed?: boolean;
  children?: BranchContent<T>;
}
/** A Switch case: read by the enclosing Switch (a marker node elsewhere). */
export const Match: <T>(props: MatchProps<T>) => DOMValue = _match as never;
/** Render the first Match whose `when()` is truthy, else `fallback`; re-created only when the matched index changes. */
export const Switch: (props: { fallback?: DOMValue; children?: DOMValue }) => DOMValue = _switch as never;

// Dynamic tags: one element name, no raw-text / RCDATA / document-level / embedding elements. Same rule as
// the server (server-structural.ts).
const UNSAFE_TAG =
    /^(script|style|template|textarea|title|i?frame|frameset|object|embed|no(script|embed|frames)|plaintext|xmp|base|meta|link|html|head|body)$/i,
  VOID_TAG = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;
/** Props of `Dynamic`: `component` (a component function or tag name) plus the props passed through. */
export type DynamicProps<P> = { component: Component<P> | string } & Record<string, unknown>;
/**
 * Render a component function (called with the remaining props) or an intrinsic tag (remaining props are
 * attributes, as a spread: a function value is an accessor; `onX` functions are listeners; `style` an
 * object; `ref` gets the element; `children` its content). Props are live: a `component` getter (a compiled
 * `component={c()}`) re-creates the content when its value changes (previous one disposed); the forwarded
 * props stay getters (component props / spread attributes update in place).
 */
export function Dynamic<P>(props: DynamicProps<P>): DOMValue {
  const rest = _restProps(props, COMPONENT) as Record<string, unknown>,
    own = Object.getOwnPropertyDescriptor(props, "component");
  // A plain `component` value (static `component={X}`) renders once, as before.
  if (!own?.get) return dynamicContent(props.component, rest);
  const type = computed(() => props.component);
  return _scoped(() => {
    const value = type();
    return untrack(() => dynamicContent(value, rest));
  }) as DOMValue;
}
const COMPONENT = ["component"];
function dynamicContent(type: unknown, rest: Record<string, unknown>): DOMValue {
  if (typeof type === "function") return _c(type as (props: unknown) => DOMValue, rest) as DOMValue;
  if (typeof type !== "string" || !/^[A-Za-z][A-Za-z0-9]*(-[\w.-]+)*$/.test(type) || UNSAFE_TAG.test(type)) throw TypeError("Unsafe dynamic tag");
  if (rest.children != null && VOID_TAG.test(type)) throw TypeError("Void element has no children");
  const doc = _constructionDoc(),
    ns = type === "svg" ? SVG : type === "math" ? MATH : HTML;
  let element = doc.createElementNS(ns, ns === HTML ? type.toLowerCase() : type);
  // A tag HTML does not know: an SVG child, else MathML.
  if (String(element) === "[object HTMLUnknownElement]") element = doc.createElementNS(SVG, type);
  if (String(element) === "[object SVGElement]" && ns === HTML) element = doc.createElementNS(MATH, type);
  if (LAZY_ROWS && _adoption.node) element = _adoption.node(element, 0);
  // The forwarding object itself (flag 2: getters read inside the spread effect), `children` as content (flag 1), `ref` bound once.
  _spread(element, rest, 3);
  return element;
}

/**
 * Render `children` into `mount` (default `document.body`), inside a `<div data-rivet-portal>` it owns
 * and removes on cleanup; renders nothing in place. Server: nothing (portal content is browser-only;
 * in a resumed page put it behind a signal, e.g. `<Show when={open}>`, so its region is created in the
 * browser). Overlays usually need none: `popover` / `<dialog>` render in the top layer in place.
 */
export function Portal(props: { mount?: Element | null; children?: DOMValue }): DOMValue {
  const doc = _constructionDoc(),
    host = doc.createElement("div");
  host.setAttribute("data-rivet-portal", "");
  _insert(host, props.children, null);
  (props.mount ?? doc.body).append(host);
  onCleanup(() => host.remove());
  return null;
}

export { Router, defineRoute } from "./dom-router.ts";
/** @internal Static SVG shapes (`[tag, attrs][]`, kit `Icon`) cloned from a per-data template; twin of `/server` `_svgShapes`. */
export { _svgShapes } from "./dom-svg.ts";
export {
  _tpl,
  _tplNs,
  _c,
  _cp,
  _className,
  _textValue,
  _attrValue,
  _setAttr,
  _on,
  _listen,
  _insert,
  _for,
  _show,
  _switch,
  _match,
  _fx,
  _fx1,
  _cls,
  _t,
  _tx,
  _attrSet,
  _attrWrite,
  _spread,
  _attrs,
  _ref,
  _scoped,
  _cond,
} from "./dom-v2.ts";
export { _model, _select, _rcdata, _resumeSelect } from "./dom-v2-controls.ts";
/**
 * An element ref for `ref={r}`: `r()` is the attached element (undefined before). It is a signal, so a
 * `clientEffect` reading it re-runs when an element attaches (resume revives it as one, holding the
 * server-rendered element). Forward it as a prop like any value.
 */
export const ref = <T extends Element = HTMLElement>(): Ref<T> => signal<T | undefined>(undefined) as unknown as Ref<T>;
/** Hand the native element to its ref callback, or set a `ref()` signal, during setup. */
export function bindRef(target: Element, fn: ((element: Element) => void) | null | undefined): void {
  if (fn == null) return;
  if (typeof fn !== "function") throw TypeError("ref must be a function");
  const ref = fn as Partial<Signal<Element | undefined>> & (() => Element | undefined);
  if (!ref.set) return fn(target);
  ref.set(target);
  // Unmount: back to undefined, unless a newer element took the ref meanwhile.
  onCleanup(() => untrack(ref) === target && ref.set!(undefined));
}
const passiveTypes = new Set(["scroll", "wheel", "touchstart", "touchmove", "touchend", "pointermove", "resize"]);
/** Run browser-only work after the current mount as an owned effect; a returned function is its cleanup. */
/**
 * A value built where it is used: lazy (first read), reactive (a factory reading signals re-runs; `onCleanup` inside it
 * disposes the previous value). On a resumed page the factory runs in the browser on first read, under the server's
 * context providers — for resource holders (sockets, library objects) that must not be serialized. Not `clientOnly`:
 * the server runs the factory too when it renders a read. Function Bridge T26 (Q3); resume sites: compiler C14 (T27).
 */
export function reconstruct<T>(factory: () => T): () => T {
  return computed(factory, { equals: false });
}

export function clientEffect(fn: () => void | (() => void) | Promise<unknown>, _options?: { when?: ClientWhen }): void {
  if (typeof fn !== "function") throw TypeError("clientEffect requires a function");
  const owner = getOwner();
  if (!owner) throw Error("clientEffect requires a live owner");
  let disposed = false;
  runWithOwner(owner, () => onCleanup(() => (disposed = true)));
  queueMicrotask(() => {
    if (disposed) return;
    runWithOwner(owner, () =>
      effect(() => {
        const cleanup = fn();
        if (typeof cleanup === "function") onCleanup(cleanup);
      }),
    );
  });
}
/** @internal `clientEvent` `match`: the event's target is inside an element matching `selector`. */
const _matches = (event: Event, selector: string): boolean => !!(event.target as Element | null)?.closest?.(selector);
/**
 * Owned listener on window, document, an element or a "media:(query)" match; handler runs in a batch.
 * `standalone: false` (resumed pages): the listener alone does not make a server-rendered page resumable — a page
 * with nothing else to resume ships no JavaScript and the listener never attaches (the router's link listeners unless
 * `rivetRouter({ clientRouter: true })`).
 * `match` (a CSS selector): the handler runs only for events whose target is inside a matching element
 * (`target.closest(match)`); on resumed pages its chunk loads only then — the router's document link listeners
 * (`"a"`) load no router code for a click or hover elsewhere. With `once`, the first matching event removes the
 * listener. A `media:` target has no element target: `match` never matches there (leave it out). Development builds
 * validate the selector at registration (`SyntaxError`; dev façade + resume runtime).
 */
export function clientEvent<E extends Event = Event>(
  target: Window | Document | Element | `media:${string}`,
  type: string,
  handler: (event: E) => void,
  options?: {
    when?: ClientWhen;
    passive?: boolean;
    capture?: boolean;
    once?: boolean;
    preload?: "eager" | "idle" | "visible" | "intent" | "interaction";
    standalone?: boolean;
    match?: string;
  },
): void;
export function clientEvent<E extends Event = Event>(
  target: Window | Document | Element | `media:${string}` | MediaQueryList,
  type: string,
  handler: (event: E) => void,
  options: {
    when?: ClientWhen;
    passive?: boolean;
    capture?: boolean;
    once?: boolean;
    preload?: "eager" | "idle" | "visible" | "intent" | "interaction";
    standalone?: boolean;
    match?: string;
  } = {},
): void {
  if (typeof handler !== "function") throw TypeError("clientEvent requires a handler function");
  const owner = getOwner();
  if (typeof target === "string") {
    if (!target.startsWith("media:")) throw TypeError('clientEvent string targets must be "media:(query)"');
    target = matchMedia(target.slice(6));
    type = "change";
  } else if (!target || typeof target.addEventListener !== "function") throw TypeError("Invalid clientEvent target");
  const match = options.match;
  // `once` with `match`: the first MATCHING event removes the listener (native `once` would drop it on any event).
  const once = Boolean(options.once) && !!match;
  const listen = {
    passive: options.passive ?? passiveTypes.has(type),
    capture: Boolean(options.capture),
    once: Boolean(options.once) && !match,
  };
  let active = true;
  const at = target;
  const listener = function (this: unknown, event: Event) {
    if (match && !_matches(event, match)) return;
    if (once) at.removeEventListener(type, listener, listen);
    if (active && live(owner)) _dispatch(owner, handler as (event: Event) => unknown, this, event);
  };
  target.addEventListener(type, listener, listen);
  if (owner)
    runWithOwner(owner, () =>
      onCleanup(() => {
        active = false;
        target.removeEventListener(type, listener, listen);
      }),
    );
}
