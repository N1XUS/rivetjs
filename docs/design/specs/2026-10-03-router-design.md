# Router: file routes, data, adapters (design)

Input: [meta-framework research](../research/2026-10-03-meta-framework-routing.md). Package `@rivetjs/router` (`libs/router`; route primitives stay in `@rivetjs/runtime/router`). Builds on `@rivetjs/runtime` router (`compileRoutes`, `defineRoute`, `Router`), resume (`renderResumable`, `createResume`) and `@rivetjs/compiler/vite`.

## Package layout (split by where code runs)
- `shared/` — wire contract + control flow (errors, `DATA_PARAM`, `Head`, `RouteData`); no platform APIs.
- `client/` — browser runtime: route data fetch, link interception, prefetch, scroll/focus (`@rivetjs/router/client`).
- `server/` — web-standard handler + page rendering (`@rivetjs/router/server`); no Node APIs.
- `adapters/` — `node` (`@rivetjs/router/node`), `static`, `csr`; Node APIs allowed.
- `build/` — route scanner, codegen, Vite plugin (`@rivetjs/router/routes`, `/vite`).
- Root `@rivetjs/router`: route-module API (errors, types). Rule: `client/` imports only `shared/` + runtime; enforced by a graph test.

## Goals
- File-based routes; layouts; 404/error pages.
- Guards + data loading outside components; guards run on first request, client navigation and actions alike (Solid middleware skips client nav, Qwik layout middleware skips `server$`).
- One web-standard handler `(Request) => Promise<Response>`; adapters wrap it: `node`, `static` (prerendered resumable + CSR fallback), `csr` (SPA via `mount`).
- Zero cost for pages that don't use a feature: no app runtime in pages without client navigation; loader data travels in resume state (no second fetch on load).

## Route files (`src/routes/`)
- `index.tsx` → `/`; `about.tsx` → `/about`; `blog/index.tsx` → `/blog`.
- `[id]` param; `[[lang]]` optional (expands to two patterns, longer first); `[...rest]` splat (terminal); `(group)/` path-less folder.
- `_layout.tsx` wraps every route below it (nesting outer → inner); `_404.tsx` (nearest wins), `_error.tsx` (nearest wins).
  - Every `_layout` stays mounted while client navigation stays below it (state survives); layout data lives in resume-serialized signals updated per navigation; data requests skip kept layouts' loaders (G12, [routing: nested layouts](../../guides/routing.md#file-routes-nested-layouts)).
  - Layout props are accessors (`LayoutProps`: `data()`, `params()`, `url()`, `children`); page props are values (`PageProps`).
  - Unmatched URLs: `_404` of the longest static folder prefix (groups add no segment, param folders skipped), else root. Failed loads: matched route's nearest `_404` (status 404) / `_error`. Error pages render inside the layouts whose guards passed and loaders succeeded (unmatched: root layout), with those layouts' `head` merged under the error title (current behaviour, R18N 2026-10-27).
- Ignored: files/folders starting with `_` other than the above, `*.test.*`, `*.d.ts`.
- Conflicts (two files → same pattern) and invalid names are build errors with both paths.
- Ordering: static segments before params before optional before splat; ties by depth → deterministic, independent of file system order.

## Route modules
- `x.tsx` (universal, client + server): `default` component `(props: { data, params, url, children? })`; optional `head` — object or `({ data, params, url }) => Head` (`title`, `meta[]`, `links[]`), merged layout → page (inner wins per key: title; meta by name/property; links by rel+href, one canonical).
- `x.server.ts` (server only; client import = build error): 
  - `guard(event)` — `void` to continue; `return`/`throw` `redirect(to, status=302)`, `deny(status=403)`, `notFound()`.
  - `load(event)` — data for the component; may `throw notFound()` / `redirect()` / `error(status, message)`; runs after all guards pass; layouts + page loaders run in parallel.
  - `entries()` — param sets for prerender (static adapter).
  - `prerender: boolean` (default: true when the route is static or has `entries`).
  - `actions: { [name]: (event) => result }` — `POST` with `?/name` (progressive `<form method=post action="?/name">`); after an action, loaders re-run; result exposed to the page as `action`.
  - `headers(event) => HeadersInit` (cache policy per route).
- `event`: `{ request, url, params, locals, signal, cookies: { get, set, delete }, setHeader, platform }`; `locals` shared along the chain (guard → loaders → actions).
- Types: generated `.rivet/routes.d.ts` maps route ids to `params` / `data` (typed `href()` + page props).

## Request flow (handler)
1. Static asset? → adapter (not handler).
2. Match URL against the route table (`compileRoutes`); none → nearest `_404` (status 404).
3. `POST ?/action` → origin check (CSRF: `Origin` must equal host) → guards → action → re-run loaders → render (or `redirect`); JSON `Accept` returns the action result (`application/json`).
4. Guards outer → inner (layout guards, then page guard), sequential; first non-void result ends the chain.
5. Loaders in parallel; each `AbortSignal` follows the request.
6. Render: `renderResumable(() => <Layouts><Page data/></Layouts>)` into a `ReadableStream` (backpressure via `desiredSize`); head merged into the document shell; `stream` option enables out-of-order Async.
7. Errors: thrown `HttpError` → status + nearest `_error`; unknown errors → 500, message hidden in production as `Internal Server Error (digest <id>)` with the same id passed to `onError(error, request, { digest })` (default: `console.error`), shown in dev.
- Data endpoint: `GET <path>?_rivet=data` (header `x-rivet-data: 1`) runs steps 2,4,5 and returns `{ data: [layout…, page], status }`, `{ redirect }` or `{ error }` encoded with the resume table (Date/Map/Set/BigInt survive). Client navigation uses it, so guards always run server-side. `Cache-Control` from route `headers()`; default `private, no-store`.

## Client navigation
- Route table on the client: same patterns; per route `module: () => import("x.tsx")` (one chunk per route via the resume `route` chunk strategy) and `load` = fetch the data endpoint (with the router's `AbortSignal`).
- Redirect results navigate (replace); error results render `_error`.
- Link interception: delegated `click` on same-origin `<a>` without `target`/`download`/modifier keys/`rel=external`; `data-rivet-reload` opts out. Prefetch of data and the matched page chunk on `pointerover`/`focusin` (intent; data reused for 5 s). Page chunks never load at idle: `lazyComponent(…, { warm: false })` and resume `lazy: "intent"` (the App chunk loads eagerly for click interception and would otherwise pull every page).
- Scroll: top on push; restore on back/forward; `#hash` scrolls to target. Focus moves to `<main>`/h1 for a11y; `document.title` from head.
- No client navigation runtime on pages without links to other routes.

## Adapters
- `@rivetjs/router/node` (`adapters/node.ts`): `serve({ handler, client, port, host })` — immutable `Cache-Control` for hashed assets (`/assets/*`), `no-cache` + ETag for others; brotli/gzip by `Accept-Encoding` (threshold 1 KiB, skip already-compressed types); streams web `Response` bodies with backpressure; `HEAD`; `/healthz` (200) and `/readyz`; graceful `SIGTERM` (stop accepting, drain ≤ 10 s); request timeout; error page on handler throw; no `X-Powered-By`; security headers (`X-Content-Type-Options`, `Referrer-Policy`); a fresh nonce per request passed to the handler.
- CSP: `createApp` sets `strictCSP(nonce)` on HTML pages — `script-src 'nonce-…' 'strict-dynamic'; object-src 'none'; base-uri 'none'` (inline loader/stream scripts carry the nonce; resume chunks, lazy routes and `import()`s load through them); `csp: (nonce) => policy` customizes, `false` disables, a route `headers()` CSP wins. Data responses carry none. Verified in Chromium: zero violations through resume, navigation, prefetch, client-only and idle imports. Static prerender has no per-request nonce: each page gets `<meta http-equiv="Content-Security-Policy">` with `script-src 'sha256-…' 'self'; object-src 'none'; base-uri 'none'` (`hashCSP`; `prerender({ csp: false })` opts out). `'strict-dynamic'` is not used there: browsers pass a nonce's trust on to `import()`, not a hash's. Trusted Types: opt-in `strictCSP(nonce, { trustedTypes: true })` / `prerender({ csp: { trustedTypes: true } })` append `require-trusted-types-for 'script'; trusted-types rivet` (array adds app policy names); the runtime's one HTML sink (template parse) goes through policy `rivet` when `trustedTypes` exists. Verified in Chromium: resume, navigation, client-rendered routes, zero violations; plain-string sinks throw.
- `@rivetjs/router/static`: `prerender({ handler, routes, outDir })` — renders every prerenderable route (static paths + `entries()`), writes `<path>/index.html` and `<path>/_data.json` (client navigation without a server); non-prerenderable routes without `.server.ts` → CSR fallback `200.html` (shell + client router renders them); non-prerenderable routes with server modules → build error naming the route.
- `@rivetjs/router/csr`: SPA — `index.html` shell + `mount(App)` with the DOM router; routes with `.server.ts` are a build error (no server).

## Build + dev (`@rivetjs/router/vite`)
- `rivetRouter({ routes = "src/routes", outDir = ".rivet", document = "src/document.ts", styles, mode = "server" | "static" | "csr", resume })` returns `[router, rivet compiler]`.
- Codegen writes real files (compiled like app code, resume mode for server/static): `.rivet/app.tsx` (universal App + client routes), `routes.ts` (server table, lazy `.server.ts`), `entry.server.tsx` (page factory; re-exports `routes`, `universal`, `document`, `createApp` so the server bundle has one runtime instance), `entry.dev.tsx` (dev client mount), `routes.d.ts`; CSR: `app.tsx`, `entry.client.tsx`, `routes.d.ts`. Unchanged files are not rewritten; add/remove under routes → regenerate + full reload.
- `vite build` → `dist/client` (manifest, resume chunks; input = `styles`, CSR: client entry + `index.html` from the document shell); `vite build --ssr` → `dist/server/entry.server.js`.
- Dev: `appType: "custom"`; middleware after Vite's runs the same handler via `ssrLoadModule` (no resumability in dev). CSR dev serves the shell through `transformIndexHtml`.
  - Pages render inside `<div data-rivet-dev style="display:contents">` with the route data embedded (`#rivet-dev-data`, the data endpoint's encoding) and two nonce'd module scripts: `/@vite/client` and `.rivet/entry.dev.tsx`.
  - `entry.dev.tsx` imports the matched page module, then client-renders the App over the server HTML with the embedded data as `ServerData` (used once in the browser; navigations fetch).
  - HMR: component modules self-accept (compiler plugin, `@rivetjs/runtime/hot`): edited routes, layouts, components re-render in place, state kept — own signals by creation order (reset when the count changes, or `@refresh reset`), children's by position, ranges passed via props (layout `children`) survive. Dev client compiles route modules without resume mode (dev pages never resume). A changed non-component export (`head`, constants) invalidates → importer updates (generated `app.tsx` hot-replaces in place, state kept); updates `app.tsx` cannot take reach `entry.dev.tsx`, which re-mounts the app (fresh data, state resets, no reload); `.server.ts` edits apply on the next request (Vite's SSR graph). CSR `entry.client.tsx` re-mounts the same way.
- Browser graphs importing `*.server.*` fail the build (`resolveId` guard).
- Production: `start({ dist })` (node) loads the build (resume manifest, entry CSS from the Vite manifest); `prerenderBuild({ dist })` (static) writes pages into `dist/client`.
- Data source per mode, compiled into the App: `server` → data endpoint; `static` → `_data.json`; `csr` → none (pages get no loader data; `.server.ts` is a codegen error).

## Testing
- Route scanner: table-driven (names → patterns, ordering, conflicts, ignore rules).
- Handler: guards order/short-circuit, parallel loaders, redirect/deny/notFound/error statuses, data endpoint encoding, actions + CSRF, abort.
- Node adapter: compression negotiation, caching headers, streaming backpressure, health, shutdown.
- Static: prerender output tree, `_data.json`, fallback, error for non-prerenderable server routes.
- Browser (Chromium): navigation via data endpoint, guard redirect during client nav, back/forward scroll, prefetch on intent.
- Playground migrated to file routes + node adapter + Dockerfile; `docker run` serves resumable pages.

## Out of scope (later)
- Sessions/encrypted cookies, i18n rewrites, middleware plugins, ISR.
