// Server Suspense slots, shared by server-suspense.ts and server-resume.ts (own module, so neither
// adds to what an app without Suspense parses).
import type { Context, Disposer, Owner } from "@rivetjs/reactivity";
import type { ServerValue } from "./server.ts";

/** @internal Nearest Suspense (context token): Asyncs below it never stream on their own (server-resume) and report pending loads (`p`). */
export const _SUSPENSE: Context<{ p: boolean } | null> = { defaultValue: null };
/** A streaming render's claim on one Suspense (the derived renderer's `_onSuspense`, `server-derived.ts`). */
export interface SuspenseStream {
  /**
   * Stream `value` (constructed since the claim) after `fallback`: the fallback goes out in the shell, the content follows
   * once it rendered. `inside` is this Suspense's pending flag (the context value its content sees as `_SUSPENSE`).
   */
  defer(value: unknown, fallback: () => ServerValue, owner: Owner | null | undefined, own: Disposer, inside: object): ServerValue;
  release(dispose: Disposer): void;
}
let suspenseHook: (() => SuspenseStream | null) | null = null;
/** Resume ABI: a streaming derived render may stream a pending Suspense (fallback first, its content after the shell). */
export function _onSuspense(fn: () => SuspenseStream | null): void {
  suspenseHook = fn;
}
/** @internal The streaming render's claim for a Suspense here (null: render in place). */
export function _claimSuspense(): SuspenseStream | null {
  return suspenseHook && suspenseHook();
}
