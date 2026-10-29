// HeroUI v3.2.6 `useIsHydrated` (false on the server and the first client render, true after hydration).
// Rivet has no hydration pass: the accessor is `false` while rendering on the server (and in the markup a resumed page keeps) and
// becomes `true` in the browser once the page's client effects run (`clientEffect`; on a resumed page that is when the owning
// boundary boots). Use it to gate browser-only UI. Costs nothing unless imported.
import { signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";

export function useIsHydrated(): () => boolean {
  const hydrated = signal(false);
  clientEffect(() => {
    hydrated.set(true);
  });
  return hydrated;
}
