// Web-standard request handler: route match → guards → parallel loaders → render, plus the data
// endpoint client navigation uses (so guards always run on the server) and form actions.
import { compileRoutes } from "@rivetjs/runtime/router/server";
import { createEncoder, _builtinKinds } from "@rivetjs/runtime/resume-format";
import { HttpError, isHttpError } from "../shared/errors.ts";
import { isActionFailure } from "../shared/actions.ts";
import { DATA_PARAM, KEEP_PAGE, KEEP_PARAM, withoutRivet, type ActionAnswer, type ActionResult, type DataAnswer, type Head, type LoaderDeps } from "../shared/data.ts";
export { DATA_PARAM, type ActionResult } from "../shared/data.ts";
import { loadServer } from "./module.ts";
import { crossSite, limitBody, type BodyLimit } from "./security.ts";
import { ABSOLUTE, unsafeTarget } from "../shared/redirect.ts";
import { slashPath, TRAILING_SLASH } from "../shared/slash.ts";
import { parseCookies } from "../shared/cookie.ts";
export type { BodyLimit } from "./security.ts";
import type { RouteId, RouteParams } from "../index.ts";

/** Cookie access for one request; `set`/`delete` append `Set-Cookie` to the response. */
export interface Cookies {
  get(name: string): string | undefined;
  /** Every request cookie (with this request's `set`/`delete` applied), in header order. */
  getAll(): { name: string; value: string }[];
  set(name: string, value: string, options?: CookieOptions): void;
  delete(name: string, options?: Pick<CookieOptions, "path" | "domain">): void;
}
/** Cookie attributes of `cookies.set()`. */
export interface CookieOptions {
  path?: string;
  domain?: string;
  maxAge?: number;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
}
/** What guards, loaders, actions and endpoints receive. `locals` is shared along one request's chain. */
/** `RequestEvent<"items/[id]">`: params of a file route id (`RouteParams`, generated). */
export interface RequestEvent<P extends Record<string, string> | RouteId = Record<string, string>> {
  readonly request: Request;
  readonly url: URL;
  readonly params: Readonly<P extends RouteId ? RouteParams[P] : P>;
  readonly locals: Record<string, unknown>;
  readonly signal: AbortSignal;
  readonly cookies: Cookies;
  /** The handler runs in development (`dev` option); undefined when unknown (treat as production). */
  readonly dev?: boolean;
  /** Set a response header (HTML, data and action responses alike). */
  setHeader(name: string, value: string): void;
  /** Set several response headers; `set-cookie` is rejected (use `cookies.set`). */
  setHeaders(headers: Readonly<Record<string, string>>): void;
  /** The matched route (`id`: file route id, e.g. `blog/[slug]`); `null` for unmatched URLs. */
  readonly route: { readonly id: string | null };
  /** A client-navigation data request (`?_rivet=data`, answered with JSON), not a document request. */
  readonly isDataRequest: boolean;
  /** What the adapter knows about the connection (node: `clientAddress`). */
  readonly platform: Platform;
  /**
   * Loaders: name what this loader's data depends on (strings; a `URL` counts as its `href`), so
   * `invalidate(key)` in the browser reruns only the loaders that depend on `key`. Any time during
   * the loader; repeats are ignored. Elsewhere (guards, actions, handlers) it does nothing.
   */
  depends(...keys: readonly (string | URL)[]): void;
}
/** Adapter-provided request facts (`event.platform`). */
export interface Platform {
  /** Client IP address (node adapter: the socket's, or `X-Forwarded-For`'s first with `trustProxy`). */
  readonly clientAddress?: string;
  readonly [key: string]: unknown;
}
type Result = unknown;
type Handler = (event: RequestEvent) => Response | undefined | void | Promise<Response | undefined | void>;
/**
 * A route's or layout's server exports, normalized: in-file `serverLoad`… arrive here as `load`…
 * (sibling `*.server.ts` modules may still use the old names). `onRequest` and `on<Method>` request
 * handlers run outermost first before guards; a returned `Response` ends the request.
 */
export interface ServerModule {
  onRequest?: Handler;
  onGet?: Handler;
  onPost?: Handler;
  onPut?: Handler;
  onPatch?: Handler;
  onDelete?: Handler;
  /** OPTIONS (CORS preflight): after `onRequest`, outer → inner, the route's own module included; void → 204 + `Allow`. */
  onOptions?: Handler;
  guard?(event: RequestEvent): Result | Promise<Result>;
  load?(event: RequestEvent): Result | Promise<Result>;
  entries?(): Iterable<Record<string, string>> | Promise<Iterable<Record<string, string>>>;
  prerender?: boolean;
  /** `false` (route module only): skip the cross-site check for this route's unsafe methods (webhooks). */
  csrf?: boolean;
  actions?: Record<string, (event: RequestEvent) => Result | Promise<Result>>;
  headers?(event: RequestEvent): HeadersInit | undefined;
  GET?(event: RequestEvent): Response | Promise<Response>;
  POST?(event: RequestEvent): Response | Promise<Response>;
  PUT?(event: RequestEvent): Response | Promise<Response>;
  PATCH?(event: RequestEvent): Response | Promise<Response>;
  DELETE?(event: RequestEvent): Response | Promise<Response>;
}
type Load<T> = () => Promise<T>;
/** One generated route-table entry. */
export interface AppRoute {
  readonly id: string;
  readonly pattern: string;
  /** Server modules of the enclosing layouts, outermost first (undefined: layout has none). */
  readonly layouts: readonly (Load<ServerModule> | undefined)[];
  readonly server?: Load<ServerModule>;
  /** False for endpoint-only routes (a `.server.ts` without a page). */
  readonly page: boolean;
  /** Layout ids (`/` + folder path: `/`, `/shop`), parallel to `layouts`: data requests may skip the loaders of kept ones. */
  readonly keys?: readonly string[];
}
/** Everything a renderer needs for one page. `data` holds layout data then page data. */
export interface RenderInput {
  readonly request: Request;
  readonly url: URL;
  readonly route: AppRoute;
  readonly params: Readonly<Record<string, string>>;
  readonly data: readonly unknown[];
  readonly status: number;
  readonly headers: Headers;
  readonly nonce: string | undefined;
  readonly action: ActionResult | undefined;
  readonly locals: Record<string, unknown>;
  /** Merged head (layouts → page) from `head` exports. */
  readonly head: Head | undefined;
  /** Layouts (indices into `data`) whose loader read the request URL: their data follows every URL change. */
  readonly byURL?: readonly number[];
  /** Keys the loaders passed to `event.depends()` (index into `data`); absent when none called it. */
  readonly deps?: LoaderDeps;
}
/** What the error renderer receives: request, matched route, status and a user-safe message. */
export interface ErrorInput {
  readonly request: Request;
  readonly url: URL;
  /** Matched route (undefined for unmatched URLs). */
  readonly route: AppRoute | undefined;
  readonly status: number;
  /** User-safe message: the HttpError's for 4xx, generic for 5xx outside dev. */
  readonly message: string;
  readonly headers: Headers;
  readonly nonce: string | undefined;
  /** The request's `locals` as guards/loaders left them (empty when no guard ran, e.g. unmatched URLs). */
  readonly locals: Record<string, unknown>;
  /**
   * Data of the outermost layouts the error page renders inside (route data order): those whose guards
   * passed and whose loaders succeeded, up to the first that did not. Unmatched URLs: the root layout's.
   */
  readonly layouts?: readonly unknown[];
}
/** Options of the app handler: routes, renderers, head and dev flags. */
export interface AppOptions {
  readonly routes: readonly AppRoute[];
  render(input: RenderInput): Response | Promise<Response>;
  renderError?(input: ErrorInput): Response | Promise<Response>;
  /** Merged head for a route from its universal modules' `head` exports. */
  head?(route: AppRoute, data: readonly unknown[], match: { params: Readonly<Record<string, string>>; url: URL }): Head | undefined | Promise<Head | undefined>;
  /** Show 5xx messages (never in production). */
  readonly dev?: boolean;
  /** Server failures; `digest` is also in the (otherwise generic) 5xx message the client sees. */
  onError?(error: unknown, request: Request, info?: ErrorInfo): void;
  /** Request body limit in bytes for unsafe methods (413 past it). Default 1 MiB, multipart 10 MiB. */
  readonly maxBody?: BodyLimit;
  /**
   * URL of the resume manifest's `builtins` chunk (RegExp / URLSearchParams / binary / error decoders): data and action
   * answers holding such values name it (`x`), the client imports it before decoding. Without it they fail to decode.
   */
  builtins?(): string | undefined;
  /** Data requests: per layout of `route`, whether its loader may be skipped when the client keeps its data (default all). */
  keepable?(route: AppRoute): readonly boolean[] | undefined | Promise<readonly boolean[] | undefined>;
  /**
   * Called once per HTML page GET / HEAD (no data request, no action) after the request handlers and before the guards
   * and loaders: the moment a server can send `103 Early Hints` while it is still busy (`createApp({ earlyHints })`).
   */
  earlyHints?(route: AppRoute, request: Request): void;
}

/** Where a server failure happened: request handler (`onRequest`/`on<Method>`/endpoint, module load), guard, loader, action or page render. */
export type ErrorPhase = "handler" | "guard" | "loader" | "action" | "render";
/** `onError` details of a reported (5xx) failure. */
export interface ErrorInfo {
  readonly digest: string;
  readonly phase?: ErrorPhase;
  /** Matched route id. */
  readonly route?: string;
}

/** @internal Short random id tying a hidden 5xx message to its server log entry. */
export const _digest = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};
/** The app's web-standard request handler. */
export type AppHandler = (request: Request, context?: { nonce?: string; address?: string; platform?: Platform }) => Promise<Response>;

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
const ON = { GET: "onGet", POST: "onPost", PUT: "onPut", PATCH: "onPatch", DELETE: "onDelete" } as const;
type Method = keyof typeof ON;
/** `byURL` when no layout loader read the URL (shared: a server render always reports it). */
const NO_LAYOUTS: readonly number[] = Object.freeze([]);

const TOKEN = /^[!#$%&'*+\-.^_`|~\w]+$/;
/** RFC 6265 path-value: no CTLs, no `;` (it would start another attribute). */
const PATH = /^\/[^\u0000-\u001f\u007f;]*$/;
/** Host name or IP literal, optional leading dot. */
const DOMAIN = /^\.?[a-z\d](?:[a-z\d-]*[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]*[a-z\d])?)*$/i;
const SAME_SITE = { lax: "Lax", strict: "Strict", none: "None" } as const;
/** Browsers drop cookies whose name + value exceed 4096 bytes. */
const COOKIE_MAX = 4096;
function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  if (!TOKEN.test(name)) throw new TypeError("Invalid cookie name");
  const path = options.path ?? "/";
  if (!PATH.test(path)) throw new TypeError(`Invalid cookie path ${JSON.stringify(path)}`);
  const encoded = encodeURIComponent(value);
  if (name.length + encoded.length > COOKIE_MAX) throw new TypeError(`Cookie "${name}" is larger than ${COOKIE_MAX} bytes (browsers drop it)`);
  const secure = options.secure ?? true;
  const sameSite = options.sameSite ?? "lax";
  if (!Object.hasOwn(SAME_SITE, sameSite)) throw new TypeError(`Invalid cookie sameSite ${JSON.stringify(sameSite)}`);
  if (sameSite === "none" && !secure) throw new TypeError(`Cookie "${name}": sameSite "none" requires secure (browsers reject it)`);
  if ((name.startsWith("__Secure-") || name.startsWith("__Host-")) && !secure) throw new TypeError(`Cookie "${name}": the prefix requires secure`);
  if (name.startsWith("__Host-") && (path !== "/" || options.domain)) throw new TypeError(`Cookie "${name}": __Host- requires path "/" and no domain`);
  let out = name + "=" + encoded + "; Path=" + path;
  if (options.domain) {
    if (!DOMAIN.test(options.domain)) throw new TypeError(`Invalid cookie domain ${JSON.stringify(options.domain)}`);
    out += "; Domain=" + options.domain;
  }
  if (options.maxAge !== undefined) {
    if (!Number.isFinite(options.maxAge)) throw new TypeError(`Invalid cookie maxAge ${options.maxAge}`);
    out += "; Max-Age=" + Math.floor(options.maxAge);
  }
  if (options.expires) {
    if (!(options.expires instanceof Date) || Number.isNaN(options.expires.getTime())) throw new TypeError("Invalid cookie expires date");
    out += "; Expires=" + options.expires.toUTCString();
  }
  if (options.httpOnly ?? true) out += "; HttpOnly";
  if (secure) out += "; Secure";
  out += "; SameSite=" + SAME_SITE[sameSite];
  return out;
}

/**
 * A response that sets a cookie must not be stored by shared caches (it would hand the cookie to
 * every visitor): `Cache-Control` gets `private`; `public` and `s-maxage` go, other directives stay.
 */
function privateCache(headers: Headers): void {
  const kept = (headers.get("cache-control") ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter((d) => d && !/^(?:public|private|s-maxage)\b/i.test(d));
  headers.set("cache-control", ["private", ...kept].join(", "));
}

/**
 * Encode a value with the resume table (Date/Map/Set/BigInt/undefined/cycles survive). With built-in entries (RegExp /
 * URLSearchParams / binary / errors) and a `builtins` chunk URL, `x` names it: the client imports it before decoding.
 */
export function encodeData(value: unknown, builtins?: string, origin?: string): string {
  const encoder = createEncoder({ origin });
  const root = encoder.ref(value);
  return JSON.stringify(builtins && _builtinKinds(encoder.table) ? { t: encoder.table, r: root, x: builtins } : { t: encoder.table, r: root });
}

const isRedirect = (e: HttpError) => e.location !== undefined;
/** A same-origin redirect target that is the page itself without a query (`url`: the action request's URL). */
function backHere(location: string, url: URL): boolean {
  const target = new URL(location, url);
  return target.origin === url.origin && target.pathname === url.pathname && !target.search && !target.hash;
}

/** A redirect from an action without an explicit status answers 303 (the browser follows with GET). */
const seeOther = (failure: unknown): unknown => {
  if (!isHttpError(failure) || !(failure as { defaultStatus?: boolean }).defaultStatus) return failure;
  const out = new HttpError(303, failure.message, failure.location);
  if ((failure as { external?: boolean }).external) Object.defineProperty(out, "external", { value: true });
  return out;
};
const NO_PLATFORM: Platform = Object.freeze({});
// `event.depends()` outside loaders.
const noDeps = (): void => {};

// Dev hint, once per layout: a layout loader that denies or redirects acts as access control, but
// client navigations that keep the layout's data (`_rivet_keep`, client-controlled) skip it.
const hinted = new Set<string>();
function accessHint(route: AppRoute, index: number, failure: unknown): never {
  const layout = route.keys?.[index] ?? String(index);
  if (isHttpError(failure) && (failure.status === 401 || failure.status === 403 || isRedirect(failure)) && !hinted.has(layout)) {
    hinted.add(layout);
    console.warn(
      `[rivet] The loader of layout "${layout}" ${isRedirect(failure) ? "redirected" : "answered " + failure.status}: loaders are not access control. ` +
        "Client navigations that keep this layout's data skip its loader, so pages below it would load anyway. Check access in `serverGuard` (guards always run).",
    );
  }
  throw failure;
}

/**
 * One loader's view of the request event (`loaderEvent`): every member reads through to the event, `depends()`
 * records this loader's keys and, for layouts (`byURL`), reading `url` / `request` notes that it depends on the
 * URL. A class instead of `Object.create(event, descriptors)`: that built a dictionary-mode object with fresh
 * closures per loader, per request (~0.6 µs + garbage each). Destructuring loaders read members once each.
 */
class LoaderEvent {
  readonly #event: RequestEvent;
  readonly #index: number;
  readonly #byURL: Set<number> | null;
  readonly #deps: Set<string>[];
  constructor(event: RequestEvent, index: number, byURL: Set<number> | null, deps: Set<string>[]) {
    this.#event = event;
    this.#index = index;
    this.#byURL = byURL;
    this.#deps = deps;
  }
  get request(): Request {
    this.#byURL?.add(this.#index);
    return this.#event.request;
  }
  get url(): URL {
    this.#byURL?.add(this.#index);
    return this.#event.url;
  }
  // A getter (closure made when read): loaders destructure it (`({ depends }) => …`).
  get depends(): RequestEvent["depends"] {
    const deps = this.#deps,
      index = this.#index;
    return (...keys) => {
      const set = (deps[index] ??= new Set());
      for (const key of keys) set.add(String(key));
    };
  }
  get params(): RequestEvent["params"] {
    return this.#event.params;
  }
  get locals(): RequestEvent["locals"] {
    return this.#event.locals;
  }
  get signal(): RequestEvent["signal"] {
    return this.#event.signal;
  }
  get cookies(): RequestEvent["cookies"] {
    return this.#event.cookies;
  }
  get dev(): RequestEvent["dev"] {
    return this.#event.dev;
  }
  get route(): RequestEvent["route"] {
    return this.#event.route;
  }
  get isDataRequest(): RequestEvent["isDataRequest"] {
    return this.#event.isDataRequest;
  }
  get platform(): RequestEvent["platform"] {
    return this.#event.platform;
  }
  get setHeader(): RequestEvent["setHeader"] {
    return this.#event.setHeader;
  }
  get setHeaders(): RequestEvent["setHeaders"] {
    return this.#event.setHeaders;
  }
}

/** Create the app's request handler. */
export function createHandler(options: AppOptions): AppHandler {
  const { routes, render, dev = false } = options;
  // `origin`: same-origin URLs in the data serialize relative (prerendered `_data.json`: no build-time origin).
  const reply = (value: ActionAnswer | DataAnswer, status: number, headers: Headers, origin: string): Response =>
    json(value, status, headers, options.builtins?.(), origin);
  const report = options.onError ?? ((error: unknown, _request: Request, info?: ErrorInfo) => console.error("[rivet] digest " + info?.digest + ":", error));
  const match = compileRoutes(routes.map((route) => ({ path: route.pattern, render: () => route })));
  // The root layout's server module (layout id `/`): unmatched URLs' error pages render inside it.
  const rootLayout = routes.find((route) => route.keys?.[0] === "/");

  return async (request, context = {}) => {
    const url = new URL(request.url);
    // `url.searchParams` only when the query names the router's params (document requests skip it);
    // they are removed textually (re-serializing would turn `?flag&q=a%20b` into `?flag=&q=a+b`).
    const data = url.search.includes(DATA_PARAM) && url.searchParams.get(DATA_PARAM) === "data";
    // Layouts whose data the client still has (`_rivet_keep=id,id`): their loaders are skipped (guards still run).
    const kept = data ? url.searchParams.get(KEEP_PARAM) : null;
    if (data) url.search = withoutRivet(url.search);
    const headers = new Headers();
    const nonce = context.nonce;
    const locals: Record<string, unknown> = {};
    const found = match(url);
    const route = found ? (found.route.render(undefined, found) as AppRoute) : undefined;
    const method = request.method === "HEAD" ? "GET" : request.method;
    // `?/save&next=/b`: the action name ends at the first `&`. Bad percent-encoding → 400 (after CSRF).
    let action: string | undefined;
    let malformed = false;
    if (method === "POST" && url.search.startsWith("?/")) {
      action = url.search.slice(2).split("&", 1)[0]!;
      try {
        action = decodeURIComponent(action);
      } catch {
        malformed = true;
      }
    }
    // Enhanced form submits (JSON) get redirects and failures as JSON, like data requests.
    const wantsJSON = data || (action !== undefined && (request.headers.get("accept") ?? "").includes("application/json"));

    // Error pages keep the outermost layouts whose guards passed (`guarded` modules) and whose loaders
    // succeeded: loaders that already ran are reused, the others run now (guards passed for them).
    let guarded = 0;
    let modules: readonly (ServerModule | undefined)[] = [];
    const loads: (Promise<unknown> | undefined)[] = [];
    const errorLayouts = async (): Promise<unknown[]> => {
      const out: unknown[] = [];
      for (let i = 0; i < Math.min(guarded, route ? route.layouts.length : 1); i++) {
        try {
          out.push(await (loads[i] ??= Promise.resolve(modules[i]?.load?.(event))));
        } catch {
          break;
        }
      }
      return out;
    };
    // Set by `event.cookies`: the response gets `privateCache` once its headers are final.
    let setsCookie = false;
    const fail = async (status: number, message: string): Promise<Response> => {
      if (setsCookie) privateCache(headers);
      if (wantsJSON) return reply({ error: { status, message } }, status, headers, url.origin);
      const layouts = options.renderError && guarded ? await errorLayouts() : [];
      const input: ErrorInput = { request, url, route, status, message, headers, nonce, locals, ...(layouts.length ? { layouts } : {}) };
      if (options.renderError) return options.renderError(input);
      headers.set("content-type", "text/plain; charset=utf-8");
      return new Response(message, { status, headers });
    };
    const body = { exceeded: false };
    let phase: ErrorPhase = "handler";
    const settle = async (failure: unknown): Promise<Response> => {
      if (body.exceeded) return fail(413, "Payload too large");
      // Absolute redirect targets must stay on this origin unless `redirect(url, { external: true })`.
      if (
        isHttpError(failure) &&
        isRedirect(failure) &&
        !(failure as { external?: boolean }).external &&
        ABSOLUTE.test(failure.location!) &&
        new URL(failure.location!).origin !== url.origin
      )
        failure = new Error(`redirect() to another origin (${failure.location}); pass { external: true } to allow it`);
      if (isHttpError(failure)) {
        if (isRedirect(failure)) {
          if (setsCookie) privateCache(headers);
          if (wantsJSON) return reply({ redirect: failure.location, status: failure.status }, 200, headers, url.origin);
          headers.set("location", failure.location!);
          return new Response(null, { status: failure.status, headers });
        }
        if (failure.status < 500) return fail(failure.status, failure.expose || dev ? failure.message : "Internal Server Error");
        const digest = _digest();
        report(failure, request, { digest, phase, route: route!.id });
        return fail(failure.status, failure.expose || dev ? failure.message : `Internal Server Error (digest ${digest})`);
      }
      if (request.signal.aborted) throw failure;
      const digest = _digest();
      report(failure, request, { digest, phase, route: route!.id });
      return fail(500, dev && failure instanceof Error ? failure.message : `Internal Server Error (digest ${digest})`);
    };

    // Parsed on first cookie access (most requests never read one).
    let jar: Map<string, string> | undefined;
    const cookieJar = (): Map<string, string> => (jar ??= parseCookies(request.headers.get("cookie")));
    const event: RequestEvent = {
      request,
      url,
      params: found?.params ?? {},
      locals,
      signal: request.signal,
      dev,
      cookies: {
        get: (name) => cookieJar().get(name),
        getAll: () => Array.from(cookieJar(), ([name, value]) => ({ name, value })),
        set: (name, value, cookie) => {
          cookieJar().set(name, value);
          setsCookie = true;
          headers.append("set-cookie", serializeCookie(name, value, cookie));
        },
        delete: (name, cookie) => {
          cookieJar().delete(name);
          setsCookie = true;
          headers.append("set-cookie", serializeCookie(name, "", { ...cookie, maxAge: 0, expires: new Date(0) }));
        },
      },
      setHeader: (name, value) => headers.set(name, value),
      setHeaders: (values) => {
        for (const name in values) {
          if (name.toLowerCase() === "set-cookie") throw new TypeError("setHeaders: use event.cookies.set for set-cookie");
          headers.set(name, values[name]!);
        }
      },
      route: { id: route?.id ?? null },
      isDataRequest: data,
      platform: context.platform || context.address ? { ...(context.address ? { clientAddress: context.address } : {}), ...context.platform } : NO_PLATFORM,
      depends: noDeps,
    };
    // Each loader gets its own view of the event: `depends()` records its keys (route data index);
    // `track` (layouts) also notes reads of the URL or request (such data is not kept across URL changes).
    const deps: Set<string>[] = [];
    const byURL = new Set<number>();
    const loaderEvent = (i: number, track: boolean): RequestEvent => new LoaderEvent(event, i, track ? byURL : null, deps) as unknown as RequestEvent;
    // Only when a loader called `depends()`: one entry per loader, undefined for the others.
    const depsOf = (): { deps?: LoaderDeps } => (deps.length ? { deps: Array.from(modules, (_, i) => (deps[i] ? [...deps[i]!] : undefined)) } : {});
    // A Response from a request handler, guard, action or endpoint keeps what the request set: event
    // cookies are appended, other event headers fill in what it lacks (its own win). Immutable headers
    // (`Response.redirect()`, a proxied `fetch()`) are copied first.
    const merge = (response: Response): Response => {
      const cookies = headers.getSetCookie();
      let own = false;
      headers.forEach((_, name) => (own ||= name !== "set-cookie"));
      if (!cookies.length && !own) return response;
      const apply = (target: Headers) => {
        headers.forEach((value, name) => name !== "set-cookie" && !target.has(name) && target.set(name, value));
        for (const cookie of cookies) target.append("set-cookie", cookie);
        if (setsCookie) privateCache(target);
      };
      try {
        apply(response.headers);
        return response;
      } catch {
        const copy = new Response(response.body, response);
        apply(copy.headers);
        return copy;
      }
    };
    // Data requests: a guard's or request handler's Response becomes the JSON the client follows
    // (3xx → `{ redirect }`, anything else → `{ reload }`); enhanced actions get redirects as JSON.
    // A target the client must not follow itself (`javascript:`, `//evil`, control characters): the
    // client loads the document instead, where the browser applies the real response.
    const early = (response: Response): Response => {
      if (!wantsJSON) return merge(response);
      for (const cookie of response.headers.getSetCookie()) headers.append("set-cookie", cookie);
      if (!headers.has("cache-control")) headers.set("cache-control", "no-store");
      else if (setsCookie || headers.has("set-cookie")) privateCache(headers);
      const location = response.status >= 300 && response.status < 400 ? response.headers.get("location") : null;
      if (location !== null && !unsafeTarget(location) && (!ABSOLUTE.test(location) || /^https?:/i.test(location)))
        return reply({ redirect: location, status: response.status }, 200, headers, url.origin);
      return data || location !== null ? reply({ reload: true }, 200, headers, url.origin) : merge(response);
    };

    if (!found || !route) {
      // The 404 page renders inside the root layout when its guard passes (its loader runs in `fail`).
      if (rootLayout && options.renderError && !wantsJSON && method === "GET") {
        try {
          modules = [await loadServer(rootLayout.layouts[0])];
          const verdict = await modules[0]?.guard?.(event);
          if (verdict === undefined) guarded = 1;
        } catch {
          /* No layout around the 404 page. */
        }
      }
      return fail(404, "Not found");
    }
    // `rivetRouter({ trailingSlash })` (build-time constant, folded away when unset): page GET/HEAD in
    // the other form → 308 to the canonical path (query kept; data requests get `{ redirect }`), before
    // any handler runs. `/`, endpoints and other methods are left alone.
    if (TRAILING_SLASH !== "ignore" && method === "GET" && route.page) {
      const canonical = slashPath(url.pathname, TRAILING_SLASH);
      if (canonical !== url.pathname) {
        headers.set("location", canonical + url.search);
        return early(new Response(null, { status: 308, headers }));
      }
    }
    if (!METHODS.has(method)) {
      if (route.page) headers.set("allow", "GET, HEAD, POST");
      return fail(405, "Method not allowed");
    }

    try {
      modules = await Promise.all([...route.layouts.map(loadServer), loadServer(route.server)]);
      const own = modules[modules.length - 1];
      const on = method === "OPTIONS" ? "onOptions" : ON[method as Method];
      // Unsafe methods: cross-site check before any handler, guard or action; then the body limit.
      // OPTIONS (CORS preflight) is safe: no check, no body.
      if (method !== "GET" && method !== "OPTIONS") {
        if (own?.csrf !== false && crossSite(request, url.origin, dev)) throw new HttpError(403, "Cross-site request rejected");
        request = limitBody(request, options.maxBody, body);
        (event as { request: Request }).request = request;
      }
      if (malformed) throw new HttpError(400, "Malformed action name");
      // Page routes take GET, actions, and methods the route module handles (`onPost`…).
      // `Allow`: page routes take GET/HEAD, POST (actions) and the methods the route module handles;
      // endpoints what they export. 405 answers list those; OPTIONS answers add OPTIONS.
      const allow = (options: boolean): string =>
        [
          ...(route.page
            ? ["GET, HEAD, POST", ...(["PUT", "PATCH", "DELETE"] as const).filter((m) => own?.[ON[m]])]
            : (Object.keys(ON) as Method[]).filter((m) => own?.[ON[m]] || own?.[m]).map((m) => (m === "GET" ? "GET, HEAD" : m))),
          ...(options ? ["OPTIONS"] : []),
        ].join(", ");
      if (route.page && method !== "GET" && method !== "OPTIONS" && action === undefined && !own?.[on!]) {
        headers.set("allow", allow(false));
        return fail(405, "Method not allowed");
      }
      // Request handlers: outermost first, `onRequest` then `on<Method>`; an endpoint route's own
      // `on<Method>` produces its response below. OPTIONS: `onRequest` then `onOptions` (own module too).
      for (const module of modules) {
        if (!module) continue;
        const first = module.onRequest;
        if (first) {
          const result: unknown = await first(event);
          if (result instanceof Response) return early(result);
          if (isHttpError(result)) throw result;
        }
        const second = route.page || module !== own || method === "OPTIONS" ? module[on] : undefined;
        if (second) {
          const result: unknown = await second(event);
          if (result instanceof Response) return early(result);
          if (isHttpError(result)) throw result;
        }
      }
      // OPTIONS no handler answered: what the route allows (no guards, loaders or render).
      if (method === "OPTIONS") {
        headers.set("allow", allow(true));
        return new Response(null, { status: 204, headers });
      }
      // Early hints: before guards and loaders (the slow part of data-backed pages); public asset URLs only.
      if (options.earlyHints && method === "GET" && route.page && !wantsJSON && action === undefined) options.earlyHints(route, request);
      // Guards run outermost first and stop the chain on the first non-void result.
      phase = "guard";
      for (const module of modules) {
        const guard = module?.guard;
        if (guard) {
          const verdict = await guard(event);
          if (verdict instanceof Response) return early(verdict);
          if (isHttpError(verdict)) throw verdict;
        }
        guarded++;
      }
      phase = "handler";
      for (const module of modules) {
        const extra = module?.headers?.(event);
        if (extra) new Headers(extra).forEach((value, name) => headers.set(name, value));
      }
      if (!route.page) {
        const endpoint = own?.[on!] ?? own?.[method as Method];
        if (!endpoint) {
          headers.set("allow", allow(false));
          return fail(405, "Method not allowed");
        }
        const response: unknown = await endpoint(event);
        if (body.exceeded) return fail(413, "Payload too large");
        if (!(response instanceof Response)) throw new Error(`${route.id}: ${own?.[on!] ? on : method} must return a Response`);
        return merge(response);
      }
      let performed: ActionResult | undefined;
      let status = 200;
      if (action !== undefined) {
        phase = "action";
        // Own function members only: `?/toString`, `?/constructor`, `?/__proto__` are unknown actions.
        const actions = own?.actions;
        const run = actions && Object.hasOwn(actions, action) ? actions[action] : undefined;
        if (typeof run !== "function") throw new HttpError(404, `Unknown action "${action}"`);
        let result: unknown;
        try {
          result = await run(event);
        } catch (failure) {
          result = failure;
          if (!isHttpError(failure)) throw failure;
        }
        if (body.exceeded) return fail(413, "Payload too large");
        if (isHttpError(result)) {
          const failure = seeOther(result) as HttpError;
          // Single flight for post/redirect/get back to this page (`redirect()` to its path, no query): the
          // enhanced submit gets the page's fresh loader data with the redirect (no second data request).
          if (wantsJSON && request.headers.has("x-rivet-revalidate") && isRedirect(failure) && backHere(failure.location!, url)) {
            if (!headers.has("cache-control")) headers.set("cache-control", "no-store");
            if (setsCookie) privateCache(headers);
            url.search = "";
            phase = "loader";
            const fresh = await Promise.all(modules.map((module, i) => module?.load?.(loaderEvent(i, false))));
            const head = await options.head?.(route, fresh, { params: found.params, url });
            return reply({ redirect: failure.location, status: failure.status, data: fresh, ...(head ? { head } : {}), ...depsOf() }, 200, headers, url.origin);
          }
          throw failure;
        }
        if (result instanceof Response) return early(result);
        if (isActionFailure(result)) {
          status = result.status;
          performed = { name: action, result: result.data, status };
        } else performed = { name: action, result };
        url.search = "";
        if (wantsJSON) {
          if (!headers.has("cache-control")) headers.set("cache-control", "no-store");
          if (setsCookie) privateCache(headers);
          // Single flight: an enhanced form submit that succeeded gets the page's fresh loader data
          // (the client revalidates from it). Failures changed nothing; other JSON posts (field checks,
          // autosave drafts) do not ask for it.
          if (status < 400 && request.headers.has("x-rivet-revalidate")) {
            phase = "loader";
            const fresh = await Promise.all(modules.map((module, i) => module?.load?.(loaderEvent(i, false))));
            const head = await options.head?.(route, fresh, { params: found.params, url });
            return reply({ action: performed, data: fresh, ...(head ? { head } : {}), ...depsOf() }, status, headers, url.origin);
          }
          return reply({ action: performed }, status, headers, url.origin);
        }
      }
      const skip = new Set<number>();
      if (kept) {
        const ids = new Set(kept.split(","));
        const allowed = await options.keepable?.(route);
        route.keys?.forEach((id, i) => ids.has(id) && allowed?.[i] !== false && skip.add(i));
        // `.`: the page's own loader (same-URL `invalidate(key)` of layout keys only).
        if (ids.has(KEEP_PAGE) && allowed?.[route.layouts.length] !== false) skip.add(route.layouts.length);
      }
      // Layout loaders that read the URL (or request) cannot be kept across URL changes: the client learns which.
      phase = "loader";
      const loaded = await Promise.all(
        modules.map((module, i) => {
          if (skip.has(i) || !module?.load) return (loads[i] = undefined);
          const load = Promise.resolve(module.load(loaderEvent(i, i < route.layouts.length)));
          // Dev: a layout loader used as access control is skipped for kept layouts (`_rivet_keep`).
          return (loads[i] = dev && i < route.layouts.length ? load.catch((failure) => accessHint(route, i, failure)) : load);
        }),
      );
      const head = await options.head?.(route, loaded, { params: found.params, url });
      if (data) {
        if (!headers.has("cache-control")) headers.set("cache-control", "private, no-store");
        else if (setsCookie) privateCache(headers);
        return reply(
          {
            data: loaded,
            status,
            ...(head ? { head } : {}),
            ...(skip.size ? { keep: [...skip] } : {}),
            ...(byURL.size ? { byURL: [...byURL] } : {}),
            ...depsOf(),
          },
          status,
          headers,
          url.origin,
        );
      }
      if (!headers.has("cache-control")) headers.set("cache-control", "no-cache");
      if (setsCookie) privateCache(headers);
      phase = "render";
      return await render({
        request,
        url,
        route,
        params: found.params,
        data: loaded,
        status,
        headers,
        nonce,
        action: performed,
        locals: event.locals,
        head,
        byURL: byURL.size ? [...byURL] : NO_LAYOUTS,
        ...depsOf(),
      });
    } catch (failure) {
      return settle(failure);
    }
  };
}

function json(value: ActionAnswer | DataAnswer, status: number, headers: Headers, builtins?: string, origin?: string): Response {
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("x-content-type-options", "nosniff");
  return new Response(encodeData(value, builtins, origin), { status, headers });
}
