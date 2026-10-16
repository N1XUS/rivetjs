import type { ServerValue } from "./server.ts";

/** Private brand of an ErrorBoundary's deferred content; the renderer buffers it (see server.ts). */
export const CAUGHT: unique symbol = Symbol.for("rivet.server.caught");
/** Content rendered into a buffer: written once complete, else replaced by `fallback(error)`. */
export interface CaughtRecord {
  readonly [CAUGHT]: true;
  readonly value: unknown;
  readonly fallback: (error: unknown) => unknown;
}
// A class (pinned shape), not a computed-key literal: see template.ts.
let caughtPin: Caught | null = null;
class Caught {
  declare [CAUGHT]: true;
  declare value: unknown;
  declare fallback: (error: unknown) => unknown;
  constructor(value: unknown, fallback: (error: unknown) => unknown) {
    this[CAUGHT] = true;
    this.value = value;
    this.fallback = fallback;
  }
}
/** Resume recorder's view of one boundary (see server-resume's `_onErrorBoundary`). */
export interface BoundaryHook {
  /** Evaluate the children as boundary content. */
  content<T>(fn: () => T): T;
  /** Mark where the content's deferred rendering starts. */
  defer(value: unknown): unknown;
  /** Drop what the failed content recorded; returns the resumable `reset`. */
  fail(): () => void;
  /** Evaluate the fallback in the boundary's scope. */
  fallback<T>(fn: () => T): T;
}
export type BoundaryFallback = (error: unknown, reset: () => void) => ServerValue;

let boundaryHook: ((fallback: BoundaryFallback) => BoundaryHook | null) | null = null;
/** Resume ABI: observe error boundaries during resumable renders. */
export function _onErrorBoundary(fn: (fallback: BoundaryFallback) => BoundaryHook | null): void {
  boundaryHook = fn;
}
const noop = (): void => {};

/**
 * Error boundary. A throw while evaluating `children`, or while rendering their output (awaited
 * `Async` rejections without their own `error` included), renders `fallback(error, reset)` in their
 * place: the content is buffered until complete, so none of it reaches the response. Request abort
 * is never caught. `reset` is inert on the server (in a resumable render it re-creates the boundary
 * in the browser). The response status is unchanged. The compiler passes `children` as a thunk
 * (plain JSX children included).
 */
export function ErrorBoundary({ fallback, children }: { fallback: BoundaryFallback; children: ServerValue }): ServerValue {
  const hook = boundaryHook === null ? null : boundaryHook(fallback);
  const failed = (error: unknown): unknown => {
    if (hook === null) return fallback(error, noop);
    const reset = hook.fail();
    return hook.fallback(() => fallback(error, reset));
  };
  let value: unknown;
  try {
    const content = children as () => ServerValue;
    value = hook === null ? content() : hook.content(content);
  } catch (error) {
    // Never a scalar: in a resumable render the boundary site stays a region.
    return [failed(error)] as ServerValue;
  }
  caughtPin ??= new Caught(null, Object);
  return new Caught(hook === null ? value : hook.defer(value), failed) satisfies CaughtRecord as unknown as ServerValue;
}
