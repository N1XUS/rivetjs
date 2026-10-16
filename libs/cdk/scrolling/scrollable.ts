// Ported from Angular Components (src/cdk/scrolling/{scrollable,virtual-scrollable,
// virtual-scrollable-element,virtual-scrollable-window}.ts), MIT, © Google LLC.
// Rivet: plain classes over an element (no directive / DI): `new CdkScrollable(element)` + `init()`
// (Angular ngOnInit) / `destroy()`; direction from `dir` attributes (cdk/bidi) unless `dir` is given.
import { direction, type Direction } from "../bidi/index.ts";
import { Emitter, type Stream } from "./emitter.ts";
import { getRtlScrollAxisType, RtlScrollAxisType, supportsScrollBehavior } from "./rtl.ts";
import { scrollDispatcher, type ScrollDispatcher, type ScrollDispatcherTarget } from "./scroll-dispatcher.ts";

/**
 * ScrollToOptions with offsets relative to top / bottom / left / right / start / end.
 * top and bottom are mutually exclusive, as are left, right, start and end.
 */
export interface ExtendedScrollToOptions extends ScrollOptions {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  start?: number;
  end?: number;
}

export type ScrollEdge = "top" | "left" | "right" | "bottom" | "start" | "end";

export interface ScrollableOptions {
  /** Layout direction (Angular `Directionality`); default: read from the element's `dir` ancestry. */
  dir?: Direction | (() => Direction);
  /** Dispatcher to register with (default: the document's shared one). */
  dispatcher?: ScrollDispatcher;
}

/** A scroll container: emits its scroll events, registers with the ScrollDispatcher, normalizes RTL offsets. */
export class CdkScrollable implements ScrollDispatcherTarget {
  protected elementRef: { nativeElement: HTMLElement };
  protected scrollDispatcher: ScrollDispatcher;
  protected _scrollElement: EventTarget;
  private _dir: ScrollableOptions["dir"];
  private _cleanupScroll: (() => void) | undefined;
  private _elementScrolled = new Emitter<Event>();
  protected readonly _destroyed = new Emitter<void>();

  constructor(element: HTMLElement, options: ScrollableOptions = {}) {
    this.elementRef = { nativeElement: element };
    this._scrollElement = element;
    this._dir = options.dir;
    this.scrollDispatcher = options.dispatcher ?? scrollDispatcher(element.ownerDocument);
  }

  /** Current layout direction. */
  get dir(): { value: Direction } {
    const dir = this._dir;
    return { value: typeof dir === "function" ? dir() : (dir ?? direction(this.elementRef.nativeElement)) };
  }

  /** Start listening and register with the dispatcher (Angular `ngOnInit`). */
  init(): this {
    if (!this._cleanupScroll) {
      const target = this._scrollElement;
      const listener = (event: Event) => this._elementScrolled.next(event);
      target.addEventListener("scroll", listener);
      this._cleanupScroll = () => target.removeEventListener("scroll", listener);
    }
    this.scrollDispatcher.register(this);
    return this;
  }

  /** Stop listening, complete streams, deregister (Angular `ngOnDestroy`). */
  destroy(): void {
    this._cleanupScroll?.();
    this._cleanupScroll = undefined;
    this._elementScrolled.complete();
    this.scrollDispatcher.deregister(this);
    this._destroyed.next();
    this._destroyed.complete();
  }

  /** Emits when the host element scrolls. */
  elementScrolled(): Stream<Event> {
    return this._elementScrolled;
  }

  getElementRef(): { nativeElement: HTMLElement } {
    return this.elementRef;
  }

  /**
   * Normalized `scrollTo`: left / right always mean the container's physical sides; start / end
   * mean left / right in LTR and vice versa in RTL; bottom is rewritten as top.
   */
  scrollTo(options: ExtendedScrollToOptions): void {
    const el = this.elementRef.nativeElement;
    const isRtl = this.dir.value == "rtl";
    options = { ...options };
    if (options.left == null) options.left = isRtl ? options.end : options.start;
    if (options.right == null) options.right = isRtl ? options.start : options.end;
    if (options.bottom != null) options.top = el.scrollHeight - el.clientHeight - options.bottom;
    if (isRtl && getRtlScrollAxisType() != RtlScrollAxisType.NORMAL) {
      if (options.left != null) options.right = el.scrollWidth - el.clientWidth - options.left;
      if (getRtlScrollAxisType() == RtlScrollAxisType.INVERTED) options.left = options.right;
      else if (getRtlScrollAxisType() == RtlScrollAxisType.NEGATED) options.left = options.right ? -options.right : options.right;
    } else if (options.right != null) options.left = el.scrollWidth - el.clientWidth - options.right;
    this._applyScrollToOptions(options);
  }

  private _applyScrollToOptions(options: ExtendedScrollToOptions): void {
    const el = this.elementRef.nativeElement;
    const { top, left, behavior } = options;
    if (supportsScrollBehavior()) el.scrollTo({ top, left, behavior } as ScrollToOptions);
    else {
      if (top != null) el.scrollTop = top;
      if (left != null) el.scrollLeft = left;
    }
  }

  /**
   * Scroll offset from `from`, normalized like `scrollTo` (left / right physical, start / end logical).
   */
  measureScrollOffset(from: ScrollEdge): number {
    const LEFT = "left";
    const RIGHT = "right";
    const el = this.elementRef.nativeElement;
    if (from == "top") return el.scrollTop;
    if (from == "bottom") return el.scrollHeight - el.clientHeight - el.scrollTop;
    const isRtl = this.dir.value == "rtl";
    if (from == "start") from = isRtl ? RIGHT : LEFT;
    else if (from == "end") from = isRtl ? LEFT : RIGHT;
    if (isRtl && getRtlScrollAxisType() == RtlScrollAxisType.INVERTED) {
      // INVERTED: scrollLeft is (scrollWidth - clientWidth) all the way left, 0 all the way right.
      return from == LEFT ? el.scrollWidth - el.clientWidth - el.scrollLeft : el.scrollLeft;
    } else if (isRtl && getRtlScrollAxisType() == RtlScrollAxisType.NEGATED) {
      // NEGATED: scrollLeft is -(scrollWidth - clientWidth) all the way left, 0 all the way right.
      return from == LEFT ? el.scrollLeft + el.scrollWidth - el.clientWidth : -el.scrollLeft;
    }
    // NORMAL (and LTR): 0 all the way left, (scrollWidth - clientWidth) all the way right.
    return from == LEFT ? el.scrollLeft : el.scrollWidth - el.clientWidth - el.scrollLeft;
  }
}

/** A CdkScrollable usable as the scroll container of a virtual scroll viewport. */
export abstract class CdkVirtualScrollable extends CdkScrollable {
  /** Viewport size along `orientation`. */
  measureViewportSize(orientation: "horizontal" | "vertical"): number {
    const viewportEl = this.elementRef.nativeElement;
    return orientation === "horizontal" ? viewportEl.clientWidth : viewportEl.clientHeight;
  }
  /** Bounding client rect edge including the scroll offset. */
  abstract measureBoundingClientRectWithScrollOffset(from: "left" | "top" | "right" | "bottom"): number;
}

/** Virtual scrollable for an arbitrary scrolling ancestor element (`cdkVirtualScrollingElement`). */
export class CdkVirtualScrollableElement extends CdkVirtualScrollable {
  constructor(element: HTMLElement, options?: ScrollableOptions) {
    super(element, options);
    element.classList.add("cdk-virtual-scrollable");
  }
  override measureBoundingClientRectWithScrollOffset(from: "left" | "top" | "right" | "bottom"): number {
    return this.getElementRef().nativeElement.getBoundingClientRect()[from] - this.measureScrollOffset(from);
  }
}

/** Virtual scrollable for the window scrollbar (`scrollWindow`). */
export class CdkVirtualScrollableWindow extends CdkVirtualScrollable {
  constructor(doc: Document = document, options?: ScrollableOptions) {
    super(doc.documentElement, options);
    this._scrollElement = doc;
  }
  override measureBoundingClientRectWithScrollOffset(from: "left" | "top" | "right" | "bottom"): number {
    return this.getElementRef().nativeElement.getBoundingClientRect()[from];
  }
}
