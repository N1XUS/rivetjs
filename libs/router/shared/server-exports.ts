// Route server exports are wrapper calls: `export const loader = load((event) => …)`. The wrapper tags
// the value with its kind; the compiler strips every wrapper call from browser builds (by the import
// binding, any export name) and `server/module.ts` finds them on the server by tag. Spec:
// docs/design/specs/2026-10-20-server-exports-design.md.
import type { RequestEvent } from "../server/handler.ts";
import type { RouteId } from "../index.ts";

/**
 * Tag key of a server export: an own non-enumerable property whose value is the kind. `Symbol.for`
 * (not a module-local registry): route modules and the server bundle's router may be different
 * module instances.
 */
export const SERVER_EXPORT: unique symbol = Symbol.for("rivet.server");

/** What a server export is: the name of the wrapper that made it. */
export type ServerKind =
  "load" | "guard" | "actions" | "entries" | "headers" | "onRequest" | "onGet" | "onPost" | "onPut" | "onPatch" | "onDelete" | "onOptions";
/** A value tagged as a server export of kind `K` (still callable / usable as `V`). */
export type ServerExport<K extends ServerKind, V> = V & { readonly [SERVER_EXPORT]: K };

type Params = Record<string, string> | RouteId;
/** Request handler result: a `Response` ends the request; `undefined` continues; an `HttpError` is thrown or returned. */
type HandlerResult = Response | undefined | void | Promise<Response | undefined | void>;
// Method-style (bivariant) parameter: an action annotated `(event: RequestEvent<"items/[id]">) => …` is accepted.
type ActionFn = { bivariance(event: RequestEvent): unknown }["bivariance"];

function tag<K extends ServerKind, V extends object>(kind: K, value: V): ServerExport<K, V> {
  Object.defineProperty(value, SERVER_EXPORT, { value: kind });
  return value as ServerExport<K, V>;
}
// A fresh function per wrapper call: `onGet(h)` and `onPost(h)` with one `h` keep their own kinds.
function wrap<K extends ServerKind, F extends (...args: never[]) => unknown>(kind: K, fn: F): ServerExport<K, F> {
  if (typeof fn !== "function") throw new TypeError(`${kind}() expects a function`);
  return tag(kind, fn.bind(undefined) as F);
}

/**
 * Marks a deferred loader (`load(fn, { defer: true })`): an own non-enumerable property of the wrapped function. The
 * handler starts it with the request and renders without awaiting it (`server/deferred.ts`).
 */
export const DEFER: unique symbol = Symbol.for("rivet.defer") as never;
declare const deferred: unique symbol;
/**
 * The data of a deferred loader (`load(fn, { defer: true })`): a handle the page renders through a boundary —
 * `<Async load={() => data}>` / `resource(() => data)` — while the shell streams without waiting for it. On the server
 * it follows this request's run of the loader (started with the request); after a client navigation (the data
 * endpoint awaits deferred loaders) the slot holds the resolved value itself, which boundaries take as it is. Reading
 * it directly (`data.title`) is a bug: dev throws `DeferredDataError`.
 */
export interface Deferred<T> extends PromiseLike<T> {
  readonly [deferred]: T;
}
/** Options of `load(fn, options)`. */
export interface LoadOptions {
  /**
   * Start the loader with the request but do not wait for it before rendering: the page's (layout's) `data` is a
   * `Deferred<T>`, rendered through `<Async load={() => data}>` / `resource(() => data)`; the response streams the
   * shell first and the boundary's content when the loader settles. Client navigations (`?_rivet=data`) get the
   * resolved value. A deferred loader cannot set headers or cookies (TypeError: the response head is already out).
   */
  readonly defer?: boolean;
}
/** Loader: data for the page / layout (`data` prop; `PageProps<typeof loader>`). Runs on the server only. */
export function load<T, P extends Params = Record<string, string>>(
  fn: (event: RequestEvent<P>) => T,
  options?: LoadOptions & { readonly defer?: false },
): ServerExport<"load", (event: RequestEvent<P>) => T>;
/** Deferred loader (`{ defer: true }`): the data is a `Deferred<T>` the page renders through a boundary. */
export function load<T, P extends Params = Record<string, string>>(
  fn: (event: RequestEvent<P>) => T,
  options: LoadOptions & { readonly defer: true },
): ServerExport<"load", (event: RequestEvent<P>) => Deferred<Awaited<T>>>;
export function load<T, P extends Params = Record<string, string>>(fn: (event: RequestEvent<P>) => T, options?: LoadOptions): unknown {
  const loader = wrap("load", fn);
  if (options?.defer) Object.defineProperty(loader, DEFER, { value: true });
  return loader;
}
/** Guard: runs outer → inner before loaders and actions; return a `Response` / throw `redirect()` / `deny()` to stop. */
export function guard<T, P extends Params = Record<string, string>>(fn: (event: RequestEvent<P>) => T): ServerExport<"guard", (event: RequestEvent<P>) => T> {
  return wrap("guard", fn);
}
/** Form actions (`POST ?/name`): `{ name: (event) => result }`; `fail(status, data)` for validation errors. */
export function actions<A extends Record<string, ActionFn>>(map: A): ServerExport<"actions", A> {
  if (typeof map !== "object" || map === null) throw new TypeError("actions() expects an object of functions");
  const copy = { ...map };
  for (const name of Object.keys(copy)) if (typeof copy[name] !== "function") throw new TypeError(`actions(): \`${name}\` is not a function`);
  return tag("actions", copy);
}
/** Params to prerender a dynamic route (static builds): one object of param values per page (optional params may be absent). */
export function entries<T extends Iterable<object> | Promise<Iterable<object>>>(fn: () => T): ServerExport<"entries", () => T> {
  return wrap("entries", fn);
}
/** Response headers of the route (`HeadersInit`), after the guards. */
export function headers<P extends Params = Record<string, string>>(
  fn: (event: RequestEvent<P>) => HeadersInit | undefined,
): ServerExport<"headers", (event: RequestEvent<P>) => HeadersInit | undefined> {
  return wrap("headers", fn);
}

type Handler<P extends Params> = (event: RequestEvent<P>) => HandlerResult;
/** Any method, before guards (outer → inner); a returned `Response` ends the request. */
export function onRequest<P extends Params = Record<string, string>>(fn: Handler<P>): ServerExport<"onRequest", Handler<P>> {
  return wrap("onRequest", fn);
}
/** GET / HEAD request handler (endpoint routes: must return the `Response`; pages: middleware before the guards). */
export function onGet<P extends Params = Record<string, string>>(fn: Handler<P>): ServerExport<"onGet", Handler<P>> {
  return wrap("onGet", fn);
}
/** POST request handler (pages: before actions; endpoints: answers). */
export function onPost<P extends Params = Record<string, string>>(fn: Handler<P>): ServerExport<"onPost", Handler<P>> {
  return wrap("onPost", fn);
}
/** PUT request handler. */
export function onPut<P extends Params = Record<string, string>>(fn: Handler<P>): ServerExport<"onPut", Handler<P>> {
  return wrap("onPut", fn);
}
/** PATCH request handler. */
export function onPatch<P extends Params = Record<string, string>>(fn: Handler<P>): ServerExport<"onPatch", Handler<P>> {
  return wrap("onPatch", fn);
}
/** DELETE request handler. */
export function onDelete<P extends Params = Record<string, string>>(fn: Handler<P>): ServerExport<"onDelete", Handler<P>> {
  return wrap("onDelete", fn);
}
/** OPTIONS (CORS preflight): no CSRF check; nothing answered → `204` + `Allow`. */
export function onOptions<P extends Params = Record<string, string>>(fn: Handler<P>): ServerExport<"onOptions", Handler<P>> {
  return wrap("onOptions", fn);
}
