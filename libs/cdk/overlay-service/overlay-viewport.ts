// Shared plumbing of the Angular-style overlay modules: a minimal event stream (Rx `Subject`
// subset: subscribe / next / complete, `audit` throttling) and lazily created `ViewportRuler` /
// `ScrollDispatcher` singletons (Angular CDK scrolling). Local adapters: the cdk scrolling module
// may later own these; nothing here runs at import time.
//
// Ported from @angular/cdk/scrolling (viewport-ruler.ts, scroll-dispatcher.ts), MIT, © Google LLC.

export interface Subscription {
  unsubscribe(): void;
}

/** Read side of an `EventStream` (Rx `Observable` subset). */
export interface Subscribable<T> {
  subscribe(next: (value: T) => void): Subscription;
}

/** A multicast stream (Rx `Subject` subset). */
export class EventStream<T> implements Subscribable<T> {
  private _listeners = new Set<(value: T) => void>();
  private _closed = false;
  /** Called when the first subscriber arrives / the last leaves (lazy global listeners). */
  onActive: ((active: boolean) => void) | null = null;

  get observed(): boolean {
    return this._listeners.size > 0;
  }

  subscribe(next: (value: T) => void): Subscription {
    if (this._closed) return { unsubscribe() {} };
    const fn = (value: T) => next(value);
    this._listeners.add(fn);
    if (this._listeners.size === 1) this.onActive?.(true);
    return {
      unsubscribe: () => {
        if (this._listeners.delete(fn) && !this._listeners.size) this.onActive?.(false);
      },
    };
  }

  next(value: T): void {
    if (this._closed) return;
    for (const fn of [...this._listeners]) fn(value);
  }

  complete(): void {
    this._closed = true;
    if (this._listeners.size) {
      this._listeners.clear();
      this.onActive?.(false);
    }
  }
}

/** `source` throttled like Rx `auditTime(ms)`: the last value once per `ms` window (0 = as is). */
export function audit<T>(source: Subscribable<T>, ms: number): Subscribable<T> {
  if (ms <= 0) return source;
  return {
    subscribe(next) {
      let timer: ReturnType<typeof setTimeout> | undefined, last: T;
      const inner = source.subscribe((value) => {
        last = value;
        timer ??= setTimeout(() => {
          timer = undefined;
          next(last);
        }, ms);
      });
      return {
        unsubscribe() {
          clearTimeout(timer);
          inner.unsubscribe();
        },
      };
    },
  };
}

/** `source` filtered. */
export function filter<T>(source: Subscribable<T>, predicate: (value: T) => boolean): Subscribable<T> {
  return { subscribe: (next) => source.subscribe((value) => predicate(value) && next(value)) };
}

export const DEFAULT_RESIZE_TIME = 20;
export const DEFAULT_SCROLL_TIME = 20;

export interface ViewportScrollPosition {
  top: number;
  left: number;
}

/** Viewport size / scroll position, cached until the next resize (Angular `ViewportRuler`). */
export class ViewportRuler {
  private _viewportSize: { width: number; height: number } | null = null;
  private readonly _change = new EventStream<Event>();
  private _cleanup: (() => void) | null = null;

  constructor() {
    // Global listeners only while someone listens (and to drop the cache).
    this._change.onActive = (active) => {
      if (active && !this._cleanup && typeof window !== "undefined") {
        const listener = (event: Event) => this._change.next(event);
        window.addEventListener("resize", listener);
        window.addEventListener("orientationchange", listener);
        this._cleanup = () => {
          window.removeEventListener("resize", listener);
          window.removeEventListener("orientationchange", listener);
        };
      } else if (!active) {
        this._cleanup?.();
        this._cleanup = null;
      }
    };
  }

  getViewportSize(): Readonly<{ width: number; height: number }> {
    // Not cached without a resize listener (it could not be invalidated).
    if (!this._viewportSize || !this._cleanup) this._updateViewportSize();
    return { width: this._viewportSize!.width, height: this._viewportSize!.height };
  }

  getViewportRect(): { top: number; left: number; bottom: number; right: number; width: number; height: number } {
    // documentElement rect, not window scroll properties: they disagree when pinch zoomed.
    const scrollPosition = this.getViewportScrollPosition();
    const { width, height } = this.getViewportSize();
    return { top: scrollPosition.top, left: scrollPosition.left, bottom: scrollPosition.top + height, right: scrollPosition.left + width, height, width };
  }

  getViewportScrollPosition(): ViewportScrollPosition {
    if (typeof document === "undefined") return { top: 0, left: 0 };
    const documentElement = document.documentElement;
    const documentRect = documentElement.getBoundingClientRect();
    const top = -documentRect.top || document.body?.scrollTop || window.scrollY || documentElement.scrollTop || 0;
    const left = -documentRect.left || document.body?.scrollLeft || window.scrollX || documentElement.scrollLeft || 0;
    return { top, left };
  }

  /** Resize / orientation changes, throttled. */
  change(throttleTime: number = DEFAULT_RESIZE_TIME): Subscribable<Event> {
    const source: Subscribable<Event> = {
      subscribe: (next) =>
        this._change.subscribe((event) => {
          this._viewportSize = null;
          next(event);
        }),
    };
    return audit(source, throttleTime);
  }

  private _updateViewportSize(): void {
    this._viewportSize = typeof window !== "undefined" ? { width: window.innerWidth, height: window.innerHeight } : { width: 0, height: 0 };
  }
}

/**
 * Scroll events of the document and of any scroll container (Angular `ScrollDispatcher`).
 * Deviation: no `cdkScrollable` registration needed — one capture listener sees every scrolling
 * element; `register(element)` is kept for parity (marks extra containers for `getAncestorScrollContainers`).
 */
export class ScrollDispatcher {
  private readonly _scrolled = new EventStream<Element | void>();
  private _cleanup: (() => void) | null = null;
  /** Explicitly registered scroll containers. */
  readonly scrollContainers = new Set<Element>();

  constructor() {
    this._scrolled.onActive = (active) => {
      if (active && !this._cleanup && typeof document !== "undefined") {
        const listener = (event: Event) => {
          const target = event.target;
          this._scrolled.next(target instanceof Element && target !== document.documentElement && target !== document.body ? target : undefined);
        };
        document.addEventListener("scroll", listener, { capture: true, passive: true });
        this._cleanup = () => document.removeEventListener("scroll", listener, true);
      } else if (!active) {
        this._cleanup?.();
        this._cleanup = null;
      }
    };
  }

  register(element: Element): void {
    this.scrollContainers.add(element);
  }

  deregister(element: Element): void {
    this.scrollContainers.delete(element);
  }

  /** Any scroll (document: `undefined`; an element: that element), audited. */
  scrolled(auditTimeInMs: number = DEFAULT_SCROLL_TIME): Subscribable<Element | void> {
    return audit(this._scrolled, auditTimeInMs);
  }

  /** Scrolls of the document or of a scroll container that contains `element`. */
  ancestorScrolled(element: Element, auditTimeInMs?: number): Subscribable<Element | void> {
    return filter(this.scrolled(auditTimeInMs), (target) => !target || target.contains(element));
  }

  /** Registered scroll containers that contain `element`. */
  getAncestorScrollContainers(element: Element): Element[] {
    return [...this.scrollContainers].filter((container) => container.contains(element));
  }
}

let ruler: ViewportRuler | undefined, dispatcher: ScrollDispatcher | undefined;
/** The shared `ViewportRuler` (created on first use). */
export const viewportRuler = (): ViewportRuler => (ruler ??= new ViewportRuler());
/** The shared `ScrollDispatcher` (created on first use). */
export const scrollDispatcher = (): ScrollDispatcher => (dispatcher ??= new ScrollDispatcher());

/** `coerceCssPixelValue`: numbers → `px`, strings as is, nullish → "". */
export const coerceCssPixelValue = (value: unknown): string => (value == null ? "" : typeof value === "string" ? value : `${value}px`);
/** `coerceArray`. */
export const coerceArray = <T>(value: T | readonly T[]): T[] => (Array.isArray(value) ? [...value] : [value as T]);

/** A client rect without x / y (Angular `scroll-clip.ts`). */
export type ClipRect = Pick<DOMRect, "top" | "bottom" | "left" | "right" | "width" | "height">;

/** Whether `element` is scrolled entirely outside any of its scroll containers. */
export function isElementScrolledOutsideView(element: ClipRect, scrollContainers: ClipRect[]): boolean {
  return scrollContainers.some(
    (container) => element.bottom < container.top || element.top > container.bottom || element.right < container.left || element.left > container.right,
  );
}

/** Whether `element` is clipped by any of its scroll containers. */
export function isElementClippedByScrolling(element: ClipRect, scrollContainers: ClipRect[]): boolean {
  return scrollContainers.some(
    (container) => element.top < container.top || element.bottom > container.bottom || element.left < container.left || element.right > container.right,
  );
}
