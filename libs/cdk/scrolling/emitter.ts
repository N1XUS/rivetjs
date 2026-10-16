// Minimal push streams replacing the RxJS subjects of Angular CDK scrolling / drag-drop (no RxJS
// dependency): `Emitter` (Subject), `auditTime`, `distinct` (distinctUntilChanged), `filter`.
// Browser-only plumbing: nothing here is serialized or created at import time.

export interface Subscription {
  unsubscribe(): void;
}

export interface Observer<T> {
  next?: (value: T) => void;
  complete?: () => void;
}

/** Subscribe-only view of a stream (RxJS `Observable` subset). */
export interface Stream<T> {
  subscribe(observer: ((value: T) => void) | Observer<T>): Subscription;
}

const toObserver = <T>(o: ((value: T) => void) | Observer<T>): Observer<T> => (typeof o === "function" ? { next: o } : { ...o });

/** Multicast subject: `next` pushes to current subscribers; `complete` notifies and drops them. */
export class Emitter<T> implements Stream<T> {
  private observers = new Set<Observer<T>>();
  private closed = false;
  private readonly onCount?: (count: number) => void;
  /** `onCount`: called with the new subscriber count (lazy global listeners). */
  constructor(onCount?: (count: number) => void) {
    this.onCount = onCount;
  }
  get count(): number {
    return this.observers.size;
  }
  get isStopped(): boolean {
    return this.closed;
  }
  next(value: T): void {
    if (this.closed) return;
    for (const observer of [...this.observers]) observer.next?.(value);
  }
  subscribe(o: ((value: T) => void) | Observer<T>): Subscription {
    const observer = toObserver(o);
    if (this.closed) {
      observer.complete?.();
      return { unsubscribe() {} };
    }
    this.observers.add(observer);
    this.onCount?.(this.observers.size);
    return {
      unsubscribe: () => {
        if (this.observers.delete(observer)) this.onCount?.(this.observers.size);
      },
    };
  }
  complete(): void {
    if (this.closed) return;
    this.closed = true;
    const observers = [...this.observers];
    this.observers.clear();
    for (const observer of observers) observer.complete?.();
    this.onCount?.(0);
  }
}

/** A cold stream from a subscribe function (`new Observable(subscriber => teardown)`). */
export function stream<T>(subscribe: (observer: Required<Observer<T>>) => () => void): Stream<T> {
  return {
    subscribe(o) {
      const observer = toObserver(o);
      let done = false;
      let teardown: (() => void) | undefined;
      const stop = () => {
        if (done) return;
        done = true;
        teardown?.();
      };
      teardown = subscribe({
        next: (value) => !done && observer.next?.(value),
        complete: () => {
          if (done) return;
          stop();
          observer.complete?.();
        },
      });
      if (done) teardown();
      return { unsubscribe: stop };
    },
  };
}

/** `auditTime(ms)`: after a value, wait `ms` (`frame` + 0 → next animation frame), then emit the latest. */
export function auditTime<T>(source: Stream<T>, ms: number, frame = false): Stream<T> {
  return stream((out) => {
    let timer: ReturnType<typeof setTimeout> | number | undefined, latest: T;
    const raf = frame && ms === 0 && typeof requestAnimationFrame === "function";
    const cancel = () => {
      if (timer === undefined) return;
      if (raf) cancelAnimationFrame(timer as number);
      else clearTimeout(timer as ReturnType<typeof setTimeout>);
      timer = undefined;
    };
    const sub = source.subscribe({
      next: (value) => {
        latest = value;
        if (timer !== undefined) return;
        const fire = () => {
          timer = undefined;
          out.next(latest);
        };
        timer = raf ? requestAnimationFrame(fire) : setTimeout(fire, ms);
      },
      complete: () => {
        cancel();
        out.complete();
      },
    });
    return () => {
      sub.unsubscribe();
      cancel();
    };
  });
}

/** `distinctUntilChanged()`. */
export function distinct<T>(source: Stream<T>): Stream<T> {
  return stream((out) => {
    let has = false,
      last: T;
    const sub = source.subscribe({
      next: (value) => {
        if (has && Object.is(value, last)) return;
        has = true;
        last = value;
        out.next(value);
      },
      complete: out.complete,
    });
    return () => sub.unsubscribe();
  });
}

/** `filter(predicate)`. */
export function filter<T>(source: Stream<T>, predicate: (value: T) => boolean): Stream<T> {
  return stream((out) => {
    const sub = source.subscribe({ next: (value) => predicate(value) && out.next(value), complete: out.complete });
    return () => sub.unsubscribe();
  });
}

/** A stream that completes at once (Angular's `of()` on the server). */
export const EMPTY_STREAM: Stream<never> = stream((out) => {
  out.complete();
  return () => {};
});
