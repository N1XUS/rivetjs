---
title: Config
description: All options of rivetRouter, the rivet compiler plugin, kit, the i18n plugin, prerenderBuild, start and serve, with types and defaults.
template: reference
related: [guides/tooling/vite, reference/file-conventions, guides/deploy/node, guides/deploy/static-hosts]
---

Options and defaults as they are in the source today. Rivet is experimental, so names may still change.

## rivetRouter

`import { rivetRouter } from "@rivetjs/router/vite"`. File routes plus the Rivet compiler, configured for you. Returns an array of Vite plugins.

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [rivetRouter({ mode: "static", styles: ["src/styles.css"] }), tailwindcss()],
});
```

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `routes` | `string` | `"src/routes"` | Routes folder. |
| `base` | `string` | Vite's `base` | URL path the app is served under (`/app`). Sets Vite's `base`; routes, `<Link>`, `navigate()`, data requests, prefetch and the adapters follow it. |
| `adapter` | `"fetch"` \| `"vercel"` \| `"netlify"` \| `"cloudflare"` \| `"bun"` \| `"deno"` \| options object | none (Node) | Extra deploy target that `vite build --ssr` also writes. See [Deploy](../guides/deploy/overview.md). |
| `outDir` | `string` | `".rivet"` | Folder for generated code. |
| `document` | `string` | `"src/document.ts"` | Module whose default export is the `DocumentShell`. |
| `styles` | `string[]` | `[]` | Stylesheets to build and link in every page. |
| `inlineStylesheets` | `"auto"` \| `{ maxTotalBrotli?: number }` \| `"always"` \| `"never"` | `"auto"` | Per page. `auto`: all of a page's stylesheets go into the page as `<style>` when they add up to at most 6 KB brotli, so it makes no render-blocking stylesheet request; otherwise only stylesheets of at most Vite's `build.assetsInlineLimit` (4 KB uncompressed). `{ maxTotalBrotli }`: `auto` with another total, in bytes. `always`: every stylesheet. `never`: link them all. Written by `headTags(head, input)` in the document shell. See [CSS and Tailwind](../guides/styling/css-and-tailwind.md#small-stylesheets-are-inlined). |
| `mode` | `"server"` \| `"static"` \| `"csr"` | `"server"` | `server`: render per request. `static`: prerender to files. `csr`: single-page app, no server code allowed. |
| `resume` | `Partial<RivetResumeOptions>` | route files + app modules | Passed to the compiler. Route files are added to `modules` for you, and `appModules` (default `true`) resumes every app `.tsx`/`.jsx` component file a route imports; `appModules: false` opts out, then list other components in `modules`. `lazy` defaults to `"intent"` here. |
| `images` | `ImagesConfig` \| `true` | off | Image imports (`?image`, `?jsx`). Same as `rivet({ images })`. |
| `bridges` | `BridgeEntry[]` | none | Framework bridges (`react()` from `@rivetjs/bridge-react/vite`, `preact()` from `@rivetjs/bridge-preact/vite`): those components render as islands in the routed pages. Same as `rivet({ bridges })`. Server and static modes only. See [React and Preact components](../guides/components/framework-components.md). |
| `devtools` | `boolean` | `true` | DevTools on the dev server, if `@rivetjs/devtools` is installed. |
| `transitions` | `boolean` \| `TransitionOptions` | off | View transitions and pending UI for client navigation. `true` uses the defaults below. |
| `head` | `"components"` \| `"early"` | `"components"` with `kit()`, else `"early"` | `components`: hold `<head>` until the page rendered, so kit head components apply. `early`: route `head` exports only. Experimental. |
| `css` | `RivetCSSOptions` | see below | Scoped styles options, passed to `rivet({ css })`. Experimental. |
| `staticIcons` | `boolean` | `true` | `<Icon>` from `@rivetjs/kit/icon` with a `lucide` icon and constant props compiles to its inline `<svg>` (no component call). `false` keeps every call. Same as `rivet({ staticIcons })`. |
| `trailingSlash` | `"ignore"` \| `"never"` \| `"always"` | `"ignore"` | `ignore`: `/a` and `/a/` both serve the page. `never` / `always`: page requests in the other form get a `308` to `/a` / `/a/`; `<Link>` and `navigate()` write that form; static builds write `a.html` (`never`) or `a/index.html`. See [links and navigation](../guides/routing/links-and-navigation.md#trailing-slashes). |
| `routeRules` | `Record<string, RouteRule>` | none | Headers and page caching per path pattern (`/about`, `/blog/*`, `/docs/**`): `{ headers, cache: { maxAge, swr, tags, varies, query, cookies } \| false, swr, isr, cdn, shell: true \| { maxAge, swr, tags, varies, query } \| false }`. Cached pages are rendered once and then served from the server's memory, with `ETag` / `Last-Modified` (`304`) and `s-maxage` for CDNs. JSON data only. Applies to the server adapters (Node, fetch); the static adapter ignores rules (prerendered files get the host's headers). `isr` needs a fixed origin (`start({ origin })` or `routeCache: { origin }`). `shell` stores the request-independent part of a page and renders its deferred parts per request ([shell cache](../guides/routing/headers-and-caching.md#partial-prerendering-shell-cache)); `RIVET_SHELL_HOLES=0` in the server's environment keeps every shell hit on the replay path. Dev applies `headers` only (and reports why a `shell` would not be stored). A server's own `routeRules` option replaces it. See [route rules](../guides/routing/headers-and-caching.md#route-rules-and-page-caching). |
| `prefetch` | `boolean` \| `"document"` \| `"prerender"` | detected | Fetch (or prerender) the next document before a click, for links that load a document (links whose path matches no page route, `reload` links, or apps without client routing; endpoint links are never prefetched). `"document"` / `"prerender"`: also the default for every link without its own `prefetch`. `true`: only links marked `prefetch="document"` / `"prerender"`. Default: on when the sources mark such a link. `false`: off. While it is on, pages whose only client code is framework islands also download the Rivet runtime at low priority after the page loads (without running it), so the first link click does not wait for it. After the page loads, every resumed page also downloads the code of its interactive components that way. Neither download happens with Save-Data on or on a 2G connection. Server and static modes. See [instant page transitions](../recipes/instant-page-transitions.md). |
| `prefetchEagerness` | `"conservative"` \| `"moderate"` \| `"eager"` | `"moderate"` | When Chromium starts a document prefetch: `"conservative"` on pointer or touch down, `"moderate"` also when the pointer rests on a link for about 200 ms, `"eager"` sooner. Applies whenever document prefetch is on. Other browsers keep the fallback's timing. |
| `prefetchPaths` | `boolean` | `true` | Client-routed apps: whether links whose path matches no route take part in document prefetch (each page carries a pattern of all route paths). `false` prefetches only `reload` and `rel="external"` links and leaves the pattern out. |
| `clientRouter` | `boolean` | `false` | `true`: every page ships the client router, so links, back and forward update the page in place. `false`: the router alone does not make a page ship JavaScript. A page with nothing else to resume ships none, and its links load documents. Pages that resume anyway (interactive pages) still navigate in place. Ignored in `csr`, which always routes in the browser. See [static hosts](../guides/deploy/static-hosts.md#pages-without-javascript). |
| `announce` | `boolean` | `true` | Announce the new page to screen readers after client navigation. |
| `searchParams`, `navigate`, `forms`, `params`, `activeLinks` | `boolean` | detected from your sources | Include the router code for `useSearchParams()`, `navigate()` / `invalidate()` / `setSearchParams()`, enhanced `@rivetjs/forms` submits (also `@rivetjs/ui` `Form`; implies `navigate`), `useParams()` and `<Link active>`. Set `true` when only a dependency uses them. |
| `serverOnly` | `(string \| RegExp)[]` \| `{ modules?: (string \| RegExp)[]; reach?: "error" \| "warn" }` | `[]`, `reach: "error"` | Extra server-only modules (ids or specifiers, such as `"virtual:content"`), on top of `*.server.*` files and the `@rivetjs/router/server-only` marker. A page that uses one itself becomes a document route; a component or layout that does fails the build ([RV3011](../errors/RV3011.md)). `reach: "warn"`: a warning instead, and those pages become document routes. See [server-only code](../guides/security/server-only-code.md#what-the-build-checks). |
| `dev.resume` | `boolean` | `true` | Dev server: pages resume like production; the first edit switches a page to rendering in the browser. `false`: dev pages render in the browser from the first load. |

Builds: `vite build` writes `dist/client`, `vite build --ssr` writes `dist/server`. In `csr` mode the client build also writes `index.html`, and `--ssr` is an error.

### TransitionOptions

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `viewTransitions` | `boolean` | `true` | `false`: pending UI only, pages swap without animation. |
| `reducedMotion` | `"skip"` \| `"allow"` | `"skip"` | `skip`: no view transition when the visitor prefers reduced motion. `allow`: your CSS decides. |
| `pending.delay` | `number` (ms) | `200` | Time before `html[data-rivet-pending]` and `useNavigation().shown` turn on. |
| `pending.minDuration` | `number` (ms) | `300` | Minimum time the pending state stays on once shown. |

Also import `@rivetjs/router/transitions.css` in your stylesheet. See [transitions](../guides/routing/transitions.md).

## rivet

`import { rivet } from "@rivetjs/compiler/vite"`. The compiler plugin alone, for apps without file routes. `rivetRouter` includes it.

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `resume` | `RivetResumeOptions` | off | Modules that compile so they can resume. Without it, nothing resumes. |
| `images` | `ImagesConfig` \| `true` | off | Adds the image plugin (needs `sharp`). Then `rivet()` returns an array of plugins. |
| `bridges` | `BridgeEntry[]` | none | Framework bridges (`react()`, `preact()`): React / Preact components as islands. Then `rivet()` returns an array of plugins. See [React and Preact components](../guides/components/framework-components.md). |
| `devtools` | `boolean` | `true` | DevTools on the dev server when installed. Builds never include them. |
| `css` | `RivetCSSOptions` | see below | `css` blocks and `*.module.*` naming. |
| `include` | Vite `FilterPattern` | every `.tsx` / `.jsx` outside `node_modules` | Modules the compiler transforms (globs relative to the root, or RegExps). |
| `exclude` | Vite `FilterPattern` | none | Modules never transformed, for example another framework's files. Wins over `include`. |
| `serverOnly` | `(string \| RegExp)[]` | `[]` | Server-only modules (ids or specifiers). With `rivetRouter` its build check decides; without it, a browser import of one stops the build. |
| `staticIcons` | `boolean` | `true` | Compile `<Icon icon={X} />` (`@rivetjs/kit/icon`, a `lucide` icon, constant props) to its inline `<svg>`. `false` keeps every call. |

### RivetResumeOptions

Since: the first release with the option (and the default it had there when that changed later); next: in the source, not released yet.

| Option | Type | Default | Since | Meaning |
| --- | --- | --- | --- | --- |
| `appModules` | `boolean` | `false` (`rivetRouter`: `true`) | `0.1.0-alpha.0` | Compile every app `.tsx`/`.jsx` module (inside the root, outside `node_modules`) that a resumable module imports in resume mode; `modules` then only seeds the graph. |
| `modules` | `string[]` | required | `0.1.0-alpha.0` | Source files, relative to the root, compiled in resume mode. |
| `dev` | `boolean` | `false` | `0.1.0-alpha.0` | Dev server: client modules compile in resume mode, for a server that renders with `api.devResume.manifest()` (boundary names → dev module URLs). `rivetRouter` sets it. |
| `domData` | `boolean` | `false` | next | The items of a `<For>` over a component's data props (a route's loader rows) are read back from the rows the page shows instead of being sent with the props, when every value the rows show is the item's (strings and numbers as an element's whole text or a plain attribute). On a 1,000-row page the resume data goes from 8.5 KB to 0.3 KB brotli; the first click costs a few milliseconds more at 4× CPU slowdown. See [data from the page](../learn/resuming.md#data-from-the-page). |
| `roots` | `string[]` | none | next | Files, relative to the root, whose default export is the page's root component: its props are sent as data and it starts on its own, like a route page. `rivetRouter` adds its generated app. |

Removed with the single resume model (plan M6): `entry`, `chunks`, `merge`, `cap`, `lazy`, `lazyOwned`, `lazyRows`, `model` and `preload.rules`. Per-component preload strategies (`export const preload`, element `preload="…"`, `<ChunkGroup preload>`) have no effect: not yet on the derived model; tracked in plan M6.

### RivetCSSOptions

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `layer` | `string` \| `false` | `"components"` | Cascade layer of `css` block output. `false`: no layer. |
| `layers` | `string` \| `false` | Tailwind's `theme, base, components, utilities` | Layer order statement at the start of each extracted sheet. `false`: none. |
| `names` | `"readable"` \| `"short"` | `readable` in dev, `short` in builds | `readable`: `<class>_<hash5>`. `short`: `r<hash6>`. |
| `reference` | `string` | none | Root-relative stylesheet `@reference`d by every `css` block (Tailwind `@apply` and theme). |
| `modules` | `boolean` | `true` | Name `*.module.<ext>` classes like `css` blocks. Off when Vite's `css.modules.generateScopedName` is set. |

See [scoped styles](../guides/styling/scoped-styles.md).

### ImagesConfig

| Option | Type | Default |
| --- | --- | --- |
| `layout` | `"fixed"` \| `"constrained"` \| `"full-width"` | `"constrained"` |
| `formats` | `("avif" \| "webp" \| "jpeg" \| "png")[]` | `["avif", "webp"]` |
| `densities` | `number[]` | `[1, 2]` |
| `breakpoints` | `number[]` | `[640, 768, 1024, 1280, 1536, 1920, 2560]` |
| `quality` | per format | `avif 50`, `webp 75`, `jpeg 78`, `png 80` |
| `placeholder` | `"blur"` \| `"dominant-color"` \| `"none"` | `"blur"` |
| `presets` | `Record<string, Directives>` | none; use with `?preset=name&image` |
| `processor` | `ImageProcessor` | sharp |
| `cacheDir` | `string` | `"node_modules/.rivet/images"` |

Per-import directives (`?width=320&layout=fixed&image`): `layout`, `width`, `height`, `formats` (`;`-separated), `quality`, `densities`, `placeholder`, `fit` (`cover` default, `contain`, `inside`), `position` (`center` default), `preset`. See [images](../guides/assets/images.md).

## kit

`import { kit } from "@rivetjs/kit/vite"`. Add it next to `rivetRouter()`; it turns on component head (`head: "components"`) and `?font` imports. Experimental.

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `fonts.display` | `string` | `"swap"` | Default `font-display` of `?font` imports. |

See [kit](../ui/kit.md).

## i18n

`import { i18n } from "@rivetjs/i18n/vite"`. Put it before `rivetRouter()` or `rivet()`.

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `locales` | `string[]` | required | Locale codes. The order is the build's variant order. |
| `defaultLocale` | `string` | required | Must be in `locales`. |
| `catalogs` | `string` \| `(locale) => object` | required | Path with `{locale}` (for example `"locales/{locale}.json"`), or a loader function. |
| `fallback` | `Record<string, string>` | none | Fallback locale per locale. Every chain ends at `defaultLocale`. |
| `missing` | `"error"` \| `"warn"` \| `"fallback"` | `"error"` (`"warn"` in dev) | What happens when a non-default locale lacks a key. |
| `routing.prefix` | `"always"` \| `"as-needed"` \| `"never"` \| `Record<string, string>` | `"as-needed"` | Locale prefix in URLs. |
| `strategy` | `string[]` | `url`, `cookie`, `preferredLanguage`, `baseLocale` | Order used to pick the locale. |
| `cookie` | `{ name?: string; maxAge?: number }` \| `false` | name `"rivet_locale"`, session cookie | Locale cookie. `maxAge` in seconds. `i18nGuard` and `setLocale` write it when a visitor picks a language. `false`: no cookie. |
| `timeZone` | `string` | none | Time zone for date formatting. |
| `baseUrl` | `string` | none | Site origin; needed by `alternates()`. |
| `dts` | `string` | `"src/rivet-i18n.d.ts"` | Generated types file. |

See [translating text](../guides/i18n/translating-text.md) and [locale URLs](../guides/i18n/locale-urls.md).

## prerenderBuild

`import { prerenderBuild } from "@rivetjs/router/static"`. Run after `vite build && vite build --ssr` in `static` mode. Writes the pages into `dist/client`.

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `dist` | `string` | `"dist"` | Build folder with `client/` and `server/`. |
| `origin` | `string` | `"http://localhost"` | Origin of the fake requests; affects absolute URLs in the output. |
| `shell` | `() => string \| Promise<string>` | none | Browser-rendered shell written to `200.html` for routes that cannot be prerendered. Required if such routes exist. |
| `csp` | `false` \| `{ trustedTypes?: boolean \| string[] }` | on | Each page gets a `<meta>` CSP that allows its own inline scripts by hash. `false`: no meta tag. |
| `locales` | `string[]` | none | With i18n: one client build per locale. |
| `dictionary` | `false` \| `{ max?: number }` | on | The site's [compression dictionary](../guides/routing/headers-and-caching.md#compression-dictionaries), built from up to 12 pages per route group and their `_data.json`, at most `max` (131072) bytes, written to `_rivet/dict/`. Only the Node adapter uses it. `false`: none. |

Returns `{ pages: string[], fallback: string[], dictionaries? }`.

## start

`import { start } from "@rivetjs/router/node"`. Serves a production build of a file-routed app. Takes every `serve` option except `handler` and `client`, plus the options below. The [Node deploy guide](../guides/deploy/node.md#options) explains each one.

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `dist` | `string` | `"dist"` | Build folder. |
| `stream` | `{ deadline?: number }` | off | Stream pending `Async` boundaries. `deadline` (ms) hands the rest to the browser. |
| `locales` | `string[]` | none | With i18n: per-locale client builds. |
| `resolveLocale` | `(request) => string \| undefined` (may be async) | none | With i18n: the locale of error pages when the URL has none. |
| `maxBody` | `number` \| `{ default, multipart }` | 1 MiB, multipart 10 MiB | Request body limit for unsafe methods; larger bodies get `413`. |
| `csp` | `false` \| `{ trustedTypes?, directives? }` \| `(nonce) => string` | strict CSP with a nonce | Content-Security-Policy of HTML pages. See [CSP](../guides/security/csp.md). |
| `preload` | `{ lean?: boolean }` or a function of the request | none | `lean: true`: pages whose only client code is framework islands boot from an inline script without the Rivet runtime. See [Preloading](../guides/performance/preloading.md). |
| `routeRules` | `Record<string, RouteRule>` | the build's (`rivetRouter({ routeRules })`) | Headers and page caching per path; replaces the build's rules. |
| `routeCache` | `{ maxBytes?, maxEntries?, origin? }` | 32 MiB, 5,000 pages | Bounds of the route rules' page store. |
| `renderCache` | `RenderCache` | none | Cross-request fragment cache (`createRenderCache()` from `@rivetjs/runtime/server-cache`). |
| `workers` | `number` \| `"auto"` | `1` | Worker processes (`node:cluster`); `"auto"` = one per CPU core. |
| `earlyHints` | `boolean` \| `{ runtime?, links? }` | off | `103 Early Hints` for pages. See [Early hints](../guides/routing/headers-and-caching.md#early-hints). |

## serve

`import { serve } from "@rivetjs/router/node"`. A Node HTTP server around any web-standard handler `(request, { nonce, address }) => Response`.

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `handler` | `Handler` | required | Answers requests that are not files in `client`. |
| `client` | `string` | none | Folder of static files served before the handler. |
| `base` | `string` | none | URL base path (`/app`): `client` files are served under it. |
| `static` | `"index"` \| `"fs"` | `"index"` | `index`: the `client` folder is indexed once at start (files added later are not served). `fs`: look up each request on disk. |
| `immutable` | `(pathname) => boolean` | starts with `<base>/assets/` | Files that get `Cache-Control: immutable`. |
| `port` | `number` | `3000` | Port. |
| `host` | `string` | `"127.0.0.1"` | Host. |
| `compress` | `boolean` \| `{ zstd?: boolean \| number, br?: number, gzip?: number, precompress?: boolean }` | `true` | Compress responses by `Accept-Encoding`: zstd when accepted (level 3; 1 for bodies of 256 KB and more), else Brotli (4), else gzip (6). `{ zstd: n, br: n, gzip: n }`: those levels for dynamic responses (zstd −7 … 22, Brotli 0 … 11, gzip 1 … 9; Brotli 1 / gzip 1 = ASP.NET Core `Fastest`). Immutable `client` files are compressed once at the best quality on their first request and written next to the file (`.zst` / `.br` / `.gz`). `{ zstd: false }`: Brotli / gzip only. `{ precompress: false }`: nothing written to disk. See [Node](../guides/deploy/node.md#what-the-server-does-for-you). |
| `dictionary` | `false` \| `{ samples?: string[], max?: number }` | the `client` build's dictionaries | [Compression dictionaries](../guides/routing/headers-and-caching.md#compression-dictionaries): HTML pages link the dictionary, and browsers that have it get `dcz` answers (zstd with the dictionary). Default: the dictionaries `prerenderBuild` wrote into `client`. `{ samples }`: paths rendered once at start whose shared parts become the site's dictionary (server-rendered apps). `false`: off. Needs `compress`. |
| `earlyHints` | `boolean` | `false` | Send the `103 Early Hints` the handler asks for (HTTP/1.1 clients). |
| `reusePort` | `boolean` | `false` | Bind with `SO_REUSEPORT` so several processes share the port (Linux, FreeBSD; needs a fixed `port`). |
| `origin` | `string` | none | Fixed public origin for request URLs, for servers behind a proxy. |
| `trustProxy` | `boolean` \| `number` \| `(address, hop) => boolean` | `false` | Which proxy hops to trust for `X-Forwarded-For` / `-Proto` / `-Host`. |
| `idleMemory` | `boolean` | `true` | Return heap memory to the OS when the server goes idle after traffic. |
| `grace` | `number` (ms) | `10000` | Time to finish open requests on close. |
| `onError` | `(error, request?) => void` | `console.error` | Unexpected failures. |
| `headers` | `Record<string, string \| null>` | `nosniff` + referrer policy | Extra headers on every response; a name of a default replaces it (any case), `null` removes it. |
| `health` | `false` \| `{ live?: string \| false, ready?: string \| false }` | `/healthz`, `/readyz` | Health paths answered before the app; other paths, `false` for one, `false` for both. |

Returns `{ server, url, close() }`. `closeOnSignals(serving)` closes it on `SIGINT` / `SIGTERM`.
