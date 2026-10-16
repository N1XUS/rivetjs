// Pure helpers of the transitions module (no router client imports at runtime; unit tested in Node).
import type { NavigationInfo } from "./index.ts";

/** A page module's `export const transition`: extra types, `false` (never animate into it), or per navigation. */
export type RouteTransition = false | { types?: readonly string[] } | ((nav: NavigationInfo) => false | { types?: readonly string[] });

const NAME = "data-vt-name";


/**
 * View transition types of a navigation, or null for an instant swap. Defaults (`push`, `replace`,
 * `back`, `forward`) are always first; link `data-transition` wins over the route's `transition`.
 */
export function transitionTypes(nav: NavigationInfo): string[] | null {
  let route = nav.route as RouteTransition | undefined;
  if (typeof route === "function") route = route(nav);
  const link = nav.transition?.trim();
  if (link === "none" || (route === false && !link)) return null;
  return [nav.type, ...(link ? link.split(/\s+/) : route ? (route.types ?? []) : [])];
}

/** `data-vt-name` elements by name, one per name (duplicates drop the name). */
export function namedElements(root: ParentNode | null): Map<string, HTMLElement | null> {
  const names = new Map<string, HTMLElement | null>();
  for (const element of root?.querySelectorAll<HTMLElement>(`[${NAME}]`) ?? []) {
    const name = element.getAttribute(NAME)!;
    names.set(name, names.has(name) ? null : element);
  }
  return names;
}
/** Names present exactly once on both sides: the shared elements of a transition. */
export function sharedNames(before: Map<string, HTMLElement | null>, after: Map<string, HTMLElement | null>): string[] {
  return [...before].filter(([name, element]) => element && after.get(name)).map(([name]) => name);
}

/**
 * Indicator timer: `show` after `delay` unless finished first; once shown, `hide` no earlier than
 * `minDuration` after showing. `start` while running keeps the timers (redirects, quick re-clicks).
 */
export function indicator(
  delay: number,
  minDuration: number,
  show: () => void,
  hide: () => void,
  clock: { now(): number; set(fn: () => void, ms: number): unknown; clear(handle: unknown): void } = {
    now: () => Date.now(),
    set: (fn, ms) => setTimeout(fn, ms),
    clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  },
) {
  let timer: unknown, shownAt: number | null = null, running = false;
  return {
    start(): void {
      if (timer !== undefined && !running) clock.clear(timer), (timer = undefined);
      if (running) return;
      running = true;
      if (shownAt === null) timer = clock.set(() => ((timer = undefined), (shownAt = clock.now()), show()), delay);
    },
    finish(): void {
      running = false;
      if (shownAt === null) {
        if (timer !== undefined) clock.clear(timer), (timer = undefined);
        return hide();
      }
      const rest = minDuration - (clock.now() - shownAt);
      const done = () => ((timer = undefined), (shownAt = null), hide());
      if (rest > 0) timer = clock.set(done, rest);
      else done();
    },
  };
}
