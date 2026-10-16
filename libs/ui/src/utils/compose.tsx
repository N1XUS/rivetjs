// Ported from HeroUI v3.2.6 packages/react/src/utils/compose.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `class` instead of `className`; render props come from @rivetjs/cdk (same shape as RAC's, values are
// accessors — the function form receives cdk's render-props object unchanged). Two strings compose to a string
// (upstream, via RAC `composeRenderProps`, always returns a function); cdk `class` accepts both.
// `.tsx` (server-rewritten, unlike `.ts`): the composed render-prop function is an object-literal function value (cdk
// `composeRenderProps` pattern), a compiler-registered resumable symbol over `cls` / `tw` — a cdk class binding that captures it
// serializes on resumed pages (a closure built in a `.ts` module would fail: "capture #n function is not serializable").
import { cx } from "tailwind-variants";

// Re-export utility classes from @heroui/styles for backward compatibility (as upstream).
export { disabledClasses, focusRingClasses, ariaDisabledClasses } from "../../styles/src/index.ts";

type SlotFn = (args?: { class?: string; [key: string]: unknown }) => string;

export const composeSlotClassName = (slotFn: SlotFn | undefined, cls?: string, variants?: Record<string, unknown>): string | undefined =>
  // No `{ ...(variants ?? {}) }` copy when `variants` is absent (every Card part): 24.5 → 20.8 ns/call (node 26, warm).
  typeof slotFn === "function" ? slotFn(variants ? { ...variants, class: cls } : { class: cls }) : cls;

export function composeTwRenderProps<T>(
  cls: string | ((v: T) => string | undefined) | undefined,
  tw?: string | ((v: T) => string | undefined),
): string | ((v: T) => string) {
  if (typeof cls !== "function" && typeof tw !== "function") return cx(tw ?? "", cls ?? "") ?? "";
  const composed = {
    fn: (v: T): string => cx(typeof tw === "function" ? (tw(v) ?? "") : (tw ?? ""), typeof cls === "function" ? cls(v) : (cls ?? "")) ?? "",
  };
  return composed.fn;
}
