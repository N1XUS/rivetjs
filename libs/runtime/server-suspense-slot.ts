// Server Suspense slots, shared by server-suspense.ts and server-resume.ts (own module, so neither
// adds to what an app without Suspense parses).
import type { Context, Disposer, Owner } from "@rivetjs/reactivity";
import type { ServerValue } from "./server.ts";

/** @internal Nearest Suspense (context token): Asyncs below it never stream on their own (server-resume) and report pending loads (`p`). */
export const _SUSPENSE: Context<{ p: boolean } | null> = { defaultValue: null };
/** A streaming render's claim on one Suspense (see server-resume's `_onSuspense`). */
export interface SuspenseStream {
  /** Stream `value` (constructed since the claim) as one segment after `fallback`; null: render in place. */
  defer(value: unknown, fallback: () => ServerValue, owner: Owner | null | undefined, own: Disposer): ServerValue;
  release(dispose: Disposer): void;
}
let suspenseHook: (() => SuspenseStream | null) | null = null;
/** Resume ABI: a streaming render may stream a pending Suspense as one segment (fallback first). */
export function _onSuspense(fn: () => SuspenseStream | null): void {
  suspenseHook = fn;
}
/** @internal The streaming render's claim for a Suspense here (null: render in place). */
export function _claimSuspense(): SuspenseStream | null {
  return suspenseHook && suspenseHook();
}
