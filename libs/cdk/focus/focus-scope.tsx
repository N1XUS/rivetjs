// FocusScope: focus containment (Tab / Shift+Tab wrap, focus pulled back when it escapes), focus
// restoration on unmount (and Tab out of a restoring scope continues after the restore target), auto
// focus on mount, nested scopes (the innermost active scope wins; a child scope rendered elsewhere,
// e.g. a portal, links to its parent), and a focus manager.
// Ported from @react-aria/focus FocusScope (react-spectrum), Apache-2.0, © Adobe.
//
// Rivet deviations (resumability: the DOM is the scope tree, no component code runs on resumed pages):
// - The scope is a wrapper `<div data-rv-focus-scope style="display:contents">` (the original uses two
//   hidden sentinel spans around the children). Nesting is DOM nesting; a scope rendered outside its
//   parent's subtree carries `data-rv-focus-parent` (set at mount from the active scope, the
//   original's re-parenting rule).
// - `useFocusManager()` resolves the scope from the focused element at call time (the original reads
//   it from context: Rivet evaluates children before their parent, so context cannot reach them).
// - Containment / restore / auto focus run in a client effect (resumed pages: when the scope is
//   visible); a resumable keydown handler on the wrapper contains Tab before that. A server-rendered
//   `autoFocus` scope whose effect wakes after the user moved focus elsewhere leaves focus alone
//   (`focusMovedByUser`; React runs the effect at hydration, before any interaction).
import { clientEffect, ref } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { createId } from "../utils/id.ts";
import { focusMovedByUser, focusSafely, getFocusableTreeWalker, type FocusManager, type FocusManagerOptions } from "./index.ts";
import { getInteractionModality } from "../interactions/focus-visible.tsx";
import {
  browserDocument,
  getActiveElement,
  getEventTarget,
  getOwnerDocument,
  isAndroid,
  isChrome,
  nodeContains,
  type FocusableElement,
} from "../interactions/utils.ts";
import { cssEscape } from "../utils/dom.ts";

export type { FocusManager, FocusManagerOptions } from "./index.ts";

export interface FocusScopeProps {
  /** Contain focus inside the scope (users cannot move focus outside, e.g. a modal). */
  contain?: boolean;
  /** Restore focus to the element focused when the scope mounted, after it unmounts. */
  restoreFocus?: boolean;
  /** Focus the first focusable element of the scope on mount. */
  autoFocus?: boolean;
  /** Class of the wrapper element (it renders `display: contents`). */
  class?: string;
  children?: Content;
}

const SCOPE = "data-rv-focus-scope";
const PARENT = "data-rv-focus-parent";
const CONTAIN = "data-rv-contain";
const RESTORE_FOCUS_EVENT = "rv-focus-scope-restore";

interface ScopeData {
  nodeToRestore?: FocusableElement;
  focusedNode?: FocusableElement;
  raf?: number;
}

// Browser-only module state (never serialized): the active scope and per-scope bookkeeping.
// (one object: resume-extracted symbols import module bindings read-only)
const g: { activeScope: Element | null } = { activeScope: null };
const scopes = new WeakMap<Element, ScopeData>();
const data = (scope: Element): ScopeData => scopes.get(scope) ?? (scopes.set(scope, {}), scopes.get(scope)!);

/** The parent scope of `scope` (explicit link, else the nearest enclosing scope). */
function parentOf(scope: Element): Element | null {
  const link = scope.getAttribute(PARENT);
  if (link) {
    const found = scope.ownerDocument.querySelector(`[${SCOPE}="${cssEscape(link)}"]`);
    if (found) return found;
  }
  return scope.parentElement?.closest(`[${SCOPE}]`) ?? null;
}

/** The innermost scope containing `element`. */
function scopeOf(element: Element | null | undefined): Element | null {
  return element?.closest?.(`[${SCOPE}]`) ?? null;
}

function isAncestorScope(ancestor: Element | null, scope: Element | null): boolean {
  for (let parent = scope && parentOf(scope); parent; parent = parentOf(parent)) if (parent === ancestor) return true;
  return false;
}

function isElementInScope(element: Element | null | undefined, scope: Element | null | undefined): boolean {
  return !!element && !!scope && nodeContains(scope, element);
}

/** `element` is in `scope` or one of its child scopes (portaled ones included); `null` = any scope. */
function isElementInChildScope(element: Element | null | undefined, scope: Element | null = null): boolean {
  if (!element) return false;
  // Top-layer elements (toasts) always accept focus.
  if (element instanceof Element && element.closest("[data-rv-top-layer]")) return true;
  let s = scopeOf(element);
  if (!scope) return !!s;
  for (; s; s = parentOf(s)) if (s === scope) return true;
  return false;
}

/** @private Whether `element` is in a child scope of the active scope. */
export function isElementInChildOfActiveScope(element: Element): boolean {
  return isElementInChildScope(element, g.activeScope);
}

function shouldContainFocus(scope: Element): boolean {
  for (let s = g.activeScope; s && s !== scope; s = parentOf(s)) if (s.hasAttribute(CONTAIN)) return false;
  return true;
}

function shouldRestoreFocus(scope: Element): boolean {
  let s = g.activeScope;
  for (; s && s !== scope; s = parentOf(s)) if (scopes.get(s)?.nodeToRestore) return false;
  return s === scope;
}

function focusElement(element: FocusableElement | null | undefined, scroll = false): void {
  if (element == null) return;
  try {
    if (scroll) element.focus();
    else focusSafely(element);
  } catch {
    // ignore
  }
}

function getFirstInScope(scope: Element, tabbable = true): FocusableElement | null {
  let next = getFocusableTreeWalker(scope, { tabbable }).nextNode();
  // No tabbable element: the first focusable one.
  if (tabbable && !next) next = getFocusableTreeWalker(scope, { tabbable: false }).nextNode();
  return next as FocusableElement | null;
}

function focusFirstInScope(scope: Element, tabbable = true): void {
  focusElement(getFirstInScope(scope, tabbable));
}

/** Tab / Shift+Tab inside a containing scope: next / previous tabbable, wrapping. Returns true when handled. */
function containTab(scope: Element, e: KeyboardEvent, focused: Element | null): boolean {
  if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey || e.isComposing || e.defaultPrevented || !shouldContainFocus(scope)) return false;
  if (!focused || !isElementInScope(focused, scope)) return false;
  const walker = getFocusableTreeWalker(scope, { tabbable: true });
  walker.currentNode = focused;
  let next = (e.shiftKey ? walker.previousNode() : walker.nextNode()) as FocusableElement | null;
  if (!next) {
    walker.currentNode = scope;
    next = (e.shiftKey ? lastChild(walker) : walker.nextNode()) as FocusableElement | null;
  }
  e.preventDefault();
  if (next) {
    focusElement(next, true);
    if (next instanceof HTMLInputElement) next.select();
  }
  return true;
}

function lastChild(walker: TreeWalker): Node | null {
  let found: Node | null = null;
  for (let last = walker.lastChild(); last; last = walker.lastChild()) found = last;
  return found;
}

/**
 * @internal Resumable keydown handler of the wrapper: containment works before the client effect
 * installed its document listeners (first Tab on a resumed page).
 */
export function scopeKeyDown(e: KeyboardEvent): void {
  const scope = e.currentTarget as Element;
  if (!scope.hasAttribute(CONTAIN)) return;
  // The key's target, not activeElement: on a resumed page the browser may already have moved focus.
  const target = getEventTarget<Element>(e);
  if (!g.activeScope && isElementInScope(target, scope)) g.activeScope = scope;
  containTab(scope, e, target);
}

interface Mount {
  scope: Element;
  contain: boolean;
  restoreFocus: boolean;
  autoFocus: boolean;
  nodeToRestore: FocusableElement | null;
  /** Rendered by the server (mount effect running on a resumed page): auto focus skips when the user moved focus. */
  resumed?: boolean;
}

/** @internal Client effect of FocusScope: link to the tree, contain, track, auto focus; returns cleanup. */
export function mountScope(mount: Mount): () => void {
  const { scope, contain, restoreFocus, autoFocus } = mount;
  const doc = getOwnerDocument(scope);
  const own = data(scope);
  const cleanups: (() => void)[] = [];
  const listen = (target: EventTarget, type: string, fn: EventListener, options?: boolean) => {
    target.addEventListener(type, fn, options);
    cleanups.push(() => target.removeEventListener(type, fn, options));
  };
  // A scope mounting outside the active scope (a dialog launched from a menu) gets it as its parent.
  if (!scope.parentElement?.closest(`[${SCOPE}]`) && !scope.hasAttribute(PARENT) && g.activeScope && g.activeScope !== scope && g.activeScope.isConnected)
    scope.setAttribute(PARENT, g.activeScope.getAttribute(SCOPE)!);
  // Stop the custom restore event from reaching parent scopes.
  const stop = (e: Event) => e.stopPropagation();
  listen(scope, RESTORE_FOCUS_EVENT, stop);

  if (contain) {
    listen(doc, "keydown", ((e: KeyboardEvent) => void containTab(scope, e, getActiveElement(doc))) as EventListener, false);
    const onFocus = (e: Event) => {
      const target = getEventTarget<Element>(e);
      // Focus in a child scope of the active scope: it becomes active. Moving to an ancestor is not allowed.
      if ((!g.activeScope || isAncestorScope(g.activeScope, scope)) && isElementInScope(target, scope)) {
        g.activeScope = scope;
        own.focusedNode = target as FocusableElement;
      } else if (shouldContainFocus(scope) && !isElementInChildScope(target, scope)) {
        // Focus escaped (e.g. from the browser location bar): back to the last focused node or the first tabbable.
        if (own.focusedNode?.isConnected) focusElement(own.focusedNode);
        else if (g.activeScope) focusFirstInScope(g.activeScope);
      } else if (shouldContainFocus(scope)) own.focusedNode = target as FocusableElement;
    };
    listen(doc, "focusin", onFocus, false);
    const onBlur = (e: Event) => {
      // Firefox does not move focus back to the dialog without this.
      if (own.raf) cancelAnimationFrame(own.raf);
      own.raf = requestAnimationFrame(() => {
        // Android Chrome TalkBack: focus coercion traps the virtual cursor; skip.
        const modality = getInteractionModality();
        const skip = (modality === "virtual" || modality === null) && isAndroid() && isChrome();
        // activeElement, not relatedTarget: clicks into iframes count.
        const active = getActiveElement(doc);
        if (!skip && active && shouldContainFocus(scope) && !isElementInChildScope(active, scope)) {
          g.activeScope = scope;
          const target = getEventTarget<FocusableElement>(e);
          if (target && target.isConnected) {
            own.focusedNode = target;
            focusElement(target);
          } else focusFirstInScope(scope);
        }
      });
    };
    listen(scope, "focusout", onBlur, false);
    cleanups.push(() => own.raf && cancelAnimationFrame(own.raf));
  } else if (restoreFocus) {
    // Restoring, non-containing scopes track becoming active.
    listen(doc, "focusin", () => {
      if ((!g.activeScope || isAncestorScope(g.activeScope, scope)) && isElementInScope(getActiveElement(doc), scope)) g.activeScope = scope;
    });
  } else {
    // Active scope tracking without contain / restore.
    listen(doc, "focusin", (e: Event) => {
      const target = getEventTarget<Element>(e);
      if (isElementInScope(target, scope)) g.activeScope = scope;
      else if (!isElementInChildScope(target)) g.activeScope = null;
    });
  }

  if (restoreFocus) {
    own.nodeToRestore = mount.nodeToRestore && mount.nodeToRestore !== doc.body ? mount.nodeToRestore : undefined;
    // Tab out of a restoring scope continues after the node to restore (overlays rendered elsewhere).
    if (!contain)
      listen(
        doc,
        "keydown",
        ((e: KeyboardEvent) => {
          if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey || !shouldContainFocus(scope) || e.isComposing) return;
          const focused = doc.activeElement as FocusableElement;
          if (!isElementInChildScope(focused, scope) || !shouldRestoreFocus(scope)) return;
          let nodeToRestore = current(own.nodeToRestore);
          const walker = getFocusableTreeWalker(doc.body, { tabbable: true });
          walker.currentNode = focused;
          let next = (e.shiftKey ? walker.previousNode() : walker.nextNode()) as FocusableElement | null;
          if (!nodeToRestore || !nodeToRestore.isConnected || nodeToRestore === doc.body) nodeToRestore = own.nodeToRestore = undefined;
          if ((!next || !isElementInChildScope(next, scope)) && nodeToRestore) {
            walker.currentNode = nodeToRestore;
            // Skip elements within the scope (it may directly follow the node to restore).
            do next = (e.shiftKey ? walker.previousNode() : walker.nextNode()) as FocusableElement | null;
            while (isElementInChildScope(next, scope));
            e.preventDefault();
            e.stopPropagation();
            if (next) focusElement(next, true);
            // Leaving the top-level scope: blur to the body; else back to the restore target.
            else if (!isElementInChildScope(nodeToRestore)) focused.blur();
            else focusElement(nodeToRestore, true);
          }
        }) as EventListener,
        true,
      );
  }

  // Becomes the active scope when it already holds focus (bottom-most scope containing it).
  const active = getActiveElement(doc);
  if (isElementInScope(active, scope) && scopeOf(active) === scope) g.activeScope = scope;

  if (autoFocus && !(mount.resumed && !isElementInScope(getActiveElement(doc), scope) && focusMovedByUser(doc))) {
    g.activeScope = scope;
    if (!isElementInScope(getActiveElement(doc), scope)) focusFirstInScope(scope);
  }

  return () => {
    for (const cleanup of cleanups.splice(0)) cleanup();
    const parent = parentOf(scope);
    // Restore chain captured now: the scope leaves the tree before the frame.
    const chain: Element[] = [];
    for (let s: Element | null = scope; s; s = parentOf(s)) chain.push(s);
    const wasActive = scope === g.activeScope || isAncestorScope(scope, g.activeScope);
    // Restore targets resolved now (`current`): a same-id element created after the unmount (the next page of a
    // client navigation that removed this scope with its trigger) is no replacement.
    const nodeToRestore = current(own.nodeToRestore);
    const targets = chain.map((s) => (s === scope ? nodeToRestore : current(scopes.get(s)?.nodeToRestore)));
    const focused = getActiveElement(doc);
    const restoring =
      restoreFocus && nodeToRestore && ((focused && isElementInChildScope(focused, scope)) || (focused === doc.body && shouldRestoreFocus(scope)));
    if (wasActive && (!parent || parent.isConnected)) g.activeScope = parent;
    // Sibling scopes restoring into this scope restore to this scope's target instead.
    if (nodeToRestore)
      for (const other of doc.querySelectorAll(`[${SCOPE}]`)) {
        const d = scopes.get(other);
        if (other !== scope && d?.nodeToRestore && isElementInScope(d.nodeToRestore, scope)) d.nodeToRestore = nodeToRestore;
      }
    if (restoring)
      requestAnimationFrame(() => {
        // Only when focus was lost to the body (otherwise it moved somewhere on purpose).
        if (doc.activeElement !== doc.body) return;
        for (const target of targets) if (target?.isConnected) return restoreFocusToElement(target);
        // No restore target left: the first element of the nearest connected ancestor scope.
        for (const s of chain.slice(1))
          if (s.isConnected) {
            const node = getFirstInScope(s, true);
            if (node) return restoreFocusToElement(node);
          }
      });
  };
}

// Rivet: a resumed page re-creates a server-rendered region on its first change, replacing the trigger
// that was focused when the scope rendered: restore to its replacement (same id). Only a replacement present
// while the scope is still mounted (the unmount resolves its targets at once): one created later belongs to
// another page, and React Aria restores to the connected original only.
function current(node: FocusableElement | undefined): FocusableElement | undefined {
  if (!node || node.isConnected || !node.id) return node;
  return (node.ownerDocument.getElementById(node.id) as FocusableElement | null) ?? node;
}

function restoreFocusToElement(node: FocusableElement): void {
  // Parents may intercept (virtualized collections reuse elements).
  if (node.dispatchEvent(new CustomEvent(RESTORE_FOCUS_EVENT, { bubbles: true, cancelable: true }))) focusElement(node);
}

/**
 * Manages focus for its descendants: containment, restore on unmount, auto focus on mount, and the
 * scope a `useFocusManager()` resolves to.
 */
export function FocusScope(props: FocusScopeProps) {
  const contain = !!props.contain,
    restoreFocus = !!props.restoreFocus,
    autoFocus = !!props.autoFocus;
  const id = createId();
  const scope = ref<HTMLDivElement>();
  // Saved during render (before an autoFocus child mounts), like the original. Server: none.
  const doc = browserDocument();
  const nodeToRestore = doc ? (getActiveElement(doc) as FocusableElement | null) : null;
  const resumed = !doc;
  clientEffect(() => {
    const element = scope();
    if (!element) return;
    return mountScope({ scope: element, contain, restoreFocus, autoFocus, nodeToRestore, resumed });
  });
  return (
    <div
      ref={scope}
      class={props.class}
      style={{ display: "contents" }}
      data-rv-focus-scope={id}
      data-rv-contain={contain ? "" : undefined}
      onKeyDown={contain ? (event) => scopeKeyDown(event) : undefined}
    >
      {props.children}
    </div>
  );
}

function scopeFrom(element: Element | null | undefined): Element | null {
  const doc = browserDocument();
  return scopeOf(element ?? (doc ? getActiveElement(doc) : null));
}

/** @internal FocusManager methods bound to the scope of `from` / the focused element. */
export function scopeFocusNext(opts: FocusManagerOptions = {}): FocusableElement | null {
  const scope = scopeFrom(opts.from);
  if (!scope) return null;
  const { from, tabbable, wrap, accept } = opts;
  const node = from || getActiveElement(getOwnerDocument(scope));
  const walker = getFocusableTreeWalker(scope, { tabbable, accept });
  walker.currentNode = isElementInScope(node, scope) ? node! : scope;
  let next = walker.nextNode() as FocusableElement | null;
  if (!next && wrap) {
    walker.currentNode = scope;
    next = walker.nextNode() as FocusableElement | null;
  }
  if (next) focusElement(next, true);
  return next;
}

/** @internal */
export function scopeFocusPrevious(opts: FocusManagerOptions = {}): FocusableElement | null {
  const scope = scopeFrom(opts.from);
  if (!scope) return null;
  const { from, tabbable, wrap, accept } = opts;
  const node = from || getActiveElement(getOwnerDocument(scope));
  const walker = getFocusableTreeWalker(scope, { tabbable, accept });
  let previous: FocusableElement | null;
  if (isElementInScope(node, scope)) {
    walker.currentNode = node!;
    previous = walker.previousNode() as FocusableElement | null;
  } else {
    walker.currentNode = scope;
    previous = lastChild(walker) as FocusableElement | null;
  }
  if (!previous && wrap) {
    walker.currentNode = scope;
    previous = lastChild(walker) as FocusableElement | null;
  }
  if (previous) focusElement(previous, true);
  return previous;
}

/** @internal */
export function scopeFocusFirst(opts: FocusManagerOptions = {}): FocusableElement | null {
  const scope = scopeFrom(opts.from);
  if (!scope) return null;
  const next = getFocusableTreeWalker(scope, { tabbable: opts.tabbable, accept: opts.accept }).nextNode() as FocusableElement | null;
  if (next) focusElement(next, true);
  return next;
}

/** @internal */
export function scopeFocusLast(opts: FocusManagerOptions = {}): FocusableElement | null {
  const scope = scopeFrom(opts.from);
  if (!scope) return null;
  const walker = getFocusableTreeWalker(scope, { tabbable: opts.tabbable, accept: opts.accept });
  walker.currentNode = scope;
  const previous = lastChild(walker) as FocusableElement | null;
  if (previous) focusElement(previous, true);
  return previous;
}

/**
 * A FocusManager for the FocusScope holding focus (or `opts.from`). Call its methods from handlers;
 * the object is resumable (captured by a handler it serializes as symbols).
 */
export function useFocusManager(): FocusManager {
  return {
    focusNext: (opts?: FocusManagerOptions) => scopeFocusNext(opts),
    focusPrevious: (opts?: FocusManagerOptions) => scopeFocusPrevious(opts),
    focusFirst: (opts?: FocusManagerOptions) => scopeFocusFirst(opts),
    focusLast: (opts?: FocusManagerOptions) => scopeFocusLast(opts),
  };
}
