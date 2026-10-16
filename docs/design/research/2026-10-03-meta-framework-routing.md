# Meta-framework routing: SolidStart 2 vs Qwik 2 router (research notes)

Input for the Rivet app-layer design (file routes, guards, route data). Sources: official docs (mostly Solid 1 / Qwik 1 era), SolidStart 2 + Solid 2 RC + Qwik 2 RC announcements. [S1]/[Q1] = verified for v1 only; [mem] = unverified.

## File routing
- Solid: `src/routes`; `index.tsx`/`(name).tsx`; `[id]`, `[[id]]` optional, `[...rest]`; `(group)/`; layout = `blog.tsx` beside `blog/`; 404 `[...404].tsx`; no error-page convention; `export const route = { preload }`; API routes = files exporting `GET/POST…(event)` (API wins over UI on same path). [S1]
- Qwik: `src/routes/**/index.tsx` pages, `index.ts` endpoints (`onGet`…), md/mdx; `[id]`, `[...rest]` (no optional); `(group)`; `layout.tsx` nesting; named layouts `layout-x.tsx` + `index@x.tsx`; `plugin@*.ts` before root layout; `404.tsx`, `error.tsx` (v2: inside layouts, `useHttpStatus()`, digest to client); exports `head`, `onRequest*`, loaders/actions, `onStaticGenerate`; i18n rewrite routes.

## Route data outside components
- Solid: `query(fn, name)` cached fn, key = name + sorted-args; dedupe; preload reuse 5 s, GC 180 s; per-request server cache; route `preload({params, location, intent})` warms in parallel (no waterfall); `"use server"` → RPC; component reads via `createAsync` (v2: async memo + `<Loading>`); streams via Suspense, `deferStream` when setting headers; seroval `json` default; `revalidate(keys)` / `refresh()`.
- Qwik: `routeLoader$` in layout/index, server-only, after middleware, before render, parallel unless `resolveValue` dependency; `fail(status, data)`; v2: per-loader JSON endpoint (HTTP-cacheable), per-loader `cacheControl`/`eTag`/`expires`/`poll`/`allowStale`/`search`, `blockSSR: false`, AsyncSignal errors, not serialized by default, loaders can't read action state; out-of-order `<Pending>`/`<Catch>` (experimental).

## Guards / middleware
- Solid: one global `createMiddleware({ onRequest, onBeforeResponse })`; `event.locals`; does NOT run on client navigations → guard inside queries/server functions with `getRequestEvent()` + `redirect()`; no per-route middleware; `<HttpStatusCode>`, `<HttpHeader>`.
- Qwik: `onRequest/onGet/onPost…` per layout + page; order plugins → layouts (outer→inner) → index → loaders/actions → render; `await next()` wraps; RequestEvent: redirect/error/status/json/html/send/stream/exit, headers/cookie/parseBody/url/params/query, sharedMap/env/platform/locale/cacheControl; client nav hits server via loader JSON so guards run (v2: full chain); layout middleware skips `server$`.

## Mutations
- Solid: `action(fn)` + `<form action method=post>` works without JS (server fn); `useAction`; `useSubmission(s)`; v2 generator action + `createOptimisticStore`; `redirect/reload/json` with `revalidate`; single-flight mutation (mutation + destination data in one response); manual validation.
- Qwik: `routeAction$`/`globalAction$`; `<Form>` progressive; `a.submit()`; `value/formData/isRunning`; `zod$`/`validator$` → `fieldErrors`; redirect via ev; loaders re-run after action; no optimistic API [mem].

## Head / status / redirects
- Solid: `@solidjs/meta` components scoped to route; headers only before stream starts.
- Qwik: `export const head` (object or fn of loaders), merged page→layouts, layouts can rewrite; no component head; `useHttpStatus()`; `throw ev.redirect()`.

## Navigation
- Solid: `<A>` (moving to native `<a>` interception), `explicitLinks`, `base`, `useBeforeLeave`, hover → `preload(intent: "preload")`, scroll top; data on nav = client queries / RPC.
- Qwik: `<Link>`, `useNavigate`, `useLocation` (`isNavigating`); scroll restoration; v2 `prefetchBundles` (viewport) / `prefetchData` (hover); data on nav = per-loader JSON.

## Adapters
- Solid: Nitro presets (node, vercel, netlify, cloudflare, aws, deno, static); SPA `ssr: false`; SSG `prerender: { routes, crawlLinks }` (dynamic params by crawl or list only).
- Qwik: adapters per platform (static, node/express/fastify, cloudflare, vercel, netlify, deno, bun…), each with own entry; SSG via `onStaticGenerate` → params; mix SSR/SSG per route; sitemap; v2 static loader JSON; no SPA mode [mem].

## Other concerns
- Env split: Solid `VITE_*` public / `process.env` server; Qwik `PUBLIC_*` / `ev.env.get()`.
- Server-only guard: `"use server"`; Qwik v2 build error on client import of `*.server.ts` / `server/`.
- RPC: `"use server"` (seroval, `getRequestEvent`); `server$` (RequestEvent, streaming generators, AbortSignal).
- Sessions: Solid `useSession` encrypted cookie; Qwik cookies only.
- CSRF: Qwik origin check on actions [mem]; Solid undocumented.
- Error boundaries: Solid manual; Qwik `error.tsx` / `<Catch>`.
- Cache/ISR: Solid manual + Nitro route rules [mem]; Qwik `cacheControl()`, per-loader eTag.
- Typed routes/links: Solid Router 2 "fully typed"; Qwik none [mem].
- i18n: Qwik rewrites + `locale()`; base path / trailing slash policy.

## Gaps Rivet can fill
- Guards per route/layout that run on initial request, client navigation and RPC alike (Solid middleware skips client nav; Qwik layout middleware skips `server$`).
- Optional params (Qwik lacks), typed links/params.
- Validation + optimistic updates in one action API.
- Per-loader cacheable data endpoints (Qwik v2) + single-flight mutation responses (Solid).
- First-class SSG param enumeration (`entries()`), not crawl-only.
