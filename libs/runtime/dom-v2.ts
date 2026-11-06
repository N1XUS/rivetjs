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
  _rebind1,
  _dispose,
  _rootIn,
  _scoped,
  _swapObserver,
  _tracking,
  _untrack1,
  computed,
  effect,
  getOwner,
  signal,
  untrack,
} from "@rivetjs/reactivity";
import type { EqualsOptions, Owner, Signal } from "@rivetjs/reactivity";
import { coerce, unsupported, write } from "./dom-attr.ts";
// `_constructionDoc` from the leaf, not through `dom.ts`: `dom.ts` imports this module, and `host` below reads the
// binding while this module evaluates. Vite's module runner (Vitest, SSR dev) defines `dom.ts`'s re-exports only when
// its body reaches them, so through the cycle it was still undefined there (NX-E2E 2026-10-27).
import { _booleans, _constructionDoc } from "./dom-base.ts";

import { _parseHTML, bindRef } from "./dom.ts";
import { LAZY_ROWS } from "./lazy-rows.ts";
import { DERIVED } from "./derived.ts";

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
    // Adopt run (LAZY-ROWS T5 builds, `dom-adopt.ts` `_adoptRow`): the probe records the clone, the adopt run gets the server node.
    return LAZY_ROWS && _adoption.node ? _adoption.node(node!.cloneNode(true), 0) : node!.cloneNode(true);
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
  // `untrack` by hand: no closure + context per component call (MOUNT-01).
  const previous = _swapObserver(null);
  try {
    return fn(props());
  } finally {
    _swapObserver(previous);
  }
}

// ---- text ----
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
      else if (!(LAZY_ROWS && _adoption.live && soleText(el, next))) el.textContent = next;
      (el as unknown as { $$t?: string }).$$t = next;
      return;
    }
    el.textContent = "";
  }
  let slot = last as Slot | undefined;
  if (typeof slot !== "object") (el as unknown as { $$t?: Slot }).$$t = slot = { current: null };
  // An accessor (component content such as a `<For>`), or an array holding one: read in its own effect,
  // so the caller's binding does not track it and re-create the content (components, focused nodes)
  // on each of its updates (Solid `insertExpression`).
  if (typeof value === "function" || (Array.isArray(value) && hasAccessor(value))) nestedAt(el, value, slot, null);
  else assign(el, value, slot, null);
}
// MOUNT-01 (allocation): an ABI function that creates a closure over its parameters on some path makes V8 allocate a
// context for them on every call, the scalar path too (16–28 B per call: a text / attribute binding per mounted field).
// Closures live in separate functions (`nestedAt`, `bindAttr`, `bindWrite`, `bindClass`, `bindText`, `bindInsert`); pinned by
// `tests/dom-v2-alloc.test.ts`.
function nestedAt(parent: Parent, value: unknown, slot: Slot, marker: Node | null): void {
  nested(marker === null ? () => parent : () => marker.parentNode as Parent, value, slot, marker);
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
      if (!(LAZY_ROWS && _adoption.live && text.data === value)) text.data = value;
      return;
    }
    if (value == null || (typeof value !== "object" && typeof value !== "function")) {
      // Numbers go to the DOM as-is (see `_textValue`).
      const next = typeof value === "number" ? (value as unknown as string) : coerce(value);
      if (!(LAZY_ROWS && _adoption.live && text.data === String(next))) text.data = next;
      return;
    }
    text.data = "";
    (text as unknown as { $$s?: Slot }).$$s = slot = { current: null };
  }
  if (typeof value === "function" || (Array.isArray(value) && hasAccessor(value))) nestedAt(text.parentNode as Parent, value, slot, text);
  else assign(text.parentNode as Parent, value, slot, text);
}
/**
 * Compiler ABI (GC-01): a sole dynamic text child of a placeholder-free element (`<strong></strong>`), client-created DOM
 * only. The binding starts with the element (`_fx1(fx, el, …)`, `el` used by nothing else in `fx`): the first scalar write
 * sets `textContent` — no placeholder Text is cloned and no Text wrapper is created during the mount (one DOM wrapper less
 * per bound field: scavenge roots / weak handles, `docs/guides/performance.md`). The first later write takes the Text node
 * and hands it to the binding in place of the element (`_rebind1`): later runs get the Text, whose `firstChild` is null, so
 * the same scalar path writes its `textContent` (= its data; an expando or a `firstChild` + wrapper read on the element
 * per update costs +10…+40 % per update). A write while the element is still empty (`""` so far) writes `textContent`
 * again. The first non-scalar switches to `_insert` semantics for good (`$$s`: on the element, or `_tx`'s on the Text).
 */
export function _te(node: Element | Text, value: unknown): void {
  const slot = (node as unknown as { $$s?: Slot }).$$s;
  if (slot === undefined && (typeof value === "string" || value == null || (typeof value !== "object" && typeof value !== "function"))) {
    // Numbers go to the DOM as-is (see `_textValue`).
    const next = typeof value === "string" ? value : typeof value === "number" && value ? (value as unknown as string) : coerce(value);
    const text = node.firstChild;
    if (text === null) node.textContent = next;
    else {
      if (!(LAZY_ROWS && _adoption.live && (text as Text).data === next)) (text as Text).data = next;
      _rebind1(node, text);
    }
    return;
  }
  if (node.nodeType === 3) return _tx(node as Text, value);
  insertInto(node as Element & { $$s?: Slot }, value, slot);
}
function insertInto(el: Element & { $$s?: Slot }, value: unknown, slot: Slot | undefined): void {
  if (slot === undefined) {
    el.textContent = "";
    el.$$s = slot = { current: null };
  }
  if (typeof value === "function" || (Array.isArray(value) && hasAccessor(value))) nestedAt(el, value, slot, null);
  else assign(el, value, slot, null);
}
/** Compiler ABI: a sole-child static value: scalars written once, an accessor binds, nodes/arrays insert. */
export function _textValue(el: Element, value: unknown): void {
  if (typeof value === "function") bindText(el, value as () => unknown);
  else if (value !== null && typeof value === "object") _insert(el, value);
  // Numbers go to the DOM as-is: `String(n)` would fill V8's number-string cache (0 is coerced: some DOMs drop a falsy value).
  else if (!(LAZY_ROWS && _adoption.live && soleText(el, coerce(value))))
    el.textContent = typeof value === "number" && value ? (value as unknown as string) : coerce(value);
}
function bindText(el: Element, value: () => unknown): void {
  _bindingEffect(() => {
    let next: unknown;
    try {
      next = value();
    } catch (error) {
      _t(el, null); // as `_insert`: a throwing read empties the element
      throw error;
    }
    _t(el, next);
  });
}
// The server node already shows `next` (one text, or text the build decorated: `dom-derived.ts` `decorated`).
const soleText = (el: Element, next: string): boolean => el.textContent === next;

// ---- attributes (`write` / `coerce`: `dom-attr.ts`; adopt runs skip held writes: `put`) ----
/** Compiler ABI: an identifier-only attribute value: written once unless it is an accessor. */
export function _attrValue(el: Element, name: string, value: unknown): void {
  if (typeof value === "function") bindWrite(el, name, value as () => unknown);
  else (LAZY_ROWS ? put : write)(el, name, value);
}
function bindWrite(el: Element, name: string, value: () => unknown): void {
  _bindingEffect(() => (LAZY_ROWS ? put : write)(el, name, value()));
}
/** `write`, unless an adopt run finds the value on the server's node already (`holds`). Resume builds only. */
function put(el: Element, name: string, value: unknown): void {
  if (_adoption.classValue && name.toLowerCase() === "class") value = _adoption.classValue(el, value);
  if (!(_adoption.live && holds(el, name, value))) write(el, name, value);
}
/**
 * ADOPT-CONTENT (2026-10-26), adopt runs (`_adoption.live`, `LAZY_ROWS` builds): `el` already holds what writing `value`
 * to attribute `name` would leave (`write`'s rules), so the write is skipped — the server rendered it, and a re-set is not
 * free: an `<iframe src>` re-set reloads the frame's document, every write queues a mutation record and restyles.
 */
function holds(el: Element, name: string, value: unknown): boolean {
  const lower = name.toLowerCase();
  if (el.namespaceURI === HTML) {
    // `<details>` / `<dialog>` `open` is the user's once the page is live (a toggle changes the attribute): the run keeps it.
    if (lower === "open" && (el.localName === "details" || el.localName === "dialog")) return true;
    if (lower === "defaultvalue" || lower === "defaultchecked" || lower === "popover") return false;
    // Boolean attributes follow truthiness (a `checked` / `selected` default kept: the control's state is not reset).
    if (_booleans.test(lower) && !(lower === "hidden" && typeof value === "string" && value)) return el.hasAttribute(name) === !!value;
  }
  if (value == null) return !el.hasAttribute(name);
  return (typeof value === "string" || typeof value === "number" || typeof value === "boolean") && el.getAttribute(name) === String(value);
}
/**
 * Compiler ABI: a plain attribute (compiler-classified: HTML/SVG name that is not boolean, URL-bearing,
 * namespaced or a form-control property). null/undefined remove; other values stringify.
 */
export function _setAttr(el: Element, name: string, value: unknown): void {
  if (typeof value === "function") bindAttr(el, name, value as () => unknown);
  else plain(el, name, value);
}
function bindAttr(el: Element, name: string, value: () => unknown): void {
  _bindingEffect(() => plain(el, name, value()));
}
function plain(el: Element, name: string, value: unknown): void {
  if (LAZY_ROWS && _adoption.classValue && name.toLowerCase() === "class") value = _adoption.classValue(el, value);
  if (LAZY_ROWS && _adoption.live && holds(el, name, value)) return;
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
export const _fx1: <A, B, C>(fn: (a: A, b: B, c: C) => void, a: A, b?: B, c?: C) => void = DERIVED || LAZY_ROWS ? derivedFx1 : _bindingEffect1;
// Derived / lazy rows builds (`DERIVED`, `LAZY_ROWS`): a row sample run of the adopt runtime (`_adoption.fx`:
// `dom-derived.ts`, `dom-resume-lazy.ts`) sees each binding with its captures (DERIVED-C keyed row writers, LAZY-BLOCKERS
// shared-read row writers); folded away elsewhere.
function derivedFx1<A, B, C>(fn: (a: A, b: B, c: C) => void, a: A, b?: B, c?: C): void {
  const hook = _adoption.fx;
  if (hook) hook(fn as never, a, b, c);
  else _bindingEffect1(fn, a, b, c);
}
/** Compiler ABI: write a class value (see `_className`). */
export const _cls: (el: Element, value: unknown) => void = className;
/** Compiler ABI: write a plain attribute value (null/undefined remove it). */
export const _attrSet: (el: Element, name: string, value: unknown) => void = plain;
/** Compiler ABI: write an attribute value with full semantics (booleans, URLs, control properties). */
export const _attrWrite: (el: Element, name: string, value: unknown) => void = LAZY_ROWS ? put : write;
/** Compiler ABI: an HTML element's class (null/undefined/false/"" remove it); a function binds. */
export function _className(el: Element, value: unknown): void {
  if (typeof value === "function") bindClass(el, value as () => unknown);
  else className(el, value);
}
function bindClass(el: Element, value: () => unknown): void {
  _bindingEffect(() => className(el, value()));
}
function className(el: Element, value: unknown): void {
  if (LAZY_ROWS && _adoption.classValue) {
    value = _adoption.classValue(el, value === false ? null : value);
    if (_adoption.live && holds(el, "class", value === "" ? null : value)) return;
  }
  // An empty class removes the attribute: a fresh row has none, so no write (and no style
  // invalidation) happens for it (krausest 01 / 07 / 08 +2–3% with the write).
  if (value == null || value === false || value === "") el.removeAttribute("class");
  else el.className = value as string;
}
// ---- events (delegated): `dom-events.ts` (a leaf module the lite runtime shares) ----
export { _delegateBelow, _listen, _on } from "./dom-events.ts";

// ---- children ----
/**
 * Compiler ABI: a dynamic fragment child (`<>a{x()}</>` → `[a, _scoped(() => x())]`). The insertion that
 * reads it runs later, outside the scope the fragment was built in (`provide(Ctx, v, () => <>…</>)`
 * returns before the read): each read runs in a fresh child scope of the creation owner (reactivity
 * `_scoped`) — context lookups see the providers around the fragment.
 */
export { _scoped };

type Current = Node | Node[] | null;
/** @internal An insertion's slot: the nodes it shows now (`dom-adopt.ts` adopt runs seed new slots). */
export interface InsertSlot {
  current: Current;
  /**
   * `[index, list, length]` triples: where `current` (a flattened array) took a `<For>`'s node list (the array its
   * accessor returned, refreshed in place on its next read) or a lazily adopted list's keep token (`n()`: its live nodes).
   * Set only on slots that flattened one (NULL-SLOT).
   */
  lists?: unknown[] | null;
}
type Slot = InsertSlot;
/**
 * Compiler ABI: insert a child value before `marker` (null: append). A function is an accessor:
 * the insertion re-runs when it changes. Arrays reconcile by node identity.
 */
export function _insert(parent: Parent | null, value: unknown, marker: Node | null = null): void {
  const slot: Slot = { current: null };
  if (LAZY_ROWS && _adoption.slot) _adoption.slot(slot);
  // Arrays holding accessors (fragments with dynamic children) track like an accessor.
  if (typeof value !== "function" && !(Array.isArray(value) && hasAccessor(value))) {
    assign(parent ?? (marker!.parentNode as Parent), value, slot, marker);
    return;
  }
  bindInsert(parent, value, marker, slot);
}
function bindInsert(parent: Parent | null, value: unknown, marker: Node | null, slot: Slot): void {
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
    // A `<For>` accessor is no cell (NULL-SLOT 2026-10-29): the array's binding reads it, right before it reconciles. Its
    // rows re-render in effects of their own, so a cell's node list (read before them) went stale, and the reconcile
    // re-inserted a re-rendered row's removed nodes (a resumed cdk Tree's `[rootIndicator, rows]`: rows doubled / lost).
    if (typeof item !== "function" || forFns.has(item)) return item;
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
  // Scalars / nullish (every text update of a mixed-content `_insert`): nothing to evaluate — no closure, no `within`.
  if (value === null || (typeof value !== "object" && typeof value !== "function")) return place(parent, value, null, null, slot, marker);
  // Everything else (nodes, fragments, arrays) becomes one flat node list.
  let nodes: Node[] | null = null,
    lists: unknown[] | null = null;
  let inner: unknown = null;
  // Evaluated with `parent` as the insertion parent (`within`, by hand: no closure — MOUNT-01).
  const outer = insertionParent;
  insertionParent = parent;
  try {
    if (typeof value === "function") {
      value = (value as () => unknown)();
      // An accessor returned by the read (a `<For>` / `<Show>` / component content), or an array holding
      // one (lazy children `[() => cond ? <a/> : null, <div/>]`): bound in a nested effect, so this binding
      // does not re-run — re-creating that content (the array's nodes) — on each of its updates.
      if (typeof value === "function" || (Array.isArray(value) && hasAccessor(value))) inner = value;
    }
    // Derived builds: a lazily adopted `<For>` (`dom-derived.ts`) keeps the server rows the slot holds.
    if (
      inner === null &&
      !(DERIVED && value !== null && typeof value === "object" && _adoption.keep?.has(value)) &&
      value !== null &&
      typeof value === "object"
    ) {
      // A `_for` node list is flat already (its own array, kept as the slot's current: see `_for`'s accessor).
      // Dropped at once: a module-level reference would retain a cleared list's nodes.
      if (value === forNodes) ((nodes = value as Node[]), (forNodes = null));
      else lists = flatten(Array.isArray(value) ? value : [value], (nodes = []), null);
    }
  } finally {
    insertionParent = outer;
  }
  if (DERIVED && value !== null && typeof value === "object" && _adoption.keep?.has(value)) return;
  // Follow the marker, not `parent`: content first bound in a detached fragment (an `Output`, a row) moves with its
  // anchors, and an inner update must insert where the marker is now (`tests/dom-v2-children-browser.test.ts` movedParent).
  if (inner !== null) return nestedAt(parent, inner, slot, marker);
  place(parent, value, nodes, lists, slot, marker);
}
// Show an evaluated value in `slot`: a scalar as one text node, else its flattened `nodes` (`lists`: the lists they took).
function place(parent: Parent, value: unknown, nodes: Node[] | null, lists: unknown[] | null, slot: Slot, marker: Node | null): void {
  // Unwrap a derived lazy snapshot once, before replacement can mutate its DOM range.
  let current = DERIVED && Array.isArray(slot.current) && _adoption.snapshot ? _adoption.snapshot(slot.current) : slot.current;
  // The lists this slot flattened last: their live nodes now (a ranged row re-rendered since; NULL-SLOT).
  if (slot.lists && Array.isArray(current)) current = relisted(current, slot.lists);
  if (slot.lists || lists) slot.lists = lists;
  const t = typeof value;
  if (t === "string" || t === "number" || t === "bigint") {
    const text = String(value);
    if (current !== null && (current as Node).nodeType === 3 && (current as Text).parentNode === parent) {
      // Existing single text: update in place.
      if ((current as Text).data !== text) (current as Text).data = text;
      return;
    }
    // (An adopt run's slot starts at the server's text node: it updates in place above, no creation.)
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
    if (DERIVED) _adoption.moving = true;
    if (Array.isArray(current) && current.length) reconcile(parent, current, nodes, marker);
    else {
      replace(parent, current, null, marker);
      appendAll(parent, nodes, marker);
    }
    if (DERIVED) _adoption.moving = false;
    slot.current = nodes;
  }
}

// Flatten `value` into `nodes`; returns `lists` with the `[index, list, length]` triples of the lists it took
// (`InsertSlot.lists`): a `<For>`'s node list (its accessor ran just now) or a derived lazy list's keep token.
function flatten(value: readonly unknown[], nodes: Node[], lists: unknown[] | null): unknown[] | null {
  for (let i = 0; i < value.length; i++) {
    let item = value[i];
    while (typeof item === "function") item = (item as () => unknown)();
    if (item == null || item === true || item === false) continue;
    // Derived builds: a lazily adopted list inside an array (or a cell) stands for its server rows.
    let kept: boolean | undefined = false;
    if (Array.isArray(item) || (kept = DERIVED && _adoption.keep?.has(item as object))) {
      const at = nodes.length,
        list = kept || item === forNodes;
      if (item === forNodes) forNodes = null;
      lists = flatten(kept ? (item as { n(): Node[] }).n() : (item as unknown[]), nodes, lists);
      if (list) (lists ??= []).push(at, item, nodes.length - at);
    } else if (typeof item === "object") {
      if ((item as Node).nodeType === 11) for (const n of Array.from((item as Node).childNodes)) nodes.push(n);
      else if ((item as Node).nodeType !== undefined) nodes.push(item as Node);
      else if (typeof (item as PromiseLike<unknown>).then === "function") throw TypeError("Promise DOM children require an Async boundary");
      else unsupported();
    } else nodes.push(LAZY_ROWS && _adoption.node ? _adoption.node(host.doc().createTextNode(coerce(item)), 1) : host.doc().createTextNode(coerce(item)));
  }
  return lists;
}

// `current` with each list it flattened (`InsertSlot.lists`) as that list's nodes are now (from the last: indexes hold).
function relisted(current: Node[], lists: unknown[]): Node[] {
  for (let k = lists.length - 3; k >= 0; k -= 3) {
    const at = lists[k] as number,
      list = lists[k + 1] as Node[] | { n(): Node[] };
    current = current.slice(0, at).concat(Array.isArray(list) ? list : list.n(), current.slice(at + (lists[k + 2] as number)));
  }
  return current;
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
    if (
      !next &&
      marker === null &&
      current.length > 1 &&
      parent.firstChild === current[0] &&
      parent.lastChild === current[current.length - 1] &&
      !_deferredFlush()
    ) {
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
 * under the pointer (`:hover`) is hidden instead (out of flow + invisible + `hidden`, focus moved off) and removed in the next frame's rAF, before paint: detaching the
 * hovered element posts Chrome's hover-update task, and the frame after a document's first click then waits
 * ~50 ms for its hover update (resume-bench navigate). Removed in the frame, the stall lands on the frame after
 * the paint. Every other removal (and every later click) is a plain `removeChild`.
 */
function drop(parent: Parent, node: Node): void {
  // `_adoption.inert` reads an expando (no `nodeType` DOM call per removed node, EACH 2026-11-06).
  if (DERIVED && _adoption.inert?.(node)) return;
  if (hovered(node)) keep(parent, node as HTMLElement);
  else parent.removeChild(node);
}
/** @internal `drop` for `dom.ts` outputs (an `Async` / `Suspense` generation's removed nodes: a route swap). */
export const _drop = drop;
/** `replaceChild` (same hover rule as `drop`). */
function swap(parent: Parent, next: Node, node: Node): void {
  if (hovered(node)) {
    parent.insertBefore(next, node);
    keep(parent, node as HTMLElement);
  } else parent.replaceChild(next, node);
}
const hovered = (node: Node): boolean => (_deferredFlush() || _hoverRule.on) && node.nodeType === 1 && (node as Element).matches(":hover");
/** @internal A route commit a deferred first click's flush postponed (`dom-router.ts`) keeps that flush's removal rule. */
export const _hoverRule = { on: false };
// The kept element is `hidden` too (FUZZ-UI 2026-10-29): code reading the DOM before that rAF (cdk DOM collections skip
// `[hidden]` subtrees: a TagGroup's focused-key reset after a first-click removal saw the removed tag, focus fell to the
// body) sees it gone.
function keep(parent: Parent, el: HTMLElement): void {
  const style = el.style,
    { display, position, visibility } = style,
    hidden = el.hidden,
    active = el.ownerDocument.activeElement as HTMLElement | null;
  // Focus leaves now, as a removal's does (and the rAF's removal then forces no style recalculation of this subtree).
  if (active && el.contains(active)) active.blur();
  // Out of flow and invisible, its box kept: `display: none` detaches the hovered element's box at the next style
  // recalculation, which posts the same hover-update task (it wins the race with the frame when the update ends early
  // in the vsync interval; RESUME-NAV 2026-11-05). `display` overrides the `hidden` attribute's UA rule.
  style.display = "block";
  style.position = "absolute";
  style.visibility = "hidden";
  el.hidden = true;
  requestAnimationFrame(() => {
    if (el.parentNode === parent && style.visibility === "hidden") parent.removeChild(el);
    style.display = display;
    style.position = position;
    style.visibility = visibility;
    el.hidden = hidden;
  });
}

/**
 * `reconcile`'s removals-only pass: when `b` is a subsequence of `a[0..aEnd)` (a filter, deleted rows) drop the rest in one
 * merge walk — no node map (FILTER2 2026-11-05: a 1,000-row filter's first key walks 3,000 nodes, rows + their server
 * markers, ~1 ms of map work at 4x CPU) — and return true; else false (nothing done). Its own function: `reconcile`'s
 * general path keeps its size (krausest swap).
 */
function removals(parent: Parent, a: Node[], b: Node[], aEnd: number): boolean {
  const bLength = b.length;
  let j = 0;
  for (let i = 0; i < aEnd && j < bLength; i++) if (a[i] === b[j]) j++;
  if (j !== bLength) return false;
  // The hover rule (`drop`) is the same for every node of one pass: read once; outside it a dropped node is a plain
  // `removeChild` (FILTER3 2026-11-06: per node, `drop` re-tested the marker and called `_deferredFlush`, ~2,700 cold
  // calls of a 1,000-row filter's first key).
  const hover = _deferredFlush() || _hoverRule.on;
  for (let i = 0, k = 0; i < aEnd; i++) {
    const node = a[i];
    if (k < bLength && node === b[k]) k++;
    // A lazy row's server markers are inert (left in place): the expando test inline, no call and no `parentNode`
    // DOM call for the other nodes (EACH 2026-11-06: 1,800 of a 1,000-row filter's 2,700 dropped nodes).
    else if (DERIVED && (node as Node & { $rw?: unknown }).$rw !== undefined) _adoption.inert!(node);
    else if (node.parentNode === parent) hover ? drop(parent, node) : parent.removeChild(node);
  }
  return true;
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
  // Removals only (`b` a subsequence of `a`: a filter, deleted rows): one merge walk (`removals`).
  if (bLength < aEnd && removals(parent, a, b, aEnd)) return;
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
 * @internal Resume hooks, installed by the derived adopt run (`dom-derived.ts`, `dom-adopt-run.ts`; resumed pages only,
 * null on every other page): a `_for` takes the server rows.
 */
export const _adoption: {
  rows: ((owner: Owner | null, by: (item: never, index: number) => unknown, indexed: boolean) => AdoptedList | null) | null;
  /** Server item vs a fresh item of the same key: equal data (an adopted row keeps its nodes and resumed bindings). */
  same: ((server: unknown, fresh: unknown) => boolean) | null;
  /** Dev runtime only (`dev/dom.ts`): its per-component owners (production components own nothing), transparent to adoption. */
  dev: { has(owner: object): boolean } | null;
  /**
   * LAZY-ROWS T5 adopt runs (`dom-adopt.ts` `_adoptRow`), set only while one runs: every node the runtime creates the
   * same way in both runs passes through it (`kind` 0 a template clone or created element, 1 a text node of an array
   * child, 2 an anchor; a scalar insertion's text is not one: the adopt run's slot already holds the server's). The probe
   * run records them per kind in creation order; the adopt run gets the live server node each one maps to (the node itself
   * when none does).
   */
  node?: (<N extends Node>(node: N, kind: number) => N) | null;
  /** Each new insertion slot, in creation order (probe: recorded; adopt run: seeded with the live nodes the probe's slot held). */
  slot?: ((slot: InsertSlot) => void) | null;
  /**
   * True during an adopt run: element content is never wiped (`_spread` children, `_rcdata`), it is the server's; writes
   * the server's node already holds are skipped (`holds`, `soleText`; ADOPT-CONTENT).
   */
  live?: boolean;
  /** Adoption-scoped class ownership: probe records the first binding value; adopt keeps only foreign tokens. */
  classValue?: ((el: Element, value: unknown) => unknown) | undefined;
  /**
   * Derived model adopt runs (`dom-derived.ts`, `DERIVED` builds only): called first by every `_for` with its props; a
   * returned accessor replaces the list (probe run: a hole the alignment pairs with the server rows; adopt run: the list
   * taking those rows lazily), `undefined` lets `_for` run as usual.
   */
  list?: ((props: { each: unknown; by: unknown; children: (item: () => never, index: () => number) => unknown }) => (() => Node[]) | undefined) | null;
  /**
   * Row sample runs (`dom-derived.ts` / `dom-resume-lazy.ts` `sample`, `DERIVED` / `LAZY_ROWS` builds only): every `_fx1` binding goes through
   * it (the hook creates the binding itself), so the runtime learns which hoisted binding reads which keyed signal and
   * with which captures.
   */
  fx?: ((fn: (a: unknown, b: unknown, c: unknown) => void, a: unknown, b: unknown, c: unknown) => void) | null;
  /**
   * Derived model (`DERIVED` builds only): the tokens a lazily adopted `<For>`'s accessor returns while its items are the
   * server's — a slot holding one keeps what it holds (the server rows: no node list built); inside an array or a cell,
   * a token's `n()` gives the list's server nodes.
   */
  keep?: WeakSet<object>;
  /** A lazy slot snapshot as a plain array, captured at the first replacement and shared with its proxy. */
  snapshot?: (nodes: Node[]) => Node[];
  /**
   * Derived model adopt runs (`dom-derived.ts`, `DERIVED` builds only, DERIVED-C2): called first by every `Async` with its
   * props and `Async` itself; a returned value replaces it (an `Async` the server streamed or awaited: probe run a hole,
   * adopt run the server's nodes), `undefined` lets it run as usual.
   */
  async?: ((props: { load: unknown; children: unknown; fallback?: unknown }, self: (props: never) => unknown, user: boolean) => unknown) | null;
  /** Derived builds (`dom-derived.ts`, DERIVED-C3): a load suspended a `Suspense` — in a probe run its unit renders in the browser. */
  suspense?: (() => void) | null;
  /** Derived builds (`dom-derived.ts`, M6-PARITY task 3): in an adopt run, the server's seed of the next `resource()`. */
  resource?: (() => unknown) | null;
  /** Dev server only (`hot.ts`): the state-restoring `signal` hot replacement gives app code; the derived keyed signals
   * (`dom-derived.ts` `_sig`, compiled from app `signal()` calls) make theirs with it (dev names, state kept on edits). */
  signal?: (<T>(initial: T, options?: EqualsOptions<T>) => Signal<T>) | null;
  /** Dev runtime only (`dom-derived.ts` sets it, `dev/dom.ts` reads it): a probe run is rendering — its components are
   * discarded, so they report no mount to DevTools. */
  probe?: (() => boolean) | null;
  /**
   * Derived builds (`DERIVED` only): an insertion is mutating the DOM (`reconcile`, `replace`; no try / finally: it would
   * cost every build bytes, and a throwing DOM mutation breaks the page anyway). Moving or removing the focused node
   * fires focusout synchronously, mid-move; the resume runtime must not adopt anything for those
   * (`dom-derived.ts` `on`): a row adopting over a half-moved range stamped its neighbour's nodes (one row twice, one lost).
   */
  moving?: boolean;
  /**
   * Derived builds (`DERIVED` only, FILTER 2026-11-05): a comment that is a lazy list row's server marker (`<!--r…[-->`
   * opener or its `<!--]-->`, both of one row known). A dropped row leaves the pair in place (inert and empty: the event
   * path's sibling scan counts it balanced): 2 of its 3 removals, and their mutation records, off a long list's first filter.
   * Called with any node about to be removed (an expando read: false for every other node, EACH 2026-11-06).
   */
  inert?: ((node: Node) => boolean) | null;
} = { rows: null, same: null, dev: null };
/**
 * An empty text node bounding a row or list insertion; an adopt run (LAZY-ROWS T5) gets the server's anchor in its place
 * (`_adoption.node` kind 2). Builds without lazy rows fold it to `doc.createTextNode("")`.
 */
export const _anchor = (doc: Document): Text => (LAZY_ROWS && _adoption.node ? _adoption.node(doc.createTextNode(""), 2) : doc.createTextNode(""));
/** @internal Adopted server rows: their items, rows (server nodes between their markers) and server indexes (-1: index not read). */
export interface AdoptedList {
  items: unknown[];
  /** The server rows, each with its `ad` code set (see `_for`'s `adopted`). */
  rows: ForRow[];
  /** Rows at -3 (their own render read signals, unchanged so far): turns true once one changed — they are re-created then. */
  changed: (() => boolean) | null;
  /** Lazy rows (LAZY-ROWS T5): called once with the For's row function and item reader (kept rows materialise through them). */
  host?: ((children: (item: () => unknown, index: () => number) => unknown, read: (this: ForRow) => unknown) => void) | null;
  /**
   * Derived builds (`DERIVED` only, EACH 2026-11-06): the items a derived lazy list's slot just evaluated (the change that
   * builds this `_for`) and the signals that evaluation read. The first pass takes these items and subscribes to those
   * signals instead of running `each` again (~0.4 ms of a 1,000-row filter's first key at 4x CPU).
   */
  first?: { value: unknown[]; signals: readonly (() => unknown)[] } | null;
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
  /** An adopted server row's code (`_for`'s `adopted`), null for a client row: a field, not a per-list Map (FILTER2). */
  ad: number | null;
}
const NO_NODES: Node[] = [],
  NO_ROWS: readonly ForRow[] = [];
// The node list a `_for` accessor returned last: `assign` takes it as is (no `flatten` copy).
let forNodes: Node[] | null = null;
// `_for` accessors (and a derived lazy list's): read by the insertion that shows them, never through a cell (`cells`).
const forFns = new WeakSet<object>();
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
// `_for`'s merge walk (EACH): the new middle items `next[start..newEnd)` are old middle items in order, each one's key its
// old row's — those rows into `rows` (true), else false (the caller maps the old keys; `rows` is overwritten).
function inOrder(
  rows: ForRow[],
  list: ForRow[],
  items: readonly unknown[],
  next: readonly unknown[],
  by: ((item: never, index: number) => unknown) | undefined,
  start: number,
  end: number,
  newEnd: number,
): boolean {
  let j = start;
  for (let i = start; i < end && j < newEnd; i++)
    if (next[j] === items[i]) {
      const row = list[i]!;
      if ((by ? by(next[j] as never, j) : next[j]) !== row.key) return false;
      rows[j++] = row;
    }
  return j === newEnd;
}
// `_for`'s first pass over a derived slot's evaluation (`AdoptedList.first`): read (track) its signals, return its items.
function handed(first: NonNullable<AdoptedList["first"]>, _cleared: null): unknown[] {
  const signals = first.signals;
  for (let i = 0; i < signals.length; i++) signals[i]!();
  return first.value;
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
  if (DERIVED && _adoption.list) {
    const held = _adoption.list(props as never);
    if (held !== undefined) return (forFns.add(held), held);
  }
  const owner = getOwner(),
    // The insertion parent the list is created under: rows built later (effect re-runs) see it too, so
    // namespace-picking templates (`_tplNs`) parse like the first rows.
    parent = insertionParent,
    { by, children } = props,
    indexed = children.length > 1;
  let items: readonly T[] = [],
    list: ForRow[] = [],
    // Resume: whether `list` may hold adopted server rows. Their `ad` code: their server index (-1: the row did not read
    // it; -2: its own render read signals no site inside binds, so it is re-created on the first run, like a changed
    // item). They keep their resumed bindings, which read the server item: a changed item (or read index) re-creates the
    // row. A fresh item equal in data to the server one (refetched lists: same rows, new objects) keeps the row
    // (`_adoption.same`). -3: its own render read signals that still hold their server values: kept until `changed` turns
    // true, then re-created (a client row's own reads are untracked, but the server row has no binding for what they
    // decided).
    adopted = false,
    changed: (() => boolean) | null = null,
    // Every current row by key, kept across passes: matching and duplicate detection are O(changed rows), no
    // per-pass Set over kept rows (append 1k to 10k). null: rebuilt from `list` (first pass, after a throwing pass).
    keys: Map<unknown, ForRow> | null = null,
    first: AdoptedList["first"] = null;
  if (_adoption.rows !== null) {
    const taken = _adoption.rows(owner, by as (item: never, index: number) => unknown, indexed);
    if (taken !== null) ((adopted = true), ({ items: items as unknown[], rows: list, changed } = taken as AdoptedList));
    if (DERIVED && taken !== null) first = (taken as AdoptedList).first ?? null;
    if (LAZY_ROWS) taken?.host?.(children as (item: () => unknown, index: () => number) => unknown, itemRead);
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
    // Adopt run (LAZY-ROWS T5 builds): the anchors are the server nodes already in place (not moved into a fragment).
    const doc = host.doc(),
      start = (row.start = _anchor(doc)),
      end = (row.end = _anchor(doc)),
      frag = doc.createDocumentFragment();
    if (!LAZY_ROWS || start.parentNode === null) frag.append(start, end);
    _insert(null, out, end);
  };
  const create = (value: T, i: number, key: unknown): ForRow => {
    const row: ForRow = { value, key, sig: null, index: indexed ? signal(i) : null, nodes: null, start: null, end: null, owner: null, pass: forPass, ad: null };
    _rootIn(owner, build, row);
    return row;
  };
  // An effect maintains the rows (item/index writes are not allowed in a computed); the rows are
  // published through a signal that `_insert` reads, their nodes collected at that read: an inserted
  // row's content is re-rendered by its own effect after this one (an item write), so a snapshot taken
  // here would be stale. Like mapArray: rows whose item is unchanged at the common prefix/suffix are
  // kept without key work; keys are matched in the middle.
  const out = signal<readonly ForRow[]>(NO_ROWS, { equals: false });
  let published = false;
  effect(() => {
    // The derived slot's evaluation of this change (`AdoptedList.first`, taken once): its items, its signals tracked.
    const each = props.each,
      next = DERIVED && first ? (handed(first, (first = null)) as readonly T[]) : typeof each === "function" ? (each as () => readonly T[])() : each;
    if (changed !== null && changed()) {
      changed = null;
      for (const row of list) if (row.ad === -3) row.ad = -2;
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
          adopted = false;
          keys = changed = null;
          out.set(NO_ROWS);
          return;
        }
        let start = 0,
          end = m,
          newEnd = n;
        const limit = n < m ? n : m;
        // An adopted prefix row keeps its row when it passed last pass at this index: same item (`items` holds the values
        // the rows took), an index it did not read (-1), one it read and still shows, or a row kept until `changed` (-3; a
        // flip turned those -2 above: the keyed path re-creates them).
        if (!adopted) while (start < limit && next[start] === items[start]) start++;
        else
          for (let at: number | null; start < limit && next[start] === items[start]; start++)
            if ((at = list[start]!.ad) !== null && at !== -1 && at !== -3 && at !== start) break;
        // A prefix row keeps its index (so its key). A suffix row moves when the length changes: keep it only while its key
        // holds at the new index (an index-keyed `by` gives a moved equal item another key; keeping the row left its stale
        // key in `keys`, and the new row taking that key threw "Duplicate For key").
        while (
          !adopted &&
          end > start &&
          newEnd > start &&
          next[newEnd - 1] === items[end - 1] &&
          (n === m || !by || by(next[newEnd - 1]!, newEnd - 1) === list[end - 1]!.key)
        ) {
          end--;
          newEnd--;
        }
        // Same items in the same order after the rows were published (a filter's later keys keeping its rows): no row
        // work, and the rows signal stays — the list insertion does not re-collect and reconcile identical nodes (ranged
        // rows re-render in their own effects; the next read refreshes them). FILTER2 2026-11-05: ~0.5 ms of each later key
        // of a 1,000-row filter at 4x CPU. (A first pass over adopted rows equal to its items still publishes them.)
        if (start === n && n === m && published) return;
        const rows: ForRow[] = new Array(n);
        for (let i = 0; i < start; i++) rows[i] = list[i]!;
        for (let i = newEnd; i < n; i++) {
          const row = (rows[i] = list[i - n + m]!);
          if (row.index !== null && n !== m) row.index.set(i);
        }
        const pass = ++forPass;
        // No key map yet (an adopted list's first pass; DERIVED builds only — elsewhere only a pass after a throw has
        // none) and fewer new middle items than old middle rows: when the new middle items are the old ones in order (a
        // filter), each is matched to its old row by a merge walk (identity, its key checked) — no map of the m old keys
        // (EACH 2026-11-06: 1,000 sets of a 1,000-row filter's first key, ~0.3 ms at 4x CPU); the kept rows' map is built
        // after the pass.
        const sub = DERIVED && keys === null && newEnd - start < end - start && inOrder(rows, list, items, next, by, start, end, newEnd);
        let map = keys;
        if (map === null) {
          map = new Map();
          for (let i = 0; !sub && i < m; i++) map.set(list[i]!.key, list[i]!);
        }
        keys = null; // a throw below (duplicate key, row error) leaves it to be rebuilt from the untouched `list`
        // Old middle rows are free to match in this pass; any other row found by a new key (a kept prefix / suffix
        // row, or one matched or created earlier in this pass) is a duplicate.
        for (let i = start; i < end; i++) list[i]!.pass = -pass;
        let claimed = 0;
        for (let i = start; i < newEnd; i++) {
          const value = next[i]!,
            key = sub ? rows[i]!.key : by ? by(value, i) : value;
          let row = sub ? rows[i] : map.get(key);
          if (row !== undefined) {
            if (row.pass !== -pass) throw Error("Duplicate For key");
            row.pass = pass;
            claimed++;
            const at = row.ad;
            if (at !== null) {
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
        // More rows dropped than kept (a filter): a fresh map of the kept rows, not one delete per dropped row.
        const fresh = sub || end - start - claimed > n;
        for (let i = start; i < end; i++) {
          const row = list[i]!;
          if (row.pass === -pass) {
            if (!fresh) map.delete(row.key);
            // An adopted row the browser never ran owns nothing: no call (900 of a 1,000-row filter's first key).
            if (row.owner !== null) _dispose(row.owner);
          }
        }
        if (fresh) {
          map = new Map();
          for (let i = 0; i < n; i++) map.set(rows[i]!.key, rows[i]!);
        }
        keys = map;
        items = next.slice();
        list = rows;
        if (adopted) {
          let i = 0;
          while (i < n && rows[i]!.ad === null) i++;
          if (i === n) ((adopted = false), (changed = null));
        }
        published = true;
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
  const read = (): Node[] => {
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
  forFns.add(read);
  return read;
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
  let current: { i: number; v: unknown; owner: Owner | null; value: unknown } | null = null;
  const pick = computed(select, { equals: (a, c) => a.i === c.i && (!keyed(a.i) || Object.is(a.v, c.v)) });
  const update = ({ i, v }: Pick): unknown => {
    if (current !== null) {
      if (current.i === i && !(keyed(i) && !Object.is(current.v, v))) return current.value;
      _dispose(current.owner);
    }
    const next = { i, v, owner: null as Owner | null, value: undefined as unknown };
    // The fallback is read in the insertion's binding, not here: what it reads directly (`fallback={msg()}`, a ternary) stays
    // live, and an accessor it holds (a nested `Show` / `Switch` / `For`, a slot) is bound with its own tracking. Only a
    // function asking for the value is a render function: untracked, as branch content.
    if (i < 0) {
      next.value = () => {
        const c = content(i);
        if (typeof c === "function") return c.length ? _untrack1(c as (get: () => unknown) => unknown, () => v) : c;
        if (c === null || typeof c !== "object" || (c as Node).nodeType !== 11) return c;
        // A fragment's nodes are captured once: inserting it empties it.
        if (!eager.has(i)) eager.set(i, Array.from((c as Node).childNodes));
        return eager.get(i);
      };
      current = next;
      return next.value;
    }
    const c = content(i);
    if (typeof c === "function") {
      const get = keyed(i) ? () => v : live(i);
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
