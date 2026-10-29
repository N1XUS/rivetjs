// HeroUI v3.2.6 `useMounted` (false until the component mounted on the client). Rivet: the accessor is `false` on the server and in
// the server markup, `true` once the component's client effects ran in the browser (`clientEffect`). Same behaviour as
// `useIsHydrated` (Rivet has no separate hydration pass); both exist for API parity.
import { signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";

export function useMounted(): () => boolean {
  const mounted = signal(false);
  clientEffect(() => {
    mounted.set(true);
  });
  return mounted;
}
