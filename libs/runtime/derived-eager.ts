// Derived model, dependency facts (DERIVED-C4): `_rEager()` marks the boundary rendering it, and its ancestors, as adopted
// with their parents (never deferred to idle). Generated route modules call it where a `Router` level renders: its swap
// and its revived loads belong to the page load's adopt task. A no-op outside a derived server render (the derived
// server registers the hook); importable from shared code (no server dependency).
let hook: (() => void) | null = null;
/** Mark the current derived boundary (and its ancestors) eager. */
export const _rEager = (): void => void hook?.();
/** @internal The derived server's mark. */
export const _onEager = (fn: () => void): void => void (hook = fn);
