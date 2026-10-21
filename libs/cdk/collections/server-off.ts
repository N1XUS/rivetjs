// Browser resolution of the cdk `#server` import and of `@rivetjs/cdk/slot-probe` (package.json): no slot probe. The
// constant `false` and the empty function fold away at every call site (0 DOM bytes). No imports: a `#dev` import here
// would add a shared chunk to every page (measured +1.2 k min, size-report page `three`). Development builds resolve
// `server-dev.ts` instead (same exports + the misconfigured-server warning).
import type { Context } from "@rivetjs/reactivity";

export const slotProbing = false;
export function probeSlots(_values: readonly (readonly [Context<any>, unknown])[], _content: unknown): void {}

// Reactive ids: one browser registry (`utils/id.ts`); `idScoping` folds the server lookup away.
export const idScoping = false;
export function scopedIdUpdaters(): Map<string, unknown> | undefined {
  return undefined;
}

// DOM-backed loader data (DOM-DATA): browsers register no rows (folds away).
export function domRowItem(_item: unknown): void {}
