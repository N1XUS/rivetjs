// HeroUI v3.2.6 `useSafeLayoutEffect` / `useIsomorphicLayoutEffect` (a `useLayoutEffect` that is a no-op on the server).
// Rivet: no layout-effect phase and no hydration pass; the equivalent is `clientEffect` (`@rivetjs/runtime/dom`): never runs on the
// server, runs once in the browser after the owner is created (reactive reads re-run it, `return` a cleanup). Both names are
// the same function; prefer `clientEffect` in new code (the compiler knows it for resume triggers).
import { clientEffect } from "@rivetjs/runtime/dom";

export const useSafeLayoutEffect: typeof clientEffect = clientEffect;
export const useIsomorphicLayoutEffect: typeof clientEffect = clientEffect;
