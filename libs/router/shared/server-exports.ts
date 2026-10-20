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

/** Loader: data for the page / layout (`data` prop; `PageProps<typeof loader>`). Runs on the server only. */
export function load<T, P extends Params = Record<string, string>>(fn: (event: RequestEvent<P>) => T): ServerExport<"load", (event: RequestEvent<P>) => T> {
  return wrap("load", fn);
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
