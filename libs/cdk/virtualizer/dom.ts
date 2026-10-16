// Ported from React Spectrum (react-aria/src/virtualizer/{utils.ts, ScrollView.tsx, VirtualizerItem.tsx,
// useVirtualizerItem.ts} and react-aria/src/utils/isElementVisible.ts), Apache-2.0, © Adobe. The RTL scroll
// offset detection originates in react-window (createGridComponent.js), MIT, © Brian Vaughn.
// Rivet: framework-free DOM helpers; `createScrollView` is useScrollView as a plain controller (no flushSync:
// signal writes apply synchronously), styles are Rivet style objects (px strings; logical inset when no dir).
import type { StyleObject } from "@rivetjs/runtime/style";
import type { Key } from "../collections/index.ts";
import type { LayoutInfo } from "./layout-info.ts";
import { Point } from "./point.ts";
import { Rect } from "./rect.ts";
import { Size } from "./size.ts";
import type { Direction } from "./types.ts";

export type RTLOffsetType = "negative" | "positive-descending" | "positive-ascending";

let cachedRTLResult: RTLOffsetType | null = null;

/**
 * How the browser reports `scrollLeft` of RTL elements (spec: negative; old Chrome: positive from the left;
 * old WebKit/IE: positive from the right). Detected once by scrolling a probe element.
 */
export function getRTLOffsetType(recalculate = false): RTLOffsetType {
  if (cachedRTLResult === null || recalculate) {
    const outerDiv = document.createElement("div");
    const outerStyle = outerDiv.style;
    outerStyle.width = "50px";
    outerStyle.height = "50px";
    outerStyle.overflow = "scroll";
    outerStyle.direction = "rtl";
    const innerDiv = document.createElement("div");
    innerDiv.style.width = "100px";
    innerDiv.style.height = "100px";
    outerDiv.appendChild(innerDiv);
    document.body.appendChild(outerDiv);
    if (outerDiv.scrollLeft > 0) {
      cachedRTLResult = "positive-descending";
    } else {
      outerDiv.scrollLeft = 1;
      cachedRTLResult = outerDiv.scrollLeft === 0 ? "negative" : "positive-ascending";
    }
    document.body.removeChild(outerDiv);
  }
  return cachedRTLResult;
}

/** `scrollLeft` normalized to a distance from the inline start (RTL-safe). */
export function getScrollLeft(node: Element, direction: Direction): number {
  let { scrollLeft } = node;
  if (direction === "rtl") {
    const { scrollWidth, clientWidth } = node;
    switch (getRTLOffsetType()) {
      case "negative":
        scrollLeft = -scrollLeft;
        break;
      case "positive-descending":
        scrollLeft = scrollWidth - clientWidth - scrollLeft;
        break;
    }
  }
  return scrollLeft;
}

/** Set `scrollLeft` from a distance from the inline start (RTL-safe). */
export function setScrollLeft(node: Element, direction: Direction, scrollLeft: number): void {
  if (direction === "rtl") {
    switch (getRTLOffsetType()) {
      case "negative":
        scrollLeft = -scrollLeft;
        break;
      case "positive-ascending":
        break;
      default: {
        const { clientWidth, scrollWidth } = node;
        scrollLeft = scrollWidth - clientWidth - scrollLeft;
        break;
      }
    }
  }
  node.scrollLeft = scrollLeft;
}

const px = (value: number): string | undefined => (Number.isFinite(value) ? value + "px" : undefined);

/**
 * Absolute (or sticky) position style of a view, relative to its parent view. `dir` picks `left` / `right`;
 * without `dir` the inline-start offset is the logical `inset-inline-start` (RTL without JS).
 */
export function layoutInfoToStyle(layoutInfo: LayoutInfo, dir?: Direction | null, parent?: LayoutInfo | null): StyleObject {
  const xProperty = dir === "rtl" ? "right" : dir === "ltr" ? "left" : "inset-inline-start";
  // Sticky children of an overflowing parent are positioned against the scroll container, not the parent.
  const relative = parent && !(parent.allowOverflow && layoutInfo.isSticky);
  const style: Record<string, string | undefined> = {
    position: layoutInfo.isSticky ? "sticky" : "absolute",
    // Sticky elements are in normal flow: inline-block so sticky columns don't push each other onto new rows.
    display: layoutInfo.isSticky ? "inline-block" : undefined,
    overflow: layoutInfo.allowOverflow ? "visible" : "hidden",
    opacity: layoutInfo.opacity === 1 ? undefined : String(layoutInfo.opacity),
    "z-index": layoutInfo.zIndex ? String(layoutInfo.zIndex) : undefined,
    transform: layoutInfo.transform ?? undefined,
    contain: "size layout style",
    top: px(layoutInfo.rect.y - (relative ? parent.rect.y : 0)),
    [xProperty]: px(layoutInfo.rect.x - (relative ? parent.rect.x : 0)),
    width: px(layoutInfo.rect.width),
    height: px(layoutInfo.rect.height),
  };
  // Non-finite / unset values are dropped (no `undefined` in serialized state).
  for (const key in style) if (style[key] === undefined) delete style[key];
  return style as StyleObject;
}

/** Intrinsic size of a view element (its fixed height reset while measuring). */
export function getSize(node: HTMLElement): Size {
  const height = node.style.height;
  node.style.height = "";
  const size = new Size(node.scrollWidth, node.scrollHeight);
  node.style.height = height;
  return size;
}

/** Whether `element` is rendered and visible (hidden virtualizers must not report 0 sizes). */
export function isElementVisible(element: Element): boolean {
  const el = element as Element & { checkVisibility?(o?: object): boolean };
  if (typeof el.checkVisibility === "function") return el.checkVisibility({ visibilityProperty: true });
  const style = getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && !element.closest("[hidden]");
}

/** useVirtualizerItem's measurement: report the view's measured size (only while visible). */
export function measureItem(virtualizer: { updateItemSize(key: Key, size: Size): void }, key: Key, element: HTMLElement): void {
  if (!isElementVisible(element)) return;
  virtualizer.updateItemSize(key, getSize(element));
}

export interface ScrollViewOptions {
  /** Current content size (scroll position is clamped to it). */
  contentSize(): Size;
  onVisibleRectChange(rect: Rect): void;
  onSizeChange?(size: Size): void;
  onScrollStart?(): void;
  onScrollEnd?(): void;
  allowsWindowScrolling?: boolean;
  /** Text direction of the scroller (scrollLeft normalization). */
  direction(): Direction;
}

export interface ScrollView {
  /** Handle a scroll event (of the scroller, an ancestor or the window). */
  onScroll(event: Event): void;
  /** Re-measure the scroller (resize observer / window resize / content size change). */
  updateSize(): void;
  readonly isScrolling: boolean;
  dispose(): void;
}

/** useScrollView as a controller for `element`: visible rect from scroll position + size, scroll start / end (300 ms). */
export function createScrollView(element: HTMLElement, options: ScrollViewOptions): ScrollView {
  const state = {
    // Internal scroll position of the scroll view.
    scrollPosition: new Point(),
    // Size of the scroll view.
    size: new Size(),
    // Offset of the scroll view relative to the window viewport.
    viewportOffset: new Point(),
    // Size of the window viewport.
    viewportSize: new Size(window.innerWidth, window.innerHeight),
    scrollEndTime: 0,
    scrollTimeout: null as ReturnType<typeof setTimeout> | null,
    isScrolling: false,
    lastVisibleRect: new Rect(),
  };

  const updateVisibleRect = () => {
    // Window scrolling: intersect the window viewport with the scroll view (unbounded height, page scroll).
    const visibleRect = options.allowsWindowScrolling
      ? new Rect(
          state.viewportOffset.x + state.scrollPosition.x,
          state.viewportOffset.y + state.scrollPosition.y,
          Math.max(0, Math.min(state.size.width - state.viewportOffset.x, state.viewportSize.width)),
          Math.max(0, Math.min(state.size.height - state.viewportOffset.y, state.viewportSize.height)),
        )
      : new Rect(state.scrollPosition.x, state.scrollPosition.y, state.size.width, state.size.height);
    // Don't emit updates if the visible area is zero and the last emitted area was also zero.
    if (visibleRect.area > 0 || state.lastVisibleRect.area > 0) {
      options.onVisibleRectChange(visibleRect);
      state.lastVisibleRect = visibleRect;
    }
  };

  const onScroll = (event: Event) => {
    const target = event.target as Element | Document;
    if (target !== element && !(target as Node).contains?.(element) && target !== document) return;
    if (target !== element) {
      // An ancestor element or the window was scrolled: update the position relative to the viewport.
      const boundingRect = element.getBoundingClientRect();
      const x = boundingRect.x < 0 ? -boundingRect.x : 0;
      const y = boundingRect.y < 0 ? -boundingRect.y : 0;
      if (x === state.viewportOffset.x && y === state.viewportOffset.y) return;
      state.viewportOffset = new Point(x, y);
    } else {
      // The scroll view itself was scrolled; clamp (no rubber band shaking out of bounds).
      const contentSize = options.contentSize();
      const scrollTop = element.scrollTop;
      const scrollLeft = getScrollLeft(element, options.direction());
      state.scrollPosition = new Point(
        Math.max(0, Math.min(scrollLeft, contentSize.width - state.size.width)),
        Math.max(0, Math.min(scrollTop, contentSize.height - state.size.height)),
      );
    }

    updateVisibleRect();
    if (!state.isScrolling) {
      state.isScrolling = true;
      options.onScrollStart?.();
    }
    // Reschedule the end timer only when it gets close.
    const now = Date.now();
    if (state.scrollEndTime <= now + 50) {
      state.scrollEndTime = now + 300;
      if (state.scrollTimeout != null) clearTimeout(state.scrollTimeout);
      state.scrollTimeout = setTimeout(() => {
        state.isScrolling = false;
        state.scrollTimeout = null;
        options.onScrollEnd?.();
      }, 300);
    }
  };

  let isUpdatingSize = false;
  const updateSize = () => {
    // No reentrancy: a resize observer firing from the relayout this causes would loop.
    if (isUpdatingSize) return;
    isUpdatingSize = true;
    const clientWidth = element.clientWidth;
    const clientHeight = element.clientHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const viewportSizeChanged = state.viewportSize.width !== viewportWidth || state.viewportSize.height !== viewportHeight;
    if (viewportSizeChanged) state.viewportSize = new Size(viewportWidth, viewportHeight);
    if (state.size.width !== clientWidth || state.size.height !== clientHeight || viewportSizeChanged) {
      state.size = new Size(clientWidth, clientHeight);
      state.scrollPosition = new Point(getScrollLeft(element, options.direction()), element.scrollTop);
      updateVisibleRect();
      options.onSizeChange?.(state.size);
      // Scrollbars appeared or disappeared from the relayout: lay out once more (at most two passes).
      if (clientWidth !== element.clientWidth || clientHeight !== element.clientHeight) {
        state.size = new Size(element.clientWidth, element.clientHeight);
        updateVisibleRect();
        options.onSizeChange?.(state.size);
      }
    }
    isUpdatingSize = false;
  };

  // Border-box observation: content-box would loop when scrollbars appear or disappear.
  const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => updateSize());
  observer?.observe(element, { box: "border-box" });
  const onWindowResize = () => updateSize();
  window.addEventListener("resize", onWindowResize);
  // Ancestor / window scrolling (capture: scroll does not bubble).
  if (options.allowsWindowScrolling) document.addEventListener("scroll", onScroll, { capture: true, passive: true });

  return {
    onScroll,
    updateSize,
    get isScrolling() {
      return state.isScrolling;
    },
    dispose() {
      observer?.disconnect();
      window.removeEventListener("resize", onWindowResize);
      if (options.allowsWindowScrolling) document.removeEventListener("scroll", onScroll, { capture: true });
      if (state.scrollTimeout != null) clearTimeout(state.scrollTimeout);
    },
  };
}
