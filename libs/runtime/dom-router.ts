import { batch, getOwner, onCleanup, signal, untrack } from "@rivetjs/reactivity";
import { Async } from "./dom-async.ts";
import { DERIVED } from "./derived.ts";
import { routeMatcher, renderRoute, _popGate } from "./router.ts";
import type { Signal } from "@rivetjs/reactivity";
import type { AsyncWork, DOMValue } from "./dom.ts";
import type { RouteDefinition, RouteMatch, Routes } from "./router.ts";
export type { RouteTable, Routes } from "./router.ts";

/** An owned browser history controller. Each tracked location read returns a fresh URL. */
export interface BrowserRouter {
  location(): URL;
  /**
   * Resolve against current location. Only same-origin HTTP(S) destinations are accepted.
   * `revalidate`: the current URL re-runs its location readers (route data refetch) without a history entry.
   */
  navigate(to: string | URL, options?: { replace?: boolean; revalidate?: boolean }): void;
  /** Idempotently remove history listeners; all later reads and navigation reject. */
  dispose(): void;
}
/** Flat DOM route. Load receives the Async boundary's cancellation and captured context. */
export type DOMRoute<T = any> = RouteDefinition<T, DOMValue>;
/** A fresh match snapshot with immutable decoded parameters. */
export type DOMRouteMatch<T = any> = RouteMatch<T, DOMValue>;

/**
 * A directory index file URL (`/a/index.html`: static hosts serve the prerendered file at it too) as its directory's
 * (`/a/`), in place (`history.replaceState`): routes match directories, so the router would render not-found there.
 */
export function _indexURL(browser: Window = globalThis.window): void {
  const { pathname, search, hash } = browser.location;
  if (pathname.endsWith("/index.html")) browser.history.replaceState(browser.history.state, "", pathname.slice(0, -"index.html".length) + search + hash);
}

// Internal: a browser router's tracked read of its URL without the fragment (Router keys route work on it).
const PAGE = Symbol();
/** Create inside a live owner, usually mount. Observes popstate, not external pushState calls. */
export function createRouter(options?: { window?: Window }): BrowserRouter;
/** Own browser history under the current live reactive owner. Location reads track the href
 * and return independent URL snapshots. Construct during mount; external pushState is not observed.
 * Resume passes the server-rendered location signal as `href`. */
export function createRouter(options: { window?: Window; href?: Signal<string> } = {}): BrowserRouter {
  const owner = getOwner();
  if (!owner || (owner as unknown as { disposed: boolean }).disposed) throw Error("createRouter requires a live reactive owner");
  const browser = options.window ?? globalThis.window;
  if (!browser?.location || !browser.history) throw TypeError("createRouter requires a browser Window");
  _indexURL(browser);
  const initial = new URL(browser.location.href);
  if (!["http:", "https:"].includes(initial.protocol)) throw TypeError("Router location must use HTTP(S)");
  // `href` holds the URL without its fragment, `hash` the fragment: a hash-only change leaves
  // readers of `href` alone (a resumed routes region stays mounted).
  const page = (url: URL) => url.href.split("#")[0]!;
  // Resume: adopt the server-rendered location signal so regions that read it stay subscribed.
  const href = options.href ?? signal(page(initial));
  const hash = signal(initial.hash);
  if (options.href) untrack(() => href() !== page(initial) && href.set(page(initial)));
  let active = true;
  const live = () => {
    if (!active) throw Error("Router is disposed");
  };
  const location = () => {
    live();
    const url = new URL(href());
    url.hash = hash();
    return url;
  };
  const update = (event?: Event) => {
    if (!active || (event && _popGate.blocked?.(event))) return;
    const url = new URL(browser.location.href);
    batch(() => (hash.set(url.hash), href.set(page(url))));
  };
  const dispose = () => {
    if (!active) return;
    active = false;
    browser.removeEventListener("popstate", update);
  };
  browser.addEventListener("popstate", update);
  onCleanup(dispose);
  return Object.freeze({
    location,
    /** Resolve a relative URL, reject unsafe/cross-origin destinations, then push or replace history. */
    navigate(to: string | URL, { replace = false, revalidate = false }: { replace?: boolean; revalidate?: boolean } = {}) {
      live();
      const current = untrack(location);
      const next = new URL(to, current);
      if (!["http:", "https:"].includes(next.protocol) || next.origin !== current.origin) throw TypeError("Navigation requires a same-origin HTTP(S) URL");
      if (next.href === current.href) {
        // Same URL: a revalidation invalidates location readers once (the batch flushes after the
        // value is back), so the routes region reloads its data and commits once.
        if (revalidate)
          batch(() => {
            href.set("");
            href.set(page(next));
          });
        return;
      }
      browser.history[replace ? "replaceState" : "pushState"](null, "", next.href);
      update();
    },
    /** Remove the owned popstate listener. Owner cleanup also invokes this idempotent disposer. */
    dispose,
    [PAGE]: () => href(),
  });
}

/** Compile once. Each URL change cancels old loading and disposes its rendered branch. */
// Compile the registry once and render each location in an owned cancellable Async region.
export function Router({
  router,
  routes,
  fallback,
  error,
  notFound,
  swap,
  hold,
}: {
  router: Pick<BrowserRouter, "location">;
  /** Definitions, or a `RouteTable` (paths compiled once per array, only the matched route defined). */
  routes: readonly DOMRoute[] | Routes<DOMValue>;
  fallback?: () => DOMValue;
  error?: (cause: unknown) => DOMValue;
  notFound?: (url: URL) => DOMValue;
  /** Wraps each route commit: `apply()` (now or later) swaps in `next`, the detached route output. */
  swap?: (apply: () => void, next: ParentNode) => void;
  /** Keep the current route mounted and live until the next one commits; renders while the first route loads. */
  hold?: () => DOMValue;
}): DOMValue {
  // Route work tracks the URL without its fragment: a hash-only change keeps the route (no reload, no remount).
  const page = (router as { [PAGE]?: () => string })[PAGE];
  return renderRoute(
    // Derived builds: a route level is the runtime's own `Async` (`$i`, as the server marks it: never a hole of its own).
    swap || hold
      ? (props) =>
          Async(
            DERIVED
              ? ({ ...props, swap, hold: !!hold, fallback: hold || props.fallback, $i: 1 } as typeof props)
              : { ...props, swap, hold: !!hold, fallback: hold || props.fallback },
          )
      : DERIVED
        ? (props) => Async({ ...props, $i: 1 } as typeof props)
        : Async,
    routeMatcher(routes as Routes<DOMValue>),
    page ? () => (page(), untrack(router.location)) : router.location,
    { fallback, error, notFound },
  );
}

/** Preserve inferred loader data; heterogeneous registry erasure occurs only in Router's routes. */
export function defineRoute<T>(
  path: string,
  options: {
    load: (work: AsyncWork, match: DOMRouteMatch) => T | PromiseLike<T>;
    render: (data: NoInfer<T>, match: DOMRouteMatch<NoInfer<T>>) => DOMValue;
  },
): DOMRoute<T>;
/** Define a synchronous route with undefined data. */
export function defineRoute(
  path: string,
  options: {
    load?: undefined;
    render: (data: undefined, match: DOMRouteMatch<undefined>) => DOMValue;
  },
): DOMRoute<undefined>;
/** Define a DOM route while retaining the loader's data type for its render callback. */
export function defineRoute(path: string, options: object): object {
  return { ...options, path };
}
