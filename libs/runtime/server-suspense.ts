// Server Suspense. Pay-per-use: `Async` only calls the pending hook this module installs, so an app
// that does not import `Suspense` ships none of this (`sideEffects: false` drops the module).
import { createRoot, getOwner, provide, useContext, _detach } from "@rivetjs/reactivity";
import type { Owner, Signal } from "@rivetjs/reactivity";
import { _onPending } from "./server-async.ts";
import { _claimSuspense, _SUSPENSE } from "./server-suspense-slot.ts";
import { _scopedRecord } from "./server-structural.ts";
import type { ServerScope, ServerValue } from "./server.ts";

// The install returns the context token Suspense provides, so a bundler keeps it exactly when
// Suspense is used (a bare top-level call in a `sideEffects: false` module is dropped).
const SUSPENSE = _onPending(() => {
  const inside = useContext(_SUSPENSE);
  if (inside) inside.p = true;
}, _SUSPENSE);

// How Suspense builds a thunk's content: `resource()` (server-resource.ts, only when imported) installs a builder that
// waits for the resources the content read while they loaded and builds it again (`_onBuild`).
let build: ((content: () => unknown) => unknown) | null = null;
/** @internal `resource()`: build Suspense thunk content through `fn`. Returns `state` (kept exactly when it is used). */
export function _onBuild<S>(fn: (content: () => unknown) => unknown, state: S): S {
  build = fn;
  return state;
}

/**
 * Coordinated loading. Ordered renders: `children` render in place, every `Async` below awaited (the
 * fallback is never rendered). Streaming resumable renders: Asyncs below never stream on their own; when
 * one of them is pending, the Suspense (with a `fallback`, in a claimable site) writes the fallback and
 * streams all of its content as one segment once it has rendered. Pass `children` as a thunk.
 */
export function Suspense({ fallback, children }: { fallback?: () => ServerValue; children: ServerValue }): ServerScope {
  const claim = typeof fallback === "function" ? _claimSuspense() : null;
  const inside = { p: false };
  let owner: Owner | null | undefined,
    top: Owner | null = null;
  const root = createRoot(() => {
    top = getOwner();
    return provide(SUSPENSE, inside, () => {
      owner = getOwner();
      return typeof children === "function" ? (build === null ? (children as () => unknown)() : build(children as () => unknown)) : children;
    });
  });
  if (claim && inside.p) {
    // Streamed: the stream disposes it (`release`, else `own` once the segment is dropped), so it leaves its parent, whose
    // render (the shell, a segment) ends first. Only once deferred: a throwing fallback disposes it (as a throwing
    // createRoot init does), whether or not an owner is around it.
    let value;
    try {
      value = claim.defer(root.value, fallback!, owner, root.dispose);
    } catch (error) {
      root.dispose();
      throw error;
    }
    _detach(top);
    return _scopedRecord(owner, value, () => claim.release(root.dispose));
  }
  return _scopedRecord(owner, root.value, root.dispose);
}

/** Server twin of the DOM `startTransition`: runs `fn` (nothing loads in place on the server). */
export function startTransition(fn: () => void, _pending?: Signal<boolean>): Promise<void> {
  fn();
  return Promise.resolve();
}
/** Server twin of the DOM `useTransition`: `[pending, start]`, never pending (not capturable by resumed
 * handlers or bindings; use `startTransition(fn, pendingSignal)` in resumable components). */
export function useTransition(): [pending: () => boolean, start: (fn: () => void) => Promise<void>] {
  return [() => false, startTransition];
}
