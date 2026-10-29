// `useMediaQuery(query, defaultValue?)`: accessor of `matchMedia(query).matches`, kept current by a `change` listener.
// SSR-safe: on the server (and in the markup a resumed page keeps) it is `defaultValue` (default `false`); in the browser the
// first client effect reads the real match, then follows changes. `query` may be an accessor (re-subscribes when it changes).
import { signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";

export function useMediaQuery(query: string | (() => string), defaultValue: boolean = false): () => boolean {
  const matches = signal(defaultValue);
  clientEffect(() => {
    if (typeof matchMedia !== "function") return;
    const list = matchMedia(typeof query === "function" ? query() : query);
    matches.set(list.matches);
    const onChange = (event: MediaQueryListEvent): void => {
      matches.set(event.matches);
    };
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  });
  return matches;
}
