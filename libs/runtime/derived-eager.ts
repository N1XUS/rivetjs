// Derived model, dependency facts (DERIVED-C4): `_rEager()` marks the boundary rendering it, and its ancestors, as adopted
// with their parents (never deferred to idle). Generated route modules call it where a `Router` level renders: its swap
// and its revived loads belong to the page load's adopt task. A no-op outside a derived server render (the derived
// server registers the hook); importable from shared code (no server dependency).
let hook: (() => void) | null = null;
/** Mark the current derived boundary (and its ancestors) eager. */
export const _rEager = (): void => void hook?.();
/** @internal The derived server's mark. */
export const _onEager = (fn: () => void): void => void (hook = fn);

// Weak boundaries (ZERO Z3, 2026-10-25): `_rWeak()` marks the boundary rendering it weak — the router's generated `Root` /
// `App` (`rivetRouter({ clientRouter })` off: links load documents). A render whose records are all weak ships no tail, no
// loader, no runtime (the page has nothing live of its own; the router alone does not make it resumable). A no-op outside
// a derived server render (the derived server registers the hook).
let weak: (() => void) | null = null;
/** Mark the current derived boundary weak. */
export const _rWeak = (): void => void weak?.();
/** @internal The derived server's mark. */
export const _onWeak = (fn: () => void): void => void (weak = fn);

// Framework islands on the derived model (M6-PARITY, `@rivetjs/bridge` `_island`): the server bridge offers each hydrated
// island to the derived render. One with plain JSON props (`props`) boots through the bridge's lean boot (records +
// inline boot before the derived tail, `tail` writes them): no Rivet runtime involved. Any other (live / callback props,
// Rivet slot content, `intent`, `props` null) hydrates in the adopt run of the boundary rendering it, which then adopts at
// the island's policy trigger (`on`; tail `i` names those islands). A no-op outside a derived server render (false).
/** A hydrated island of a derived render. */
export interface DerivedIsland {
  /** Root id (`data-ri`), island key (manifest `islands`), policy (undefined: hydrate on change). */
  id: string;
  key: string;
  on: string | undefined;
  /** Its framework props as plain JSON (lean boot), or why not (the boundary's adopt run hydrates it); asked once. */
  values(): Record<string, unknown> | string;
  /** `values()`' props once the derived render asked (null: not lean). */
  props: Record<string, unknown> | null;
  /** The bridge's lean tail writer: records + boot for the lean islands (`nonce` sanitised, manifest for chunk URLs). */
  tail(islands: readonly DerivedIsland[], manifest: { islands?: Record<string, string>; deps?: Record<string, string[]> } | undefined, nonce: string): string;
}
let island: ((entry: DerivedIsland) => boolean) | null = null;
/** Offer a hydrated island to the derived render (true: taken). */
export const _rIsland = (entry: DerivedIsland): boolean => island?.(entry) ?? false;
/** @internal The derived server's island collector. */
export const _onIsland = (fn: (entry: DerivedIsland) => boolean): void => void (island = fn);
