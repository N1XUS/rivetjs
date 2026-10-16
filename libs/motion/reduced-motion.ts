// @rivetjs/motion/reduced-motion (spec D14): `prefersReducedMotion()` → accessor of `prefers-reduced-motion: reduce`
// (one shared signal + one media listener, created on first call in the browser; `false` on the server).
import { signal, type Signal } from "@rivetjs/reactivity";

let shared: Signal<boolean> | undefined;

/** Whether the user prefers reduced motion (live: follows the media query). */
export function prefersReducedMotion(): () => boolean {
  if (typeof matchMedia === "undefined") return () => false;
  if (!shared) {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const value = (shared = signal(query.matches));
    query.addEventListener("change", (event) => value.set(event.matches));
  }
  const value = shared;
  return () => value();
}
