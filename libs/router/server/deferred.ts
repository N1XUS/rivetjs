// Deferred loaders (`load(fn, { defer: true })`, lane PPR-T01 = shell-cache spec T1, docs/design/specs/2026-10-20-ppr-shell-design.md
// D3): a document request starts them with the other loaders but renders without awaiting them; their slot in the route
// data is a `Deferred<T>` handle that boundaries (`<Async load={() => data}>`, `resource(() => data)`) take like a promise.
// Loaded by the handler (dynamic import) only for a route with a deferred loader: other apps' server bundles pay nothing.
import type { Cookies, RequestEvent } from "./handler.ts";

// One handle per deferred slot per request: a frozen object whose non-enumerable `then` follows the loader's promise, so
// every await form works (`Async` / `resource` fetchers, `await data`, `Promise.all`). Ruling (PPR-T01): per request, not
// spec D3's request-independent handle resolved against the render scope — that one failed `await data` (the
// continuation runs outside the owner, the render scope is gone) and would need AsyncLocalStorage; shell-cache H-replay
// (T3) re-runs the page with live handles anyway, H-holes (T6) must swap a retained handle for the hit's (frame swap).
const DOCS = "https://rivetjs.severyn.pro/guides/routing/loading-data#deferred-loaders";

// The only string keys a handle answers in dev: what promise / boundary / encoder / JSON code reads.
const ALLOWED = new Set(["then", "toJSON", "constructor", "valueOf", "toString"]);
const devGet: ProxyHandler<object>["get"] = (target, key, receiver) => {
  if (typeof key === "symbol" || ALLOWED.has(key)) return Reflect.get(target, key, receiver);
  const error = new TypeError(
    "Deferred loader data read synchronously (`data." +
      key +
      "`): `load(fn, { defer: true })` data is a Deferred handle — render it through `<Async load={() => data}>` or `resource(() => data)` (" +
      DOCS +
      ")",
  );
  error.name = "DeferredDataError";
  throw error;
};
const DEV_TRAPS: ProxyHandler<object> = { get: devGet };
/**
 * The `Deferred<T>` handle of a started deferred loader. Its only property (`then`) is non-enumerable: the resume encoder
 * writes it as an empty object (a resumed page's layout data signal holds it; client navigations carry resolved values).
 * Dev: a Proxy that throws `DeferredDataError` when code reads a field (`data.title`) instead of rendering the handle
 * through a boundary.
 */
export function deferredHandle(promise: Promise<unknown>, dev: boolean): object {
  const handle = Object.freeze(
    Object.defineProperty({}, "then", { value: (ok?: (value: unknown) => unknown, fail?: (cause: unknown) => unknown) => promise.then(ok, fail) }),
  );
  return dev ? new Proxy(handle, DEV_TRAPS) : handle;
}

/** Start deferred loader `i` now (with the request); a rejection is the boundary's, never an unhandled one. */
export function startDeferred(run: () => unknown): Promise<unknown> {
  const promise = new Promise<unknown>((resolve) => resolve(run()));
  promise.catch(() => {});
  return promise;
}

const late = (what: string) => (): never => {
  throw new TypeError(`A deferred loader cannot ${what}: the response head is sent before it settles (use a non-deferred loader or a guard)`);
};
const lateCookies = (cookies: Cookies): Cookies => ({
  get: cookies.get,
  getAll: cookies.getAll,
  set: late("set cookies"),
  delete: late("delete cookies"),
});
/** A deferred loader's event view: reads like its loader view, but `setHeader(s)` / `cookies.set` / `cookies.delete` throw. */
export function lateEvent(event: RequestEvent): RequestEvent {
  return new Proxy(event, {
    get(target, key) {
      if (key === "setHeader") return late("set headers");
      if (key === "setHeaders") return late("set headers");
      if (key === "cookies") return lateCookies(target.cookies);
      const value = Reflect.get(target, key, target);
      return value;
    },
  });
}
