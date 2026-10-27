// `Async`, `ErrorBoundary`, `lazyComponent`, `clientOnly` (re-exported by `@rivetjs/runtime/dom`). Leaf of `dom.ts`
// (BIG-UI-2 2026-10-27): a module is atomic in its chunk, so inside `dom.ts` every page that renders anything carried
// them (~1 KB gz with the async coordinator and `lazyFunction`); here they ship only with the pages that use them.
import { createRoot, effect, onCleanup, getOwner, runWithOwner, untrack, signal, useContext, catchError, _handleError, _scoped } from "@rivetjs/reactivity";
import type { Context, Disposer } from "@rivetjs/reactivity";
import { lazyFunction } from "./lazy.ts";
import { coordinator } from "./async-coordinator.ts";
import type { Coordinator } from "./async-coordinator.ts";
import { _constructionDoc, _dom } from "./dom.ts";
import type { AsyncProps, AsyncWork, ClientOnlyOptions, Component, DOMValue, LazyComponentOptions, Output } from "./dom.ts";
import { _adoption, _c } from "./dom-v2.ts";
import { DERIVED } from "./derived.ts";

// `_dom` is read at call time: `dom.ts` re-exports this module, so it is still uninitialised while this one evaluates.

/** Owned asynchronous boundary. load tracks synchronous reads only; replacement / unmount aborts work and
 * disposes old output. Explicit work.get / run restore ownership after await. Current asynchronous failures
 * use error, or retain fallback and report once through the nearest ErrorBoundary (else a deferred throw). */
export function Async<T>(props: AsyncProps<T>): DOMValue {
  // Derived builds: in an adopt run, a boundary the server streamed (or awaited) is a hole (`dom-derived.ts`); the
  // runtime's own (`$i`: router levels, `lazyComponent`, `clientOnly`) only with a fallback function (M6-PARITY task 4).
  if (DERIVED && _adoption.async) {
    const hole = _adoption.async(props as AsyncProps<unknown>, Async as never, !(props as { $i?: 1 }).$i);
    if (hole !== undefined) return hole as DOMValue;
  }
  const doc = _constructionDoc(),
    outer = getOwner(),
    shown = signal<Output | null>(null);
  let stopTracking: Disposer | undefined, held: Output | undefined;
  stopTracking = effect(() => {
    // Suspense/transitions (only when imported) adapt each generation's props.
    const p = coordinator ? (coordinator as Coordinator<T>)(props, () => held) : props;
    const controller = new AbortController();
    let active = true,
      branch = held,
      reported = false;
    const root = createRoot(() => {
      const owner = getOwner();
      onCleanup(() => {
        active = false;
        controller.abort();
      });
      const live = () => {
        if (!active) throw Error("Async generation is disposed");
        controller.signal.throwIfAborted();
      };
      const run = <R>(fn: () => R): R => {
        live();
        const value = runWithOwner(owner, fn);
        live();
        return value;
      };
      return {
        run,
        work: Object.freeze({ signal: controller.signal, get: <V>(token: Context<V>): V => run(() => useContext(token)), run }) as AsyncWork,
      };
    });
    onCleanup(() => {
      active = false;
      controller.abort();
      root.dispose();
    });
    const stop = () => {
      if (!active) return;
      active = false;
      controller.abort();
      // Terminal construction failure also releases work created directly during tracked load.
      if (stopTracking) stopTracking();
      else root.dispose();
    };
    const report = (failure: unknown): void => {
      if (reported) return;
      reported = true;
      // The nearest ErrorBoundary takes it; without one it is thrown from the microtask.
      queueMicrotask(() => _handleError(failure, outer));
    };
    const commit = (factory: () => DOMValue, swap?: (apply: () => void, next: ParentNode) => void): void =>
      root.value.run(() => {
        // Construct detached output first, so a failed callback rolls back its partial scopes.
        // Held output belongs to the boundary, so it outlives this generation until replaced.
        const build = () =>
          _dom.output(doc, () => {
            const value = factory();
            // The callback can synchronously supersede/unmount this generation.
            return active ? value : null;
          });
        const next = p.hold ? runWithOwner(outer, build) : build();
        const discard = () => {
          try {
            next.dispose();
          } catch {}
        };
        const apply = () => {
          if (!active) return discard();
          let failure: unknown;
          try {
            if (branch) branch.dispose();
          } catch (error) {
            failure = error;
          }
          // Author cleanup can invalidate the load too; do not show replacement output.
          if (!active) return discard();
          branch = next;
          if (p.hold) held = next;
          shown.set(next);
          if (failure) throw failure;
        };
        if (!active) discard();
        else if (swap) swap(apply, next.start.parentNode!);
        else apply();
      });
    const failure = (cause: unknown, asynchronous: boolean): void => {
      if (!active) return;
      if (p.error) {
        try {
          commit(() => p.error!(cause), p.swap);
        } catch (error) {
          if (!active) return;
          try {
            stop();
          } catch {}
          if (asynchronous) report(error);
          else throw error;
        }
      } else if (asynchronous) report(cause);
      else {
        try {
          stop();
        } catch {}
        throw cause;
      }
    };
    let loaded: T | PromiseLike<T>, then: unknown;
    // Invoke directly in the tracking effect. Explicit work.run is intentionally untracked.
    try {
      loaded = p.load(root.value.work);
      then = loaded == null ? undefined : (loaded as PromiseLike<T>).then;
    } catch (error) {
      failure(error, false);
      return;
    }
    if (typeof then === "function") {
      // Observe a thenable's getter once and apply normal asynchronous assimilation.
      const observed = Promise.resolve<T>({ then: (resolve, reject) => Reflect.apply(then as PromiseLike<T>["then"], loaded, [resolve, reject]) });
      observed.then(
        (value) => {
          if (!active) return;
          try {
            commit(() => p.children(value), p.swap);
          } catch (error) {
            if (!active) return;
            try {
              stop();
            } catch {}
            report(error);
          }
        },
        (error: unknown) => failure(error, true),
      );
      try {
        if (p.fallback && !(held && props.hold)) commit(p.fallback);
      } catch (error) {
        if (!active) return;
        try {
          stop();
        } catch {}
        throw error;
      }
    } else {
      try {
        commit(() => p.children(loaded as T), p.swap);
      } catch (error) {
        if (!active) return;
        try {
          stop();
        } catch {}
        throw error;
      }
    }
  });
  return () => {
    const out = shown();
    return out === null ? null : _dom.nodes(out);
  };
}

/** Error boundary. Synchronous render errors of `children`, failures of effects and bindings inside it
 * (also when an event handler's write triggers them) and `Async` load failures without their own `error`
 * render `fallback(error, reset)`; `reset()` disposes the fallback and renders `children` again.
 * Errors thrown by event handlers themselves are not caught. The compiler passes `children` as a thunk
 * (plain JSX children included). */
export function ErrorBoundary(props: { fallback: (error: unknown, reset: () => void) => DOMValue; children: DOMValue }): DOMValue {
  const doc = _constructionDoc(),
    failure = signal<[unknown] | null>(null),
    reset = (): void => void failure.set(null);
  // Each read in a fresh scope under the boundary: the re-run disposes the failed children. The children
  // are bound right here (an output under the handler), so their insertions' failures — first run and
  // later — reach it; the fallback's reach the next boundary up.
  return _scoped(() => {
    const failed = failure();
    if (failed) return props.fallback(failed[0], reset);
    // The first error wins until reset.
    const out = catchError(
      () => _dom.output(doc, props.children as () => DOMValue),
      (error) => untrack(failure) || failure.set([error]),
    );
    return out ? _dom.nodes(out) : null;
  });
}

/** Load module.default only when mounted; cache functions, never rendered output or props. */
export function lazyComponent<P>(
  importer: () => { default: Component<P> } | PromiseLike<{ default: Component<P> }>,
  select?: undefined,
  options?: LazyComponentOptions,
): Component<P>;
/** Select a named DOM-target component. Cancellation stops this region's wait, not the shared import. */
export function lazyComponent<M, P>(importer: () => M | PromiseLike<M>, select: (module: M) => Component<P>, options?: LazyComponentOptions): Component<P>;
export function lazyComponent<M, P>(
  importer: () => M | PromiseLike<M>,
  select?: (module: M) => Component<P>,
  options: LazyComponentOptions = {},
): Component<P> {
  const reference = lazyFunction(importer, select!);
  const lazy = (props: P) => {
    const loaded = reference.peek();
    if (loaded) return _c(loaded, props) as DOMValue;
    const p: AsyncProps<Component<P>> = {
      load: (work) => reference.load({ signal: work.signal }),
      children: (fn) => _c(fn, props) as DOMValue,
      fallback: options.fallback,
      error: options.error,
    };
    if (DERIVED) (p as { $i?: 1 }).$i = 1;
    return Async(p);
  };
  // Load now, so the next render is synchronous (routers await it with the route's data).
  (lazy as Component<P> & { load?: () => Promise<unknown> }).load = () => reference.load();
  return lazy;
}

/** Browser-only module.default. Server compile erases supported inline imports and renders fallback(props). */
export function clientOnly<P>(
  importer: () => { default: Component<P> } | PromiseLike<{ default: Component<P> }>,
  select?: undefined,
  options?: ClientOnlyOptions<P>,
): Component<P>;
/** Browser-only selected component; ordinary author module setup/props still execute on both targets. */
export function clientOnly<M, P>(importer: () => M | PromiseLike<M>, select: (module: M) => Component<P>, options?: ClientOnlyOptions<P>): Component<P>;
export function clientOnly<M, P>(importer: () => M | PromiseLike<M>, select?: (module: M) => Component<P>, options: ClientOnlyOptions<P> = {}): Component<P> {
  const reference = lazyFunction(importer, select!);
  return (props: P) => {
    const p: AsyncProps<Component<P>> = {
      load: (work) => reference.load({ signal: work.signal }),
      children: (fn) => _c(fn, props) as DOMValue,
      fallback: options.fallback ? () => options.fallback!(props) : undefined,
      error: options.error,
    };
    if (DERIVED) (p as { $i?: 1 }).$i = 1;
    return Async(p);
  };
}
