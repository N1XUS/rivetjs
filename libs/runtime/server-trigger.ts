// Client triggers on the server (derived model). `clientEffect` / `clientEvent` / `clientOnly` are no-ops during server
// rendering; under a derived render (`server-derived.ts` sets `on` when it loads) each call flags the boundary whose
// body runs with the trigger its `when` names, so the browser materialises that boundary at load / idle / visible.
// Spread listener props (`server-spread.ts`) report their event type the same way. A process that never loads
// `server-derived` pays one property read per call.

/** Trigger kinds: the `when` default differs (effect / event `idle`, `clientOnly` `visible`; `load` = idle for effects). */
export const EFFECT = 0,
  EVENT = 1,
  ONLY = 2;

/**
 * @internal Set by `server-derived`. `on`: a client trigger (`when`, kind). `ev`: a listener prop (`onScroll`) a server
 * spread dropped — its event type joins the loader's delegated types (`data-events`) when not a default one; `""` = a
 * spread `ref` (D5: the unit listens to any type).
 */
export const _trigger: { on: ((when: unknown, kind: number) => void) | null; ev: ((key: string) => void) | null } = { on: null, ev: null };
