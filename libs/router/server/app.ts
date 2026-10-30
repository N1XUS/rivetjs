// Assemble the generated route table, page factory and document shell into one request handler.
import { _variantOf, type ServerValue } from "@rivetjs/runtime/server";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import type { RenderCache, RenderCacheScope } from "@rivetjs/runtime/server-cache";
import type { IncrCache } from "@rivetjs/runtime/server-incr";
import type { ActionResult, Head, HeadSink, LoaderDeps } from "../shared/data.ts";
import { headTags, rankMerge, type RankedHead } from "../shared/head.ts";
import { copyHeadRendering, lateHeadTags } from "../shared/head-native.ts";
import { nonceCSP, type CSPOptions } from "../shared/csp.ts";
import { inlineStylesFor, type InlineStyleManifest } from "./inline-styles.ts";
import type { TrailingSlash } from "../shared/slash.ts";
import { escapeJSON } from "@rivetjs/runtime/resume-format";
import { createHandler, _digest, encodeData, type AppHandler, type AppRoute, type BodyLimit, type ErrorInfo, type ShellPhase } from "./handler.ts";
import { renderDocument, type DocumentInput, type DocumentShell, type RenderPageOptions } from "./render.ts";
import type { EarlyHintsOptions, Hinter, HintWriter } from "./early-hints.ts";
import type { CachePolicy, CachingHandler, RouteCacheOptions, RouteRules } from "./route-cache.ts";
import { SHELL_BUILD } from "./shell-build.ts";

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
  /** A deferred loader's redirect target, read at the document's end (client redirect). */
  readonly moved?: () => string | undefined;
  /** @internal Route rule `shell`: a shell fill / replay (always streams). */
  readonly shell?: ShellPhase;
  /** i18n: the rendered locale (`locals.locale` when one of `AppConfig.i18n.locales`, else the first): `locale()` from `@rivetjs/i18n` reads it. */
  readonly locale?: string;
}
type HeadExport = Head | ((context: { data: unknown; params: Readonly<Record<string, string>>; url: URL }) => Head | undefined);
/** Shape of the generated `.rivet/entry.server.tsx` module. */
export interface GeneratedEntry {
  readonly routes: readonly AppRoute[];
  readonly universal: Readonly<Record<string, () => Promise<[number, { head?: unknown }][]>>>;
  page(input: PageInput): () => ServerValue;
  /**
   * The page module of `url` (generated `loadPage`): loaded before a route's first render, so its lazy page component
   * renders synchronously — a render that throws then fails before the response starts (500 + error page).
   */
  loadPage?(url: URL): Promise<unknown> | undefined;
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
   * Preload planner (`@rivetjs/runtime/server-derived` `PreloadOptions`). The page's handler closures (`data-fo`) are
   * fetched as low-priority modulepreloads in the first idle period after `load` (`ahead: "idle"`, default), right after
   * it (`"load"`), or not before the first intent (`"intent"`); intent (pointer down / resting 80 ms, focus, touch, key)
   * always fetches them at once. `lean` (per page URL when a function) = `ahead: "intent"` for that page: nothing loads
   * before the first interaction.
   */
  readonly preload?: {
    readonly ahead?: "idle" | "load" | "intent";
    readonly lean?: boolean | ((url: URL) => boolean | undefined);
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
   * Incremental server rendering of keyed lists: `createIncrCache()` from `@rivetjs/runtime/server-incr` (opt-in; build with
   * `rivetRouter({ resume: { incr: true } })` / `rivet({ resume: { incr: true } })` so the compiler emits its row proofs). A
   * `<For>` whose rows the compiler proved pure re-renders only the rows whose read fields changed since the last render of
   * that list; the rest are written from their stored bytes. Byte-identical to an uncached render. Resumable (production)
   * renders only.
   */
  readonly incr?: IncrCache;
  /** With `incr`: the request's partition (tenant); lists of different partitions never share state. */
  readonly incrPartition?: (request: Request) => string | undefined;
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

// `@rivetjs/runtime/server` `VARIANT_VALUE`: an i18n `t()` value outside JSX (one value per locale variant).
const VARIANT_VALUE = Symbol.for("rivet.variantValue");
/**
 * `value` with its translated values (server `t()` outside JSX: route `head` exports, kit head components) resolved for
 * locale `variant`, deep through plain objects and arrays; unchanged values (and containers holding none) keep their identity.
 */
export function translateHead<T>(value: T, variant: number): T {
  if (value === null || typeof value !== "object") return value;
  if ((value as Record<symbol, unknown>)[VARIANT_VALUE]) return _variantOf(value, variant) as T;
  if (Array.isArray(value)) {
    let out: unknown[] | undefined;
    for (let i = 0; i < value.length; i++) {
      const item = translateHead(value[i], variant);
      if (item !== value[i]) (out ??= value.slice())[i] = item;
    }
    return (out ?? value) as T;
  }
  // Plain records only (head fields, JSON-LD data); branded inline scripts, URLs and class instances stay as they are.
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;
  let out: Record<string, unknown> | undefined;
  for (const key of Object.keys(value)) {
    const item = (value as Record<string, unknown>)[key];
    const next = translateHead(item, variant);
    if (next !== item) (out ??= { ...(value as Record<string, unknown>) })[key] = next;
  }
  return (out ? copyHeadRendering(value as Head, out as Head) : value) as T;
}

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
function createSink(
  nonce: string | undefined,
  late: (message: string) => void,
  variant: number | undefined,
): HeadSink & { entries: RankedHead[]; close(): void } {
  let seq = 0,
    closed = false;
  const entries: RankedHead[] = [];
  // i18n: translated values (`<Title>{t("…")}</Title>`, `<Meta content={t("…")} />`) resolve for the request's locale.
  const resolve = variant === undefined ? undefined : (value: unknown) => translateHead(value, variant);
  return {
    nonce,
    entries,
    ...(resolve ? { resolve } : {}),
    close: () => void (closed = true),
    push(level, head, component) {
      if (resolve) head = resolve(head) as Head;
      if (!closed) {
        entries.push({ level, phase: 1, seq: seq++, head });
        return undefined;
      }
      // After the shell: only body-valid tags (links, scripts, styles) still apply, where they render.
      if (head.title !== undefined || head.titleTemplate !== undefined || head.meta?.length || head.html || head.body || head.base)
        late(`${component ?? "A head component"} rendered after the shell (inside a streamed Async boundary): title/meta/html changes are ignored there`);
      return lateHeadTags(head, { nonce }, headTags);
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
  // Page module loads per route (`entry.loadPage`; null: loaded). Dev loads every time (modules change between requests).
  const pages = new Map<string, Promise<unknown> | null>();
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
  const moveScript = (to: string | undefined, nonce: string | undefined) =>
    to === undefined ? "" : `<script${scriptAttrs(nonce)}>location.replace(${JSON.stringify(to).replace(/</g, "\\u003c")})</script>`;
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
    // A route's first render: its page module loads first (the lazy page would otherwise make the render pending, and a
    // pending render opens the response — a throw in the page then ends a 200 with a failure marker instead of a 500).
    if (routeId !== undefined && entry.loadPage) {
      let loading = dev ? entry.loadPage(page.url) : pages.get(routeId);
      if (loading === undefined) {
        pages.set(routeId, (loading = entry.loadPage(page.url) ?? null));
        // Loaded: later renders go straight on. Failed: the render fails (route error view / 500), the next request retries.
        loading?.then(
          () => pages.set(routeId, null),
          () => pages.delete(routeId),
        );
      }
      if (loading) {
        const go = () => styled(page, status, headers, nonce, request, locals, routeId);
        return loading.then(go, go);
      }
    }
    return styled(page, status, headers, nonce, request, locals, routeId);
  };
  const styled = (
    page: PageInput,
    status: number,
    headers: Headers,
    nonce: string | undefined,
    request: Request,
    locals?: Record<string, unknown>,
    routeId?: string,
  ): Response | Promise<Response> => {
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
    const i18n = config.i18n;
    const locale = i18n && typeof locals?.locale === "string" && i18n.locales.includes(locals.locale) ? locals.locale : undefined;
    const variant = locale ? i18n!.locales.indexOf(locale) : 0;
    // `locale()` (`@rivetjs/i18n`): the variant rendered; without a settled locale the first one.
    if (i18n) page = { ...page, locale: locale ?? i18n.locales[0]! };
    let sink: ReturnType<typeof createSink> | undefined;
    if (entry.headComponents) {
      sink = createSink(
        nonce,
        (message) => {
          if (dev) console.error("[rivet] " + message);
          // Once per message (component + text: bounded by the app's code), not per URL (unbounded).
          else if (!warned.has(message)) (warned.add(message), console.warn("[rivet] " + message));
        },
        i18n ? variant : undefined,
      );
      page = { ...page, headSink: sink };
      // Shell cache H-holes hit: no hold (the stored shell's head is out), so the holes' head components get late entries.
      if (page.shell?.render?.holes) (sink.close(), (page.shell.headSink = sink));
    }
    const signal = request.signal;
    if (hinter && routeId !== undefined) {
      if (!sink) hinter.learn(routeId, page.head);
      const links = hinter.links(routeId);
      if (links.length && !headers.has("link")) headers.set("link", links.join(", "));
    }
    if (csp && nonce !== undefined && !headers.has("content-security-policy")) headers.set("content-security-policy", csp(nonce));
    const built = (i18n && i18n.manifests?.[locale ?? i18n.locales[0]!]) || manifest;
    const devMode =
      built || !config.devResume ? undefined : typeof config.devResume.mode === "function" ? config.devResume.mode(locale) : config.devResume.mode;
    const pageManifest = built || config.devResume?.manifest;
    // Dev check mode streams nothing: a shell fill's deferred data waits in place there (not an in-order read).
    if (page.shell && devMode === "check") page.shell.plain = true;
    const dir = locals?.dir === "rtl" || locals?.dir === "ltr" ? locals.dir : undefined;
    const exports = page.head ? (levels.get(page.head) ?? ranked([page.head], config.head)) : ranked([], config.head);
    // Root layout component entries stay in the browser (that layout never re-renders there).
    const persistent = new Set<object>();
    const leanOption = config.preload?.lean;
    const prime = routeId !== undefined && pageManifest?.ready?.routes[routeId] !== undefined;
    const lean = typeof leanOption === "function" ? leanOption(page.url) : leanOption;
    const run = () => {
      const factory = entry.page(page);
      // Built by assignment, not spread chains: a `...(cond ? { k } : {})` per optional key allocated a temporary object
      // each and grew the result one property at a time (~0.5 KB a request).
      const input: { -readonly [K in keyof DocumentInput]: DocumentInput[K] } = { head: page.head, nonce, url: page.url, status, styles: pageStyles };
      if (inlineStyles) input.inlineStyles = inlineStyles;
      if (locale) input.locale = locale;
      if (dir) input.dir = dir;
      if (sink) input.managed = { persistent };
      const options: RenderPageOptions = {
        document,
        signal,
        onError: (error: unknown) => {
          // Route rules: a page that rendered an error fallback is not stored (`route-cache.ts` `RENDER_FAILED`).
          (request as unknown as Record<symbol, boolean>)[RENDER_FAILED] = true;
          const digest = _digest();
          report(error, request, { digest, phase: "render", ...(routeId !== undefined ? { route: routeId } : {}) });
          return digest;
        },
      };
      if (sink) {
        const collected = sink;
        options.hold = {
          head: () => {
            collected.close();
            for (const { level, head } of collected.entries)
              if (level === 0) for (const entry of [...(head.meta ?? []), ...(head.links ?? []), ...(head.scripts ?? [])]) persistent.add(entry);
            const merged = rankMerge([...exports, ...collected.entries]);
            if (routeId !== undefined) hinter?.learn(routeId, merged);
            return merged;
          },
        };
      }
      if (pageManifest) options.manifest = pageManifest;
      if (incrCache) {
        options.incr = incrCache;
        if (incrPartition) options.incrPartition = incrPartition(request);
      }
      if (variant) options.variant = variant;
      // Deferred loaders: their boundaries stream out of order (shell first) even when the app set no `stream`.
      // Shell routes (`routeRules` `shell`) always stream: the stored shell ends where the first boundary would stream.
      if (config.stream) options.stream = config.stream;
      else if (page.deferred || page.shell) options.stream = {};
      // ROUTER-PRIME: a route the manifest lists (`ready`): its page chunk joins the fetch-ahead list, the prime runs `Root.ready`.
      if (lean || config.preload?.ahead || prime) {
        const preload: NonNullable<RenderPageOptions["preload"]> = {};
        if (lean) preload.lean = lean;
        else if (config.preload?.ahead) preload.ahead = config.preload.ahead;
        if (prime) preload.route = routeId;
        options.preload = preload;
      }
      if (nonce !== undefined) options.nonce = nonce;
      if (config.devScripts && !built) options.around = devAround(page, status, nonce, locale, devMode);
      // Deferred loaders' redirects (status already sent): the browser navigates at the document's end.
      if (page.moved) options.epilogue = () => moveScript(page.moved!(), nonce);
      if (devMode === "check") options.discardState = true;
      // Shell fills / replays (`shell-cache.ts`): byte-counting / compare-only body writer, recorder hook.
      const shell = page.shell?.render as Pick<RenderPageOptions, "body" | "shell" | "holes"> | undefined;
      if (shell) Object.assign(options, shell);
      return renderDocument(factory, input, options, { status, headers });
    };
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
  const incrCache = config.incr,
    incrPartition = config.incrPartition;
  // `renderCache`: the scope module (AsyncLocalStorage) loads at startup, pay-per-use like `directives`.
  let withCache: (<T>(scope: RenderCacheScope, fn: () => T) => T) | undefined;
  let fragments: Promise<void> | null = config.renderCache
    ? import("@rivetjs/runtime/server-cache").then((module) => {
        withCache = module.withRenderCache;
        fragments = null;
      })
    : null;
  // A route's universal modules (`head` exports) in production: loaded once, then answered without a promise a request.
  type UniversalModules = [number, { head?: unknown }][];
  const universals = dev ? undefined : new Map<string, UniversalModules>();
  const universalOf = (id: string): UniversalModules | Promise<UniversalModules> | undefined => {
    const known = universals?.get(id);
    if (known) return known;
    const loading = entry.universal[id]?.();
    return universals && loading ? loading.then((modules) => (universals.set(id, modules), modules)) : loading;
  };
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
    head(route, data, match) {
      const merge = (modules: UniversalModules | undefined) =>
        modules ? routeHead(modules, data, match.params, match.url, match.locals, Infinity) : config.head ? rankMerge(ranked([], config.head)) : undefined;
      const modules = universalOf(route.id);
      return modules instanceof Promise ? modules.then(merge) : merge(modules);
    },
    // A layout whose `head` is a function of its data reruns its loader (the merged head needs it).
    async keepable(route) {
      const modules = await universalOf(route.id);
      const out: boolean[] = [];
      for (const [index, module] of modules ?? []) if (typeof module.head === "function") out[index] = false;
      return out;
    },
    render: (input) => {
      const page: { -readonly [K in keyof PageInput]: PageInput[K] } = {
        data: input.data,
        // Shell fills: a URL whose named query reads outside the rule's key are recorded (`shell-cache.ts`).
        url: input.shell?.url ?? input.url,
        head: input.head,
      };
      if (input.action) page.action = input.action;
      if (input.byURL) page.byURL = input.byURL;
      if (input.deps) page.deps = input.deps;
      if (input.deferred) page.deferred = input.deferred;
      if (input.moved) page.moved = input.moved;
      if (input.shell) page.shell = input.shell;
      return respond(page, input.status, input.headers, input.nonce, input.request, input.locals, input.route.id);
    },
    renderError: async (input) => {
      const locals = await errorLocals(input.locals, input.request, input.url);
      const layouts = input.layouts ?? [];
      return respond(
        {
          // The outermost layouts' data (error pages render inside the layouts that loaded).
          data: layouts,
          url: input.url,
          head: await errorHead(input.route, layouts, input.status, input.params ?? {}, input.url, locals),
          error: { status: input.status, message: input.message },
        },
        input.status,
        input.headers,
        input.nonce,
        input.request,
        locals,
      );
    },
  });
  const given = config.routeRules ?? entry.routeRules;
  if (!given || !Object.keys(given).length) return app;
  // Dev: headers only (a stored page would hide edits); `shell` rules probe (track reads, log why a shell would not be stored).
  const rules: RouteRules = dev
    ? Object.fromEntries(
        Object.entries(given).map(([pattern, rule]) => [
          pattern,
          { ...(rule.headers ? { headers: rule.headers } : {}), ...(rule.shell !== undefined ? { shell: devShell(rule) } : {}) },
        ]),
      )
    : given;
  const shelled = Object.values(rules).some((rule) => rule.shell);
  if (shelled && !SHELL_BUILD)
    throw new TypeError("createApp: `shell` route rules need a build whose `rivetRouter({ routeRules })` has a `shell` rule (it bundles the shell cache)");
  // Route rules: their module loads at startup (pay-per-use); malformed rules reject there (unhandled: the process
  // fails like a synchronous throw would). Requests before it settles wait for it.
  const policy: CachePolicy = {
    policy: (nonce) => (csp ? csp(nonce) : false),
    // The default / `CSPOptions` nonce policy becomes hashes in stored pages; a `csp` function keeps its nonce per page.
    hash: config.csp === undefined ? {} : typeof config.csp === "object" ? config.csp : null,
  };
  let cached: CachingHandler | null = null;
  // Shell rules: the shell cache module loads with the rules module (pay-per-use: only apps with `shell` rules).
  const loading = Promise.all([import("./route-cache.ts"), SHELL_BUILD && shelled ? SHELL_BUILD() : undefined]).then(
    ([{ withRouteRules }, shells]) =>
      (cached = withRouteRules(app, rules, policy, entry.base ?? "", config.routeCache, shells, {
        dev,
        build: manifest?.runtime ?? "",
      })),
  );
  const handler: AppHandler = (request, context) => (cached ? cached(request, context) : loading.then((ready) => ready(request, context)));
  // The node adapter's fast path (a stored page before a Request is built), once the module loaded.
  Object.defineProperty(handler, ROUTE_CACHE, { get: () => (cached ? (cached as unknown as Record<symbol, unknown>)[ROUTE_CACHE] : undefined) });
  return handler;
  // Dev shell rules: keys only (the probe never stores, so no times and no fixed origin).
  function devShell(rule: RouteRules[string]): false | { maxAge: number; query?: boolean | readonly string[]; varies?: readonly string[] } {
    if (rule.shell === false) return false;
    const own: { query?: boolean | readonly string[]; varies?: readonly string[] } = typeof rule.shell === "object" ? rule.shell : {};
    const cache: { query?: boolean | readonly string[]; varies?: readonly string[] } = typeof rule.cache === "object" ? rule.cache : {};
    const query = own.query ?? cache.query;
    const varies = own.varies ?? cache.varies;
    return { maxAge: 0, ...(query !== undefined ? { query } : {}), ...(varies ? { varies } : {}) };
  }
  /**
   * Merged head of a route's universal modules below `depth` (route data order: layouts, then the page), over the app's
   * defaults; i18n: translated values resolve for the request's locale (`locals.locale`). `extra`: the innermost entry.
   */
  function routeHead(
    modules: readonly [number, { head?: unknown }][],
    data: readonly unknown[],
    params: Readonly<Record<string, string>>,
    url: URL,
    locals: Record<string, unknown> | undefined,
    depth: number,
    extra?: Head,
  ): Head | undefined {
    const heads: (Head | undefined)[] = [];
    for (const [index, module] of modules) {
      if (index >= depth) continue;
      const head = module.head as HeadExport | undefined;
      heads[index] = typeof head === "function" ? head({ data: data[index], params, url }) : head;
    }
    if (extra) heads[depth] = extra;
    const i18n = config.i18n;
    if (i18n) {
      const locale = typeof locals?.locale === "string" ? i18n.locales.indexOf(locals.locale) : -1;
      for (let i = 0; i < heads.length; i++) heads[i] = translateHead(heads[i], locale < 0 ? 0 : locale);
    }
    const contributions = ranked(heads, config.head);
    const merged = rankMerge(contributions);
    if (merged) levels.set(merged, contributions);
    return merged;
  }
  /**
   * Error / 404 page head: the `head` exports of the layouts it renders inside (title template, meta), then its own title.
   * A layout `head` that throws leaves the page with its own head (the error page must render).
   */
  async function errorHead(
    route: AppRoute | undefined,
    layouts: readonly unknown[],
    status: number,
    params: Readonly<Record<string, string>>,
    url: URL,
    locals: Record<string, unknown>,
  ): Promise<Head> {
    const own: Head = { title: status === 404 ? "Not found" : "Error" };
    // Unmatched URLs render inside the root layout: any route below it lists that layout's module first.
    const source = route ?? (layouts.length ? entry.routes.find((r) => r.keys?.[0] === "/") : undefined);
    try {
      const modules = source && layouts.length ? await entry.universal[source.id]?.() : undefined;
      if (modules) return routeHead(modules, layouts, params, url, locals, layouts.length, own) ?? own;
    } catch {
      /* The error page's own head. */
    }
    return own;
  }
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
