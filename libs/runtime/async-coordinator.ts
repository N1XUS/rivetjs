// The `Async` coordinator slot (DOM). Own module so dom-suspense.ts can install into it while dom.ts,
// which re-exports dom-suspense.ts, is still evaluating.
import type { AsyncProps, Output } from "./dom.ts";

/** @internal Adapts one `Async` generation's props (`held`: the output the boundary keeps now). */
export type Coordinator<T = unknown> = (props: AsyncProps<T>, held: () => Output | undefined) => AsyncProps<T>;
export let coordinator: Coordinator | null = null;
/** @internal Installed by dom-suspense.ts when Suspense or transitions are imported; returns `state`. */
export function _coordinate<S>(fn: Coordinator, state: S): S {
  coordinator = fn;
  return state;
}
