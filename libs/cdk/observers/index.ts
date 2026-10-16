// Ported from angular/components src/cdk/observers (MIT, © Google LLC): `MutationObserverFactory`,
// `ContentObserver`, `CdkObserveContent`, `SharedResizeObserver` (private API), and from react-spectrum
// packages/react-aria/src/utils/useResizeObserver.ts (Apache-2.0, © Adobe).
//
// Rivet: services become factories (`createContentObserver`, `createSharedResizeObserver`; shared
// instances via `contentObserver()` / `sharedResizeObserver()`); RxJS observables become a minimal
// `Observable` with the same emission semantics. The `cdkObserveContent` directive is the function
// `observeContent(element, onChange, { debounce })`, to call from a client effect; it returns the
// cleanup (disabled = don't call it / call the cleanup). Nothing runs at import time or on the server.
import { coerceElement, coerceNumberProperty, type NumberInput } from "../coercion/index.ts";

/** Subscription handle. */
export interface Unsubscribable {
  unsubscribe(): void;
}

/** Observer callbacks (RxJS `Partial<Observer>` subset). */
export type ObserverLike<T> = ((value: T) => void) | { next?: (value: T) => void; complete?: () => void };

/** Minimal observable (the RxJS subset the CDK observers return). */
export interface Observable<T> {
  subscribe(observer?: ObserverLike<T>): Unsubscribable;
}

function toObserver<T>(observer?: ObserverLike<T>): { next?: (value: T) => void; complete?: () => void } {
  return typeof observer === "function" ? { next: observer } : (observer ?? {});
}

/** Hot multicast stream (RxJS `Subject` subset). */
export class _Subject<T> {
  observers = new Set<{ next?: (value: T) => void; complete?: () => void }>();
  closed = false;
  next(value: T) {
    for (const observer of [...this.observers]) observer.next?.(value);
  }
  complete() {
    this.closed = true;
    const observers = [...this.observers];
    this.observers.clear();
    for (const observer of observers) observer.complete?.();
  }
  subscribe(observer?: ObserverLike<T>): Unsubscribable {
    const o = toObserver(observer);
    if (this.closed) {
      o.complete?.();
      return { unsubscribe() {} };
    }
    this.observers.add(o);
    return { unsubscribe: () => void this.observers.delete(o) };
  }
}

// ---------------------------------------------------------------------------------------------------
// ContentObserver

/** Records the content observer ignores: comment additions / removals and comment text changes. */
function shouldIgnoreRecord(record: MutationRecord): boolean {
  // Comment `characterData` change (e.g. framework anchors).
  if (record.type === "characterData" && record.target instanceof Comment) return true;
  // Only comments added / removed.
  if (record.type === "childList") {
    for (let i = 0; i < record.addedNodes.length; i++) if (!(record.addedNodes[i] instanceof Comment)) return false;
    for (let i = 0; i < record.removedNodes.length; i++) if (!(record.removedNodes[i] instanceof Comment)) return false;
    return true;
  }
  return false;
}

/** Angular `MutationObserverFactory` (a test seam): `null` when `MutationObserver` is unavailable. */
export interface MutationObserverFactory {
  create(callback: MutationCallback): Pick<MutationObserver, "observe" | "disconnect"> | null;
}

export const defaultMutationObserverFactory: MutationObserverFactory = {
  create: (callback) => (typeof MutationObserver === "undefined" ? null : new MutationObserver(callback)),
};

/** Angular `ContentObserver`: one `MutationObserver` per element, shared and reference counted. */
export interface ContentObserver {
  /** Content changes of `element` (an element or a ref accessor), comment-only changes dropped. */
  observe(element: Element | (() => Element | null | undefined)): Observable<MutationRecord[]>;
  /** `ngOnDestroy`: disconnects every observer and completes every stream. */
  destroy(): void;
}

export function createContentObserver(factory: MutationObserverFactory = defaultMutationObserverFactory): ContentObserver {
  const observed = new Map<Element, { observer: Pick<MutationObserver, "observe" | "disconnect"> | null; stream: _Subject<MutationRecord[]>; count: number }>();

  const observeElement = (element: Element): _Subject<MutationRecord[]> => {
    let entry = observed.get(element);
    if (!entry) {
      const stream = new _Subject<MutationRecord[]>();
      const observer = factory.create((mutations) => stream.next(mutations));
      observer?.observe(element, { characterData: true, childList: true, subtree: true });
      observed.set(element, (entry = { observer, stream, count: 1 }));
    } else {
      entry.count++;
    }
    return entry.stream;
  };

  const cleanup = (element: Element) => {
    const entry = observed.get(element);
    if (!entry) return;
    entry.observer?.disconnect();
    entry.stream.complete();
    observed.delete(element);
  };

  const unobserveElement = (element: Element) => {
    const entry = observed.get(element);
    if (entry && !--entry.count) cleanup(element);
  };

  return {
    observe(elementOrRef) {
      return {
        subscribe(observer) {
          const element = coerceElement(elementOrRef) as Element;
          const o = toObserver(observer);
          const stream = observeElement(element);
          const subscription = stream.subscribe({
            next: (records) => {
              const kept = records.filter((record) => !shouldIgnoreRecord(record));
              if (kept.length) o.next?.(kept);
            },
            complete: () => o.complete?.(),
          });
          let closed = false;
          return {
            unsubscribe() {
              if (closed) return;
              closed = true;
              subscription.unsubscribe();
              unobserveElement(element);
            },
          };
        },
      };
    },
    destroy() {
      for (const element of [...observed.keys()]) cleanup(element);
    },
  };
}

let sharedContentObserver: ContentObserver | undefined;

/** The shared `ContentObserver` (Angular root service), created on first use. */
export function contentObserver(): ContentObserver {
  return (sharedContentObserver ??= createContentObserver());
}

/**
 * `cdkObserveContent`: calls `onChange(records)` when the content of `element` changes (text and
 * element children, subtree; comment-only changes ignored). `debounce` (ms, coerced like the input):
 * one call per quiet period with the last records. Returns the cleanup (directive destroy / disabled).
 */
export function observeContent(
  element: Element | (() => Element | null | undefined),
  onChange: (records: MutationRecord[]) => void,
  options: { debounce?: NumberInput; observer?: ContentObserver } = {},
): () => void {
  const debounce = options.debounce == null ? 0 : coerceNumberProperty(options.debounce);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const subscription = (options.observer ?? contentObserver()).observe(element).subscribe((records) => {
    if (!debounce) return onChange(records);
    clearTimeout(timer);
    timer = setTimeout(() => onChange(records), debounce);
  });
  return () => {
    clearTimeout(timer);
    subscription.unsubscribe();
  };
}

// ---------------------------------------------------------------------------------------------------
// SharedResizeObserver

const loopLimitExceededErrorHandler = (e: unknown) => {
  if (typeof ErrorEvent !== "undefined" && e instanceof ErrorEvent && e.message === "ResizeObserver loop limit exceeded") {
    console.error(
      `${e.message}. This could indicate a performance issue with your app. See https://github.com/WICG/resize-observer/blob/master/explainer.md#error-handling`,
    );
  }
};

/** One `ResizeObserver` for one box type; per-element observables replay the last entries. */
class SingleBoxSharedResizeObserver {
  _box: ResizeObserverBoxOptions;
  _resize = new _Subject<ResizeObserverEntry[]>();
  _resizeObserver?: ResizeObserver;
  _elementObservables = new Map<Element, Observable<ResizeObserverEntry[]>>();
  _destroyed = false;

  constructor(box: ResizeObserverBoxOptions) {
    this._box = box;
    if (typeof ResizeObserver !== "undefined") this._resizeObserver = new ResizeObserver((entries) => this._resize.next(entries));
  }

  observe(target: Element): Observable<ResizeObserverEntry[]> {
    let observable = this._elementObservables.get(target);
    if (observable) return observable;
    // `shareReplay({bufferSize: 1, refCount: true})` over the filtered stream, `takeUntil(destroyed)`.
    const subscribers = new Set<{ next?: (value: ResizeObserverEntry[]) => void; complete?: () => void }>();
    let last: ResizeObserverEntry[] | undefined;
    let source: Unsubscribable | undefined;
    const teardown = () => {
      this._resizeObserver?.unobserve(target);
      source?.unsubscribe();
      source = undefined;
      last = undefined;
      if (this._elementObservables.get(target) === observable) this._elementObservables.delete(target);
    };
    observable = {
      subscribe: (observer) => {
        const o = toObserver(observer);
        if (this._destroyed) {
          o.complete?.();
          return { unsubscribe() {} };
        }
        subscribers.add(o);
        if (last) o.next?.(last);
        if (!source) {
          source = this._resize.subscribe({
            next: (entries) => {
              if (!entries.some((entry) => entry.target === target)) return;
              last = entries;
              for (const s of [...subscribers]) s.next?.(entries);
            },
            complete: () => {
              const all = [...subscribers];
              subscribers.clear();
              teardown();
              for (const s of all) s.complete?.();
            },
          });
          this._resizeObserver?.observe(target, { box: this._box });
        }
        return {
          unsubscribe: () => {
            if (!subscribers.delete(o)) return;
            if (!subscribers.size) teardown();
          },
        };
      },
    };
    this._elementObservables.set(target, observable);
    return observable;
  }

  destroy() {
    this._destroyed = true;
    this._resize.complete();
    this._resizeObserver?.disconnect();
    this._elementObservables.clear();
  }
}

/**
 * Angular `SharedResizeObserver`: one `ResizeObserver` per box type for the whole app. `observe`
 * returns the same observable for the same element and box while it has subscribers; a new
 * subscriber gets the last entries right away.
 */
export interface SharedResizeObserver {
  observe(target: Element, options?: ResizeObserverOptions): Observable<ResizeObserverEntry[]>;
  destroy(): void;
}

export function createSharedResizeObserver(): SharedResizeObserver {
  const observers = new Map<ResizeObserverBoxOptions, SingleBoxSharedResizeObserver>();
  let cleanupErrorListener: (() => void) | undefined;
  if (typeof ResizeObserver !== "undefined" && typeof window !== "undefined") {
    window.addEventListener("error", loopLimitExceededErrorHandler);
    cleanupErrorListener = () => window.removeEventListener("error", loopLimitExceededErrorHandler);
  }
  return {
    observe(target, options) {
      const box = options?.box || "content-box";
      let observer = observers.get(box);
      if (!observer) observers.set(box, (observer = new SingleBoxSharedResizeObserver(box)));
      return observer.observe(target);
    },
    destroy() {
      for (const [, observer] of observers) observer.destroy();
      observers.clear();
      cleanupErrorListener?.();
    },
  };
}

let sharedResize: SharedResizeObserver | undefined;

/** The shared `SharedResizeObserver` (Angular root service), created on first use. */
export function sharedResizeObserver(): SharedResizeObserver {
  return (sharedResize ??= createSharedResizeObserver());
}

/**
 * react-aria `useResizeObserver`: calls `onResize()` when `element` resizes (`ResizeObserver`, or
 * window `resize` where unsupported). Call from a client effect; returns the cleanup.
 */
export function useResizeObserver(options: {
  ref: Element | (() => Element | null | undefined) | null | undefined;
  box?: ResizeObserverBoxOptions;
  onResize: () => void;
}): () => void {
  const element = typeof options.ref === "function" ? options.ref() : options.ref;
  if (!element) return () => {};
  const win = element.ownerDocument.defaultView ?? window;
  const onResize = () => options.onResize();
  if (typeof (win as { ResizeObserver?: unknown }).ResizeObserver === "undefined") {
    win.addEventListener("resize", onResize, false);
    return () => win.removeEventListener("resize", onResize, false);
  }
  const observer = new (win as typeof globalThis).ResizeObserver((entries) => {
    if (entries.length) onResize();
  });
  observer.observe(element, { box: options.box });
  return () => observer.unobserve(element);
}
