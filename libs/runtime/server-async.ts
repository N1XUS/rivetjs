import { createRoot, getOwner, onCleanup, _detach } from "@rivetjs/reactivity";
import { captureAsyncContext } from "./async.ts";
import { lazyFunction } from "./lazy.ts";
import { _scopedRecord } from "./server-structural.ts";
import type { Context, Disposer, Owner } from "@rivetjs/reactivity";
import type { AsyncWork } from "./async.ts";
import type { ClientWhen, ServerScope, ServerValue } from "./server.ts";

/** Async boundary callbacks. The server awaits children and never emits fallback, except in a
 * streaming resumable render (`renderResumable(..., { stream })`): a pending boundary with a
 * fallback writes the fallback first and streams its content later in the same response. */
export interface AsyncProps<T> {
  load: (work: AsyncWork) => T | PromiseLike<T>;
  children: (value: T) => ServerValue;
  fallback?: () => ServerValue;
  /** Handles load failures only; abort/output/writer failures always escape. */
  error?: (error: unknown) => ServerValue;
}
/** Loading errors may render output; fallback is DOM-only except in streaming resumable renders. */
export interface LazyComponentOptions {
  fallback?: () => ServerValue;
  error?: (error: unknown) => ServerValue;
}
/** Client-only fallback; browser load errors are handled by the DOM adapter. */
export interface ClientOnlyOptions<P> {
  fallback?: (props: P) => ServerValue;
  error?: (error: unknown) => ServerValue;
  /** Resumed pages: when the browser mounts it (default `visible`). */
  when?: ClientWhen;
}
/** A streaming render's claim on one pending boundary (see server-resume's Boundary). */
export interface AsyncStream {
  defer(
    loaded: Promise<unknown>,
    success: (value: unknown) => unknown,
    failure: (cause: unknown) => unknown,
    fallback: () => ServerValue,
    owner: Owner | null | undefined,
    abort: (reason?: unknown) => void,
    own: Disposer,
    prepare?: undefined,
    /** The boundary's props (shell cache H-holes: a boundary the compiler marked `$hole` may be re-run on a hit). */
    hole?: object,
  ): ServerValue;
  release(dispose: Disposer): void;
}

let requestSignal: AbortSignal | undefined;

/** Internal renderer ABI: restore request cancellation for one synchronous callback. */
// Restore a request signal only during synchronous traversal.
export function withRequestSignal<T>(signal: AbortSignal | undefined, fn: () => T): T {
  const previous = requestSignal;
  requestSignal = signal;
  try {
    return fn();
  } finally {
    requestSignal = previous;
  }
}

let asyncHook: (() => AsyncStream | null) | null = null;
// The reason of every disposal abort (same name and message as AbortController's default reason).
let disposed: DOMException | undefined;
/** Resume ABI: a streaming render may take a pending boundary out of order (fallback first). */
export function _onAsync(fn: () => AsyncStream | null): void {
  asyncHook = fn;
}

let contentHook: (() => (<R>(fn: () => R) => R) | null) | null = null;
/** Resume ABI: awaited (non-streamed) content renders in the recorder region active where the boundary was constructed. */
export function _onAsyncContent(fn: () => (<R>(fn: () => R) => R) | null): void {
  contentHook = fn;
}

// The data work handle of one boundary. A class, not a frozen object literal: a literal with the `signal`
// accessor is a dictionary-mode object, and freezing it built a fresh map per boundary in old space whose
// accessor pair held the getter closure — so the closure's whole request graph survived every scavenge
// until the next mark-compact (router /page with 0 rows: 15.7% of all allocation promoted, 4.7% without).
// One shared class map, frozen through the cached transition. `get` / `run` stay own closures (destructurable).
class Work implements AsyncWork {
  readonly #signal: () => AbortSignal;
  readonly get: AsyncWork["get"];
  readonly run: AsyncWork["run"];
  constructor(signal: () => AbortSignal, get: AsyncWork["get"], run: AsyncWork["run"]) {
    this.#signal = signal;
    this.get = get;
    this.run = run;
  }
  get signal(): AbortSignal {
    return this.#signal();
  }
}

/** Construct a single-response owned async data boundary. */
// Await data in ordered server output; error handles only load failures. `fallback` is DOM-only,
// except in a streaming resumable render, which writes it first and streams the content later.
export function Async<T>(props: AsyncProps<T>): ServerScope {
  const { load, children, error, fallback } = props;
  const stream = asyncHook !== null && typeof fallback === "function" ? asyncHook() : null;
  // Resumable renders: the content renders later, in the traversal, outside the enclosing site's read; it still belongs
  // to that site's region (the browser disposes it with the region). Streamed content renders in its segment instead.
  const enter = contentHook !== null && stream === null ? contentHook() : null;
  let owner: Owner | null | undefined;
  const root = createRoot(() => {
    owner = getOwner();
    const context = captureAsyncContext();
    // The AbortController (and the DOMException its default reason captures, with a stack) is
    // created only when `work.signal` is read; a boundary whose load never reads it aborts as a
    // flag. `aborted` holds the first abort reason, as AbortController keeps the first one.
    let controller: AbortController | undefined,
      aborted: [unknown] | undefined,
      active = true,
      detach = () => {};
    const abort = (reason?: unknown): void => {
      if (aborted) return;
      aborted = [reason];
      if (controller) {
        controller.abort(reason);
        aborted[0] = controller.signal.reason;
      }
    };
    const signal = (): AbortSignal => {
      if (!controller) {
        controller = new AbortController();
        if (aborted) {
          controller.abort(aborted[0]);
          aborted[0] = controller.signal.reason;
        }
      }
      return controller.signal;
    };
    onCleanup(() => {
      active = false;
      detach();
      // Disposal aborts an already-created controller with one shared AbortError (RA4): the default
      // reason is a fresh DOMException whose stack capture cost ~3% of a routed page's CPU.
      abort(controller ? (disposed ??= AbortSignal.abort().reason as DOMException) : undefined);
    });
    const live = () => {
      // The reason (a default AbortError when none was given) materializes only when thrown.
      if (aborted) signal().throwIfAborted();
      if (!active) throw new Error("Async owner is disposed");
    };
    const work: AsyncWork = Object.freeze(
      new Work(
        signal,
        <V>(token: Context<V>): V => (live(), context.get(token)),
        <R>(fn: () => R): R => (live(), context.run(fn)),
      ),
    );
    // Load runs now, during construction (inside the enclosing binding's read): a resumable
    // render records its synchronous signal reads, so the browser re-creates the boundary (and
    // reloads) when they change. Request abort is linked once traversal reaches the boundary.
    let value: T | PromiseLike<T>, loaded: Promise<unknown> | undefined, thrown: [unknown] | undefined;
    try {
      value = work.run(() => load(work));
      const then = value == null ? undefined : (value as PromiseLike<T>).then;
      if (typeof then === "function") {
        loaded = new Promise((resolve, reject) => Reflect.apply(then as PromiseLike<T>["then"], value, [resolve, reject]));
        // Handled when traversal reaches the boundary (a later turn than this construction).
        loaded.catch(() => {});
        if (pendingHook) pendingHook();
      }
    } catch (cause) {
      thrown = [cause];
    }
    return () => {
      const parent = requestSignal;
      if (parent) {
        const link = () => abort(parent.reason);
        if (parent.aborted) link();
        else {
          parent.addEventListener("abort", link, { once: true });
          detach = () => parent.removeEventListener("abort", link);
        }
      }
      const success = (value: unknown): unknown => {
        live();
        return context.run(enter === null ? () => children(value as T) : () => enter(() => children(value as T)));
      };
      const failure = (cause: unknown): unknown => {
        live();
        if (!error) throw cause;
        return context.run(enter === null ? () => error(cause) : () => enter(() => error(cause)));
      };
      if (thrown) return failure(thrown[0]);
      live();
      if (loaded) {
        if (stream === null) return loaded.then(success, failure);
        // Streamed: the stream renders the outcome later, inside its segment's recorder, and disposes the boundary
        // (`release`, else `own` once the segment is dropped): it leaves its parent, whose render (the shell, a segment)
        // ends first. Only once deferred: a throwing fallback leaves it to its parent.
        const deferred = stream.defer(loaded, success, failure, fallback!, owner, abort, root.dispose, undefined, props);
        _detach(owner!);
        return deferred;
      }
      return success(value!);
    };
  });
  // A streamed boundary outlives the shell render: its stream disposes it once written or abandoned.
  return _scopedRecord(owner, root.value, stream === null ? root.dispose : () => stream.release(root.dispose));
}

/** Lazily load a server-target default component; cache code, never props or output. */
export function lazyComponent<P>(
  importer: () => { default: (props: P) => ServerValue } | PromiseLike<{ default: (props: P) => ServerValue }>,
  select?: undefined,
  options?: LazyComponentOptions,
): (props: P) => ServerScope;
/** Lazily select a server-target named component; failed loading is retryable. */
export function lazyComponent<M, P>(
  importer: () => M | PromiseLike<M>,
  select: (module: M) => (props: P) => ServerValue,
  options?: LazyComponentOptions,
): (props: P) => ServerScope;
/** Load a server-target component on demand; cache its function, never request props/output. */
export function lazyComponent<M, P>(
  importer: () => M | PromiseLike<M>,
  select?: (module: M) => (props: P) => ServerValue,
  options: LazyComponentOptions = {},
): (props: P) => ServerScope {
  const reference = lazyFunction(importer, select!);
  // Once loaded, the component renders synchronously (no load promise, request-signal link or
  // AbortController per render: a routed page's lazy view pays them on every request otherwise).
  return (props: P) =>
    Async({
      load: (work) => reference.peek() ?? reference.load({ signal: work.signal }),
      children: (component) => component(props),
      error: options.error,
      fallback: options.fallback,
    });
}

let clientOnlyHook: ((when: string) => void) | null = null;
/** Resume ABI: observe client-only mounts during resumable renders. */
export function _onClientOnly(fn: (when: string) => void): void {
  clientOnlyHook = fn;
}

/** Render fallback only; browser importer/default component is never evaluated. */
export function clientOnly<P>(
  importer: () => { default: (props: P) => unknown } | PromiseLike<{ default: (props: P) => unknown }>,
  select?: undefined,
  options?: ClientOnlyOptions<P>,
): (props: P) => ServerValue;
/** Render fallback only; browser importer and selector are never evaluated. */
export function clientOnly<M, P>(
  importer: () => M | PromiseLike<M>,
  select: (module: M) => (props: P) => unknown,
  options?: ClientOnlyOptions<P>,
): (props: P) => ServerValue;
/** Render only fallback on the server; importer and selector are never called. */
export function clientOnly<P>(_importer: unknown, _select?: unknown, { fallback, when }: ClientOnlyOptions<P> = {}): (props: P) => ServerValue {
  return (props: P) => {
    if (clientOnlyHook !== null) clientOnlyHook(when ?? "visible");
    return fallback ? fallback(props) : null;
  };
}

let pendingHook: (() => void) | null = null;
/** @internal Suspense (server-suspense.ts, only when imported): a pending load reports to the nearest one. Returns `state`. */
export function _onPending<S>(fn: () => void, state: S): S {
  pendingHook = fn;
  return state;
}
