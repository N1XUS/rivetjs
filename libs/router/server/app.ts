// Assemble the generated route table, page factory and document shell into one request handler.
import type { ServerValue } from "@rivetjs/runtime/server";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import type { RenderCache, RenderCacheScope } from "@rivetjs/runtime/server-cache";
import type { ActionResult, Head, HeadSink, LoaderDeps } from "../shared/data.ts";
import { headTags, rankMerge, type RankedHead } from "../shared/head.ts";
import { nonceCSP, type CSPOptions } from "../shared/csp.ts";
import { inlineStylesFor, type InlineStyleManifest } from "./inline-styles.ts";
import type { TrailingSlash } from "../shared/slash.ts";
import { escapeJSON } from "@rivetjs/runtime/resume-format";
import { createHandler, _digest, encodeData, type AppHandler, type AppRoute, type BodyLimit, type ErrorInfo } from "./handler.ts";
import { renderDocument, type DocumentShell } from "./render.ts";
import type { EarlyHintsOptions, Hinter, HintWriter } from "./early-hints.ts";
import type { CachePolicy, CachingHandler, RouteCacheOptions, RouteRules } from "./route-cache.ts";

/** How a dev page renders (`AppConfig.devResume`). */
export type DevResumeMode = "check" | "resume";

/** What the generated page factory receives. */
export interface PageInput {
  readonly data: readonly unknown[];
  readonly url: URL;
  readonly head: Head | undefined;
  readonly error?: { readonly status: number; readonly message: string };
  /** Component head collector (entries generated with `@rivetjs/kit`); the app provides it through `ServerData`. */
  readonly headSink?: HeadSink;
  /** The form action this request performed (no-JS POST): pages read it with `actionResult()`. */
  readonly action?: ActionResult;
  /** Layouts whose loader read the request URL (client navigation reloads them on any URL change). */
  readonly byURL?: readonly number[];
  /** Loaders' `event.depends()` keys (absent when none called it): resumed with the layout state for `invalidate(key)`. */
  readonly deps?: LoaderDeps;
  /** A `data` slot is a deferred loader's handle (`load(fn, { defer: true })`): the page streams (out of order) even without `stream`. */
  readonly deferred?: true;
}
type HeadExport = Head | ((context: { data: unknown; params: Readonly<Record<string, string>>; url: URL }) => Head | undefined);
/** Shape of the generated `.rivet/entry.server.tsx` module. */
export interface GeneratedEntry {
  readonly routes: readonly AppRoute[];
  readonly universal: Readonly<Record<string, () => Promise<[number, { head?: unknown }][]>>>;
  page(input: PageInput): () => ServerValue;
  /** The app's document shell, when codegen was given one. */
  readonly document?: DocumentShell;
  /** `createApp` from the same bundle as the app (one runtime instance). */
  readonly createApp?: typeof createApp;
  /** Generated with component head (`@rivetjs/kit`): pages hold the document start until the shell rendered. */
  readonly headComponents?: boolean;
  /** URL base path the route patterns carry (`""` or e.g. `/app`; `rivetRouter({ base })` / Vite `base`). */
  readonly base?: string;
  /** `rivetRouter({ trailingSlash })` when `"never"` / `"always"` (the handler's 308s use the bundle's build-time constant; the static adapter reads this). */
  readonly trailingSlash?: Exclude<TrailingSlash, "ignore">;
  /** `rivetRouter({ preload: { background } })`: the default `preload.background` of this app's pages. */
  readonly preloadBackground?: number;
  /** Document prefetch on (`rivetRouter({ prefetch })`): the default `preload.ahead` of this app's pages. */
  readonly fetchAhead?: boolean;
  /** `rivetRouter({ routeRules })`: the app's route rules (JSON data; `createApp({ routeRules })` replaces them). */
  readonly routeRules?: RouteRules;
}
/** Config of the server app built from the generated routes entry. */
export interface AppConfig {
  readonly entry: GeneratedEntry;
  /** Document shell; defaults to the entry's `document`. */
  readonly document?: DocumentShell;
  /** Stylesheet URLs passed to the document. */
  readonly styles?: readonly string[];
  /**
   * Per-route stylesheets (route modules' CSS), linked after `styles`: the client build's
   * `.vite/rivet-route-css.json` (see `loadBuild`) or, in dev, a lookup of the route's module graph.
   */
  readonly routeStyles?: Readonly<Record<string, readonly string[]>> | ((routeId: string) => readonly string[] | Promise<readonly string[]>);
  /**
   * Stylesheets pages may write inline instead of linking: the client build's `.vite/rivet-inline-css.json`
   * (`rivetRouter({ inlineStylesheets })`, see `loadBuild`), decided per page from its `styles` + `routeStyles` list
   * (`inlineStylesFor`). Dev links every sheet.
   */
  readonly inlineStyles?: InlineStyleManifest;
  /** Document defaults below every route (level −1): e.g. `{ titleTemplate: "%s · Shop", meta: [...] }`. */
  readonly head?: Head;
  /** Production resume manifest; omit in dev (see `devResume`). */
  readonly manifest?: ResumeManifest;
  readonly dev?: boolean;
  /**
   * Dev (no manifest): module scripts that client-render the page (e.g. the Vite client and the
   * generated `entry.dev.tsx`). The app renders inside `[data-rivet-dev]` with its route data embedded.
   * A function gets the page's locale (i18n), e.g. to load that locale's dev module graph.
   */
  readonly devScripts?: readonly string[] | ((locale: string | undefined) => readonly string[]);
  /**
   * Dev server (`rivetRouter` sets it; no production `manifest`): pages render through the resume
   * recorder with this dev manifest, so serialization and chunk errors surface as in production.
   * `mode` (per page locale when a function): `"check"` leaves the recorded state and loader out of
   * the page and the browser client-renders (`devScripts`, embedded data); `"resume"` serves the
   * page resumable like production, inside `[data-rivet-dev="resume"]` followed by `devScripts`.
   */
  readonly devResume?: {
    readonly manifest: ResumeManifest;
    readonly mode: DevResumeMode | ((locale: string | undefined) => DevResumeMode);
  };
  readonly stream?: { deadline?: number };
  /**
   * Preload planner. `background`: byte budget (minified) of `visible` chunks' static closures also prefetched at idle,
   * in plan order (default 1 MiB, `0` off; Save-Data / 2G never). A function decides per page URL (`undefined`: default),
   * e.g. `0` for embedded frames that a page shows many of. `lean` (per page URL when a function): nothing loads before
   * the first interaction — no scheduled prefetch (eager / idle / visible / background) and no router fetch-ahead;
   * handlers load on intent (pointer dwell, focus, touch) and interaction, as under Save-Data.
   */
  readonly preload?: {
    readonly background?: number | ((url: URL) => number | undefined);
    readonly lean?: boolean | ((url: URL) => boolean | undefined);
    /**
     * Islands-only lean pages of a file-router app (bridge D-lean: the router's region + link listeners deferred until
     * the first link intent / click) still fetch the runtime + router chunks ahead (low priority after `load`, fetched,
     * never evaluated). On `resume.chunks: "route"` builds every page also fetches its own handler chunks ahead the
     * same way. Default: the app's document prefetch (`rivetRouter({ prefetch })` on → true). Ignored with `lean`.
     */
    readonly ahead?: boolean;
  };
  /**
   * Content-Security-Policy for HTML pages, given the response's nonce (inline scripts carry it).
   * Default: strict nonce policy (`strictCSP`); `CSPOptions` (`{ trustedTypes, directives }`): `strictCSP` with them (directives checked at startup);
   * `false` sends none. A `headers()` CSP wins.
   */
  readonly csp?: false | CSPOptions | ((nonce: string) => string);
  /** Server failures (`digest` set for 5xx responses, matching the message the client sees; `phase`/`route` where it failed). */
  onError?(error: unknown, request: Request, info?: ErrorInfo): void;
  /**
   * i18n: locales in compiler variant order and per-locale resume manifests. A page renders the
   * variant and manifest of `locals.locale` (set by a guard, e.g. `i18nGuard`); `locals.dir` reaches
   * the document as `dir`. Error pages use the request's `locals` too; without a locale there
   * (unmatched URLs, guards that failed first) `resolve(request)` decides, else a first path segment
   * naming a locale, else the first locale.
   */
  readonly i18n?: {
    readonly locales: readonly string[];
    readonly manifests?: Readonly<Record<string, ResumeManifest>>;
    resolve?(request: Request): string | undefined | Promise<string | undefined>;
  };
  /** Request body limit for unsafe methods (413 past it); default 1 MiB, multipart 10 MiB. */
  readonly maxBody?: BodyLimit;
  /**
   * Route rules by path pattern (`{ "/blog/**": { swr: 60 }, "/about": { isr: true, headers: { … } } }`): response headers,
   * and an in-process cache of rendered pages (fresh, stale-while-revalidate, ISR; ETag / Last-Modified → 304).
   * Defaults to the entry's (`rivetRouter({ routeRules })`). The rules module loads only when there are rules.
   * See `server/route-cache.ts` / docs "Caching".
   */
  readonly routeRules?: RouteRules;
  /** The route rules' page store: `maxBytes` (default 32 MiB), `maxEntries` (default 5000), `origin` (the public origin pages are stored for; `isr` needs it). */
  readonly routeCache?: RouteCacheOptions;
  /**
   * Cross-request fragment cache (`createRenderCache()` from `@rivetjs/runtime/server-cache`): every page renders inside
   * its scope (`withRenderCache`: locale variant, nonce, abort signal, resumable), so `cached()` / `shell()` / compiler
   * `_cached` components hit across requests. Node-only (AsyncLocalStorage; Workers: `nodejs_als`); loaded only when set.
   */
  readonly renderCache?: RenderCache;
  /**
   * Early hints for HTML pages (production only): linked stylesheets, the head's build-asset font preloads (learned
   * per route from its last render), `links` (e.g. preconnects), and with `runtime: true` the resume runtime entry. Sent as `103 Early
   * Hints` by the node adapter before guards and loaders run (`start({ earlyHints })`), and as a `Link` header on every
   * page response (proxies such as Cloudflare turn it into 103s). Browsers act on 103s over HTTP/2+ only. Pages served
   * from the route cache get the stored `Link` header but no 103 (no render runs): it helps uncached pages. Default off.
   */
  readonly earlyHints?: boolean | EarlyHintsOptions;
}

// `route-cache.ts` `ROUTE_CACHE` (same registered symbol; that module loads only with rules).
const ROUTE_CACHE = Symbol.for("rivet.routeCache");
// `early-hints.ts` `EARLY_HINTS` (same registered symbol; that module loads only with `earlyHints`).
const EARLY_HINTS = Symbol.for("rivet.earlyHints");
const RENDER_FAILED = Symbol.for("rivet.renderFailed");

/** Route export levels: layouts outermost first, then the page (undefined entries skipped). */
const ranked = (heads: readonly (Head | undefined)[], defaults?: Head): RankedHead[] => [
  ...(defaults ? [{ level: -1, phase: 0 as const, seq: 0, head: defaults }] : []),
  ...heads.flatMap((head, level) => (head ? [{ level, phase: 0 as const, seq: 0, head }] : [])),
];
/**
 * Merge heads outer → inner: inner wins per key (title; meta by name/property/http-equiv/itemprop
 * + media; one canonical; alternates by hreflang; other links by rel + href; scripts by id/src).
 */
export function mergeHeads(heads: readonly (Head | undefined)[]): Head | undefined {
  return rankMerge(ranked(heads));
}

/** Component head collector of one request: entries until the hold releases, then late entries render in place. */
function createSink(nonce: string | undefined, late: (message: string) => void): HeadSink & { entries: RankedHead[]; close(): void } {
  let seq = 0,
    closed = false;
  const entries: RankedHead[] = [];
  return {
    nonce,
    entries,
    close: () => void (closed = true),
    push(level, head, component) {
      if (!closed) {
        entries.push({ level, phase: 1, seq: seq++, head });
        return undefined;
      }
      // After the shell: only body-valid tags (links, scripts, styles) still apply, where they render.
      if (head.title !== undefined || head.titleTemplate !== undefined || head.meta?.length || head.html || head.body || head.base)
        late(`${component ?? "A head component"} rendered after the shell (inside a streamed Async boundary): title/meta/html changes are ignored there`);
      return (
        headTags(
          { ...(head.links ? { links: head.links } : {}), ...(head.scripts ? { scripts: head.scripts } : {}), ...(head.styles ? { styles: head.styles } : {}) },
          { nonce },
        ) || undefined
      );
    },
  };
}

/** Create the app's request handler. */
export function createApp(config: AppConfig): AppHandler {
  const { entry, manifest, dev = false, styles = [], routeStyles } = config;
  const inlineFor = config.inlineStyles ? inlineStylesFor(config.inlineStyles) : undefined;
  const option = config.csp ?? nonceCSP;
  let csp: false | ((nonce: string) => string) = typeof option === "object" ? (nonce: string) => nonceCSP(nonce, option) : option;
  // `directives`: the merge module loads at startup (pay-per-use, dynamic import) and checks them once —
  // a mistake rejects at startup (unhandled: the process fails like a synchronous throw would); requests
  // arriving before it settles wait for it, later ones take the synchronous path.
  let directives: Promise<void> | null =
    typeof option === "object" && option.directives
      ? import("./strict-csp.ts").then(({ strictCSP }) => {
          strictCSP("", option);
          csp = (nonce: string) => strictCSP(nonce, option);
          directives = null;
        })
      : null;
  // Route export contributions behind each merged head (rank merge with component entries).
  const levels = new WeakMap<Head, RankedHead[]>();
  // Early hints: the per-route Link values live in `early-hints.ts`, loaded at startup only with `earlyHints`.
  const hintOption = dev ? undefined : config.earlyHints;
  let hinter: Hinter | undefined;
  let hintLoading: Promise<unknown> | null = hintOption
    ? import("./early-hints.ts").then(({ createHinter }) => {
        hinter = createHinter(hintOption, { styles, routeStyles, inlineFor, base: entry.base ?? "", runtime: manifest?.runtime });
        hintLoading = null;
      })
    : null;
  const warned = new Set<string>();
  const document = config.document ?? entry.document;
  if (!document) throw new TypeError("createApp: no document shell (pass `document` or generate the entry with one)");
  const scriptAttrs = (nonce: string | undefined) => (nonce !== undefined ? ` nonce="${nonce.replace(/[^\w+/=-]/g, "")}"` : "");
  // Dev pages: what the data endpoint would answer for this URL, so the client mount needs no request.
  const devAround = (page: PageInput, status: number, nonce: string | undefined, locale: string | undefined, mode: DevResumeMode | undefined) => {
    const list = typeof config.devScripts === "function" ? config.devScripts(locale) : (config.devScripts ?? []);
    const scripts = list.map((src) => `<script type="module" src="${src}"${scriptAttrs(nonce)}></script>`).join("");
    // Resumed dev pages: the dev entry only takes over (client render) on the first hot update.
    if (mode === "resume") return { start: `<div data-rivet-dev="resume" style="display:contents">`, end: `</div>${scripts}` };
    const body = page.error
      ? { error: page.error }
      : {
          data: page.data,
          status,
          ...(page.head ? { head: page.head } : {}),
          ...(page.action ? { action: page.action } : {}),
          ...(page.deps ? { deps: page.deps } : {}),
        };
    return {
      start: `<div data-rivet-dev="" style="display:contents">`,
      end: `</div><script type="application/json" id="rivet-dev-data">${escapeJSON(encodeData(body))}</script>${scripts}`,
    };
  };
  const respond = (
    page: PageInput,
    status: number,
    headers: Headers,
    nonce: string | undefined,
    request: Request,
    locals?: Record<string, unknown>,
    routeId?: string,
  ): Response | Promise<Response> => {
    if (directives || fragments || hintLoading)
      return Promise.all([directives, fragments, hintLoading]).then(() => respond(page, status, headers, nonce, request, locals, routeId));
    const extra = routeId === undefined || !routeStyles ? undefined : typeof routeStyles === "function" ? routeStyles(routeId) : routeStyles[routeId];
    if (extra && "then" in extra) return extra.then((list) => render(page, status, headers, nonce, request, locals, list, routeId));
    return render(page, status, headers, nonce, request, locals, extra, routeId);
  };
  // Failures after the document started (the status is sent): reported with a digest, which the page's failure marker carries.
  const report = config.onError ?? ((error: unknown, _request: Request, info?: ErrorInfo) => console.error("[rivet] digest " + info?.digest + ":", error));
  const render = (
    page: PageInput,
    status: number,
    headers: Headers,
    nonce: string | undefined,
    request: Request,
    locals: Record<string, unknown> | undefined,
    extra: readonly string[] | undefined,
    routeId?: string,
  ): Response | Promise<Response> => {
    const pageStyles = extra?.length ? [...styles, ...extra] : styles;
    const inlineStyles = inlineFor?.(pageStyles);
    let sink: ReturnType<typeof createSink> | undefined;
    if (entry.headComponents) {
      sink = createSink(nonce, (message) => {
        if (dev) console.error("[rivet] " + message);
        // Once per message (component + text: bounded by the app's code), not per URL (unbounded).
        else if (!warned.has(message)) (warned.add(message), console.warn("[rivet] " + message));
      });
      page = { ...page, headSink: sink };
    }
    const signal = request.signal;
    if (hinter && routeId !== undefined) {
      if (!sink) hinter.learn(routeId, page.head);
      const links = hinter.links(routeId);
      if (links.length && !headers.has("link")) headers.set("link", links.join(", "));
    }
    if (csp && nonce !== undefined && !headers.has("content-security-policy")) headers.set("content-security-policy", csp(nonce));
    const i18n = config.i18n;
    const locale = i18n && typeof locals?.locale === "string" && i18n.locales.includes(locals.locale) ? locals.locale : undefined;
    const variant = locale ? i18n!.locales.indexOf(locale) : 0;
    const built = (i18n && i18n.manifests?.[locale ?? i18n.locales[0]!]) || manifest;
    const devMode =
      built || !config.devResume ? undefined : typeof config.devResume.mode === "function" ? config.devResume.mode(locale) : config.devResume.mode;
    const pageManifest = built || config.devResume?.manifest;
    const dir = locals?.dir === "rtl" || locals?.dir === "ltr" ? locals.dir : undefined;
    const exports = page.head ? (levels.get(page.head) ?? ranked([page.head], config.head)) : ranked([], config.head);
    // Root layout component entries stay in the browser (that layout never re-renders there).
    const persistent = new Set<object>();
    const option = config.preload?.background ?? entry.preloadBackground;
    const background = typeof option === "function" ? option(page.url) : option;
    const leanOption = config.preload?.lean;
    const lean = typeof leanOption === "function" ? leanOption(page.url) : leanOption;
    const ahead = config.preload?.ahead ?? entry.fetchAhead;
    const run = () =>
      renderDocument(
        entry.page(page),
        {
          head: page.head,
          nonce,
          url: page.url,
          status,
          styles: pageStyles,
          ...(inlineStyles ? { inlineStyles } : {}),
          ...(locale ? { locale } : {}),
          ...(dir ? { dir } : {}),
          ...(sink ? { managed: { persistent } } : {}),
        },
        {
          document,
          ...(sink
            ? {
                hold: {
                  head: () => {
                    sink.close();
                    for (const { level, head } of sink.entries)
                      if (level === 0) for (const entry of [...(head.meta ?? []), ...(head.links ?? []), ...(head.scripts ?? [])]) persistent.add(entry);
                    const merged = rankMerge([...exports, ...sink.entries]);
                    if (routeId !== undefined) hinter?.learn(routeId, merged);
                    return merged;
                  },
                },
              }
            : {}),
          ...(pageManifest ? { manifest: pageManifest } : {}),
          ...(variant ? { variant } : {}),
          // Deferred loaders: their boundaries stream out of order (shell first) even when the app set no `stream`.
          ...(config.stream ? { stream: config.stream } : page.deferred ? { stream: {} } : {}),
          ...(background !== undefined || lean || ahead
            ? { preload: { ...(background !== undefined ? { background } : {}), ...(lean ? { lean } : {}), ...(ahead ? { ahead } : {}) } }
            : {}),
          signal,
          ...(nonce !== undefined ? { nonce } : {}),
          onError: (error: unknown) => {
            // Route rules: a page that rendered an error fallback is not stored (`route-cache.ts` `RENDER_FAILED`).
            (request as unknown as Record<symbol, boolean>)[RENDER_FAILED] = true;
            const digest = _digest();
            report(error, request, { digest, phase: "render", ...(routeId !== undefined ? { route: routeId } : {}) });
            return digest;
          },
          ...(config.devScripts && !built ? { around: devAround(page, status, nonce, locale, devMode) } : {}),
          ...(devMode === "check" ? { discardState: true } : {}),
        },
        { status, headers },
      );
    return withCache
      ? withCache(
          {
            cache: config.renderCache!,
            ...(variant ? { variant } : {}),
            ...(nonce !== undefined ? { nonce } : {}),
            signal,
            resumable: pageManifest !== undefined,
          },
          run,
        )
      : run();
  };
  // `renderCache`: the scope module (AsyncLocalStorage) loads at startup, pay-per-use like `directives`.
  let withCache: (<T>(scope: RenderCacheScope, fn: () => T) => T) | undefined;
  let fragments: Promise<void> | null = config.renderCache
    ? import("@rivetjs/runtime/server-cache").then((module) => {
        withCache = module.withRenderCache;
        fragments = null;
      })
    : null;
  const app = createHandler({
    routes: entry.routes,
    dev,
    // Every locale's build shares one runtime; any manifest names the built-in decoders' chunk.
    builtins: () => (manifest ?? (config.i18n?.manifests && Object.values(config.i18n.manifests)[0]) ?? config.devResume?.manifest)?.builtins,
    ...(config.onError ? { onError: config.onError } : {}),
    ...(config.maxBody !== undefined ? { maxBody: config.maxBody } : {}),
    ...(hintOption
      ? {
          earlyHints(route: AppRoute, request: Request) {
            const send = (request as unknown as Record<symbol, HintWriter | undefined>)[EARLY_HINTS];
            if (send) {
              const links = hinter?.links(route.id) ?? [];
              if (links.length) send(links);
            }
          },
        }
      : {}),
    async head(route, data, match) {
      const modules = await entry.universal[route.id]?.();
      if (!modules) return config.head ? rankMerge(ranked([], config.head)) : undefined;
      const heads: (Head | undefined)[] = [];
      for (const [index, module] of modules) {
        const head = module.head as HeadExport | undefined;
        heads[index] = typeof head === "function" ? head({ data: data[index], params: match.params, url: match.url }) : head;
      }
      const contributions = ranked(heads, config.head);
      const merged = rankMerge(contributions);
      if (merged) levels.set(merged, contributions);
      return merged;
    },
    // A layout whose `head` is a function of its data reruns its loader (the merged head needs it).
    async keepable(route) {
      const modules = await entry.universal[route.id]?.();
      const out: boolean[] = [];
      for (const [index, module] of modules ?? []) if (typeof module.head === "function") out[index] = false;
      return out;
    },
    render: (input) =>
      respond(
        {
          data: input.data,
          url: input.url,
          head: input.head,
          ...(input.action ? { action: input.action } : {}),
          ...(input.byURL ? { byURL: input.byURL } : {}),
          ...(input.deps ? { deps: input.deps } : {}),
          ...(input.deferred ? { deferred: input.deferred } : {}),
        },
        input.status,
        input.headers,
        input.nonce,
        input.request,
        input.locals,
        input.route.id,
      ),
    renderError: async (input) =>
      respond(
        {
          // The outermost layouts' data (error pages render inside the layouts that loaded).
          data: input.layouts ?? [],
          url: input.url,
          head: { title: input.status === 404 ? "Not found" : "Error" },
          error: { status: input.status, message: input.message },
        },
        input.status,
        input.headers,
        input.nonce,
        input.request,
        await errorLocals(input.locals, input.request, input.url),
      ),
  });
  const given = config.routeRules ?? entry.routeRules;
  if (!given || !Object.keys(given).length) return app;
  // Dev: headers only (a stored page would hide edits).
  const rules: RouteRules = dev
    ? Object.fromEntries(Object.entries(given).map(([pattern, rule]) => [pattern, rule.headers ? { headers: rule.headers } : {}]))
    : given;
  // Route rules: their module loads at startup (pay-per-use); malformed rules reject there (unhandled: the process
  // fails like a synchronous throw would). Requests before it settles wait for it.
  const policy: CachePolicy = {
    policy: (nonce) => (csp ? csp(nonce) : false),
    // The default / `CSPOptions` nonce policy becomes hashes in stored pages; a `csp` function keeps its nonce per page.
    hash: config.csp === undefined ? {} : typeof config.csp === "object" ? config.csp : null,
  };
  let cached: CachingHandler | null = null;
  const loading = import("./route-cache.ts").then(({ withRouteRules }) => (cached = withRouteRules(app, rules, policy, entry.base ?? "", config.routeCache)));
  const handler: AppHandler = (request, context) => (cached ? cached(request, context) : loading.then((ready) => ready(request, context)));
  // The node adapter's fast path (a stored page before a Request is built), once the module loaded.
  Object.defineProperty(handler, ROUTE_CACHE, { get: () => (cached ? (cached as unknown as Record<symbol, unknown>)[ROUTE_CACHE] : undefined) });
  return handler;
  // Error pages without a settled locale: the app's resolver, else the URL's locale prefix.
  async function errorLocals(locals: Record<string, unknown>, request: Request, url: URL): Promise<Record<string, unknown>> {
    const i18n = config.i18n;
    if (!i18n || (typeof locals.locale === "string" && i18n.locales.includes(locals.locale))) return locals;
    let locale = await i18n.resolve?.(request);
    if (!locale || !i18n.locales.includes(locale)) {
      const first = url.pathname.split("/")[1]?.toLowerCase();
      locale = i18n.locales.find((l) => l.toLowerCase() === first);
    }
    return locale ? { ...locals, locale } : locals;
  }
}
