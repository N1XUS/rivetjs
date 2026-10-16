// The element an island renders, identical on both sides: `h(component, props)` with the island id as Preact's
// `useId` mask. Preact derives ids from the nearest vnode carrying a mask (`P<mask[0]>-<counter>`), walking up from
// the component; a mask on the island's own vnode makes ids `P<island id>-<n>`, unique across islands and equal on the
// server (preact-render-to-string) and the client (`hydrate`). The mask field is Preact's mangled internal `__m`
// (`_mask` in its source; the same field `@astrojs/preact` relies on): Preact has no public option for an id prefix.
// Verified on preact 10.29.8 and 11.0.1 (`tests/ssr.test.ts` "useId"). The mask is `[prefix, counter]` and Preact
// increments the counter per `useId` call: a client island keeps ONE mask for its lifetime (every update / re-render
// passes the same array), so components mounted after an update continue the count instead of repeating ids.
import { h, type ComponentType, type VNode } from "preact";

/** Preact's `useId` mask: `[prefix, next counter]`. */
export type Mask = [string, number];

/** A fresh mask for island `id` (server: one per render; client: one per island handle). */
export const maskOf = (id: string): Mask => [id, 0];

/** The island vnode: `component(props)` with `useId` masked by `mask` (`maskOf(islandId)`). */
export function islandElement(component: ComponentType<Record<string, unknown>>, props: Record<string, unknown>, mask: Mask): VNode {
  const vnode = h(component, props) as VNode & { __m?: Mask };
  vnode.__m = mask;
  return vnode;
}
