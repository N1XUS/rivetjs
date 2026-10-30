// Delegated DOM events (moved out of `dom-v2.ts`, ZERO R4 2026-10-25): one listener per type per document dispatches to
// handlers stored on the nodes (`$r<type>`), under the owner that bound them. A leaf module so the lite resume runtime
// (`dom-lite.ts`) and every client render share ONE table (one document listener per type, whatever bound it) without
// pulling the rest of the DOM ABI into the lite chunk. `dom-v2.ts` re-exports `_on` / `_listen` / `_delegateBelow`.
import { _dispatch, getOwner, onCleanup } from "@rivetjs/reactivity";
import type { Owner } from "@rivetjs/reactivity";
import { _constructionDoc } from "./dom-base.ts";

const delegated = new WeakMap<Document, Set<string>>();
// The last registered type's key and the last document's delegated types: consecutive handlers of one type skip the
// key lookup, every handler of one document the WeakMap lookup.
let lastDoc: Document | null = null,
  lastTypes: Set<string> | null = null,
  lastType = "",
  lastKey = "";
// `"$r" + type` per delegated type, made once: a fresh concatenation per bind is a new string the keyed store must
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
 * the resumed handlers run from the loader's document capture listener, ahead of this module's bubble listener. `stop`
 * = the document: every delegated handler on the path (a lazy row's cold replay, which has no resumed ancestor; a lite
 * runtime replay, `dom-lite.ts`; any build, not only lazy-rows ones). True
 * when a handler stopped propagation (the ancestor's handler must not run).
 */
export function _delegateBelow(event: Event, stop: Element | Document): boolean {
  if (!event.bubbles || !delegated.get(stop.ownerDocument ?? (stop as Document))?.has(event.type)) return false;
  return delegate(event, stop);
}
/**
 * Resume (`dom-derived.ts` replay, RESUME-FIX A1): the delegated handlers of `event` ran already — the default of a held
 * event its replay dispatches (the loader's `requestSubmit()`, a link's re-dispatched click) reaches native listeners and
 * the browser, never the handlers that ran on the held event a second time.
 */
export const _delegated = (event: Event): void => void ranTo.set(event, -1);
function delegate(event: Event, stop: Node | null): boolean {
  const done = ranTo.get(event);
  if (done === -1) return true;
  const key = "$r" + event.type,
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
  // The last type's key string is reused: a fresh `"$r" + type` per call is a new string the keyed store must
  // internalize first (krausest create10k script overhead −8%); other types come from `KEYS`.
  let key = lastKey;
  const same = type === lastType;
  if (!same) {
    key = KEYS[type] ??= "$r" + type;
    lastType = type;
    lastKey = key;
  }
  (el as unknown as Handlers)[key] = checked(handler);
  (el as unknown as { $$o: Owner | null }).$$o = getOwner();
  const doc = _constructionDoc();
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
