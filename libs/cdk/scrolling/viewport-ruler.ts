// Ported from Angular Components (src/cdk/scrolling/viewport-ruler.ts), MIT, © Google LLC.
// Rivet: no DI / NgZone — `viewportRuler(document?)` returns the lazily created per-document instance;
// `change()` is a `Stream` (subscribe/unsubscribe) instead of an RxJS Observable. Window listeners are
// added on first `change()` subscription (Angular: at construction) and removed with the last one.
import { auditTime, Emitter, type Stream } from "./emitter.ts";

/** Time in ms to throttle the resize events by default. */
export const DEFAULT_RESIZE_TIME = 20;

/** Object that holds the scroll position of the viewport in each direction. */
export interface ViewportScrollPosition {
  top: number;
  left: number;
}

const isBrowser = () => typeof document === "object" && !!document && typeof window === "object";

/** Simple utility for getting the bounds of the browser viewport. */
export class ViewportRuler {
  private _listeners: (() => void)[] | undefined;
  /** Cached viewport dimensions. */
  private _viewportSize: { width: number; height: number } | null = null;
  /** Stream of viewport change events. */
  private readonly _change: Emitter<Event>;
  protected _document: Document | undefined;

  constructor(doc?: Document) {
    this._document = doc ?? (typeof document === "object" ? document : undefined);
    this._change = new Emitter<Event>((count) => (count ? this._listen() : this._unlisten()));
  }

  private _listen(): void {
    if (this._listeners || !isBrowser()) return;
    const win = this._getWindow();
    const changeListener = (event: Event) => {
      // Clear the cached size so that the viewport is re-measured next time it is required.
      this._viewportSize = null;
      this._change.next(event);
    };
    win.addEventListener("resize", changeListener);
    win.addEventListener("orientationchange", changeListener);
    this._listeners = [() => win.removeEventListener("resize", changeListener), () => win.removeEventListener("orientationchange", changeListener)];
  }

  private _unlisten(): void {
    this._listeners?.forEach((cleanup) => cleanup());
    this._listeners = undefined;
  }

  /** Remove listeners and complete `change()` (Angular `ngOnDestroy`). */
  destroy(): void {
    this._unlisten();
    this._change.complete();
  }

  /** Returns the viewport's width and height. */
  getViewportSize(): Readonly<{ width: number; height: number }> {
    // Without change() subscribers nothing invalidates the cache: re-measure every time then.
    if (!this._viewportSize || !this._listeners) this._updateViewportSize();
    const output = { width: this._viewportSize!.width, height: this._viewportSize!.height };
    // If we're not on a browser, don't cache the size since it'll be mocked out anyway.
    if (!isBrowser()) this._viewportSize = null;
    return output;
  }

  /** Gets a DOMRect-like object for the viewport's bounds. */
  getViewportRect(): { top: number; left: number; bottom: number; right: number; height: number; width: number } {
    // The document element's bounding rect rather than window scroll properties: they can disagree
    // under pinch-zoom (https://bugs.chromium.org/p/chromium/issues/detail?id=489206#c4).
    const scrollPosition = this.getViewportScrollPosition();
    const { width, height } = this.getViewportSize();
    return { top: scrollPosition.top, left: scrollPosition.left, bottom: scrollPosition.top + height, right: scrollPosition.left + width, height, width };
  }

  /** Gets the (top, left) scroll position of the viewport. */
  getViewportScrollPosition(): ViewportScrollPosition {
    if (!isBrowser() || !this._document) return { top: 0, left: 0 };
    // Chrome and Firefox disagree on whether body or documentElement scrolls; the documentElement
    // rect's negative top/left equals the scroll position in both.
    const doc = this._document;
    const win = this._getWindow();
    const documentElement = doc.documentElement!;
    const documentRect = documentElement.getBoundingClientRect();
    const top = -documentRect.top || doc.body?.scrollTop || win.scrollY || documentElement.scrollTop || 0;
    const left = -documentRect.left || doc.body?.scrollLeft || win.scrollX || documentElement.scrollLeft || 0;
    return { top, left };
  }

  /**
   * Stream that emits whenever the size of the viewport changes.
   * @param throttleTime Time in milliseconds to throttle the stream.
   */
  change(throttleTime: number = DEFAULT_RESIZE_TIME): Stream<Event> {
    return throttleTime > 0 ? auditTime(this._change, throttleTime) : this._change;
  }

  private _getWindow(): Window {
    return this._document?.defaultView || window;
  }

  private _updateViewportSize() {
    const win = isBrowser() ? this._getWindow() : undefined;
    this._viewportSize = win ? { width: win.innerWidth, height: win.innerHeight } : { width: 0, height: 0 };
  }
}

const rulers = new WeakMap<object, ViewportRuler>();
const serverKey = {};

/** The shared ViewportRuler of `doc` (Angular root service), created on first use. */
export function viewportRuler(doc?: Document): ViewportRuler {
  const key: object = doc ?? (typeof document === "object" && document ? document : serverKey);
  let ruler = rulers.get(key);
  if (!ruler) rulers.set(key, (ruler = new ViewportRuler(doc)));
  return ruler;
}
