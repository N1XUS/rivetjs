// Suspense and transitions. Pay-per-use: `Async` only calls the coordinator this module installs, so an
// app that imports none of `Suspense`, `startTransition` or `useTransition` ships none of this
// (`sideEffects: false` drops the module and its install).
import { batch, computed, effect, getOwner, onCleanup, provide, runWithOwner, signal, untrack, useContext } from "@rivetjs/reactivity";
import { _constructionDoc, _dom } from "./dom.ts";
import { _coordinate } from "./async-coordinator.ts";
import { DERIVED } from "./derived.ts";
import { _adoption } from "./dom-v2.ts";
import type { Context, Signal } from "@rivetjs/reactivity";
import type { AsyncProps, DOMValue, Output } from "./dom.ts";

/** A Suspense's registration of one pending Async generation: returns its release (idempotent).
 * `transition`: the generation started inside a transition (a revealed Suspense ignores it). */
type Pending = (transition: boolean) => () => void;
/** A transition: joined generations `n` (+1 while `startTransition` runs), queued commits, pending signals, resolvers. */
interface Transition {
  n: number;
  q: (() => void)[];
  s: Signal<boolean>[];
  r: (() => void)[];
}
// Module state, returned by the install: every export reads it, so a bundler keeps the install
// exactly when one of them is used (a bare top-level call in a `sideEffects: false` module is dropped).
const on = _coordinate(coordinate, {
  // The transition Async generations join while `startTransition` (and its flush) runs, and the one pending.
  t: null as Transition | null,
  p: null as Transition | null,
  // Nearest Suspense of an Async (context token; null outside any).
  s: { defaultValue: null } as Context<Pending | null>,
});
const noop = (): void => {};
function within<R>(t: Transition | null, fn: () => R): R {
  const previous = on.t;
  on.t = t;
  try {
    return fn();
  } finally {
    on.t = previous;
  }
}
// A member left: once none is pending, every queued commit applies in one batch.
function settle(t: Transition): void {
  if (--t.n) return;
  if (on.p === t) on.p = null;
  batch(() => {
    for (const apply of t.q)
      try {
        apply();
      } catch (error) {
        queueMicrotask(() => {
          throw error;
        });
      }
    for (const pending of t.s) pending.set(false);
  });
  for (const resolve of t.r) resolve();
}

// One Async generation, coordinated. Output is always owned by the boundary (`hold`), so a later
// transition can keep it; a generation that does not keep it commits its fallback (or an empty one),
// which replaces it as before, and a generation that fails (and so stops) disposes it, as its own
// output would have been. A pending load registers with the nearest Suspense unless the shown output
// is kept, and joins the active transition: its commit then waits for the transition.
function coordinate<T>(props: AsyncProps<T>, held: () => Output | undefined): AsyncProps<T> {
  const t = props.hold ? null : on.t,
    kept = !!held() && (!!props.hold || !!t),
    suspense = useContext(on.s);
  let release = noop,
    left = true,
    pending = false;
  const leave = (): void => {
    if (!left) (left = true), settle(t!);
  };
  const done = (): void => (release(), leave());
  const failed = (error: unknown): never => {
    done();
    const shown = props.hold ? undefined : held();
    if (shown) shown.dispose();
    throw error;
  };
  // Content built for a transition joins it too.
  const guard = <A>(fn: ((a: A) => DOMValue) | undefined): ((a: A) => DOMValue) | undefined =>
    fn &&
    ((a) => {
      try {
        return within(t, () => fn(a));
      } catch (error) {
        return failed(error);
      }
    });
  return {
    hold: true,
    load(work) {
      let value: T | PromiseLike<T>;
      try {
        value = props.load(work);
      } catch (error) {
        if (props.error) throw error;
        return failed(error);
      }
      const then = value == null ? undefined : (value as PromiseLike<T>).then;
      if (typeof then !== "function") return value;
      pending = true;
      if (suspense && !kept) release = suspense(!!t);
      if (t) (left = false), t.n++;
      onCleanup(done);
      // Observe the thenable's getter once; a failure without `error` ends this generation's part.
      return {
        then: (resolve: (value: T) => void, reject: (error: unknown) => void) =>
          Reflect.apply(then, value, [
            resolve,
            (error: unknown) => {
              if (!props.error) done();
              reject(error);
            },
          ]),
      } as PromiseLike<T>;
    },
    children: guard(props.children)!,
    error: guard(props.error),
    fallback: kept ? undefined : props.fallback || (() => null),
    swap(apply, next) {
      const applied = (): void => (apply(), pending ? release() : undefined);
      const go = (): void => (props.swap ? props.swap(applied, next) : applied());
      if (pending && t) t.q.push(go), leave();
      else go();
    },
  };
}

/**
 * Coordinated loading: while any `Async` below it (nearest Suspense) has a pending load, `children` stay
 * mounted but detached and `fallback` is shown; once none is pending they appear in one step. A later
 * load below shows the fallback again, except inside a transition (`startTransition`). Pass `children`
 * as a thunk (`{() => <>…</>}`) so the Asyncs are created inside the boundary.
 */
export function Suspense(props: { fallback?: () => DOMValue; children: DOMValue }): DOMValue {
  const { output, nodes, park } = _dom;
  const doc = _constructionDoc(),
    owner = getOwner(),
    count = signal(0),
    holder = doc.createDocumentFragment(),
    children = props.children,
    // What the boundary shows: its content, or its fallback while a load is pending.
    view = signal<Output | null>(null);
  let revealed = false,
    hidden = false,
    shown: Output | null = null;
  const pending: Pending = (inTransition) => {
    // Derived builds: the server awaited the content in place and ships no resource state, so a load that suspends while a
    // unit adopts (its probe run) makes that unit render in the browser instead (`dom-derived.ts`, a dev warning names it).
    if (DERIVED) _adoption.suspense?.();
    // A transition keeps revealed content: its new loads do not hide it.
    if (revealed && inTransition) return noop;
    count.set(untrack(count) + 1);
    let open = true;
    return () => void (open && ((open = false), count.set(untrack(count) - 1)));
  };
  const content = provide(on.s, pending, () => output(doc, typeof children === "function" ? (children as () => DOMValue) : () => children));
  const waiting = computed(() => count() > 0);
  const drop = (): void => {
    const out = shown;
    shown = null;
    if (out) out.dispose();
  };
  onCleanup(drop);
  effect(() => {
    const wait = waiting();
    // Disposal goes in creation order: the content (its pending Asyncs) before this effect, under an owner already marked
    // disposed — a release then lands here with nothing left to show (unmount while a load is pending).
    if ((owner as { disposed?: boolean } | null)?.disposed) return;
    untrack(() =>
      runWithOwner(owner, () => {
        if (wait) {
          if (hidden) return;
          hidden = true;
          // Detached but live: updates inside it keep landing in the holder.
          park(content, holder);
          view.set(props.fallback ? (shown = output(doc, props.fallback)) : null);
        } else {
          hidden = false;
          drop();
          view.set(content);
          revealed = true;
        }
      }),
    );
  });
  return () => {
    const out = view();
    return out === null ? null : nodes(out);
  };
}

/**
 * Run `fn` (batched) as a transition: an `Async` that reloads in place because of it keeps its shown
 * output (no fallback; a revealed Suspense does not fall back) and commits only when every load the
 * transition started has settled, all in one step. `pending` (optional) is set `true` now and `false`
 * on commit. A transition started while one is pending joins it. Resolves after the commit.
 */
export function startTransition(fn: () => void, pending?: Signal<boolean>): Promise<void> {
  const t = (on.p ??= { n: 0, q: [], s: [], r: [] });
  const done = new Promise<void>((resolve) => t.r.push(resolve));
  t.n++;
  if (pending) t.s.push(pending), pending.set(true);
  try {
    within(t, () => batch(fn));
  } finally {
    settle(t);
  }
  return done;
}

/** `[pending, start]` over `startTransition` with a fresh pending signal (client-rendered components: a
 * resumed handler cannot capture `start`; use `startTransition(fn, pendingSignal)` there). */
export function useTransition(): [pending: () => boolean, start: (fn: () => void) => Promise<void>] {
  const pending = signal(false);
  return [pending, (fn) => startTransition(fn, pending)];
}
