import { signal } from "@rivetjs/reactivity";
import { Async } from "./server-async.ts";
import type { AsyncWork } from "./async.ts";
import type { RouteDefinition, RouteMatch, Routes } from "./router.ts";
import type { ServerValue, ServerScope } from "./server.ts";
export type { RouteDefinition, RouteMatch, RouteTable, Routes } from "./router.ts";

/** Immutable per-request location snapshot. Each read returns a fresh URL. */
export interface ServerRouter {
  location(): URL;
}

/** Resume ABI: a server router's location signal (serialized as the client router's href). */
export const ROUTER: unique symbol = Symbol.for("rivet.router");
/** Resume ABI: server routers' location signals (their same-origin href ships relative, see `ResumableOptions.origin`). */
export const _hrefs: WeakSet<object> = new WeakSet();
import { compileRoutes as compileLinear, routeMatcher, renderRoute } from "./router.ts";
import { _bucketPaths } from "./router-buckets.ts";

/**
 * `compileRoutes` (`@rivetjs/runtime/router`) with the server's bucketed matcher (first segment
 * buckets + static-path Map; same first-match result). Server handlers matching large tables use this one.
 */
export function compileRoutes<T, V>(routes: readonly RouteDefinition<T, V>[]): (url: URL) => RouteMatch<T, V> | null {
  return compileLinear(routes, _bucketPaths);
}

/** Snapshot an absolute HTTP(S) request URL; no browser state is accessed. */
// Location reads return fresh copies.
export function createRouter(input: URL | string): ServerRouter {
  const url = new URL(input);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new TypeError("Server router requires an absolute HTTP(S) URL");
  const href = signal(url.href);
  _hrefs.add(href);
  return Object.freeze({ location: () => new URL(href()), [ROUTER]: href });
}

/** Define a loaded route while preserving inferred loader data in render. */
export function defineRoute<T>(
  path: string,
  options: {
    load: (work: AsyncWork, match: RouteMatch<any, ServerValue>) => T | PromiseLike<T>;
    render: (data: NoInfer<T>, match: RouteMatch<NoInfer<T>, ServerValue>) => ServerValue;
  },
): RouteDefinition<T, ServerValue>;
/** Define a synchronous route with undefined data. */
export function defineRoute(
  path: string,
  options: {
    load?: undefined;
    render: (data: undefined, match: RouteMatch<undefined, ServerValue>) => ServerValue;
  },
): RouteDefinition<undefined, ServerValue>;
/** Create a typed route definition; loader work carries request cancellation and context. */
export function defineRoute(path: string, options: object): object {
  return { ...options, path };
}

/** Render one request's route; fallback is reserved for the DOM target. */
// Render one request's matched route in an owned server Async boundary.
export function Router({
  router,
  routes,
  fallback,
  error,
  notFound,
}: {
  router: ServerRouter;
  /** Heterogeneous routes retain data typing through defineRoute; erase only here. A `RouteTable` compiles its paths once per array and defines only the matched route. */
  routes: Routes<ServerValue>;
  fallback?: () => ServerValue;
  error?: (cause: unknown) => ServerValue;
  notFound?: (url: URL) => ServerValue;
}): ServerScope {
  // Read once while constructing, so a resumable region records the location dependency.
  const url = router.location();
  // A route level is the runtime's own `Async` (`$i`): never a derived hole of its own (M6-PARITY task 4).
  return renderRoute(
    (props) => Async({ ...props, $i: 1 } as typeof props),
    routeMatcher(routes, _bucketPaths),
    () => url,
    { fallback, error, notFound },
  );
}
