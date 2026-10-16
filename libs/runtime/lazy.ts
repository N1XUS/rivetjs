/** Cancellation affects one waiter; shared imports and started user work cannot be undone. */
export interface LazyOptions {
  signal?: AbortSignal;
}
/** A selected application function with separately cancellable loading/invocation. */
export interface LazyFunction<A extends readonly unknown[], R> {
  (...args: A): Promise<Awaited<R>>;
  /** Share module loading; failed imports/selection retry on the next load. */
  load(options?: LazyOptions): Promise<(...args: A) => R>;
  /** Invoke once for these arguments; results are never cached/shared. */
  invoke(args: A, options?: LazyOptions): Promise<Awaited<R>>;
  /** The selected function once loaded, else undefined; never starts an import. */
  peek(): ((...args: A) => R) | undefined;
}

function wait<T>(value: T | PromiseLike<T>, signal: AbortSignal | undefined): Promise<T> {
  const promise = Promise.resolve(value);
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", abort);
    const abort = () => {
      cleanup();
      reject(signal.reason);
    };
    promise.then(
      (v) => {
        cleanup();
        resolve(v);
      },
      (e: unknown) => {
        cleanup();
        reject(e);
      },
    );
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
}

/** Lazily select module.default, sharing imports but never function results. */
export function lazyFunction<A extends readonly unknown[], R>(
  importer: () => { default: (...args: A) => R } | PromiseLike<{ default: (...args: A) => R }>,
  select?: undefined,
): LazyFunction<A, R>;
/** Lazily select a named function; failed imports/selection are retryable. */
export function lazyFunction<M, A extends readonly unknown[], R>(
  importer: () => M | PromiseLike<M>,
  select: (module: M) => (...args: A) => R,
): LazyFunction<A, R>;
/** Share module loading, retry failed imports/selection, and invoke application functions separately per caller. */
export function lazyFunction<M, A extends readonly unknown[], R>(
  importer: () => M | PromiseLike<M>,
  select: (module: M) => (...args: A) => R = (module) => (module as { default: (...args: A) => R }).default,
): LazyFunction<A, R> {
  let cached: Promise<(...args: A) => R> | undefined, resolved: ((...args: A) => R) | undefined;
  const load = ({ signal }: LazyOptions = {}): Promise<(...args: A) => R> => {
    if (signal?.aborted) return Promise.reject(signal.reason);
    if (!cached) {
      const attempt = Promise.resolve()
        .then(importer)
        .then((module) => {
          const fn = select(module);
          if (typeof fn !== "function") throw new TypeError("Lazy selection must be a function");
          return (resolved = fn);
        });
      cached = attempt;
      attempt.catch(() => {
        if (cached === attempt) cached = undefined;
      });
    }
    return wait(cached, signal);
  };
  const invoke = (args: A, { signal }: LazyOptions = {}): Promise<Awaited<R>> =>
    load({ signal }).then((fn) => {
      signal?.throwIfAborted();
      return wait(fn(...args) as Awaited<R>, signal);
    });
  const reference: Partial<LazyFunction<A, R>> & ((...args: A) => Promise<Awaited<R>>) = (...args: A) => invoke(args);
  /** Load with per-consumer cancellation; abort never stops a shared import. */
  reference.load = load;
  /** Invoke once with explicit arguments; abort cancels waiting, not already-started application work. */
  reference.invoke = invoke;
  /** The selected function once loaded, else undefined (no import is started). */
  reference.peek = () => resolved;
  return reference as LazyFunction<A, R>;
}
