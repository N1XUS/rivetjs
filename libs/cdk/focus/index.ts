// Focus management: containment (Tab trap), restore, roving tabindex, inert outside, for overlays
// (the div overlay layer; `<FocusScope>` for components), composite widgets and custom roots.
import { tabbables } from "../a11y/index.ts";
import {
  getActiveElement,
  getOwnerDocument,
  isFocusable as isFocusableElement,
  isTabbable as isTabbableElement,
  nodeContains,
  focusWithoutScrolling,
  runAfterTransition,
  type FocusableElement,
} from "../interactions/utils.ts";
import { getInteractionModality } from "../interactions/focus-visible.tsx";
import { cssEscape } from "../utils/dom.ts";

/**
 * Rivet: the mount effect of a server-rendered element (auto focus of a Dialog / FocusScope / `autoFocus`)
 * runs on a resumed page when its chunk wakes (idle / visible), possibly after the user moved focus — React
 * runs it at hydration, before any interaction. True when focus already left the body: auto focus then
 * leaves it where the user put it.
 */
export function focusMovedByUser(doc: Document): boolean {
  const active = getActiveElement(doc);
  return !!active && active !== doc.body && active !== doc.documentElement;
}

/** Focus the first tabbable element inside `scope` (or `scope` itself when focusable); returns it. */
export function focusFirst(scope: Element): HTMLElement | null {
  const target = tabbables(scope)[0] ?? null;
  target?.focus();
  return target;
}

/** Focus the last tabbable element inside `scope`; returns it. */
export function focusLast(scope: Element): HTMLElement | null {
  const list = tabbables(scope);
  const target = list[list.length - 1] ?? null;
  target?.focus();
  return target;
}

/**
 * Keydown handler body that keeps Tab / Shift+Tab inside `scope` (wraps at the ends). Wire it on the
 * scope element: `onKeyDown={(e) => containFocus(e.currentTarget, e)}`. Returns true when it moved focus.
 */
export function containFocus(scope: Element, event: KeyboardEvent): boolean {
  if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return false;
  const list = tabbables(scope);
  if (!list.length) {
    event.preventDefault();
    return true;
  }
  // The element the key was pressed on, not `activeElement`: on a resumed page the first Tab runs
  // this after the chunk loaded, when the browser has already moved focus (from the middle item to
  // the last one, say) — comparing that new focus with the ends would wrap one step too early.
  const first = list[0]!,
    last = list[list.length - 1]!,
    target = event.target instanceof Element ? event.target : null,
    active = target && target !== scope ? target : scope.ownerDocument.activeElement;
  const outside = !active || !scope.contains(active);
  if (event.shiftKey && (active === first || outside)) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && (active === last || outside)) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}

/**
 * Remember the focused element now; the returned function focuses it again (if still connected and
 * focus is not already elsewhere outside `within`). Use around custom overlays: save on open, call on close.
 */
export function saveFocus(within?: Element | null): () => void {
  const previous = typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null);
  return () => {
    const active = document.activeElement;
    const lost = !active || active === document.body || (within ? within.contains(active) : true);
    if (previous?.isConnected && lost) previous.focus({ preventScroll: true });
  };
}

/**
 * Roving tabindex: make `item` the only tabbable item among `items` (tabindex 0, others -1) and focus
 * it. Server markup renders the same tabindex values from state (`tabIndex={focused === key ? 0 : -1}`).
 */
export function roveFocus(items: Iterable<Element>, item: HTMLElement, options?: FocusOptions): void {
  for (const other of items) if (other !== item) other.setAttribute("tabindex", "-1");
  item.setAttribute("tabindex", "0");
  item.focus(options);
}

/**
 * Make everything outside `element` inert (siblings of it and of each ancestor up to `<body>`); the
 * returned function restores the previous `inert` values. For custom modal surfaces (the overlay
 * components use `ariaHideOutside`).
 */
export function inertOutside(element: Element): () => void {
  const changed: Element[] = [];
  for (let node: Element | null = element; node && node !== document.body; node = node.parentElement) {
    const parent: Element | null = node.parentElement;
    if (!parent) break;
    for (const sibling of parent.children)
      if (sibling !== node && !sibling.hasAttribute("inert") && sibling.localName !== "script") {
        sibling.setAttribute("inert", "");
        changed.push(sibling);
      }
  }
  return () => {
    for (const el of changed) el.removeAttribute("inert");
  };
}

// --- react-aria focus utilities ---------------------------------------------------------------------
// Ported from @react-aria/focus (FocusScope.tsx: getFocusableTreeWalker, createFocusManager) and
// @react-aria/interactions focusSafely (react-spectrum), Apache-2.0, © Adobe.

export interface FocusManagerOptions {
  /** Element to start from (default: the focused element). */
  from?: Element;
  /** Only tabbable elements (default: all focusable). */
  tabbable?: boolean;
  /** Wrap around at the ends. */
  wrap?: boolean;
  /** Filter: whether an element may receive focus. */
  accept?: (node: Element) => boolean;
}

export interface FocusManager {
  /** Focus the next focusable / tabbable element in the scope. */
  focusNext(opts?: FocusManagerOptions): FocusableElement | null;
  /** Focus the previous focusable / tabbable element in the scope. */
  focusPrevious(opts?: FocusManagerOptions): FocusableElement | null;
  /** Focus the first focusable / tabbable element in the scope. */
  focusFirst(opts?: FocusManagerOptions): FocusableElement | null;
  /** Focus the last focusable / tabbable element in the scope. */
  focusLast(opts?: FocusManagerOptions): FocusableElement | null;
}

/**
 * Focus `element` without scrolling; when a screen reader's virtual cursor drives the interaction,
 * wait for running CSS transitions first (VoiceOver on iOS scrolls to transitioning elements).
 */
export function focusSafely(element: FocusableElement): void {
  if (!element.isConnected) return;
  const doc = getOwnerDocument(element);
  if (getInteractionModality() === "virtual") {
    const last = getActiveElement(doc);
    runAfterTransition(() => {
      const active = getActiveElement(doc);
      // Focus did not move (or was lost to the body) meanwhile.
      if ((active === last || active === doc.body) && element.isConnected) focusWithoutScrolling(element);
    });
  } else focusWithoutScrolling(element);
}

function getRadiosInGroup(element: HTMLInputElement): HTMLInputElement[] {
  if (!element.form)
    return [...getOwnerDocument(element).querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${cssEscape(element.name)}"]`)].filter(
      (radio) => !radio.form,
    );
  const list = element.form.elements.namedItem(element.name);
  if (list instanceof RadioNodeList) return [...list].filter((el): el is HTMLInputElement => el instanceof HTMLInputElement);
  if (list instanceof HTMLInputElement) return [list];
  return [];
}

function isTabbableRadio(element: HTMLInputElement): boolean {
  if (element.checked) return true;
  const radios = getRadiosInGroup(element);
  return radios.length > 0 && !radios.some((radio) => radio.checked);
}

/** Whether `element` is inside one of the `scope` nodes. */
export function isElementInScope(element: Element | null | undefined, scope: Element[] | null | undefined): boolean {
  if (!element || !scope) return false;
  return scope.some((node) => nodeContains(node, element));
}

/**
 * A TreeWalker over the focusable (or tabbable) elements of `root` — radio groups collapse to their
 * tab stop, `from`'s subtree is skipped, `scope` limits the nodes, `accept` filters.
 */
export function getFocusableTreeWalker(root: Element, opts?: FocusManagerOptions, scope?: Element[]): TreeWalker {
  const filter = opts?.tabbable ? isTabbableElement : isFocusableElement;
  const rootElement = root?.nodeType === Node.ELEMENT_NODE ? root : null;
  const doc = getOwnerDocument(rootElement);
  const walker: TreeWalker = doc.createTreeWalker(root || doc, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      // Skip nodes inside the starting node.
      if (nodeContains(opts?.from, node)) return NodeFilter.FILTER_REJECT;
      const element = node as Element;
      if (opts?.tabbable && element.tagName === "INPUT" && element.getAttribute("type") === "radio") {
        if (!isTabbableRadio(element as HTMLInputElement)) return NodeFilter.FILTER_REJECT;
        // Same group as the current node, none checked: skip.
        const current = walker.currentNode as HTMLInputElement;
        if (current.tagName === "INPUT" && current.type === "radio" && current.name === (element as HTMLInputElement).name) return NodeFilter.FILTER_REJECT;
      }
      if (filter(element) && (!scope || isElementInScope(element, scope)) && (!opts?.accept || opts.accept(element))) return NodeFilter.FILTER_ACCEPT;
      return NodeFilter.FILTER_SKIP;
    },
  });
  if (opts?.from) walker.currentNode = opts.from;
  return walker;
}

function lastNode(walker: TreeWalker): FocusableElement | undefined {
  let next: FocusableElement | undefined;
  let last: FocusableElement | null;
  do {
    last = walker.lastChild() as FocusableElement | null;
    if (last) next = last;
  } while (last);
  return next;
}

function focusElement(element: FocusableElement | null, scroll = false): void {
  if (element == null) return;
  try {
    if (scroll) element.focus();
    else focusSafely(element);
  } catch {
    // ignore
  }
}

type RootRef = (() => Element | null | undefined) | { current: Element | null };
const rootOf = (ref: RootRef): Element | null | undefined => (typeof ref === "function" ? ref() : ref.current);

/**
 * A FocusManager moving focus within `ref`'s element (react-aria `createFocusManager`). `ref`: a
 * `ref()` object, an element accessor or `{ current }`. Browser only (call it in handlers).
 */
export function createFocusManager(ref: RootRef, defaultOptions: FocusManagerOptions = {}): FocusManager {
  return {
    focusNext(opts: FocusManagerOptions = {}) {
      const root = rootOf(ref);
      if (!root) return null;
      const { from, tabbable = defaultOptions.tabbable, wrap = defaultOptions.wrap, accept = defaultOptions.accept } = opts;
      const node = from || getActiveElement(getOwnerDocument(root));
      const walker = getFocusableTreeWalker(root, { tabbable, accept });
      if (nodeContains(root, node)) walker.currentNode = node!;
      let next = walker.nextNode() as FocusableElement | null;
      if (!next && wrap) {
        walker.currentNode = root;
        next = walker.nextNode() as FocusableElement | null;
      }
      if (next) focusElement(next, true);
      return next;
    },
    focusPrevious(opts: FocusManagerOptions = defaultOptions) {
      const root = rootOf(ref);
      if (!root) return null;
      const { from, tabbable = defaultOptions.tabbable, wrap = defaultOptions.wrap, accept = defaultOptions.accept } = opts;
      const node = from || getActiveElement(getOwnerDocument(root));
      const walker = getFocusableTreeWalker(root, { tabbable, accept });
      if (nodeContains(root, node)) walker.currentNode = node!;
      else {
        const next = lastNode(walker);
        if (next) focusElement(next, true);
        return next ?? null;
      }
      let previous = walker.previousNode() as FocusableElement | null;
      if (!previous && wrap) {
        walker.currentNode = root;
        const last = lastNode(walker);
        if (!last) return null;
        previous = last;
      }
      if (previous) focusElement(previous, true);
      return previous ?? null;
    },
    focusFirst(opts: FocusManagerOptions = defaultOptions) {
      const root = rootOf(ref);
      if (!root) return null;
      const { tabbable = defaultOptions.tabbable, accept = defaultOptions.accept } = opts;
      const next = getFocusableTreeWalker(root, { tabbable, accept }).nextNode() as FocusableElement | null;
      if (next) focusElement(next, true);
      return next;
    },
    focusLast(opts: FocusManagerOptions = defaultOptions) {
      const root = rootOf(ref);
      if (!root) return null;
      const { tabbable = defaultOptions.tabbable, accept = defaultOptions.accept } = opts;
      const next = lastNode(getFocusableTreeWalker(root, { tabbable, accept }));
      if (next) focusElement(next, true);
      return next ?? null;
    },
  };
}
