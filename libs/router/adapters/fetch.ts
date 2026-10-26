// Fetch/edge adapter: `{ fetch(request, env?, ctx?) }` over the app handler, web-standard APIs only
// (Workers, Deno, Bun, Vercel Edge). `rivetRouter({ adapter: "fetch" })` emits `dist/server/fetch.js`
// with the client manifests inlined; static assets (`dist/client`) are the platform's to serve.
import type { AppConfig, GeneratedEntry } from "../server/app.ts";
import type { BodyLimit } from "../server/security.ts";
import type { ErrorInfo } from "../server/handler.ts";
import { assemble, type BuildManifests } from "./assemble.ts";
import { nonce } from "../shared/nonce.ts";
import { baseHeaders, type BaseHeaders } from "./base-headers.ts";

/** Workers-style module: `export default { fetch }`. */
export interface FetchModule {
  fetch(request: Request, env?: unknown, ctx?: unknown): Promise<Response>;
}
type Maybe<T> = T | undefined | Promise<T | undefined>;
export interface FetchOptions {
  /**
   * Fixed public origin (`https://shop.example`) for request URLs: set it when the platform hands the
   * handler an internal URL, so same-origin checks compare with what the browser sees.
   */
  origin?: string;
  /** Request body limit for unsafe methods (413 past it); default 1 MiB, multipart 10 MiB. */
  maxBody?: BodyLimit;
  /** Out-of-order streaming for pending `Async` boundaries. */
  stream?: { deadline?: number };
  /** Extra headers on every handler response; defaults add nosniff + referrer policy (as node: same name replaces, `null` removes). */
  headers?: BaseHeaders;
  /** Log unexpected failures (default console.error); app failures get `info` (`digest`, `phase`, `route`). */
  onError?: (error: unknown, request?: Request, info?: ErrorInfo) => void;
  /**
   * Static files before the handler (GET/HEAD): return a Response to answer, undefined to render.
   * E.g. Workers `(request, env) => env.ASSETS.fetch(request)` filtered by path; most platforms serve
   * `dist/client` before the function and need none.
   */
  serveAssets?: (request: Request, env: unknown, ctx: unknown) => Maybe<Response>;
  /** i18n: error-page locale when the request has none settled (e.g. `errorLocale(config)` from `@rivetjs/i18n/router`). */
  resolveLocale?: (request: Request) => string | undefined | Promise<string | undefined>;
  /** HTML pages' Content-Security-Policy (`createApp` `csp`): default `strictCSP`; `{ trustedTypes, directives }` (`strictCSP` with them), a `(nonce) => policy` function, or `false` (none). */
  csp?: AppConfig["csp"];
  /** Preload planner (`createApp` `preload`): `ahead` (fetch-ahead timing: `"idle"` default / `"load"` / `"intent"`), `lean` (nothing before an interaction; per page when a function). */
  preload?: AppConfig["preload"];
  /** Route rules (`createApp` `routeRules`; default: the entry's, `rivetRouter({ routeRules })`): headers + in-process page cache per path pattern. */
  routeRules?: AppConfig["routeRules"];
  /** The route rules' page store (`createApp` `routeCache`: bounds, `origin`; default `origin`: this adapter's). */
  routeCache?: AppConfig["routeCache"];
  /**
   * Early hints (`createApp` `earlyHints`): a `Link` header on HTML pages (linked stylesheets, the head's build-asset
   * font preloads, `links`, `runtime: true` the resume entry). Cloudflare / Fastly turn it into `103 Early Hints` for
   * later requests; a fetch handler cannot write a 103 itself. Default off.
   */
  earlyHints?: AppConfig["earlyHints"];
  /** Client address for `event.platform.clientAddress` (e.g. `(r) => r.headers.get("cf-connecting-ip") ?? undefined`). */
  address?: (request: Request, env: unknown, ctx: unknown) => string | undefined;
}

/** Fresh 128-bit CSP nonce (base64), shared with the node adapter. */
export { nonce };

/** Wrap a server entry and its (inlined) client manifests into a fetch module. */
export function createFetch(entry: GeneratedEntry, build: BuildManifests, options: FetchOptions = {}): FetchModule {
  const { onError = (error: unknown) => console.error(error), serveAssets, address } = options;
  const handler = assemble(
    entry,
    build,
    {
      ...(options.stream ? { stream: options.stream } : {}),
      ...(options.onError ? { onError: options.onError } : {}),
      ...(options.maxBody !== undefined ? { maxBody: options.maxBody } : {}),
      ...(options.csp !== undefined ? { csp: options.csp } : {}),
      ...(options.preload ? { preload: options.preload } : {}),
      ...(options.routeRules ? { routeRules: options.routeRules } : {}),
      // The fixed public origin is the one stored pages are for (`isr` rules need one).
      ...(options.routeCache || options.origin ? { routeCache: { ...(options.origin ? { origin: options.origin } : {}), ...options.routeCache } } : {}),
      ...(options.resolveLocale ? { resolveLocale: options.resolveLocale } : {}),
      ...(options.earlyHints ? { earlyHints: options.earlyHints } : {}),
    },
    "fetch entry",
  );
  const base = Object.entries(baseHeaders(options.headers));
  const fixedOrigin = options.origin ? new URL(options.origin).origin : null;
  /** Add the base headers the response lacks (immutable headers, e.g. a proxied `fetch()`: copy). */
  const finish = (response: Response, head: boolean): Response => {
    const missing = base.filter(([name]) => !response.headers.has(name));
    if (head && response.body) {
      void response.body.cancel().catch(() => {});
      response = new Response(null, response);
    }
    if (!missing.length) return response;
    try {
      for (const [name, value] of missing) response.headers.set(name, value);
      return response;
    } catch {
      const copy = new Response(response.body, response);
      for (const [name, value] of missing) copy.headers.set(name, value);
      return copy;
    }
  };
  return {
    async fetch(request, env, ctx) {
      const head = request.method === "HEAD";
      try {
        if (serveAssets && (head || request.method === "GET")) {
          const asset = await serveAssets(request, env, ctx);
          if (asset) return asset;
        }
        if (fixedOrigin) {
          const url = new URL(request.url);
          if (url.origin !== fixedOrigin) request = new Request(fixedOrigin + url.pathname + url.search, request);
        }
        const clientAddress = address?.(request, env, ctx);
        const platform =
          env !== undefined || ctx !== undefined || clientAddress
            ? { ...(env !== undefined ? { env } : {}), ...(ctx !== undefined ? { ctx } : {}) }
            : undefined;
        const response = await handler(request, { nonce: nonce(), ...(clientAddress ? { address: clientAddress } : {}), ...(platform ? { platform } : {}) });
        return finish(response, head);
      } catch (error) {
        if (request.signal.aborted) throw error;
        onError(error, request);
        return finish(
          new Response("Internal Server Error", { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } }),
          head,
        );
      }
    },
  };
}
