// Scroll locking (React Aria `usePreventScroll`): `preventScroll()` stops the document from
// scrolling while an overlay is open and returns the restore function. Reference counted: the page
// style is restored when the last lock is released. Standard browsers: `overflow: hidden` on the
// root plus `scrollbar-gutter: stable` (or padding) so content does not shift. iOS Safari, which
// scrolls anyway: the touch / focus handling of React Aria, loaded lazily from
// `./prevent-scroll-ios.ts` (nothing for other platforms). Modal overlays lock scrolling with it
// while open.
//
// Ported from @react-aria/overlays (usePreventScroll.ts) and @react-aria/utils (isScrollable.ts,
// getScrollParent.ts), Apache-2.0, © Adobe.
import { isIOS, isWebKit } from "../platform/index.ts";

export interface PreventScrollOptions {
  /** No lock (returns a no-op). */
  isDisabled?: boolean;
  /** Patch `HTMLElement.prototype.focus` so programmatic focus does not scroll the page (React Aria `UNSTABLE_overrideFocus`). */
  overrideFocus?: boolean;
}

// Active locks; restore of the page style when the count returns to 0.
let preventScrollCount = 0;
let restore: (() => void) | undefined;

/** Lock document scrolling; returns the release function (idempotent). */
export function preventScroll(options: PreventScrollOptions = {}): () => void {
  const { isDisabled, overrideFocus } = options;
  if (isDisabled || typeof document === "undefined") return () => {};
  preventScrollCount++;
  if (preventScrollCount === 1) {
    if (isIOS() && isWebKit()) {
      // Mobile Safari: overflow first (so scrollIntoView logic sees the lock), the rest when loaded.
      const restoreOverflow = setStyle(document.documentElement, "overflow", "hidden");
      let restoreRest: (() => void) | undefined,
        released = false;
      void import("./prevent-scroll-ios.ts").then((ios) => {
        if (!released) restoreRest = ios.preventScrollMobileWebKit();
      });
      restore = () => {
        released = true;
        restoreRest?.();
        restoreOverflow();
      };
    } else restore = preventScrollStandard(overrideFocus);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    preventScrollCount--;
    if (preventScrollCount === 0) restore?.();
  };
}

/** Whether a scroll lock is active (React Aria checks `overflow: hidden` on the root for this). */
export const isScrollPrevented = (): boolean => preventScrollCount > 0;

// Most browsers: overflow hidden on the root, keep the scrollbar's space.
function preventScrollStandard(overrideFocus?: boolean): () => void {
  const root = document.documentElement;
  const scrollbarWidth = window.innerWidth - root.clientWidth;
  const restores: (() => void)[] = [];
  if (scrollbarWidth > 0)
    // scrollbar-gutter also keeps fixed-position elements from shifting.
    restores.push("scrollbarGutter" in root.style ? setStyle(root, "scrollbar-gutter", "stable") : setStyle(root, "padding-right", `${scrollbarWidth}px`));
  restores.push(setStyle(root, "overflow", "hidden"));
  if (overrideFocus) {
    let undo: (() => void) | undefined,
      released = false;
    void import("./prevent-scroll-ios.ts").then((ios) => {
      if (!released) undo = ios.overrideFocus();
    });
    restores.push(() => {
      released = true;
      undo?.();
    });
  }
  return () => {
    for (const fn of restores.reverse()) fn();
  };
}

/** Set an inline style property; returns the function restoring the previous value. */
export function setStyle(element: HTMLElement, property: string, value: string): () => void {
  const style = element.style;
  const previous = style.getPropertyValue(property),
    priority = style.getPropertyPriority(property);
  style.setProperty(property, value);
  return () => {
    if (previous) style.setProperty(property, previous, priority);
    else style.removeProperty(property);
  };
}

/** Whether `node` scrolls (overflow auto / scroll; the root unless hidden); with `checkForOverflow`, only if its content overflows. */
export function isScrollable(node: Element | null, checkForOverflow?: boolean): boolean {
  if (!node) return false;
  const style = window.getComputedStyle(node);
  const root = document.scrollingElement || document.documentElement;
  let scrollable = /(auto|scroll)/.test(style.overflow + style.overflowX + style.overflowY);
  // The root has `visible` overflow by default but scrolls.
  if (node === root && style.overflow !== "hidden") scrollable = true;
  if (scrollable && checkForOverflow) scrollable = node.scrollHeight !== node.clientHeight || node.scrollWidth !== node.clientWidth;
  return scrollable;
}

/** Nearest scrollable ancestor of `node` (not `node` itself), else the scrolling element. */
export function getScrollParent(node: Element, checkForOverflow?: boolean): Element {
  let scrollableNode: Element | null = node;
  if (isScrollable(scrollableNode, checkForOverflow)) scrollableNode = scrollableNode.parentElement;
  while (scrollableNode && !isScrollable(scrollableNode, checkForOverflow)) scrollableNode = scrollableNode.parentElement;
  return scrollableNode || document.scrollingElement || document.documentElement;
}

/** Scrollable ancestors of `node`, nearest first (React Aria `getScrollParents`). */
export function getScrollParents(node: Element, checkForOverflow?: boolean): Element[] {
  const parents: Element[] = [];
  const root = document.scrollingElement || document.documentElement;
  let current: Element | null = node;
  do {
    if (isScrollable(current, checkForOverflow)) parents.push(current!);
    current = current!.parentElement;
  } while (current && current !== root);
  return parents;
}
