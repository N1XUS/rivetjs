// DOM v2 compiler ABI: client-created DOM without owner/range/comment bookkeeping per template or
// component. A template returns its cloned Node; bindings, components and inserted children belong to
// the nearest reactive scope (mount root, an insert effect, a list row). Static values are written
// once; only expressions that can read reactive state get an effect. Bubbling events are delegated:
// the handler lives on the node and one listener per type per document dispatches.
// Contract (docs/design/specs/2026-10-05-dom-v2.md): imperative edits to compiled DOM are not
// tracked; a removed region's nodes are removed, its owners disposed by the owning scope.
import {
  _bindingEffect,
  _deferredFlush,
  _bindingEffect1,
  _dispatch,
  _dispose,
  _rootIn,
  _scoped,
  _tracking,
  _untrack1,
  computed,
  effect,
  getOwner,
  onCleanup,
  signal,
  untrack,
} from "@rivetjs/reactivity";
import type { Owner, Signal } from "@rivetjs/reactivity";
import { INVALID_URL, MEDIA_URLS, unsafeUrl } from "./url.ts";

import { _booleans, _constructionDoc, _parseHTML, _writeDefault, bindRef } from "./dom.ts";

type Parent = Node & ParentNode;
const HTML = "http://www.w3.org/1999/xhtml",
  SVG = "http://www.w3.org/2000/svg";
const host = { doc: _constructionDoc };
// The parent the running insertion read inserts into (`within`): `_tplNs` roots take its namespace.
let insertionParent: Node | null = null;

// ---- templates ----
/**
 * Compiler ABI: hoisted template. `flags` 1 = SVG content, 2 = MathML content, 4 = fragment
 * (several roots: the clone is a DocumentFragment). Parsed once per document, cloned per call. A root
 * whose namespace depends on the insertion parent uses `_tplNs`.
 */
export function _tpl(html: string, flags = 0): () => Node {
  let doc: Document | null = null,
    node: Node | null = null;
  // Clones come from the inert template document: owning them by the live document at clone time (adopted
  // root or per-clone `adoptNode`) costs krausest 07 script +6–8%. Insertion adopts them; an element handed
  // out earlier (`_ref`) adopts its clone first. Custom elements (`<x-y>`, `is=`) upgrade only when created
  // in a live document (`prop:` must hit their setters): those templates — and fragments, whose roots
  // `appendChild` adopted — clone a live root.
  const live = flags & 4 || /<[a-z][^\s/>]*-|\sis=/i.test(html);
  const parse = (d: Document): Node => {
    let content: Node = _parseHTML(d, flags & 1 ? "<svg>" + html + "</svg>" : flags & 2 ? "<math>" + html + "</math>" : html);
    if (flags & 3) content = content.firstChild!;
    if (flags & 4) {
      const f = d.createDocumentFragment();
      while (content.firstChild) f.appendChild(content.firstChild);
      return f;
    }
    return live ? d.adoptNode(content.firstChild!) : content.firstChild!;
  };
  return (): Node => {
    let d: Document;
    try {
      d = host.doc();
    } catch {
      // No mount container / construction document and no global `document` (DOM JSX run on a server).
      throw Error("Construct DOM inside mount(): no document");
    }
    if (d !== doc) {
      doc = d;
      node = parse(d);
    }
    return node!.cloneNode(true);
  };
}
/**
 * Compiler ABI (B3, spec Q10): a template whose root HTML shares with SVG (`<a>` / `<title>` / … returned
 * by a component, no lexical namespace): cloned as SVG when the running insertion's parent is SVG content
 * (`within`, not `foreignObject`), else as HTML. Its own export, so `_tpl` carries no namespace pick.
 */
export function _tplNs(html: string): () => Node {
  const htmlClone = _tpl(html),
    svgClone = _tpl(html, 1);
  return () => {
    const p = insertionParent as Element | null;
    return p !== null && p.namespaceURI === SVG && p.localName !== "foreignObject" ? svgClone() : htmlClone();
  };
}

// ---- components ----
/** Compiler ABI: a component is an untracked call under the current owner. */
// `_untrack1` itself (no forwarding frame: one stack frame less per nested component level).
export const _c: <P>(fn: (props: P) => unknown, props: P) => unknown = _untrack1;

/** Compiler ABI: a component whose props can read reactive state: props are an untracked snapshot. */
export function _cp<P>(fn: (props: P) => unknown, props: () => P): unknown {
  return untrack(() => fn(props()));
}

// ---- text ----
const unsupported = (): never => {
  throw TypeError("Unsupported DOM child value");
};
const coerce = (v: unknown): string => (v == null || typeof v === "boolean" ? "" : typeof v === "symbol" ? unsupported() : String(v));
/**
 * Compiler ABI: write a sole dynamic child from a binding, `_fx(() => _t(el, expr))`. Scalars take
 * the text path (the template holds no placeholder: the first write sets `textContent`, later writes
 * update that Text node's data, compared against the last written string rather than read back).
 * The first non-scalar value (node, array) switches the binding to `_insert` semantics for
 * good. The binding's state (last string, or its slot) lives on the element (`$$t`), so a binding
 * costs one effect and one closure.
 */
export function _t(el: Element, value: unknown): void {
  const last = (el as unknown as { $$t?: string | Slot }).$$t;
  if (typeof last !== "object") {
    if (typeof value === "string" || value == null || (typeof value !== "object" && typeof value !== "function")) {
      const next = typeof value === "string" ? value : coerce(value);
      if (next === last) return;
      const node = last === undefined ? null : el.firstChild;
      if (node !== null) (node as Text).data = next;
      else el.textContent = next;
      (el as unknown as { $$t?: string }).$$t = next;
      return;
    }
    el.textContent = "";
  }
  let slot = last as Slot | undefined;
  if (typeof slot !== "object")
    (el as unknown as { $$t?: Slot }).$$t = slot = { current: null };
  // An accessor (component content such as a `<For>`), or an array holding one: read in its own effect,
  // so the caller's binding does not track it and re-create the content (components, focused nodes)
  // on each of its updates (Solid `insertExpression`).
  if (typeof value === "function" || (Array.isArray(value) && hasAccessor(value))) nested(() => el, value, slot, null);
  else assign(el, value, slot, null);
}
/**
 * Compiler ABI: a sole dynamic text child bound to its template's placeholder Text node (`<a> </a>`, the binding
 * gets `el.firstChild`), from a binding (`_fx1(fx, el.firstChild, …)`). Scalars write `data` — no element expando,
 * no compare (an effect re-runs only on a change; `_t`'s `$$t` read + write per update cost 2.7× this write). The
 * first non-scalar (node, array, accessor) switches the binding to `_insert` semantics for good, the emptied
 * placeholder as its marker (its slot on the Text node: `$$s`, only then).
 */
export function _tx(text: Text, value: unknown): void {
  let slot = (text as unknown as { $$s?: Slot }).$$s;
  if (slot === undefined) {
    if (typeof value === "string") {
      text.data = value;
      return;
    }
    if (value == null || (typeof value !== "object" && typeof value !== "function")) {
      // Numbers go to the DOM as-is (see `_textValue`).
      text.data = typeof value === "number" ? (value as unknown as string) : coerce(value);
      return;
    }
    text.data = "";
    (text as unknown as { $$s?: Slot }).$$s = slot = { current: null };
  }
  if (typeof value === "function" || (Array.isArray(value) && hasAccessor(value))) nested(() => text.parentNode as Parent, value, slot, text);
  else assign(text.parentNode as Parent, value, slot, text);
}
/** Compiler ABI: a sole-child static value: scalars written once, an accessor binds, nodes/arrays insert. */
export function _textValue(el: Element, value: unknown): void {
  if (typeof value === "function")
    _bindingEffect(() => {
      let next: unknown;
      try {
        next = (value as () => unknown)();
      } catch (error) {
        _t(el, null); // as `_insert`: a throwing read empties the element
        throw error;
      }
      _t(el, next);
    });
  else if (value !== null && typeof value === "object") _insert(el, value);
  // Numbers go to the DOM as-is: `String(n)` would fill V8's number-string cache (0 is coerced: some DOMs drop a falsy value).
  else el.textContent = typeof value === "number" && value ? (value as unknown as string) : coerce(value);
}

// ---- attributes ----
/** Write one attribute value (null/false remove, URL checks, control properties). */
function write(el: Element, name: string, value: unknown): void {
  let lower = name.toLowerCase();
  const html = el.namespaceURI === HTML;
  // `defaultValue` / `defaultChecked`: the default property; without one, the attribute it stands for (server parity).
  if (html && (lower === "defaultvalue" || lower === "defaultchecked")) {
    if (_writeDefault(el, lower, value)) return;
    name = lower = lower.slice(7);
  }
  // `popover` is enumerated: `true` is the empty keyword (`auto`), `false` removes it (server parity, C4).
  if (html && lower === "popover" && typeof value === "boolean") value = value ? "" : null;
  const
    // `hidden` is enumerated (`until-found`): a non-empty string is its keyword, written verbatim; "" omits it (server parity).
    word = lower === "hidden" && typeof value === "string",
    bool = html && _booleans.test(lower) && !(word && value);
  if (html && (lower === "value" || lower === "checked" || lower === "selected") && lower in el) {
    const next = lower === "value" ? coerce(value) : Boolean(value);
    if ((el as unknown as Record<string, unknown>)[lower] !== next) (el as unknown as Record<string, unknown>)[lower] = next;
  }
  // Boolean attributes follow truthiness (`0`, `""`, `NaN` remove them), like the server.
  if (value == null || (bool && (!value || word))) {
    if (name.startsWith("xlink:")) el.removeAttributeNS("http://www.w3.org/1999/xlink", name.slice(6));
    else el.removeAttribute(name);
    if (bool && lower in el) (el as unknown as Record<string, unknown>)[lower] = false;
    return;
  }
  let encoded = bool ? "" : String(value);
  if (unsafeUrl(lower, encoded, html && MEDIA_URLS.test(el.localName + " " + lower))) encoded = INVALID_URL;
  if (name.startsWith("xlink:")) el.setAttributeNS("http://www.w3.org/1999/xlink", name, encoded);
  else if (name.startsWith("xml:")) el.setAttributeNS("http://www.w3.org/XML/1998/namespace", name, encoded);
  else el.setAttribute(name, encoded);
  if (bool && lower in el) (el as unknown as Record<string, unknown>)[lower] = true;
}
/**
 * Compiler ABI: a plain attribute (compiler-classified: HTML/SVG name that is not boolean, URL-bearing,
 * namespaced or a form-control property). null/undefined remove; other values stringify.
 */
export function _setAttr(el: Element, name: string, value: unknown): void {
  if (typeof value === "function") _bindingEffect(() => plain(el, name, (value as () => unknown)()));
  else plain(el, name, value);
}
function plain(el: Element, name: string, value: unknown): void {
  if (value == null) el.removeAttribute(name);
  else el.setAttribute(name, value as string);
}
/**
 * Compiler ABI for dynamic attributes: the compiler emits one closure per binding,
 * `_fx(() => _cls(el, expr))`, instead of a read closure wrapped by the runtime.
 */
export const _fx: (fn: () => void) => void = _bindingEffect;
/**
 * Compiler ABI (OPT-D closure-free bindings): `_fx1(fn, a, b, c)` = `_fx(() => fn(a, b, c))` without the closure.
 * `fn` is hoisted to module scope and receives up to three captures (never-reassigned bindings: the element
 * variable and the locals the value reads), e.g. `const __rivetFx0 = (el, n, count) => _t(el, `${n}: ${count()}`)`
 * + `_fx1(__rivetFx0, _el$1, n, count)`. Same lifetime and release rule as `_fx`; tree-shaken when unused.
 */
export const _fx1: <A, B, C>(fn: (a: A, b: B, c: C) => void, a: A, b?: B, c?: C) => void = _bindingEffect1;
/** Compiler ABI: write a class value (see `_className`). */
export const _cls: (el: Element, value: unknown) => void = className;
/** Compiler ABI: write a plain attribute value (null/undefined remove it). */
export const _attrSet: (el: Element, name: string, value: unknown) => void = plain;
/** Compiler ABI: write an attribute value with full semantics (booleans, URLs, control properties). */
export const _attrWrite: (el: Element, name: string, value: unknown) => void = write;
/** Compiler ABI: an HTML element's class (null/undefined/false/"" remove it); a function binds. */
export function _className(el: Element, value: unknown): void {
  if (typeof value === "function") _bindingEffect(() => className(el, (value as () => unknown)()));
  else className(el, value);
}
function className(el: Element, value: unknown): void {
  // An empty class removes the attribute: a fresh row has none, so no write (and no style
  // invalidation) happens for it (krausest 01 / 07 / 08 +2–3% with the write).
  if (value == null || value === false || value === "") el.removeAttribute("class");
  else el.className = value as string;
}
/** Compiler ABI: an identifier-only attribute value: written once unless it is an accessor. */
export function _attrValue(el: Element, name: string, value: unknown): void {
  if (typeof value === "function") _bindingEffect(() => write(el, name, (value as () => unknown)()));
  else write(el, name, value);
}

// ---- events (delegated) ----
const delegated = new WeakMap<Document, Set<string>>();
// The last registered type's key and the last document's delegated types: consecutive handlers of one type skip the
// key lookup, every handler of one document the WeakMap lookup.
let lastDoc: Document | null = null,
  lastTypes: Set<string> | null = null,
  lastType = "",
  lastKey = "";
// `"$$" + type` per delegated type, made once: a fresh concatenation per bind is a new string the keyed store must
// internalize (an element with several delegated types — cdk parts bind 5 — alternates types on every bind).
const KEYS: Record<string, string> = Object.create(null);
type Handlers = Record<string, ((event: Event) => unknown) | undefined>;
// Events whose delegated handlers ran early, up to (excluding) a path index (`_delegateBelow`); -1: propagation stopped.
const ranTo = new WeakMap<Event, number>();
function dispatch(event: Event): void {
  delegate(event, null);
}
// Shadow roots seen on delegated paths → their delegated types. An event whose target and `relatedTarget` (pointer
// over / out, focus in / out) sit in one shadow tree never reaches the document; once a delegated event of a type
// crossed a shadow root, that root gets its own listener running the handlers inside it (`delegate(event, root)`,
// the document listener continues above it), so moves within the tree dispatch too.
const shadowTypes = new WeakMap<ShadowRoot, Set<string>>();
function shadowDispatch(this: ShadowRoot, event: Event): void {
  // Already run past this root (resumed `_delegateBelow` up to an ancestor outside it): nothing below is left.
  const done = ranTo.get(event);
  if (done !== undefined && (done === -1 || event.composedPath().indexOf(this) < done)) return;
  delegate(event, this);
}
function watchShadow(root: ShadowRoot, type: string): void {
  let types = shadowTypes.get(root);
  if (!types) shadowTypes.set(root, (types = new Set()));
  if (types.has(type)) return;
  types.add(type);
  root.addEventListener(type, shadowDispatch);
}
/**
 * Resume (dom-resume `dispatch`): run the delegated handlers of the nodes below `stop` on the event's path first, so a
 * client-rendered row's handler runs before its resumed (server-rendered) ancestor's, as native bubbling orders them;
 * the resumed handlers run from the loader's document capture listener, ahead of this module's bubble listener. True
 * when a handler stopped propagation (the ancestor's handler must not run).
 */
export function _delegateBelow(event: Event, stop: Element): boolean {
  if (!event.bubbles || !delegated.get(stop.ownerDocument)?.has(event.type)) return false;
  return delegate(event, stop);
}
function delegate(event: Event, stop: Node | null): boolean {
  const done = ranTo.get(event);
  if (done === -1) return true;
  const key = "$$" + event.type,
    // The propagation path the browser fixed when the dispatch started (as native listeners see it): a
    // handler that re-renders its node or an ancestor (state flushed after each handler) does not cut
    // the bubbling short. `parentNode` walk only where `composedPath` is missing.
    path = event.composedPath ? event.composedPath() : null;
  if (stop && !path) return false;
  let i = done ?? 0,
    node = (path ? path[i] : event.target) as (Node & Handlers) | null | undefined,
    emulated = false,
    stopped = false;
  while (node) {
    if ((node as Node) === stop) {
      ranTo.set(event, i);
      break;
    }
    // A shadow root on the path (DOCUMENT_FRAGMENT_NODE with a host): delegate inside it from now on.
    if ((node as Node).nodeType === 11 && (node as unknown as ShadowRoot).host) watchShadow(node as unknown as ShadowRoot, event.type);
    const handler = node[key];
    // No `disabled` skip (dom-expressions has one): a native listener on a disabled control still sees
    // the events the browser dispatches to it (Chromium: pointer events, synthetic events; no mouse
    // events / click), so the delegated handler runs exactly when a native `addEventListener` would.
    if (handler) {
      const target = node;
      // currentTarget follows the handler's node, as with a direct listener. A data property: an
      // accessor closure would be pinned by V8's map descriptors and retain the event path.
      Object.defineProperty(event, "currentTarget", { configurable: true, value: target });
      emulated = true;
      // Under the owner that bound it (context lookups); skipped once that owner is disposed.
      _dispatch((target as unknown as { $$o: Owner | null }).$$o, handler, target, event);
      // Propagation stopped below the document: natively no document / window listener would run, so the
      // ones registered after this dispatcher (react-aria-style global pointerup listeners) are skipped too.
      if (event.cancelBubble) {
        // Early run (`stop`): the loader stops the resumed handlers; this module's own listener skips the event.
        if (stop) ranTo.set(event, -1);
        else event.stopImmediatePropagation();
        stopped = true;
        break;
      }
    }
    node = (path ? path[++i] : node.parentNode || (node as unknown as ShadowRoot).host || null) as (Node & Handlers) | null | undefined;
  }
  // `stop` not on the path: every handler ran.
  if (stop && !node) ranTo.set(event, i);
  // Later document / window listeners see the real currentTarget (the document) again.
  if (emulated) delete (event as unknown as { currentTarget?: unknown }).currentTarget;
  return stopped;
}
/** A handler value: a function, or undefined for null / undefined (anything else throws). */
function checked(handler: unknown): ((event: Event) => unknown) | undefined {
  if (typeof handler === "function") return handler as (event: Event) => unknown;
  if (handler != null) throw TypeError("Event handler must be a function, null or undefined");
  return undefined;
}
/** Compiler ABI: a delegated bubbling event handler (`type` is a bubbling event). */
export function _on(el: Element, type: string, handler: ((event: Event) => unknown) | null | undefined): void {
  // The last type's key string is reused: a fresh `"$$" + type` per call is a new string the keyed store must
  // internalize first (krausest create10k script overhead −8%); other types come from `KEYS`.
  let key = lastKey;
  const same = type === lastType;
  if (!same) {
    key = KEYS[type] ??= "$$" + type;
    lastType = type;
    lastKey = key;
  }
  (el as unknown as Handlers)[key] = checked(handler);
  (el as unknown as { $$o: Owner | null }).$$o = getOwner();
  const doc = host.doc();
  // (lastDoc, lastType) is always registered after a call: the same type on the same document skips the Set.
  if (same && doc === lastDoc) return;
  let types = lastTypes;
  if (doc !== lastDoc) {
    types = delegated.get(doc) ?? null;
    if (!types) delegated.set(doc, (types = new Set()));
    lastDoc = doc;
    lastTypes = types;
  }
  if (!types!.has(type)) {
    types!.add(type);
    doc.addEventListener(type, dispatch);
  }
}
/** Compiler ABI: a direct (non-bubbling / capture) listener, removed with the owner. */
export function _listen(el: Element, type: string, handler: ((event: Event) => unknown) | null | undefined, options?: AddEventListenerOptions): void {
  // An unset handler prop (`onFocus={props.onFocus}`) binds nothing (B1).
  const fn = checked(handler);
  if (fn === undefined) return;
  const owner = getOwner(),
    listener = (event: Event) => _dispatch(owner, fn, el, event);
  el.addEventListener(type, listener, options);
  onCleanup(() => el.removeEventListener(type, listener, options));
}

// ---- children ----
/**
 * Compiler ABI: a dynamic fragment child (`<>a{x()}</>` → `[a, _scoped(() => x())]`). The insertion that
 * reads it runs later, outside the scope the fragment was built in (`provide(Ctx, v, () => <>…</>)`
 * returns before the read): each read runs in a fresh child scope of the creation owner (reactivity
 * `_scoped`) — context lookups see the providers around the fragment.
 */
export { _scoped };

type Current = Node | Node[] | null;
interface Slot {
  current: Current;
}
/**
 * Compiler ABI: insert a child value before `marker` (null: append). A function is an accessor:
 * the insertion re-runs when it changes. Arrays reconcile by node identity.
 */
export function _insert(parent: Parent | null, value: unknown, marker: Node | null = null, seed: Node[] | null = null): void {
  // `seed` (resume, `dom-adopt.ts` `_region`): the server nodes already in place; the first write reconciles them.
  const slot: Slot = { current: seed };
  // Arrays holding accessors (fragments with dynamic children) track like an accessor.
  if (typeof value !== "function" && !(Array.isArray(value) && hasAccessor(value))) {
    assign(parent ?? (marker!.parentNode as Parent), value, slot, marker);
    return;
  }
  // A null parent follows the marker (a list row's anchors move between parents).
  const at = (): Parent => parent ?? (marker!.parentNode as Parent);
  if (typeof value !== "function") return nested(at, value, slot, marker);
  _bindingEffect(() => {
    const target = at();
    let read: unknown;
    try {
      read = within(target, value as () => unknown);
      if (typeof read !== "function" && !(Array.isArray(read) && hasAccessor(read))) return assign(target, read, slot, marker);
    } catch (error) {
      // A read that throws leaves the slot empty: stale content would look current.
      assign(target, null, slot, marker);
      throw error;
    }
    // An accessor returned by the read (a component's `<For>` / `<Show>`), or an array holding one (a slot's
    // `[() => cond ? <a/> : null, <div/>]`): bound in a nested effect, so its updates do not re-run this
    // read — re-creating the component and its nodes (Solid `insertExpression` / `normalizeIncomingArray`).
    nested(at, read, slot, marker);
  });
}
/**
 * Bind `value` — an accessor, or an array holding accessors (each read in its own cell, see `cells`) — in
 * its own effect under the current scope. A throwing read empties the slot, then rethrows.
 */
function nested(at: () => Parent, value: unknown, slot: Slot, marker: Node | null): void {
  const read = Array.isArray(value) ? cells(value, at) : value;
  _bindingEffect(() => {
    try {
      assign(at(), read, slot, marker);
    } catch (error) {
      assign(at(), null, slot, marker);
      throw error;
    }
  });
}
/** Run an insertion read with `parent` as the insertion parent: `_tplNs` roots it builds take its namespace (`<title>` under an `<svg>`, G4). */
function within<T>(parent: Node, fn: () => T): T {
  const outer = insertionParent;
  insertionParent = parent;
  try {
    return fn();
  } finally {
    insertionParent = outer;
  }
}

/**
 * An array holding accessors (fragment / lazy children `[() => cond ? <a/> : null, <b/>]`) with each
 * accessor read in its own binding (owned by the caller's scope) into a signal: the array's binding
 * re-reads every item, and an item re-runs only on its own reads — a sibling's update keeps its nodes
 * A throwing item empties only itself, then rethrows.
 */
function cells(value: readonly unknown[], at: () => Parent): unknown[] {
  return value.map((item) => {
    if (Array.isArray(item)) return hasAccessor(item) ? cells(item, at) : item;
    if (typeof item !== "function") return item;
    // The first run seeds the cell's signal instead of writing it: creating the binding writes nothing, so
    // content rendered under a `computed` (a collection build pass, cdk `buildCollectionFrom`) may hold cells.
    let out: Signal<unknown> | null = null,
      first: unknown = null;
    const put = (value: unknown): void => void (out === null ? (first = value) : out.set(value));
    _bindingEffect(() => {
      try {
        const read = within(at(), item as () => unknown);
        // An accessor (or accessor array) the item returned — a slot thunk from a call (`{freshChildren(…)}`), a
        // component's `<Show>` — binds in its own cell like `assign`'s nested read: the array's binding (`flatten`)
        // must not call it, or each of its updates would re-run that read (re-creating the content it builds).
        put(typeof read === "function" ? cells([read], at)[0] : Array.isArray(read) && hasAccessor(read) ? cells(read, at) : read);
      } catch (error) {
        put(null);
        throw error;
      }
    });
    return (out = signal<unknown>(first));
  });
}
function hasAccessor(value: readonly unknown[]): boolean {
  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    if (typeof item === "function" || (Array.isArray(item) && hasAccessor(item))) return true;
  }
  return false;
}

function assign(parent: Parent, value: unknown, slot: Slot, marker: Node | null): void {
  // Everything but scalars / nullish (nodes, fragments, arrays) becomes one flat node list.
  let nodes: Node[] | null = null;
  let inner: unknown = null;
  const evaluate = (): unknown => {
    if (typeof value === "function") {
      value = (value as () => unknown)();
      // An accessor returned by the read (a `<For>` / `<Show>` / component content), or an array holding
      // one (lazy children `[() => cond ? <a/> : null, <div/>]`): bound in a nested effect, so this binding
      // does not re-run — re-creating that content (the array's nodes) — on each of its updates.
      if (typeof value === "function" || (Array.isArray(value) && hasAccessor(value))) return (inner = value);
    }
    if (value !== null && typeof value === "object") {
      // A `_for` node list is flat already (its own array, kept as the slot's current: see `_for`'s accessor).
      // Dropped at once: a module-level reference would retain a cleared list's nodes.
      if (value === forNodes) (nodes = value as Node[]), (forNodes = null);
      else flatten(Array.isArray(value) ? value : [value], (nodes = []));
    }
    return value;
  };
  value = within(parent, evaluate);
  const read = inner as unknown; // set by `evaluate` (no control-flow narrowing through the closure)
  // Follow the marker, not `parent`: content first bound in a detached fragment (an `Output`, a row) moves with its
  // anchors, and an inner update must insert where the marker is now (`tests/dom-v2-children-browser.test.ts` movedParent).
  if (read !== null) return nested(marker === null ? () => parent : () => marker.parentNode as Parent, read, slot, marker);
  const current = slot.current;
  const t = typeof value;
  if (t === "string" || t === "number" || t === "bigint") {
    const text = String(value);
    if (current !== null && (current as Node).nodeType === 3 && (current as Text).parentNode === parent) {
      // Existing single text: update in place.
      if ((current as Text).data !== text) (current as Text).data = text;
      return;
    }
    const node = host.doc().createTextNode(text);
    replace(parent, current, node, marker);
    slot.current = node;
    return;
  }
  if (nodes === null) {
    // null / undefined / booleans (and symbols): nothing.
    replace(parent, current, null, marker);
    slot.current = null;
    return;
  }
  if ((nodes as Node[]).length === 0) {
    replace(parent, current, null, marker);
    slot.current = null;
  } else {
    if (Array.isArray(current) && current.length) reconcile(parent, current, nodes, marker);
    else {
      replace(parent, current, null, marker);
      appendAll(parent, nodes, marker);
    }
    slot.current = nodes;
  }
}

function flatten(value: readonly unknown[], nodes: Node[]): void {
  for (let i = 0; i < value.length; i++) {
    let item = value[i];
    while (typeof item === "function") item = (item as () => unknown)();
    if (item == null || item === true || item === false) continue;
    if (Array.isArray(item)) flatten(item, nodes);
    else if (typeof item === "object") {
      if ((item as Node).nodeType === 11) for (const n of Array.from((item as Node).childNodes)) nodes.push(n);
      else if ((item as Node).nodeType !== undefined) nodes.push(item as Node);
      else if (typeof (item as PromiseLike<unknown>).then === "function") throw TypeError("Promise DOM children require an Async boundary");
      else unsupported();
    } else nodes.push(host.doc().createTextNode(coerce(item)));
  }
}

function appendAll(parent: Parent, nodes: Node[], marker: Node | null): void {
  for (let i = 0; i < nodes.length; i++) parent.insertBefore(nodes[i], marker);
}

/** Remove `current` and put `next` (or nothing) in its place. */
function replace(parent: Parent, current: Current, next: Node | null, marker: Node | null): void {
  if (current == null) {
    if (next) parent.insertBefore(next, marker);
    return;
  }
  if (Array.isArray(current)) {
    // Whole-parent fast clear: the list is the parent's only content.
    if (!next && marker === null && current.length > 1 && parent.firstChild === current[0] && parent.lastChild === current[current.length - 1] && !_deferredFlush()) {
      parent.textContent = "";
      return;
    }
    let placed = false;
    for (let i = 0; i < current.length; i++) {
      const node = current[i];
      if (node.parentNode !== parent) continue;
      if (!placed && next) {
        swap(parent, next, node);
        placed = true;
      } else drop(parent, node);
    }
    if (!placed && next) parent.insertBefore(next, marker);
    return;
  }
  if (current.parentNode === parent) {
    if (next) swap(parent, next, current);
    else drop(parent, current);
  } else if (next) parent.insertBefore(next, marker);
}

/**
 * Remove `node` from `parent`. In a deferred first mouse click's flush (reactivity `_deferredFlush`) an element
 * under the pointer (`:hover`) is hidden instead and removed in the next frame's rAF, before paint: detaching the
 * hovered element posts Chrome's hover-update task, and the frame after a document's first click then waits
 * ~50 ms for its hover update (resume-bench navigate). Removed in the frame, the stall lands on the frame after
 * the paint. Every other removal (and every later click) is a plain `removeChild`.
 */
function drop(parent: Parent, node: Node): void {
  if (hovered(node)) keep(parent, node as HTMLElement);
  else parent.removeChild(node);
}
/** `replaceChild` (same hover rule as `drop`). */
function swap(parent: Parent, next: Node, node: Node): void {
  if (hovered(node)) {
    parent.insertBefore(next, node);
    keep(parent, node as HTMLElement);
  } else parent.replaceChild(next, node);
}
const hovered = (node: Node): boolean => _deferredFlush() && node.nodeType === 1 && (node as Element).matches(":hover");
function keep(parent: Parent, el: HTMLElement): void {
  const style = el.style,
    display = style.display;
  style.display = "none";
  requestAnimationFrame(() => {
    if (el.parentNode === parent && style.display === "none") parent.removeChild(el);
    style.display = display;
  });
}

/**
 * Reconcile `a` (current, non-empty; nodes may have left `parent`) to `b` by node identity: common ends, swapped ends,
 * then keyed moves that keep runs in place (dom-expressions' reconcileArrays / udomdiff).
 */
function reconcile(parent: Parent, a: Node[], b: Node[], marker: Node | null): void {
  const bLength = b.length;
  let aEnd = a.length,
    bEnd = bLength,
    aStart = 0,
    bStart = 0,
    map: Map<Node, number> | null = null,
    copied = false;
  // The node after the list: past the last current node still here (a disposed output's nodes have
  // already left), else the marker.
  let last = aEnd - 1;
  while (last >= 0 && a[last].parentNode !== parent) last--;
  const after = last >= 0 ? a[last].nextSibling : marker;
  // Nothing kept and the list owns the parent: one native wipe, then append (replace all).
  if (marker === null && bLength > 0 && a[0] !== b[0] && parent.firstChild === a[0] && parent.lastChild === a[aEnd - 1] && !_deferredFlush()) {
    map = new Map();
    for (let i = 0; i < bLength; i++) map.set(b[i], i);
    let kept = false;
    for (let i = 0; i < aEnd; i++)
      if (map.has(a[i])) {
        kept = true;
        break;
      }
    if (!kept) {
      parent.textContent = "";
      for (let i = 0; i < bLength; i++) parent.insertBefore(b[i], null);
      return;
    }
  }
  while (aStart < aEnd || bStart < bEnd) {
    if (a[aStart] === b[bStart]) {
      aStart++;
      bStart++;
      continue;
    }
    while (aEnd > aStart && bEnd > bStart && a[aEnd - 1] === b[bEnd - 1]) {
      aEnd--;
      bEnd--;
    }
    if (aEnd === aStart) {
      const node = bEnd < bLength ? (bStart ? b[bStart - 1].nextSibling : b[bEnd - bStart]) : after;
      while (bStart < bEnd) parent.insertBefore(b[bStart++], node);
    } else if (bEnd === bStart) {
      while (aStart < aEnd) {
        const node = a[aStart++];
        if ((map === null || !map.has(node)) && node.parentNode === parent) drop(parent, node);
      }
    } else if (a[aStart] === b[bEnd - 1] && b[bStart] === a[aEnd - 1]) {
      const node = a[--aEnd].nextSibling;
      parent.insertBefore(b[bStart++], a[aStart++].nextSibling);
      parent.insertBefore(b[--bEnd], node);
      if (!copied) {
        a = a.slice();
        copied = true;
      }
      a[aEnd] = b[bEnd];
    } else {
      if (map === null) {
        map = new Map();
        for (let i = bStart; i < bEnd; i++) map.set(b[i], i);
      }
      const index = map.get(a[aStart]);
      if (index !== undefined) {
        if (bStart < index && index < bEnd) {
          let i = aStart,
            sequence = 1,
            t: number | undefined;
          while (++i < aEnd && i < bEnd) {
            if ((t = map.get(a[i])) === undefined || t !== index + sequence) break;
            sequence++;
          }
          if (sequence > index - bStart) {
            const node = a[aStart];
            while (bStart < index) parent.insertBefore(b[bStart++], node);
          } else swap(parent, b[bStart++], a[aStart++]);
        } else aStart++;
      } else {
        const node = a[aStart++];
        if (node.parentNode === parent) drop(parent, node);
      }
    }
  }
}

// ---- resume adoption ----
/**
 * @internal Resume hooks, installed by `dom-adopt.ts` (resume runtime only; null on every other page): a `_for`
 * takes the server rows, a `_show` / `_switch` the server branch its re-created region recorded (null: none).
 */
export const _adoption: {
  rows: ((owner: Owner | null, by: (item: never, index: number) => unknown, indexed: boolean) => AdoptedList | null) | null;
  branch: ((owner: Owner | null) => AdoptedBranch | null) | null;
  key: (() => number | null | undefined) | null;
  /** Server item vs a fresh item of the same key: equal data (an adopted row keeps its nodes and resumed bindings). */
  same: ((server: unknown, fresh: unknown) => boolean) | null;
  /** Dev runtime only (`dev/dom.ts`): its per-component owners (production components own nothing), transparent to adoption. */
  dev: { has(owner: object): boolean } | null;
} = { rows: null, branch: null, key: null, same: null, dev: null };
/**
 * Resume ABI: while a resumed page re-creates a region (its read re-runs on the first change of a signal the
 * server render read), the server branch key (match index, -1 fallback; null: never adopted) of the next
 * Show/Switch that read creates directly; `undefined` in any other creation (or when that one has no server
 * branch). Lets a stateful component start from the state the server rendered (e.g. a transition that was shown).
 * Reads `dom-adopt.ts` through `_adoption.key`: a component chunk importing it never pulls the adoption code (or a
 * `dom-adopt` chunk split off the resume entry) in.
 */
export function _serverBranch(): number | null | undefined {
  return _adoption.key === null ? undefined : _adoption.key();
}
/** @internal Adopted server rows: their items, rows (server nodes between their markers) and server indexes (-1: index not read). */
export interface AdoptedList {
  items: unknown[];
  rows: ForRow[];
  adopted: Map<ForRow, number>;
  /** Rows at -3 (their own render read signals, unchanged so far): turns true once one changed — they are re-created then. */
  changed: (() => boolean) | null;
}
/** @internal An adopted server branch as a `branches` pick: match index (-1 fallback), its value (`valued`: the server read it), owner and nodes. */
export interface AdoptedBranch {
  i: number;
  v: unknown;
  valued: boolean;
  owner: Owner | null;
  value: Node[];
}

// ---- lists ----
/** @internal A `_for` row (exported for `dom-adopt.ts`). */
export interface ForRow {
  value: unknown;
  key: unknown;
  /** Item source, created on the first tracked read (rows usually read their item once). */
  sig: Signal<unknown> | null;
  index: Signal<number> | null;
  /** The row's node, or null for an inserted row: its nodes lie between `start` and `end`. */
  nodes: Node | null;
  start: Node | null;
  end: Node | null;
  owner: Owner | null;
  /** Reconcile pass stamp (`_for`): `-pass` = an old middle row free to match in that pass, `pass` = claimed / created in it. */
  pass: number;
}
const NO_NODES: Node[] = [],
  NO_ROWS: readonly ForRow[] = [];
// The node list a `_for` accessor returned last: `assign` takes it as is (no `flatten` copy).
let forNodes: Node[] | null = null;
// Reconcile pass counter shared by every `_for` (row stamps compare against their list's current pass only).
let forPass = 0;
/** Push the rows' nodes (a ranged row: its live nodes between its anchors); true when a row is ranged. */
function rowNodes(rows: readonly ForRow[], nodes: Node[]): boolean {
  let ranged = false;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!,
      own = row.nodes;
    if (own !== null) nodes.push(own);
    else {
      ranged = true;
      for (let x: Node | null = row.start; x !== null; x = x === row.end ? null : x.nextSibling) nodes.push(x);
    }
  }
  return ranged;
}
// A row's item accessor: one bound function per row (no closure context).
function itemRead(this: ForRow): unknown {
  return this.sig !== null ? this.sig() : _tracking() ? (this.sig = signal(this.value))() : this.value;
}
/**
 * Compiler ABI: keyed list (`<For each by>{(item, index) => …}</For>`). Returns an accessor of the
 * rows' nodes for `_insert`, which reconciles them by identity. Rows are roots under the list's
 * owner; `index` exists only when `children` declares it. A row's item updates in place when its key
 * keeps a different item.
 */
export function _for<T, K>(props: {
  // Same props type as the public `For` (dom.ts / server-structural.ts): the compiler passes the user's props through.
  each: () => readonly T[];
  by: (item: T, index: number) => K;
  children: (item: () => T, index: () => number) => unknown;
}): () => Node[] {
  const owner = getOwner(),
    // The insertion parent the list is created under: rows built later (effect re-runs) see it too, so
    // namespace-picking templates (`_tplNs`) parse like the first rows.
    parent = insertionParent,
    { by, children } = props,
    indexed = children.length > 1;
  let items: readonly T[] = [],
    list: ForRow[] = [],
    // Resume: adopted server rows → their server index (-1: the row did not read it; -2: its own render read signals no
    // site inside binds, so it is re-created on the first run, like a changed item). They keep their resumed
    // bindings, which read the server item: a changed item (or read index) re-creates the row. A fresh item equal
    // in data to the server one (refetched lists: same rows, new objects) keeps the row (`_adoption.same`). -3: its own
    // render read signals that still hold their server values: kept until `changed` turns true, then re-created
    // (a client row's own reads are untracked, but the server row has no binding for what they decided).
    adopted: Map<ForRow, number> | null = null,
    changed: (() => boolean) | null = null,
    // Every current row by key, kept across passes: matching and duplicate detection are O(changed rows), no
    // per-pass Set over kept rows (append 1k to 10k). null: rebuilt from `list` (first pass, after a throwing pass).
    keys: Map<unknown, ForRow> | null = null;
  if (_adoption.rows !== null) {
    const taken = _adoption.rows(owner, by as (item: never, index: number) => unknown, indexed);
    if (taken !== null) ({ items: items as unknown[], rows: list, adopted, changed } = taken as AdoptedList);
  }
  const build = (row: ForRow): void => {
    const out = children(itemRead.bind(row) as () => T, row.index as unknown as () => number);
    const type = out !== null && typeof out === "object" ? (out as Node).nodeType : 0;
    if (type === 1 || type === 3) {
      row.nodes = out as Node;
      return;
    }
    // Any other row value (accessor, array, fragment, text): an insertion between two
    // anchors owned by the row.
    const doc = host.doc(),
      start = (row.start = doc.createTextNode("")),
      end = (row.end = doc.createTextNode("")),
      frag = doc.createDocumentFragment();
    frag.append(start, end);
    _insert(null, out, end);
  };
  const create = (value: T, i: number, key: unknown): ForRow => {
    const row: ForRow = { value, key, sig: null, index: indexed ? signal(i) : null, nodes: null, start: null, end: null, owner: null, pass: forPass };
    _rootIn(owner, build, row);
    return row;
  };
  // An effect maintains the rows (item/index writes are not allowed in a computed); the rows are
  // published through a signal that `_insert` reads, their nodes collected at that read: an inserted
  // row's content is re-rendered by its own effect after this one (an item write), so a snapshot taken
  // here would be stale. Like mapArray: rows whose item is unchanged at the common prefix/suffix are
  // kept without key work; keys are matched in the middle.
  const out = signal<readonly ForRow[]>(NO_ROWS, { equals: false });
  effect(() => {
    const each = props.each,
      next = typeof each === "function" ? (each as () => readonly T[])() : each;
    if (changed !== null && changed()) {
      changed = null;
      for (const [row, at] of adopted!) if (at === -3) adopted!.set(row, -2);
    }
    const outer = insertionParent;
    insertionParent = parent;
    try {
      untrack(() => {
        const n = next.length,
          m = items.length;
        if (n === 0) {
          for (let i = 0; i < m; i++) _dispose(list[i]!.owner);
          items = [];
          list = [];
          adopted = keys = null;
          changed = null;
          out.set(NO_ROWS);
          return;
        }
        let start = 0,
          end = m,
          newEnd = n;
        const limit = n < m ? n : m;
        // Adopted rows go through the keyed path (their item and index are checked).
        while (adopted === null && start < limit && next[start] === items[start]) start++;
        // A prefix row keeps its index (so its key). A suffix row moves when the length changes: keep it only while its key
        // holds at the new index (an index-keyed `by` gives a moved equal item another key; keeping the row left its stale
        // key in `keys`, and the new row taking that key threw "Duplicate For key").
        while (
          adopted === null &&
          end > start &&
          newEnd > start &&
          next[newEnd - 1] === items[end - 1] &&
          (n === m || !by || by(next[newEnd - 1]!, newEnd - 1) === list[end - 1]!.key)
        ) {
          end--;
          newEnd--;
        }
        const rows: ForRow[] = new Array(n);
        for (let i = 0; i < start; i++) rows[i] = list[i]!;
        for (let i = newEnd; i < n; i++) {
          const row = (rows[i] = list[i - n + m]!);
          if (row.index !== null && n !== m) row.index.set(i);
        }
        const pass = ++forPass;
        let map = keys;
        if (map === null) {
          map = new Map();
          for (let i = 0; i < m; i++) map.set(list[i]!.key, list[i]!);
        }
        keys = null; // a throw below (duplicate key, row error) leaves it to be rebuilt from the untouched `list`
        // Old middle rows are free to match in this pass; any other row found by a new key (a kept prefix / suffix
        // row, or one matched or created earlier in this pass) is a duplicate.
        for (let i = start; i < end; i++) list[i]!.pass = -pass;
        for (let i = start; i < newEnd; i++) {
          const value = next[i]!,
            key = by ? by(value, i) : value;
          let row = map.get(key);
          if (row !== undefined) {
            if (row.pass !== -pass) throw Error("Duplicate For key");
            row.pass = pass;
            if (adopted !== null && adopted.has(row)) {
              const at = adopted.get(row)!;
              if (at === -2 || (row.value !== value && !_adoption.same!(row.value, value)) || (at >= 0 && at !== i)) {
                _dispose(row.owner);
                row = undefined;
              }
            }
          }
          if (row !== undefined) {
            if (row.value !== value) {
              row.value = value;
              if (row.sig !== null) row.sig.set(value);
            }
            if (row.index !== null) row.index.set(i);
          } else map.set(key, (row = create(value, i, key)));
          rows[i] = row;
        }
        for (let i = start; i < end; i++) {
          const row = list[i]!;
          if (row.pass === -pass) {
            map.delete(row.key);
            _dispose(row.owner);
          }
        }
        keys = map;
        items = next.slice();
        list = rows;
        if (adopted !== null) {
          const kept = new Map<ForRow, number>();
          for (let i = 0; i < n; i++) if (adopted.has(rows[i]!)) kept.set(rows[i]!, adopted.get(rows[i]!)!);
          adopted = kept.size ? kept : null;
          if (adopted === null) changed = null;
        }
        out.set(rows);
      });
    } finally {
      insertionParent = outer;
    }
  });
  // The node list returned last and its rows. A ranged row's inner insertion re-renders in its own effect, so its
  // nodes may have changed since that read — and the list insertion reconciles against that very array (its slot's
  // current, taken without a copy through `forNodes`): refresh it in place from the rows' live nodes first. A stale
  // list moved a row's later nodes (remove + re-insert: restarted animations) and left them behind on removal.
  let shown: Node[] = NO_NODES,
    shownRows: readonly ForRow[] = NO_ROWS,
    ranged = false;
  return () => {
    const rows = out(),
      n = rows.length;
    if (ranged) {
      shown.length = 0;
      rowNodes(shownRows, shown);
    }
    if (n === 0) {
      ranged = false;
      shownRows = NO_ROWS;
      return (shown = NO_NODES);
    }
    const nodes: Node[] = [];
    ranged = rowNodes(rows, nodes);
    shownRows = rows;
    return (forNodes = shown = nodes);
  };
}

// ---- control flow (Show / Switch / Match) ----
/** Show / Match content: a function (lazy, gets the value accessor) or eager content (created once, kept). */
type BranchContent<T> = unknown | ((value: () => NonNullable<T>) => unknown);
/** A pick: content index (-1 = fallback) and the condition value. */
interface Pick {
  i: number;
  v: unknown;
}
// Shared Show / Switch core: a memoized pick (index cutoff; the value too when
// keyed), one branch at a time. Function content runs in its own root, disposed when hidden; eager
// content is kept and re-inserted as is (a fragment's nodes are captured once). Returns an accessor
// for `_insert`, which owns the insertion.
function branches(select: () => Pick, keyed: (i: number) => boolean, content: (i: number) => unknown, live: (i: number) => () => unknown): () => unknown {
  const owner = getOwner(),
    eager = new Map<number, unknown>();
  // Resume: the server branch is current (kept while its match holds; while the server read its value, that too).
  let current: { i: number; v: unknown; owner: Owner | null; value: unknown } | null = _adoption.branch && _adoption.branch(owner),
    valued = current !== null && (current as AdoptedBranch).valued;
  const pick = computed(select, { equals: (a, c) => a.i === c.i && (!(valued || keyed(a.i)) || Object.is(a.v, c.v)) });
  const update = ({ i, v }: Pick): unknown => {
    if (current !== null) {
      if (current.i === i && !((valued || keyed(i)) && !Object.is(current.v, v))) return current.value;
      valued = false;
      _dispose(current.owner);
    }
    const next = { i, v, owner: null as Owner | null, value: undefined as unknown };
    const c = content(i);
    if (typeof c === "function") {
      const get = i < 0 || keyed(i) ? () => v : live(i);
      next.value = _rootIn(owner, () => (c as (get: () => unknown) => unknown)(get), next);
    } else {
      if (!eager.has(i)) eager.set(i, c !== null && typeof c === "object" && (c as Node).nodeType === 11 ? Array.from((c as Node).childNodes) : c);
      next.value = eager.get(i);
    }
    current = next;
    return next.value;
  };
  return () => _untrack1(update, pick());
}
/**
 * Compiler ABI (`<Show>`, also the public `Show`): `children` while `when()` is truthy, else `fallback`; `Show`
 * semantics (truthiness memo, `keyed`, function content gets the value accessor, eager content kept).
 */
export function _show<T>(props: { when: T | (() => T); keyed?: boolean; fallback?: BranchContent<T>; children?: BranchContent<T> }): () => unknown {
  return branches(
    () => {
      const v = when(props.when);
      return { i: v ? 0 : -1, v };
    },
    (i) => i === 0 && !!props.keyed,
    (i) => (i ? props.fallback : props.children),
    () => () => when(props.when),
  );
}
// `when` / `each`: a value (a live-props getter, `when={c()}`) or an accessor (`when={c}`, `when={() => …}`).
const when = <T>(v: T | (() => T)): T => (typeof v === "function" ? (v as () => T)() : v);
interface MatchProps {
  when: unknown;
  keyed?: boolean;
  children?: unknown;
}
const cases = new WeakMap<Node, MatchProps>();
/** Compiler ABI (DOM v2 `<Match>`): a case the enclosing `_switch` reads (an empty comment elsewhere). */
export function _match<T>(props: { when: T | (() => T); keyed?: boolean; children?: BranchContent<T> }): Node {
  const marker = host.doc().createComment("");
  cases.set(marker, props as MatchProps);
  return marker;
}
/** Compiler ABI (`<Switch>`, also the public `Switch`): the first `Match` whose `when()` is truthy, else `fallback`. */
export function _switch(props: { fallback?: unknown; children?: unknown }): () => unknown {
  const list: MatchProps[] = [];
  const collect = (value: unknown): void => {
    if (Array.isArray(value)) for (const child of value) collect(child);
    else if (value !== null && typeof value === "object" && cases.has(value as Node)) list.push(cases.get(value as Node)!);
  };
  collect(props.children);
  return branches(
    () => {
      for (let i = 0; i < list.length; i++) {
        const v = when(list[i]!.when);
        if (v) return { i, v };
      }
      return { i: -1, v: undefined };
    },
    (i) => i >= 0 && !!list[i]!.keyed,
    (i) => (i < 0 ? props.fallback : list[i]!.children),
    (i) => () => when(list[i]!.when),
  );
}

// ---- conditional children (TERNARY-MEMO) ----
// Per operator: when two test values render the same thing (`?:`: same truthiness; `&&` / `||` / `??`: the JSX
// operand both times, else the same rendered test value).
const SAME_BRANCH: ((a: unknown, b: unknown) => boolean)[] = [
  (a, b) => !a === !b,
  (a, b) => (!!a && !!b) || Object.is(a, b),
  (a, b) => (!a && !b) || Object.is(a, b),
  (a, b) => (a == null && b == null) || Object.is(a, b),
];
/**
 * Compiler ABI (DOM v2): a conditional child with a JSX operand (`{c() ? <A/> : <B/>}` mode 0, `{c() && <A/>}` 1,
 * `||` 2, `??` 3) — Solid's condition memo. `test` is read through a memo cut off by `SAME_BRANCH[mode]`, so the
 * insertion reading the returned accessor re-runs `render` (rebuilding the branch's JSX) only when the rendered
 * branch changes, not on every read inside the test (a CSS enter animation replayed, focus / input state was lost).
 * `render` is the operator over the memo value; a non-JSX operand it evaluates is still tracked by the insertion.
 */
export function _cond<T>(test: () => T, mode: number, render: (value: T) => unknown): () => unknown {
  const memo = computed(test as () => unknown, { equals: SAME_BRANCH[mode] }) as () => T;
  return () => render(memo());
}

// ---- spreads / refs ----
/** Compiler ABI: `ref={expr}` on a v2 element (a `ref()` signal or a callback; owner cleanup resets a `ref()`). */
export function _ref(el: Element, fn: ((element: Element) => void) | null | undefined): void {
  // A not-yet-inserted clone of the inert template document: adopted (whole clone) before user code sees it,
  // so `ownerDocument` / `defaultView` are the live ones (cdk CdkScrollable registers on them).
  if (fn != null && el.ownerDocument.defaultView === null) host.doc().adoptNode(el.getRootNode());
  bindRef(el, fn);
}
export { _spread, _attrs } from "./dom-v2-spread.ts";
