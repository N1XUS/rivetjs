import { getOwner, runWithOwner, useContext } from "@rivetjs/reactivity";
import type { Context } from "@rivetjs/reactivity";

/** Explicit captured logical scope; calls reject after its owner is disposed. */
export interface AsyncContext {
  /** Read context synchronously in the captured owner, including after await. */
  get<T>(token: Context<T>): T;
  /** Restore ownership only for this synchronous invocation, never across await. */
  run<T>(fn: () => T): T;
}
/** Per-boundary context and cancellation signal supplied to data work. */
export interface AsyncWork extends AsyncContext {
  readonly signal: AbortSignal;
}

/** Capture a live owned scope; throws outside owned setup. */
// Capture logical context for explicit synchronous reads/work after await; never retain a global owner.
export function captureAsyncContext(): AsyncContext {
  const owner = getOwner();
  if (!owner) throw new Error("captureAsyncContext requires a live owner");
  runWithOwner(owner, () => {});
  return Object.freeze({
    /** Read the captured provider; rejects once its owner is disposed. */
    get<T>(token: Context<T>): T {
      return runWithOwner(owner, () => useContext(token));
    },
    /** Restore the owner only while invoking fn, even if fn returns a Promise. */
    run<T>(fn: () => T): T {
      return runWithOwner(owner, fn);
    },
  });
}
