// Rivet-only helper (no HeroUI counterpart). Apache-2.0 port tree (© 2025 NextUI Inc. for the ported files).
// Live props (docs/design/specs/2026-10-07-live-props-design.md): the compiler passes a prop whose value reads state as
// an own getter (`{ get variant() { return v(); } }`); a static prop is a data property. cdk parts keep live getters live
// (P5); ui parts that derive a cdk prop (`class` from `variant` / `size`, context values) build a render-prop function /
// getter only when a prop they derive from is live (`hasLiveProp`), so the static path passes plain data and the cdk part
// takes its static (copy) path. Forward a live prop as a member expression (`value={local.value}`): a getter.
// A `.tsx` module (server-rewritten, unlike `.ts`): the accessor `accessorIfLive` returns is a compiler-captured resumable
// symbol (a returned function over `props` / `key`), so a cdk handler or binding closing over it serializes on resume. Generic helpers are `function` declarations (`<T,>` arrows would parse as JSX).
import { splitProps } from "@rivetjs/runtime/props";

/** `true` when any of `keys` is an own getter of `props` (a live prop). Proxied spread props (`{...cond()}`) report data
 *  descriptors and count as static (snapshot, as before live props). */
export const hasLiveProp = (props: object, keys: readonly PropertyKey[]): boolean => {
  for (let i = 0; i < keys.length; i++) if (Object.getOwnPropertyDescriptor(props, keys[i]!)?.get !== undefined) return true;
  return false;
};

/** `splitProps(props, keys)` typed for interface props (runtime `splitProps` wants an index signature): `[picked, rest]`,
 *  both forwarding live getters unread. */
export function splitLive<T extends object, const K extends readonly (keyof T)[]>(props: T, keys: K): [Pick<T, K[number]>, Omit<T, K[number]>] {
  return splitProps(props as Record<string, unknown>, keys as never) as never;
}

/** A live prop as an accessor for the ui part's own logic (`controllable`, state factories that take `MaybeAccessor`):
 *  `() => props[key]` when the prop is live, the value otherwise (static / server path unchanged). cdk parts take live
 *  getters directly (P5): forward `prop={local.prop}` there instead. */
export function accessorIfLive<T extends object, K extends keyof T>(props: T, key: K): T[K] | (() => T[K]) {
  if (Object.getOwnPropertyDescriptor(props, key)?.get === undefined) return props[key];
  return () => props[key];
}

/** Resolves a cdk class value for the render-prop values (`string` as is, a render-prop function called). A plain helper, not a
 *  closure factory: the component body builds the render-prop function inline (`(values) => renderClass(classOf(), values)`),
 *  which the compiler registers with the body's captures; a closure returned from here would capture the caller's
 *  unregistered `compute` argument (`cdkClass(live, () => …)`, removed: "function is not serializable" on resumed pages). */
export function renderClass(c: string | ((values: never) => string), values: unknown): string {
  return typeof c === "function" ? c(values as never) : c;
}
