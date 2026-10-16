// Development browser resolution of the cdk `#server` import and of `@rivetjs/cdk/slot-probe` (package.json `browser` →
// `development`): `server-off.ts` + a guard. A server bundle that resolves the `browser` export condition (some edge /
// worker SSR bundler configs) lands here too, and the server then keeps slot ids by expectation (dangling aria IDREFs, no
// error): warn once when it runs without a document.
import type { Context } from "@rivetjs/reactivity";

export const slotProbing = false;
let warned = false;
export function probeSlots(_values: readonly (readonly [Context<any>, unknown])[], _content: unknown): void {
  if (warned || typeof document !== "undefined") return;
  warned = true;
  // eslint-disable-next-line no-console
  console.warn(
    "[rivet cdk] cdk slot probe is disabled: your server bundle resolves the `browser` export condition for @rivetjs/cdk " +
      "(`#server` / `@rivetjs/cdk/slot-probe` → the browser no-op), so server-rendered aria-describedby / aria-labelledby " +
      "ids keep slots by expectation and can point at elements that never render. Build the server bundle without the `browser` condition.",
  );
}

// Reactive ids: one browser registry (`utils/id.ts`); `idScoping` folds the server lookup away.
export const idScoping = false;
export function scopedIdUpdaters(): Map<string, unknown> | undefined {
  return undefined;
}
