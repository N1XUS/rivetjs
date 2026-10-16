// Ported from Angular Components (src/cdk/scrolling/scroll-dispatcher.ts), MIT, © Google LLC.
// Rivet: no DI / NgZone — `scrollDispatcher(document?)` returns the lazily created per-document
// instance; streams are `Stream`s (emitter.ts). Same lazy global `document` scroll listener: added
// with the first `scrolled()` subscriber, removed with the last.
import { auditTime, EMPTY_STREAM, Emitter, filter, stream, type Stream, type Subscription } from "./emitter.ts";

/** Time in ms to throttle the scrolling events by default. */
export const DEFAULT_SCROLL_TIME = 20;

/** Scrollable instance that can be registered with the `ScrollDispatcher`. */
export interface ScrollDispatcherTarget {
  /** Stream that emits when the element is scrolled. */
  elementScrolled(): Stream<Event>;
  /** The scrollable element (Angular `getElementRef().nativeElement`). */
  getElementRef(): { nativeElement: HTMLElement };
}

type ElementLike = HTMLElement | { nativeElement: HTMLElement };
const coerceElement = (value: ElementLike): HTMLElement => ("nativeElement" in value ? value.nativeElement : value);

/** Registry of scroll targets; emits when any of them (or the document) scrolls. */
export class ScrollDispatcher {
  private _document: Document | undefined;
  private _cleanupGlobalListener: (() => void) | undefined;
  /** Notifies that a registered element (or the document: `undefined`) scrolled. */
  private readonly _scrolled = new Emitter<ScrollDispatcherTarget | void>();
  /** Number of `scrolled()` subscriptions, for cleaning up the global listener. */
  private _scrolledCount = 0;
  /** Registered targets and their scroll subscriptions. */
  readonly scrollContainers: Map<ScrollDispatcherTarget, Subscription> = new Map();

  constructor(doc?: Document) {
    this._document = doc ?? (typeof document === "object" && document ? document : undefined);
  }

  /** Registers a scrollable; its scroll events are re-emitted by `scrolled()`. */
  register(target: ScrollDispatcherTarget): void {
    if (!this.scrollContainers.has(target)) this.scrollContainers.set(target, target.elementScrolled().subscribe(() => this._scrolled.next(target)));
  }

  /** De-registers a scrollable and unsubscribes from its scroll stream. */
  deregister(target: ScrollDispatcherTarget): void {
    const ref = this.scrollContainers.get(target);
    if (ref) {
      ref.unsubscribe();
      this.scrollContainers.delete(target);
    }
  }

  /**
   * Emits whenever a registered scrollable, or the document, scrolls; throttled by `auditTimeInMs`
   * (0: no throttle). Server: completes at once.
   */
  scrolled(auditTimeInMs: number = DEFAULT_SCROLL_TIME): Stream<ScrollDispatcherTarget | void> {
    if (!this._document || typeof window !== "object") return EMPTY_STREAM;
    return stream((out) => {
      if (!this._cleanupGlobalListener) {
        const doc = this._document!;
        const listener = () => this._scrolled.next();
        doc.addEventListener("scroll", listener);
        this._cleanupGlobalListener = () => doc.removeEventListener("scroll", listener);
      }
      // 0 ms: no audit (it adds perceptible delay).
      const subscription = (auditTimeInMs > 0 ? auditTime(this._scrolled, auditTimeInMs) : this._scrolled).subscribe(out);
      this._scrolledCount++;
      return () => {
        subscription.unsubscribe();
        this._scrolledCount--;
        if (!this._scrolledCount) {
          this._cleanupGlobalListener?.();
          this._cleanupGlobalListener = undefined;
        }
      };
    });
  }

  /** Remove the global listener, deregister everything, complete `scrolled()` (Angular `ngOnDestroy`). */
  destroy(): void {
    this._cleanupGlobalListener?.();
    this._cleanupGlobalListener = undefined;
    this.scrollContainers.forEach((_, container) => this.deregister(container));
    this._scrolled.complete();
  }

  /** Emits whenever a scrollable ancestor of `element` (or the document) scrolls. */
  ancestorScrolled(element: ElementLike, auditTimeInMs?: number): Stream<ScrollDispatcherTarget | void> {
    const ancestors = this.getAncestorScrollContainers(element);
    return filter(this.scrolled(auditTimeInMs), (target) => !target || ancestors.indexOf(target) > -1);
  }

  /** All registered containers that contain `element`. */
  getAncestorScrollContainers(element: ElementLike): ScrollDispatcherTarget[] {
    const scrollingContainers: ScrollDispatcherTarget[] = [];
    this.scrollContainers.forEach((_, target) => {
      if (this._targetContainsElement(target, element)) scrollingContainers.push(target);
    });
    return scrollingContainers;
  }

  /** Whether the scrollable's element is `element` or one of its ancestors. */
  private _targetContainsElement(scrollable: ScrollDispatcherTarget, elementOrRef: ElementLike): boolean {
    let element: HTMLElement | null = coerceElement(elementOrRef);
    const targetElement = scrollable.getElementRef().nativeElement;
    do {
      if (element == targetElement) return true;
    } while ((element = element!.parentElement));
    return false;
  }

  /** Test hook (Angular specs read `_cleanupGlobalListener`). */
  get _hasGlobalListener(): boolean {
    return !!this._cleanupGlobalListener;
  }
}

const dispatchers = new WeakMap<object, ScrollDispatcher>();
const serverKey = {};

/** The shared ScrollDispatcher of `doc` (Angular root service), created on first use. */
export function scrollDispatcher(doc?: Document): ScrollDispatcher {
  const key: object = doc ?? (typeof document === "object" && document ? document : serverKey);
  let dispatcher = dispatchers.get(key);
  if (!dispatcher) dispatchers.set(key, (dispatcher = new ScrollDispatcher(doc)));
  return dispatcher;
}
