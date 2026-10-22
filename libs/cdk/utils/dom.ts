// DOM helpers: owner document / window, shadow-DOM-safe queries, scroll parents, scrolling into
// view, viewport size, CSP nonce.
// Ported from react-spectrum packages/react-aria/src/utils/{domHelpers,getScrollParent,
// getScrollParents,isScrollable,scrollIntoView,useViewportSize,getMetaValue,getNonce}.ts and
// shadowdom/DOMFunctions.ts (Apache-2.0, © Adobe).
//
// react-aria gates its shadow-DOM-aware variants behind the `shadowDOM()` feature flag; here they
// are always on (in the light DOM they behave like the plain versions). Server-safe where it makes
// sense (owner document / window fall back to `undefined`); everything else is browser-only.
import { signal, type Signal } from "@rivetjs/reactivity";
import { isIOS, isWebKit } from "../platform/index.ts";
// `DEV` (`#dev`) for cdk modules that import this file anyway: re-exported here instead of a direct `#dev` import, which would add
// a module edge per importer and regroup merge chunks (DIET-CODE 2026-10-22: +1 eager chunk on 3 cdk story pages).
export { DEV } from "#dev";

/**
 * `CSS.escape(value)` (CSSOM "serialize an identifier"): the native one when the global `CSS` exists, else the same
 * algorithm in JS. React Aria calls `CSS.escape` directly; environments without the global (happy-dom / jsdom set it on
 * `window` only, older embedded webviews) would throw inside an event handler, so every cdk selector goes through this.
 */
export function cssEscape(value: string): string {
  const native = (globalThis as { CSS?: { escape?: (value: string) => string } }).CSS;
  if (native && typeof native.escape === "function") return native.escape(value);
  const string = String(value);
  const length = string.length;
  const first = string.charCodeAt(0);
  let result = "";
  for (let index = 0; index < length; index++) {
    const code = string.charCodeAt(index);
    if (code === 0x0000) result += "�";
    else if (
      (code >= 0x0001 && code <= 0x001f) ||
      code === 0x007f ||
      (index === 0 && code >= 0x0030 && code <= 0x0039) ||
      (index === 1 && code >= 0x0030 && code <= 0x0039 && first === 0x002d)
    )
      result += "\\" + code.toString(16) + " ";
    else if (index === 0 && length === 1 && code === 0x002d) result += "\\" + string.charAt(index);
    else if (
      code >= 0x0080 ||
      code === 0x002d ||
      code === 0x005f ||
      (code >= 0x0030 && code <= 0x0039) ||
      (code >= 0x0041 && code <= 0x005a) ||
      (code >= 0x0061 && code <= 0x007a)
    )
      result += string.charAt(index);
    else result += "\\" + string.charAt(index);
  }
  return result;
}

/** Type guard: a DOM Node (has a numeric `nodeType`). */
export function isNode(value: unknown): value is Node {
  return value !== null && typeof value === "object" && "nodeType" in value && typeof (value as Node).nodeType === "number";
}
function isWindow(value: unknown): value is Window & typeof globalThis {
  return typeof value === "object" && value != null && "window" in value && (value as Window).window === value;
}
/** Type guard: a Document (`nodeType` 9). */
export function isDocument(value: unknown): value is Document {
  return isNode(value) && value.nodeType === 9;
}
/** Type guard: a ShadowRoot (document fragment with a `host`). */
export function isShadowRoot(value: unknown): value is ShadowRoot {
  return isNode(value) && value.nodeType === 11 && "host" in value;
}

/** The document `target` belongs to (window → its document; iframe content → the iframe's document). */
export const getOwnerDocument = (target?: EventTarget | null): Document => {
  if (isWindow(target)) return target.document;
  if (isDocument(target)) return target;
  return (target as Node | null | undefined)?.ownerDocument ?? (typeof document !== "undefined" ? document : (undefined as unknown as Document));
};

/** The window `target` belongs to. */
export const getOwnerWindow = (target?: EventTarget | null): Window & typeof globalThis => {
  const ownerDocument = getOwnerDocument(target);
  return (ownerDocument?.defaultView ?? (typeof window !== "undefined" ? window : undefined)) as Window & typeof globalThis;
};

/** Attach `listener` to one or several targets; returns the cleanup. Null target / listener → no-op. */
export function addEvent(
  target: EventTarget | EventTarget[] | null | undefined,
  event: string,
  listener?: ((event: any) => unknown) | null,
  options?: boolean | AddEventListenerOptions,
): () => void {
  if (listener == null || target == null) return () => {};
  const targets = Array.isArray(target) ? target : [target];
  for (const t of targets) t.addEventListener(event, listener as EventListener, options);
  return () => {
    for (const t of targets) t.removeEventListener(event, listener as EventListener, options);
  };
}

/** Set a CSS property (with optional priority) on element(s); the cleanup restores each previous value. */
export function setStyle(target: HTMLElement | HTMLElement[] | null, property: string, value: string, priority?: string): () => void {
  if (target == null) return () => {};
  const restore: (() => void)[] = [];
  for (const el of Array.isArray(target) ? target : [target]) {
    const initialValue = el.style.getPropertyValue(property);
    const initialPriority = el.style.getPropertyPriority(property);
    el.style.setProperty(property, value, priority);
    restore.unshift(() => {
      if (initialValue) el.style.setProperty(property, initialValue, initialPriority);
      else el.style.removeProperty(property);
    });
  }
  return () => {
    for (const cleanup of restore) cleanup();
  };
}

/** Shadow-DOM-safe `node.contains(otherNode)`: crosses shadow roots (via `host`) and slots. */
export function nodeContains(node: Node | null | undefined, otherNode: Node | EventTarget | null | undefined): boolean {
  if (!node || !otherNode || !isNode(otherNode)) return false;
  let current: Node | null | undefined = otherNode;
  while (current != null) {
    if (current === node) return true;
    const slotted = current as Node & { assignedSlot?: HTMLSlotElement | null; assignedElements?: unknown };
    if (typeof slotted.assignedElements !== "function" && slotted.assignedSlot?.parentNode) current = slotted.assignedSlot.parentNode;
    else if (isShadowRoot(current)) current = current.host;
    else current = current.parentNode;
  }
  return false;
}

/** Shadow-DOM-safe `document.activeElement` (descends into open shadow roots). */
export const getActiveElement = (doc: Document = document): Element | null => {
  let active: Element | null = doc.activeElement;
  while (active && "shadowRoot" in active && active.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
};

/** Shadow-DOM-safe `event.target`: the node inside an open shadow root when the listener is outside it. */
export function getEventTarget<T extends EventTarget = EventTarget>(event: Event): T | null {
  const target = event.target;
  if (typeof Element !== "undefined" && target instanceof Element && target.shadowRoot && "composedPath" in event)
    return (event.composedPath()[0] ?? null) as T | null;
  return target as T | null;
}

/**
 * Targets a listener must be attached to so it sees an event globally from `from`: `[to, …shadow
 * roots between from and to]` (`to` defaults to `from`'s window; `null` → none).
 */
export function getPropagationTargets(from: Element | null | undefined, to?: Document | Window | Element | null): EventTarget[] {
  if (to === null) return [];
  const destination = to ?? getOwnerWindow(from);
  const targets: EventTarget[] = [destination];
  if (!from || from === destination) return targets;
  const toRoot = "getRootNode" in destination ? (destination as Node).getRootNode() : null;
  let current: Node | null = from.getRootNode() ?? null;
  while (isShadowRoot(current) && current !== toRoot) {
    targets.push(current);
    current = current.host.getRootNode();
  }
  return targets;
}

/** Shadow-DOM-safe fast `node.contains(document.activeElement)`. */
export function isFocusWithin(node: Element | null | undefined): boolean {
  if (!node) return false;
  const root = node.getRootNode();
  const win = getOwnerWindow(node);
  if (!(root instanceof win.Document || root instanceof win.ShadowRoot)) return false;
  const active = (root as Document | ShadowRoot).activeElement;
  return active != null && node.contains(active);
}

const scrollingRoot = (doc: Document): Element => doc.scrollingElement || doc.documentElement;

/** Whether `node` scrolls (`overflow: auto|scroll`; the root unless `overflow: hidden`), optionally only when it overflows. */
export function isScrollable(node: Element | null, checkForOverflow?: boolean): boolean {
  if (!node) return false;
  const win = getOwnerWindow(node);
  const style = win.getComputedStyle(node);
  const root = scrollingRoot(node.ownerDocument);
  let scrollable = /(auto|scroll)/.test(style.overflow + style.overflowX + style.overflowY);
  // The root has `visible` overflow by default but scrolls nonetheless.
  if (node === root && style.overflow !== "hidden") scrollable = true;
  if (scrollable && checkForOverflow) scrollable = node.scrollHeight !== node.clientHeight || node.scrollWidth !== node.clientWidth;
  return scrollable;
}

/** The nearest scrolling ancestor of `node` (excluding `node` itself when it scrolls), else the document scroller. */
export function getScrollParent(node: Element, checkForOverflow?: boolean): Element {
  let scrollable: Element | null = node;
  if (isScrollable(scrollable, checkForOverflow)) scrollable = scrollable.parentElement;
  while (scrollable && !isScrollable(scrollable, checkForOverflow)) scrollable = scrollable.parentElement;
  return scrollable || scrollingRoot(node.ownerDocument);
}

/** Every scrolling ancestor of `node` (itself included), up to and including the root when it scrolls. */
export function getScrollParents(node: Element, checkForOverflow?: boolean): Element[] {
  const parents: Element[] = [];
  const root = scrollingRoot(node.ownerDocument);
  let current: Element | null = node;
  while (current) {
    if (isScrollable(current, checkForOverflow)) parents.push(current);
    if (current === root) break;
    current = current.parentElement;
  }
  return parents;
}

export interface ScrollIntoViewOpts {
  /** Alignment along the block axis (default `nearest`). */
  block?: ScrollLogicalPosition;
  /** Alignment along the inline axis (default `nearest`). */
  inline?: ScrollLogicalPosition;
}

/**
 * Scrolls `scrollView` so that `element` is visible, like `element.scrollIntoView({ block:
 * "nearest" })` but without scrolling the parents above `scrollView`. Honours scroll-margin,
 * scroll-padding, borders and scrollbars (RTL: scrollbar on the left; iOS WebKit: always right).
 */
export function scrollIntoView(scrollView: HTMLElement, element: HTMLElement, opts: ScrollIntoViewOpts = {}): void {
  if (scrollView === element) return;
  scrollRectIntoView(scrollView, element, element.getBoundingClientRect(), opts);
}

/** `scrollIntoView` for an arbitrary rectangle `target` of `element` (client coordinates). */
export function scrollRectIntoView(scrollView: HTMLElement, element: HTMLElement, target: DOMRect, opts: ScrollIntoViewOpts = {}): void {
  const { block = "nearest", inline = "nearest" } = opts;
  const win = getOwnerWindow(scrollView);
  let y = scrollView.scrollTop;
  let x = scrollView.scrollLeft;
  const view = scrollView.getBoundingClientRect();
  const itemStyle = win.getComputedStyle(element);
  const viewStyle = win.getComputedStyle(scrollView);
  const root = scrollingRoot(scrollView.ownerDocument);
  const isRoot = scrollView === root;

  const viewTop = isRoot ? 0 : view.top;
  const viewBottom = isRoot ? scrollView.clientHeight : view.bottom;
  const viewLeft = isRoot ? 0 : view.left;
  const viewRight = isRoot ? scrollView.clientWidth : view.right;

  const px = (v: string | undefined) => parseFloat(v ?? "") || 0;
  const scrollMarginTop = px(itemStyle.scrollMarginTop);
  const scrollMarginBottom = px(itemStyle.scrollMarginBottom);
  const scrollMarginLeft = px(itemStyle.scrollMarginLeft);
  const scrollMarginRight = px(itemStyle.scrollMarginRight);
  const scrollPaddingTop = px(viewStyle.scrollPaddingTop);
  const scrollPaddingBottom = px(viewStyle.scrollPaddingBottom);
  const scrollPaddingLeft = px(viewStyle.scrollPaddingLeft);
  const scrollPaddingRight = px(viewStyle.scrollPaddingRight);
  const borderTopWidth = px(viewStyle.borderTopWidth);
  const borderBottomWidth = px(viewStyle.borderBottomWidth);
  const borderLeftWidth = px(viewStyle.borderLeftWidth);
  const borderRightWidth = px(viewStyle.borderRightWidth);

  const scrollAreaTop = target.top - scrollMarginTop;
  const scrollAreaBottom = target.bottom + scrollMarginBottom;
  const scrollAreaLeft = target.left - scrollMarginLeft;
  const scrollAreaRight = target.right + scrollMarginRight;

  const scrollBarOffsetX = isRoot ? 0 : borderLeftWidth + borderRightWidth;
  const scrollBarOffsetY = isRoot ? 0 : borderTopWidth + borderBottomWidth;
  const scrollBarWidth = isRoot ? 0 : scrollView.offsetWidth - scrollView.clientWidth - scrollBarOffsetX;
  const scrollBarHeight = isRoot ? 0 : scrollView.offsetHeight - scrollView.clientHeight - scrollBarOffsetY;

  const scrollPortTop = viewTop + (isRoot ? 0 : borderTopWidth) + scrollPaddingTop;
  const scrollPortBottom = viewBottom - (isRoot ? 0 : borderBottomWidth) - scrollPaddingBottom - scrollBarHeight;
  let scrollPortLeft = viewLeft + (isRoot ? 0 : borderLeftWidth) + scrollPaddingLeft;
  let scrollPortRight = viewRight - (isRoot ? 0 : borderRightWidth) - scrollPaddingRight;

  // WebKit on iOS always positions the scrollbar on the right.
  if ((isIOS() && isWebKit()) || viewStyle.direction === "ltr") scrollPortRight -= scrollBarWidth;
  else if (viewStyle.direction === "rtl") scrollPortLeft += scrollBarWidth;

  const shouldScrollBlock = scrollAreaTop < scrollPortTop || scrollAreaBottom > scrollPortBottom;
  const shouldScrollInline = scrollAreaLeft < scrollPortLeft || scrollAreaRight > scrollPortRight;

  if (shouldScrollBlock && block === "start") y += scrollAreaTop - scrollPortTop;
  else if (shouldScrollBlock && block === "center") y += (scrollAreaTop + scrollAreaBottom) / 2 - (scrollPortTop + scrollPortBottom) / 2;
  else if (shouldScrollBlock && block === "end") y += scrollAreaBottom - scrollPortBottom;
  else if (shouldScrollBlock && block === "nearest") {
    const start = scrollAreaTop - scrollPortTop;
    const end = scrollAreaBottom - scrollPortBottom;
    y += Math.abs(start) <= Math.abs(end) ? start : end;
  }

  if (shouldScrollInline && inline === "start") x += scrollAreaLeft - scrollPortLeft;
  else if (shouldScrollInline && inline === "center") x += (scrollAreaLeft + scrollAreaRight) / 2 - (scrollPortLeft + scrollPortRight) / 2;
  else if (shouldScrollInline && inline === "end") x += scrollAreaRight - scrollPortRight;
  else if (shouldScrollInline && inline === "nearest") {
    const start = scrollAreaLeft - scrollPortLeft;
    const end = scrollAreaRight - scrollPortRight;
    x += Math.abs(start) <= Math.abs(end) ? start : end;
  }

  if (typeof scrollView.scrollTo === "function") scrollView.scrollTo({ left: x, top: y });
  else {
    scrollView.scrollLeft = x;
    scrollView.scrollTop = y;
  }
}

export interface ScrollIntoViewportOpts {
  /** Containing element centered in the viewport first when the target is not fully visible. */
  containingElement?: Element | null;
}

/**
 * Scrolls `targetElement` into the viewport. When the page itself cannot scroll (`overflow: hidden`
 * on the root, e.g. under a modal), only the target's scroll parents scroll, never the body.
 * `containingElement` (a listbox for an option, say) is centered first if the target moved.
 */
export function scrollIntoViewport(targetElement: Element | null, opts: ScrollIntoViewportOpts = {}): void {
  const { containingElement } = opts;
  if (!targetElement || !targetElement.isConnected) return;
  const doc = targetElement.ownerDocument;
  const root = scrollingRoot(doc);
  const isScrollPrevented = getOwnerWindow(targetElement).getComputedStyle(root).overflow === "hidden";
  const { left: originalLeft, top: originalTop } = targetElement.getBoundingClientRect();
  if (!isScrollPrevented) {
    // scrollIntoView, not focus(): focus does not scroll an already focused or partly visible element.
    targetElement.scrollIntoView?.({ block: "nearest" });
    const { left: newLeft, top: newTop } = targetElement.getBoundingClientRect();
    // Account for sub pixel differences from rounding.
    if (Math.abs(originalLeft - newLeft) > 1 || Math.abs(originalTop - newTop) > 1) {
      containingElement?.scrollIntoView?.({ block: "center", inline: "center" });
      targetElement.scrollIntoView?.({ block: "nearest" });
    }
  } else {
    // The target's scroll parents are walked once (a `getComputedStyle` per ancestor; scrolling does not change them).
    const targetParents = getScrollParents(targetElement, true);
    for (const parent of targetParents) scrollIntoView(parent as HTMLElement, targetElement as HTMLElement);
    const { left: newLeft, top: newTop } = targetElement.getBoundingClientRect();
    if (Math.abs(originalLeft - newLeft) > 1 || Math.abs(originalTop - newTop) > 1) {
      const scrollParents = containingElement ? getScrollParents(containingElement, true) : [];
      for (const parent of scrollParents) scrollIntoView(parent as HTMLElement, containingElement as HTMLElement, { block: "center", inline: "center" });
      for (const parent of targetParents) scrollIntoView(parent as HTMLElement, targetElement as HTMLElement);
    }
  }
}

export interface ViewportSize {
  width: number;
  height: number;
}

/** Viewport size without the scrollbar, unaffected by pinch zoom (visualViewport where available). Server: 0 × 0. */
export function getViewportSize(win: (Window & typeof globalThis) | undefined = typeof window === "undefined" ? undefined : window): ViewportSize {
  if (!win) return { width: 0, height: 0 };
  const vv = win.visualViewport;
  const docEl = win.document.documentElement;
  return {
    // The visual viewport width may include the scrollbar gutter: take the smaller one.
    width: vv ? Math.min(vv.width * vv.scale, docEl.clientWidth) : docEl.clientWidth,
    height: vv ? vv.height * vv.scale : docEl.clientHeight,
  };
}

/**
 * react-aria `useViewportSize`: a signal of the viewport size, updated on (visual viewport) resize,
 * ignoring updates while pinch-zoomed. Server: `{ width: 0, height: 0 }` and no listeners. Returns
 * the signal and the cleanup; call from a client effect.
 */
export function viewportSize(win: (Window & typeof globalThis) | undefined = typeof window === "undefined" ? undefined : window): {
  size: Signal<ViewportSize>;
  dispose: () => void;
} {
  const size = signal<ViewportSize>(getViewportSize(win));
  if (!win) return { size, dispose: () => {} };
  const vv = win.visualViewport;
  const update = (next: ViewportSize) => {
    const current = size();
    if (next.width !== current.width || next.height !== current.height) size.set(next);
  };
  const onResize = () => {
    if (vv && vv.scale > 1) return;
    update(getViewportSize(win));
  };
  const target: EventTarget = vv ?? win;
  target.addEventListener("resize", onResize);
  return { size, dispose: () => target.removeEventListener("resize", onResize) };
}

/** Content of `<meta name|property="key">` (`csp-nonce`: also its `nonce`, then `__webpack_nonce__`). */
export function getMetaValue(key: string, doc?: Document): string | undefined {
  const win = getOwnerWindow(doc);
  const ownerDocument = getOwnerDocument(doc);
  if (ownerDocument == null || win == null) return;
  let content: string | undefined;
  const meta = ownerDocument.querySelector(`meta[name="${cssEscape(key)}"], meta[property="${cssEscape(key)}"]`);
  if (meta && meta instanceof win.HTMLMetaElement) {
    if (key === "csp-nonce" && meta.nonce) content ??= meta.nonce || undefined;
    if (meta.content) content ??= meta.content || undefined;
  }
  if (key === "csp-nonce")
    content ??=
      (win as unknown as { __webpack_nonce__?: string }).__webpack_nonce__ || (globalThis as { __webpack_nonce__?: string }).__webpack_nonce__ || undefined;
  return content;
}

let nonceCache = new WeakMap<Document, string>();

/** Reset the cached nonce value (tests). */
export function resetNonceCache(): void {
  nonceCache = new WeakMap();
}

/** The CSP nonce (`<meta property="csp-nonce">` or `__webpack_nonce__`) for injected `<style>` elements; cached per document once found. */
export function getNonce(doc?: Document): string | undefined {
  const ownerDocument = getOwnerDocument(doc);
  let nonce = nonceCache.get(ownerDocument);
  nonce ??= getMetaValue("csp-nonce", ownerDocument);
  if (nonce !== undefined) nonceCache.set(ownerDocument, nonce);
  return nonce;
}
