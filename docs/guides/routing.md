# Routing

Rivet's experimental router matches flat path patterns once, then renders each location through the existing owned Async boundary. Navigation cancels old loads and disposes replaced output. Loaders receive explicit cancellation and captured context; no context remains globally active across an await.

```tsx
import { Router, defineRoute } from '@rivetjs/runtime/dom';

export function App({ router, services }) {
const routes = [defineRoute('/items/:id', {
  load: (work, match) =>
    services.item(match.params.id, { signal: work.signal }),
  render: item => <article><h1>{item.title}</h1></article>,
})];

  return <Router router={router} routes={routes}
    fallback={() => <p>Loading…</p>}
    notFound={() => <h1>Page not found</h1>}/>;
}
```

The service implementation is an application choice. Supply server services from the server entry and browser services from the browser entry; importing an arbitrary server module into shared JSX does not make it browser-safe. Shared target-helper imports are rewritten by server compilation.

Create the browser controller inside owned setup, normally the mount factory:

```tsx
import { mount } from '@rivetjs/runtime/dom';
import { createRouter } from '@rivetjs/runtime/router/dom';

mount(() => {
  const router = createRouter();
  // router.navigate('/items/42'); push history
  // router.navigate('/items/42', { replace: true }); replace history
  return <App router={router} services={browserServices}/>;
}, document.querySelector('#app'));
```

The browser controller observes back/forward `popstate`, accepts same-origin HTTP(S) navigation, and removes its listener during owner disposal. Location reads return fresh URL snapshots. External `history.pushState` calls are not observed; use `router.navigate`. Explicit controller disposal removes history observation and prevents later reads/navigation; mounted output remains owned by its mount.

The server controller snapshots an absolute request URL:

```tsx
import { renderToString } from '@rivetjs/runtime/server';
import { createRouter } from '@rivetjs/runtime/router/server';

const html = await renderToString(() =>
  <App router={createRouter(requestURL)} services={serverServices}/>);
```

Build this entry for the server target. Each request creates fresh ownership and a URL snapshot. HTTP status codes and redirects remain the HTTP adapter's responsibility. Server loaders finish in output order; browser fallback is not streamed as a server patch.

Supported patterns are case-sensitive static paths, `:name` segments and terminal `*name` splats. Declaration order determines the first match. One trailing slash is optional. Parameters decode once; encoded slashes stay inside their original parameter segment. Malformed path escapes produce no match. Query and hash are retained in the match URL; a path or query change invalidates browser route work, a hash-only change does not (no reload, no remount; `location()` readers still see the new hash). This low-level `Router` has no link interception or layouts of its own; file routes (below) generate the router, layouts, link interception and data loading.

## File routes: links, transitions, pending UI

Design: [route transitions spec](../design/specs/2026-10-03-route-transitions-design.md) (implementation notes at the end).

- Every navigation commits once: route data and page chunk load together, then the page renders synchronously; the previous page stays mounted and interactive until then. A resumed page keeps its server view on the first navigation.
- Link interception (generated App: `interceptClick(event, router, modules)`, intent `routableAnchor(event, modules)`): same-origin http(s) in-base links, no `download` / `data-rivet-reload` / foreign `target` / `rel=external`, plain primary click — and the path matches a page route of the client's table (`modules`: `PATHS` order, same matcher as navigation; endpoint rows `_endpoint` spliced in where the server matches an endpoint before a later dynamic page pattern that fits it). Anything else is a document load: endpoints, `public/` files, other apps on the origin, unmatched paths (the server answers: 404 page, endpoint response) — no data request, no chunk prefetch on intent. Catch-all page routes make every in-base path routable. Data-endpoint `{ redirect }` to an in-base URL no page matches → `location.assign` (after the first link check registered the table). `navigate()` / back-forward to an unmatched URL still render the client `_404`. `reload` / `data-rivet-reload` forces a document for page routes. Cold click on a resumed page: the loader holds every `a[href^='/']` click, boots the router, replays; an unmatched link then follows natively (chunk-load delay, as for `reload` links).
- `<Link>` (`@rivetjs/router/client` or `@rivetjs/router/link`) renders a plain `<a href>` (no JS until interaction); `to` is typed by the generated `.rivet/routes.d.ts` (`RoutePath`, `LinkHref` from `@rivetjs/router`).
  - Other `<a>` attributes and handlers pass through (`style`, `data-*`, `download`, `onClick`, `ref`…); router attributes (`href`, `data-rivet-*`, `data-transition`) win.
  - `active` (`true` / `"exact"`): `aria-current="page"` + `data-current` while the page is the link's path (one trailing slash ignored). `"prefix"`: also below it (`aria-current="true"`). Server render uses the request URL; after each client navigation the App re-marks `a[data-rivet-active]` (generated only when a `<Link … active>` is detected, `activeLinks`). An explicit `aria-current` wins (no auto marking).
- Per-route props from the same file: `PageProps<"items/[id]">` (params from the path, data from `serverLoad`), `LayoutProps<"items/_layout">`, `actionResult<"items/[id]">()`; details in [server-code.md](server-code.md#types).

```tsx
import { Link } from "@rivetjs/router/client";
<Link to={`/items/${item.id}`} transition="zoom" pending="opacity-60">…</Link>
<Link to="/settings" transition={false} prefetch="none" replace>Settings</Link>
<Link to="/docs" active="prefix" class="nav" data-section="docs">Docs</Link>
```

- Enable transitions: `rivetRouter({ transitions: true })` or `{ viewTransitions, reducedMotion: "skip" | "allow", pending: { delay: 200, minDuration: 300 } }`; add `@import "@rivetjs/router/transitions.css";` (Tailwind variants: `@rivetjs/router/tailwind.css` → `nav-pending:`, `link-pending:`, `nav-back:`, `nav-forward:`).
  - Same-document View Transition per navigation (instant swap when unsupported, reduced motion, link `none`, route `export const transition = false`).
  - Types: `push | replace | back | forward` + link `data-transition` (wins) or route `export const transition = { types }`; mirrored on `html[data-rivet-transition]` for CSS.
  - Shared elements: `data-vt-name="item-42"` on both pages (named only when present once on each side, only during the transition); `data-vt-class` groups them.
  - Pending: `aria-busy` on `[data-rivet-routes]` and `data-rivet-pending` on the clicked link at once; `html[data-rivet-pending]` after the delay; `useNavigation()` (`@rivetjs/router/client`) → `{ state, location, from, type, shown }`, also in resumed layouts.
  - Events on `document`: `rivet:navigate` (cancelable), `rivet:before-swap` (`detail.defer(promise)`, ≤ 500 ms), `rivet:after-swap`, `rivet:navigated`; `onNavigate(fn)` (any app).
- No inline styles: transition names are set through CSSOM, so strict `style-src` and Trusted Types policies hold.
- Accessibility and history (any file-routed app):
  - Route announcer: after each client navigation commits (not the initial load) one visually hidden `aria-live="assertive"` `aria-atomic="true"` region (created on the first navigation, styled through CSSOM) gets `document.title`, else the first `h1`, else the pathname; cleared then set, so a repeated title is announced again. Opt out: `rivetRouter({ announce: false })` (or `swapRouteQuiet` for hand-written apps).
  - Focus after a route commit: the `#hash` target, else the first `h1`, else `<main>` (`tabindex="-1"` added when needed); back/forward restore scroll and leave focus alone.
  - Scroll: `history.scrollRestoration = "manual"` from the first client navigation (back to `auto` on `pagehide`, so reloads and cross-document traversals restore natively). The shown entry's position is saved before every navigation (link, back/forward, programmatic) and restored on back/forward; new routes start at the top or at their `#hash` target.
  - Hash-only navigation (same path and query; link click, same-URL `#hash` link or back/forward): scrolls to and focuses the target (no fragment: top) without rerunning loaders or remounting the page.
  - Resumed pages (RESUME-PINS 2026-10-12): a link's own resumed handler runs from the resume loader's document capture listener; one that stops propagation (cdk / ui `Link` press) hid the click from the router's bubbling `click` listener, so the browser followed it natively (same-page `#hash`: no target focus; `href="#"` scrolled to the top). The generated App also registers a capture `click` listener (resume builds only, attached after the loader's) that takes exactly the clicks whose propagation was already stopped (`event.cancelBubble`) — a client render's delegated dispatch never hides them from the router.
  - `history.state`: router keys (`i`, `rivet`) merge into the entry's state; app keys (`history.replaceState({ ...history.state, mine: 1 }, "")`) survive navigation and back/forward.

## File routes: document prefetch

Recipe: [instant page transitions](../../apps/docs/content/recipes/instant-page-transitions.md). Module `@rivetjs/router/prefetch` (`shared/prefetch.ts`).

- Scope: navigations that load a document — in client-routed apps (more than one route: the client router intercepts page links and keeps its own data + chunk intent prefetch): `reload` / `rel=external` links and links whose path matches no route (page or endpoint: endpoint links load documents but are never prefetched, a prefetch would run the handler); every link in single-route apps. Server / static modes; ignored in `csr`.
- Route paths (routed apps): codegen `routePathRegExp(patterns)` (`build/codegen.ts`) → one RegExp source over `pathname.slice(1)` matching every route pattern incl. base (trie: shared prefixes factored, `:param` → `[^\/]+`, splat → `(?:\/.*)?`, optional trailing slash, static text as `URL.pathname` serializes it, `u`/`v`-mode and URLPattern-regexp-group safe; root catch-all → `.*`; only `/` → `""`). Passed as `documentPrefetch(shell, { routed, routes })`. Rules: `and` gets `{ or: [{ selector_matches: "[data-rivet-reload],[rel~=external]" }, { not: { href_matches: "/(<routes>)" } }] }` (Chromium accepts URLPattern regexp groups; `v`-mode class syntax: `\/` inside `[...]`); selector drops the reload filter. Fallback gets `/^\/(?:<routes>)$/` as a RegExp literal (`documentPrefetch` refuses sources with `<`, line terminators or an unescaped `/`) and skips a link whose `pathname` matches unless it is a reload / external link. Cost per page: the source twice (fixture a/b/c/index: 23 chars).
- API: `<Link prefetch="document" | "prerender">` → `data-rivet-prefetch="document|prerender"` (plain `<a>` the same); `prefetch="none"` opts out; `"intent"` / unset = no attribute (SSR unchanged). Eagerness: `rivetRouter({ prefetchEagerness: "conservative" | "moderate" | "eager" })` (default `moderate`; codegen passes it only when not `moderate`, so the default entry is unchanged; fallback timing unaffected). `rivetRouter({ prefetchPaths: false })`: no `routes` RegExp in the document call → client-routed apps prefetch only reload / external links (docs sites; −7.7 KB raw per page). App: `rivetRouter({ prefetch })` — `"document"` / `"prerender"` = default for every unmarked same-origin link (selector `a:not([data-rivet-prefetch])`, plain `<a>` too), `true` = marked links only, `false` = off, unset = detected (`routerUsage`: `prefetch="document|prerender"` / `data-rivet-prefetch=…` in a file importing `@rivetjs/router`).
- Server: generated `entry.server.tsx` wraps the document shell (`documentPrefetch(shell, { default?, routed?, routes?, eagerness? })`) → before `</head>`: `<script type="speculationrules">` (document rules: `href_matches "/*"`, not the page's own path in either trailing-slash form (URLPattern-escaped + `{/}?`), `selector_matches`, `eagerness` (default `"moderate"`); `prefetch` + `prerender` lists) + one inline classic fallback script (~1.4 kB, `shared/prefetch-fallback.min.ts`). Both carry the response nonce; static `hashCSP` hashes `speculationrules` scripts too. Unused ⇒ entry/app/link output byte-identical.
- Why document rules, not a URL registry: the browser re-evaluates selectors on DOM changes (links added by client renders), dedupes, applies its own limits and intent timing; no JS on Chromium.
- Fallback (no `HTMLScriptElement.supports("speculationrules")`): delegated capture listeners — `pointerover` + 65 ms (cancelled on `pointerout` leaving the link), `focusin` / `touchstart` / `pointerdown` at once → `<link rel=prefetch as=document>`, else `fetch(href, { priority: "low" })`. Cacheability probe: the first prefetch of a tab session is `fetch(href, { cache: "no-store", priority: "low" })` (no-store: no HTTP cache lock holding an early click); `cache-control` + `pragma` with `no-store` / `no-cache` / `max-age=0` without `stale-while-revalidate` → off (`sessionStorage["rivet:prefetch"] = "0"`, no more prefetches this tab session), else `"1"` + warm the probed URL (2 requests for it, once per session). No header = cacheable. Probe network error → unknown, retried on the next intent. Skips other origins, non-http(s), current URL, Save-Data / 2g, `download`, `target` ≠ `_self`, links the client router takes (routed apps: `routes` matches the path, no reload / external mark); once per URL (bounded set, 100). No imports; never starts the Rivet runtime (works on resumed pages as served). Only cacheable HTML (`max-age` > 0) is reused by the click (hence the probe).
- Prerender: router `onNavigate` / `rivet:navigate` fire for client navigations only, never in a hidden prerendered page. App side effects on load: `whenActivated(fn)` (runs now, or on `prerenderingchange` while `document.prerendering`).
- Measured (fixture-prefetch static build, HTML 100 ms away, pointer down → next page FCP, p50): no prefetch 115 ms; Speculation Rules after 300 ms / 1 s dwell 14 / 16 ms (100 ms dwell: 116, Chrome starts at ~200 ms); fallback (Chromium, rules stripped) with `max-age=60` 15 / 17 ms, 100 ms dwell 118 on the session's first link (probe in flight) / 79 once the verdict is stored (`fetch()` path: 16 / 15, 119 / 79); with `no-cache` = no prefetch (100 / 300 ms dwell 116 / 116; before the probe 183 / 127: the in-flight prefetch held the navigation). Firefox (`rel=prefetch`) `max-age=60` 16 / 26 ms, `no-cache` no change. WebKit 26.6 reports speculation rules support but prefetched nothing (no change).

## File routes: programmatic navigation, params, search params

All from `@rivetjs/router/client`; work in CSR, dev and resumed pages without a router reference.

- `navigate(to, { replace?, state?, scroll?, focus?, transition? }): Promise<void>` — like a link click: `beforeLeave` guards, `rivet:navigate` (cancelable; `detail.trigger === "api"`), transitions / pending, announcer, focus, scroll save of the left entry.
  - `to`: `LinkHref` (typed), any string or `URL`, resolved against the page. Non-HTTP(S) → rejects (`TypeError`). Other origin → `location.assign` (`replace` → `location.replace`); the promise never settles.
  - Resolves when the new page committed; immediately when canceled, for the current URL (only merges `state`) and for hash-only changes (scroll to target, no route work).
  - `state`: app keys merged into the new entry's `history.state` (router keys `i`, `rivet` added). `scroll: false` keeps the position; `focus: false` leaves focus alone; `transition`: types or `false` (as `<Link transition>`).
  - Delivery: a `rivet:go` document event served by the generated `App` (only in apps detected as using the navigation API — see [pay-per-use features](#file-routes-pay-per-use-features); the routes element then carries `data-rivet-go`). Resumed page before the runtime/App chunk is in: boots the runtime and asks again when the resume runtime has attached its pending listeners (`rivet:attach` document event) — no polling; one 10 s fallback timer, then `location.assign`. Not answered synchronously and no `[data-rivet-go]` or no resume loader → `location.assign` at once (undetected callers degrade to a document load, no delay).
- `invalidate(fresh?): Promise<void>` (alias `revalidate`) — rerun the current page's loaders (same URL), re-render in one commit (live pages: `data()` updates in place, no re-render — [live pages](#file-routes-live-pages)): no history entry, transition, scroll or focus move (the focused control keeps focus by id); clears the prefetch cache. `fresh = { data, head?, deps? }` skips the request (see [revalidation](#file-routes-revalidation)). Without a client router: `location.reload()`. Runtime: `router.navigate(href, { revalidate: true })`.
- `invalidate(key | keys | predicate)` — rerun only the loaders that called `event.depends()` with a matching key (see [revalidation by key](#file-routes-revalidation-by-key)).
- Intent-prefetch cache (route data warmed on hover/focus, 5 s): cleared on every form `submit` (capture listener, installed with the first prefetch), by every `invalidate(…)` call, and by `@rivetjs/forms` after each enhanced POST answer. Other mutation code: call `invalidate()` / `invalidate(key)` (public; `_clearPrefetch()` stays internal). Only URLs matching a page route prefetch (unmatched links: no data request, no 404). At most 32 warmed requests (expired ones swept, the oldest aborted past the cap); a navigation aborts warmed requests for other URLs; a warmed answer is reused only for the same keep list (`_rivet_keep`).
- Data responses that are not JSON (by `content-type`: a proxy error page, an HTML fallback) load the document instead; malformed JSON is a route failure (error view, dev overlay).
- After a client navigation, focus waits for a page `h1` only while the document keeps changing (a frame without DOM mutations settles; at most 30 frames), then falls back to `<main>`.
- `useParams<"items/[id]">(): () => params` — call at component setup. Pages: their route's params (the page re-renders per navigation, so the signal is per page and resumes with its value). Nested layouts (persisted, see below): the current route's params, updated in place like their `params` prop. Root layout (outside the routes): `{}`, like its `params` prop.
- `useSearchParams(): () => URLSearchParams` — call at component setup; updated when a navigation commits (a fresh object per change; treat as read-only). Root layout included; resumed bindings revive to the browser signal (identified context `rivet:search`: the server entry provides the request's, the generated resume entry the browser's).
  - Ships only when used ([pay-per-use features](#file-routes-pay-per-use-features)): unused → no server provider, no `@rivetjs/router/search` module in the client build, no generated `entry.resume.ts` without transitions (compiler's default resume entry).
  - Custom `resume.entry`: add `[SearchParams, searchParams]` from `@rivetjs/router/search` yourself.
- `setSearchParams(update, options?)` — `update`: `URLSearchParams | Record<string, string> | (copy of current) => next | void`; navigates to the same path with the new query (hash dropped), defaults `scroll: false, focus: false`. Shallow only in the URL sense: like any search change, the route reruns its loaders and re-renders the page (root layout state stays).
- `@rivetjs/forms` follows action redirects like `navigate()` and revalidates like `invalidate()`, without importing `@rivetjs/router/client`: it reaches the booted router through `Symbol.for("rivet.router")` (`clear` = drop warmed data, `go` = queue a navigation / invalidation; installed by the generated App handlers of apps using forms — `@rivetjs/forms` or `@rivetjs/ui` `Form` detected — and announced once with `rivet:router`). Before the App serves, forms asks it once (`rivet:go`), on a resumed page boots the runtime and asks again when it attaches its listeners (`rivet:attach`), waiting at most 10 s; no router / timeout: a document load / reload. `navigate()` waits the same way (no polling). So forms chunks share no router code with the App chunk.

## File routes: pay-per-use features

Generated code provides some router features only when the app uses them (`routerUsage(root)` in `@rivetjs/router/vite`, run when the plugin configures):

| Feature | Detected by (in a file importing `@rivetjs/router`) | Generated when used |
| --- | --- | --- |
| `searchParams` | `useSearchParams` / `SearchParams` | server `SearchParams` provider, resume-entry context, `@rivetjs/router/search` chunk |
| `navigate` | `navigate` / `invalidate` / `revalidate` / `setSearchParams`; any `@rivetjs/forms` import | App `rivet:go` listener (+ its resume state), `data-rivet-go` marker, serving code (navigate.ts `perform`) |
| `forms` | any `@rivetjs/forms` text, or `Form` in a file importing `@rivetjs/ui` (anywhere in the scanned sources; implies `navigate`) | `_brand` / `_go` imports + `_brand(_go)` first in the App's click / popstate / `rivet:go` / intent handlers: installs the `Symbol.for("rivet.router")` brand forms reach the router through (apps without forms carry neither) |
| `params` | `useParams` | `RouteParamsContext` provider around pages and persisted layouts |
| `activeLinks` | `<Link` … ` active` (an `active` attribute on a `Link` tag) | App `onNavigate(() => _markActive)` effect (re-marks active links after each commit) |

- Scanned: every `.[cm]?[jt]sx?` source under the Vite root (not `node_modules`, dot dirs, build output: `dist`, `dist-*` / `dist.*` / `dist_*` dirs, Vite `build.outDir`, `.rivet`; files vanishing mid-scan — a concurrent build — are skipped) + linked dependencies of `root/package.json` (symlinks: workspaces, `npm link`; found in `node_modules` up the tree), except `@rivetjs/*`.
- Not scanned: published dependencies. Text match, not an import graph: a name in a router-importing file counts (false positives only cost bytes).
- Overrides: `rivetRouter({ searchParams, navigate, forms, params, activeLinks })` (`true` / `false`) win over detection — e.g. `forms: true` when forms come only from a published dependency (not scanned).
- Missed feature: `useSearchParams()` / `useParams()` see the context default (browser search / `{}`; server render: empty); `navigate()` / `invalidate()` load the document (`location.assign` / `replace`) at once.
- Dev: a source added or edited to use a feature turns it on (regenerate `.rivet/`, full reload); never turned off until restart.
- Single-route apps: exactly one page route with a static pattern (server/static mode), no nested layouts and none of `navigate` / `searchParams` / `activeLinks` → no client router events (click interception, intent prefetch, popstate); links load the document; eager client JS is only what the page itself needs (0 B for a static page).
- `clientRouter` (`rivetRouter`, default `false` in static mode, `true` in server mode): off, the App's router listeners are `standalone: false` and the routes region's location-only binding does not count either, so a page with nothing else to resume ships zero JS (no loader / state / modulepreloads) and its links load documents; interactive pages keep in-place navigation. Static prerender writes `_data.json` only when some page resumes (or a CSR shell exists) and `prerenderBuild` prunes unreferenced scripts on all-zero-JS sites (Astro `<ClientRouter />` model).

## File routes: nested layouts

Every layout stays mounted while client navigation stays below it (Next/SvelteKit/Nuxt behavior); the root `_layout` as before.

- `/shop/a` → `/shop/b` under `routes/shop/_layout.tsx`: the layout's DOM and state (signals, typed input values, resumed bindings) survive; only the page re-renders. Navigating outside `/shop` disposes it; coming back mounts a fresh instance. CSR apps, dev mounts and resumed pages alike; a resumed page's first navigation keeps the server-rendered layout (no remount, no layout code runs).
- Layout props stay accessors (`data()`, `params()`, `url()`), now App-level signals updated in place when the layout's loader reruns or the URL changes (also in resumed layouts). Params change (`/u/1/x` → `/u/2/x` under `routes/u/[id]/_layout.tsx`): same instance, accessors update, its loader reruns — key on `params()` inside the layout if state must reset per param.
- One commit per navigation still: each nesting level is its own `Router` region tracking one level key (the layout at that depth, or the page path + query at the deepest). The level whose key changed fetches the data of the whole chain and renders; the Router inside a new layout takes that result synchronously.
- Layout children are wrapped: `<div data-rivet-outlet="N">` (N = nesting level) holds the inner Router region (a resumable region needs an element); style it (`display: contents`) when layout CSS needs the page as a direct child.
- Data requests skip unchanged layout loaders: `?_rivet=data&_rivet_keep=/,/shop` names the layouts (`/` + folder) whose data the client already has — in the shown chain with the same own params (folder params, e.g. `id` of `u/[id]`), not invalidated.
  - The server skips those loaders only; `onRequest` / `on<Method>`, guards and `headers()` still run for every layout (security). Response: kept slots `undefined`, `keep: [indices]`; the client keeps its data.
  - Never kept: layouts whose loader read `event.url` / `event.request` (server reports them, `byURL`), layouts with a `head` function (the merged head needs their data), everything after a form submit or `invalidate()` (the next request reloads every layout), layouts whose `depends()` keys an `invalidate(key)` matches.
  - Kept loaders don't run: don't rely on loader side effects (`locals`) for child loaders — use guards.
  - Intent prefetch sends the same list. Static (`_data.json`) and CSR apps load everything as before.
- `invalidate()` / `revalidate()`: every loader reruns (a single-flight `fresh` answer carries every layout's data); persisted layouts update in place (no remount), the page re-renders. `invalidate(key)`: only matching loaders (below).
- Errors: a failed load renders the route's `_404` / `_error` view in place (inside the persisted layouts) when every layout around it kept its data; when a reloaded layout's loader may have failed (its params changed), the view replaces the chain from the top (as before).
- Server-rendered error pages render inside the root layout when its data is there: the outermost layouts whose guards passed and whose loaders succeeded keep their data (loaders not run yet run for the error page); unmatched URLs run the root layout's `guard` + loader (HTML GET only; a guard verdict or loader failure → no root layout). Nested layouts are not rendered around server errors (the failure view fills the routes region; the next navigation reloads it).
- Resume: the layout state object (`nest`: level keys + per-layout signals) is resume-serialized with the App; a `clientEffect` (`when: "load"`) maps location changes to level keys. Server-rendered inner regions whose outer level the browser re-rendered never load (orphan guard).

## File routes: revalidation

- `revalidate(fresh?)` = `invalidate(fresh?)` (`@rivetjs/router/client`, same function): refetch the current page's route data, re-render it in place; one commit, no history entry, no transition / scroll / focus move (the focused control keeps focus by id). `fresh = { data, head? }` (data-endpoint shape) skips the request. Resolves on commit. No client router on the page → the browser reloads it.
- Runtime: `router.navigate(href, { revalidate: true })` re-runs location readers for an identical href (otherwise ignored).
- Single flight: an enhanced action POST with `accept: application/json` and `x-rivet-revalidate: 1` that succeeds (status < 400) answers `{ action, data, head? }` (loaders re-run after the action). Failures skip loaders; requests without the header (field checks, autosave drafts) answer `{ action }` only. An action `redirect()` back to the page's own path (no query / fragment: post/redirect/get) answers `{ redirect, status, data, head?, deps? }` with the header (forms `follow` revalidates from it: no second data request); other redirect targets answer `{ redirect, status }`.
- `@rivetjs/forms` does this after every successful enhanced submit that stays on the page (`defineForm({ revalidate: false })` opts out).

## File routes: live pages

Spec: [2026-10-08-partial-render-design.md](../design/specs/2026-10-08-partial-render-design.md).

- Opt-in per page module: `export const live = true` (literal; scan regex `routes.ts` `LIVE`, reported by `_serverExportsOf` as `live`, not a server export — stays in the browser build, `RouteModule.live`). Layout / special-page flags ignored (layouts are live already).
- Page props: `data` is an accessor (`LivePageProps<D, P>`: `data: () => PageData<D>`; `params` / `url` plain). One signal per page render (`_livePage`); another page → normal re-render with a fresh signal.
- Same-URL revalidation of the shown live page — `invalidate()` / `revalidate(fresh)` (forms single flight), `invalidate(key)` matching the page loader — updates in place: one `batch` of `_refreshed` (layouts that reran) + `data.set(fresh page data)`; no page re-render, no Router commit, no transition / scroll / focus move. Page-local signals (open overlay, counters), DOM input values, focus survive. `invalidate(key)` with layouts only: unchanged (`refresh`).
- Served by `_serveLive` (`client/live.ts`; generated `rivet:go` listener uses it instead of `_serve` when the app has a live page + navigate/forms usage) → in place, else `_perform`. Skipped (regular path) when a navigation is in flight (`_current()`), the slot's URL (`pathname + search`) is not the target, no client router.
- Search-only navigations of the shown live page (link `?new`, `navigate()` / `setSearchParams`, popstate between entries of the page) — single-level apps (no nested layout levels): the top Router is `_liveRouter(router, live)` (keyed on the slot's `k` signal, `equals: false`, instead of the URL); `_armLive` (called first by every navigation entry point: click, popstate, `rivet:go`) starts one effect that sets `k` on each location change except a fragment-only one and a search-only one of the shown live page (`live.h` = shown URL without fragment, `live.u` = the live page's `pathname + search`). Those refresh in place (`refresh(…, search)`: one data request with the layouts' keep list, `batch` of `_refreshed` + `data.set`, then `_inPlace()` ends the navigation in flight — no Router commit, scroll / focus kept, `onNavigate` after-swap callbacks and `navigate()` waiters run). A same full URL again = revalidation: `k` re-set (`equals: false`) → the Router reruns. Loader failure → `k` set → Router commit with the route's error view. Nested layout levels (top Router = `_level`): the App's level sync `_sync(router, nest, NEST, inPlace)` asks `_liveLevels(router, live, nest, NEST, from, url)` first (`from` = the URL `_sync` saw last): a search-only change of the shown live page moves no level key and refreshes in place the same way (layouts whose loaders do not read the URL keep their data; every layout's `url()` follows); a failed loader → `_bump()` + `_sync` → the page level re-renders with the error view. Revalidations (`_bump`) never take this path. Layout `url()` also follows single-level search refreshes (`_refreshed`). e2e `libs/router/tests/live-nested.test.ts` (`fixture-live-nested`).
- Form intent (focusin via the App's intent handler, `pointerdown`) inside a `form` of the shown live page: `_liveIntent` asks the resume runtime (`Symbol.for("rivet.warm")`) to load the chunks of the inactive bindings reading the page / layout data signals (once per page render), so the refresh after a submit applies without a chunk round trip.
- Concurrency: generation counter `live.n`; only the newest refresh applies; a navigation started meanwhile wins. A loader failure → regular rerun (route error view). A data `{ redirect }` navigates (never settles).
- Resume: App-level slot `_live(source, router?)` (`{ m, s, u, d, n, k, h }`) captured by the `rivet:go` handler; `s` = the page's data signal (same table ref as the page's prop) → a resumed page refreshes without re-creating the page component; bindings that read `data()` are armed by the signal (their chunks load after the answer on a cold page).
- Codegen (only with a live page + `navigate`): `LIVE` page-index list, `const live = _live(…)` (before the listeners that capture it; single-level apps: `_live(source, router)`, Router `_liveRouter(router, live)`, entry points `(_armLive(router, live[, nest, NEST]), …)`; nested levels: `arm()` syncs with `_sync(router, nest, NEST, (from, url) => _liveLevels(router, live, nest, NEST, from, url))` — inline arrow, a `_liveLevels(…)` closure stored in a const is not resumable), route render hoists `const data = LIVE.includes(row[2]) ? _livePage(live, result.data[depth], match.url, depth) : result.data[depth]` and passes `data={data}` (static prop: a getter would create a signal per read). Apps without a live page: byte-identical output.
- Known gaps: kit component heads / `applyRouteHead` are not re-applied (title from `head` still set); in static mode `_data.json` reloads every layout.

## File routes: revalidation by key

```ts
// routes/_layout.server.ts
export const load = (event: RequestEvent) => {
  event.depends("cart"); // or a URL-like key: event.depends("/api/cart")
  return getCart(event.cookies);
};
// anywhere in the browser, after the cart changed:
await invalidate("cart");                    // one key (a URL counts as its href)
await invalidate(["cart", "session"]);       // any of them
await invalidate((key) => key.startsWith("/api/")); // predicate: gets each key string
```

- `event.depends(...keys)` (`RequestEvent`, string or `URL` keys; repeats ignored; any time during the loader, also after `await`). Guards, actions, handlers: no-op.
  - Event method, not an import: per-loader recording needs the loader's identity (each loader already gets its own event view), no async context needed (works in every adapter, fetch/edge included).
- Wire (only when some loader called `depends()`; otherwise byte-identical): data responses and single-flight answers `deps: [keys | undefined, …]` (route data order: layouts, then page); SSR → `ServerData.deps` → resumed layout state (`nest.dk`). Dev pages embed it with the route data.
- Client records the shown page's keys (kept loaders keep theirs across navigation) and plans one data request:
  - `_rivet_keep` names every loader that did not match (layout ids, see nested layouts; `.` = the page's own loader). Server skips them (guards still run; `head`-function modules never skipped).
  - Page loader matched → page level reruns and re-renders (like `invalidate()`); matching layouts rerun, others kept.
  - Only layouts matched → those layouts update in place, the page is not re-rendered (its loader kept). A failure there falls back to rerunning the page level too (its error view renders).
  - Kept-by-navigation layouts rerun when their keys match; layouts whose loader read `event.url` / `event.request` rerun with any request (never kept).
  - Nothing matches → no request (promise resolves at once).
  - Keys unknown → every loader reruns, like `invalidate()`: no keys recorded for this URL yet (dev mounts before the first load, apps without layouts before their first client load, server error pages), or data stale after a form submit / `invalidate()`. Apps without a layout table (no layouts, static, CSR): any match reruns everything.
- Prefetch: `invalidate(key)` drops the whole prefetch cache (entries' keys are unknown until they arrive) without marking layouts stale; `invalidate()` keeps its stale semantics.
- Resume cost: server apps with layouts that use the navigation API pass their layout state to `_serve` (`rivet:go` handler captures `nest`: +3 B state per page; no listener and no cost without navigation use — see [pay-per-use features](#file-routes-pay-per-use-features)); `nest.dk` only when a loader called `depends()`.
- Limits: key match is exact string equality (or your predicate); layout-only refresh applies `head.title` only (kit component heads unchanged); `fresh` data cannot be combined with keys.

## File routes: route rules and page cache

```ts
rivetRouter({ routeRules: { "/articles/**": { swr: 60 }, "/": { isr: 300 }, "/admin/**": { headers: { "x-robots-tag": "noindex" } } } });
// isr needs a fixed origin: start({ origin: "https://site.example" }) or createApp({ routeCache: { origin } })
```

- `routeRules` (`rivetRouter()` plain data → generated entry `routeRules`; `createApp` / `start` / `loadBuild` option overrides it): `{ headers?, cache?: CacheRule | false, swr?: n | true, isr?: n | true, cdn?: { maxAge, swr? } }` per pattern (exact, `*` = one segment, trailing `/**`; below `base`), matched on the decoded path (`normalPath`). Matching rules merge, more literal characters win; headers merge by name. Static adapter ignores rules. Spec `docs/design/specs/2026-10-12-route-cache.md`; code `libs/router/server/route-cache.ts`.
- Cached: GET / HEAD `200 text/html` pages without `Cookie` / `Authorization` (unless `cookies: true`: fill renders WITHOUT them — anonymous), without `set-cookie`, not `private` / `no-store`, no `Vary: *`, `Vary: cookie|authorization` only with rule `varies` and never with `cookies: true` (the cookie visitor gets a render of their own request), no reported render failure (`RENDER_FAILED`), canonical path encoding only. Hit = no guard / loader / render (public, CDN contract). Data requests, actions, endpoints pass through.
- Key: origin + decoded path + query + `varies` + learned response-`Vary` names. `routeCache.origin` fixed → other origins bypass; `isr` requires it.
- Store: process-local, 32 MiB (incl. zstd / br / gzip copies) / 5,000 entries, CLOCK; keys of client-chosen input admitted on their 2nd miss (a query string, a non-empty `varies` / learned header value, any key without a fixed origin); single flight; stale hit served at once + one background refresh (404 / 410 / 3xx / `Set-Cookie` drop, other failures back off 1 s → 5 min). Fills render a detached request without `Cookie` / `Authorization`, the client `address`, `Forwarded` / `X-Forwarded-*` / `X-Real-IP` / `True-Client-IP` / `X-Client-IP` / `CF-*` / `Fastly-Client-IP` (unless in `varies`). `revalidate({ path } | { tag })` (`@rivetjs/router/route-cache`) also voids the matching renders in flight (per fill, same path / tag predicate); under node `start({ workers })` the primary relays it to the other workers.
- Response: weak ETag + `Last-Modified` + `Age` + `x-rivet-cache: HIT | MISS | STALE` + `Vary`; `cache-control: public, max-age=0, s-maxage=…, stale-while-revalidate=…` (`isr`: `s-maxage=0, must-revalidate` unless `cdn`); `If-None-Match` / `If-Modified-Since` → 304. Default nonce CSP → stored page gets a hash policy of the nonce'd elements only (`shared/csp-hash.ts` `noncedSources`); nonce elsewhere or an unconvertible nonce policy (`csp` function) → not stored.
- Miss: buffered (no streamed TTFB) from the `DIRECT_BODY` sink; stream failure → 500.
- Node adapter: hit served before the `Request` object is built, zstd (19) / br (q11) / gzip (9) compressed once per page. editorial-bench 1000 articles: see spec Measure (hit vs uncached vs static server; miss overhead in-process).
- `earlyHints` (app option, `start` / fetch `create`; production only, default off): per route `Link` values = linked build stylesheets (`<base>/assets/` only: Chromium refetches a revalidated preload, measured +100 ms FCP) + the last render's asset font preloads (never preconnects / other head links: per-visitor data would reach every visitor) + `links` + `runtime: true` (resume entry `modulepreload`). Handler calls `AppOptions.earlyHints(route, request)` after request handlers, before guards (HTML page GET / HEAD only; route-cache hits and fills never reach it: no 103 for cached pages, their stored `Link` header only); node writes `103` via `res.writeEarlyHints` (HTTP/1.1 clients; browsers need an h2 proxy that forwards 103s); every page response gets the `Link` header (CDNs convert). `server/early-hints.ts` loads only when set.
- `renderCache` (app option): wires `@rivetjs/runtime/server-cache` fragments into page renders (dynamic import, 0 B without it).

## File routes: leave guards

- `beforeLeave(fn)` (`@rivetjs/router/client`, also `@rivetjs/router/leave` alone; browser only) → unregister function. `fn(leave)` runs before a client navigation — link click or `navigate()` / `setSearchParams()` (`type: "link"`, `to`; hash-only changes skip it) — on back/forward between client-routed entries (`type: "history"`; the address bar already shows `to`) — and on `beforeunload` (`type: "unload"`, `to: null`); `leave.cancel()` stays on the page. Filter by type: `if (leave.type === "history") return`.
  - Links: ask first, e.g. `if (!confirm("Discard changes?")) leave.cancel()`; runs before the cancelable `rivet:navigate` event.
  - Unload (reload, close, full page loads): `cancel()` cancels the event, the browser shows its own prompt (no custom text).
  - Back/forward: a cancel walks history back to the guarded entry (`history.go`); the router never sees either `popstate` (no loader, no scroll save, no `onNavigate`). Not guarded: hash-only traversals, entries the router did not number (`history.state.i` missing), traversals to another document (`unload` covers those).
  - Not guarded: redirects, `invalidate()` / `revalidate()`.
  - The `beforeunload` listener exists only while a guard is registered (it keeps pages out of the back/forward cache): register in `clientEffect(() => beforeLeave(...))` so it leaves with the component.

```tsx
clientEffect(() => beforeLeave((leave) => {
  if (dirty() && (leave.type === "unload" || !confirm("Leave with unsaved changes?"))) leave.cancel();
}));
```

- Autosave: `clientEffect(() => guardLeave(auto, { message }))` (`@rivetjs/forms/autosave`) is this guard over `shouldBlockLeave(auto)`.

File routes (`@rivetjs/router`): server code next to the page, request handlers and the migration codemod are in [server-code.md](server-code.md); slots in [slots.md](slots.md).

## File routes: base path

- `rivetRouter({ base: "/app" })` (or Vite `base: "/app/"`; the option sets it): the app lives under `/app`.
  - Generated route patterns carry it (`/` → `/app`, `/items/:id` → `/app/items/:id`); route ids, `RoutePath` and `PageProps<"id">` do not. `event.url` / `url` props are the real URLs (`/app/items/1`).
  - App paths get the base: `<Link to="/about">` → `href="/app/about"`, `navigate("/about")`. Full URLs, relative URLs and plain `<a href>` / `redirect()` targets are real URLs (write the base yourself: `withBase("/login")`, `BASE` from `@rivetjs/router`).
  - Client: data requests (`/app/x?_rivet=data`) and intent prefetch use the real URLs; links, `navigate()` and data-request redirects outside the base load the document.
  - Node: `start()` takes the base from the server entry (`export const base`): client files served under it (`/app/assets/*` immutable), other paths reach the handler (404 outside the base). `serve({ base })` for custom servers.
  - Static: `prerenderBuild()` writes files relative to the base (`dist/client/about/index.html` for `/app/about`; the host serves `dist/client` under `/app`); `prerender({ base })`.
  - Fetch: patterns and stylesheet URLs carry the base (`fetch.js` inlines it); assets stay the platform's.
  - Dev: Vite serves under the base; pages render at `/app/…`.

## File routes: trailing slash

- `rivetRouter({ trailingSlash: "ignore" | "never" | "always" })`, default `"ignore"`: `/a` and `/a/` serve the same page, URLs stay as written (nothing generated or shipped for the option).
- `"never"` / `"always"`: one canonical form (`/a` / `/a/`); `/` never changes. `"always"` never slashes a file path (last segment with an extension: `/sitemap.xml`, `/feed.rss`); dot-file segments (`/.well-known`) are directories.
  - Server: page GET/HEAD in the other form → `308` to the canonical path, query kept, before `onRequest`/guards. Data requests (`?_rivet=data`) get `{ redirect }` (the client router follows). Endpoints, POST/PUT/…, OPTIONS and unmatched URLs are never redirected.
  - Client: `<Link to>` hrefs (server render included) and `navigate()` targets are written canonical (query/hash kept); plain `<a href>` in the other form still navigates client-side via the data redirect.
  - Static: pages prerendered at the canonical URL; `"never"` writes `about.html` (hosts with clean URLs serve it at `/about`), `"always"` / `"ignore"` `about/index.html`; `_data.json` stays at `about/_data.json`. `prerender({ trailingSlash })` for custom setups (`prerenderBuild` reads it from the build).
  - Build-time: the plugin rewrites the router's policy constant (`shared/slash.ts`) in this app's client and server bundles (and bundles `@rivetjs/router` into the server build); a plain `createHandler` outside Vite always ignores.
- Static mode in dev (`vite serve`): there are no prerendered files, so the dev server answers the client's `<page>/_data.json` requests from the data endpoint (the page path in its `trailingSlash` form, as `prerender` renders it); client navigation behaves like the deployed site.

## File routes: dev errors (`vite serve`)

- Server failures (5xx from guards, loaders, actions, request handlers, render): stack source-mapped (`ssrFixStacktrace`), logged, sent to Vite's error overlay (`plugin: "rivet"`, message `<phase> failed in route "<id>": <message>`, `id` = route page file).
  - Full page load, no `_error` view: dev error page instead: escaped message, stack, route id, phase (`handler`/`guard`/`loader`/`action`/`render`); reloads on server-code edits (`rivet:data`).
  - With an `_error` view: it renders as in production; the page opens the overlay over it and carries a `<!-- rivet dev: … -->` hint.
  - Client navigation (data requests): JSON answer unchanged; the overlay opens on the open page.
- Resume recorder: dev SSR renders through `renderResumable` with the compiler plugin's dev manifest (`api.devResume`: symbol id → chunk, from the SSR compiles), so production's render errors happen in dev: non-serializable captures (functions, class instances, rendered JSX), symbols without a chunk, detached refs. The message gains `in <Component> (file:line:col), <kind> <symbol id>` and `capture \`name\` (file:line:col)`; the overlay gets `id` + `loc` of the component.
  - The state encodes after the shell (status 200 already sent): the truncated body ends with the `<!-- rivet dev: … -->` hint and opens the overlay itself; it reloads on the next hot update or server edit.
- Browser errors: render errors no `ErrorBoundary` handles (dev mount wrapped in `catchError`, error rethrown after; resumed pages: `rivet:resume-error` and uncaught errors) and route load failures that are not HTTP errors (undecodable data, failed page chunk) go to the server via `import.meta.hot.send("rivet:client-error")` → overlay of that page (`Browser error: …`). A value that is not an `Error` is described (the dev entry's `describe`): an `ErrorEvent` without `error` (ResizeObserver loop, cross-origin script) as its message + source location, `throw null` / a non-Error rejection as `Non-Error value thrown (<type>): <value>`, both with the stack of the reporting site. Event-handler throws are not forwarded (DevTools' Errors panel lists them).
- Unmatched URL, no applicable `_404`: dev page listing the route patterns (static ones linked, endpoints marked). With a `_404`: it renders, plus a `<!-- rivet dev: no route matches … Routes: … -->` comment.
- `server.hmr.overlay: false`: no overlay (dev pages still render).
- Production unchanged: generic message + digest; builds carry none of this (the `import.meta.hot` branches drop out). `onError(error, request, info)` gets `info.phase` and `info.route` (route id) besides `digest` everywhere.

## File routes: dev resume (`vite serve`)

- Default: dev pages are production-shaped: `renderResumable` HTML + state + loader inside `<div data-rivet-dev="resume" style="display:contents">`; runtime `<base>.rivet/entry.resume.ts`; symbol id → `<module>?rivet-chunk=<Component>` (compiled per request from the DOM resume compile, `import.meta.hot.accept()`ed). Interactions load their chunk like production; client navigation and loader data unchanged.
- `entry.dev.tsx` (resumed pages): forwards resume/uncaught errors to the overlay, preloads `dev-mount.tsx` at idle, and on the first non-CSS `vite:beforeUpdate` disposes the resume runtime (DEV-only `dispose()`), then client-renders via `dev-mount.tsx`; later edits hot-replace with state kept. Signals of the resumed page reset once at that switch. The same switch runs on `rivet:devtools-inspect` (DevTools inspection tabs); both triggers dispatch `rivet:dev-client-render` `{ phase: "start" | "done" }`.
- Server-code edits (`rivet:data`) reload resumed pages.
- Client-rendered dev pages (`dev-mount.tsx` from the first load, recorder still runs, state cut): `rivetRouter({ dev: { resume: false } })`, and non-default i18n locales.
- Not in dev: `ChunkGroup` / route chunk grouping, preload rules, lazy-page prefetch lists, `$r` hash checks.
- Builds unchanged (all of it behind `serve` / `import.meta.hot` / `#dev`).

## File routes: deploy adapters

Build: `vite build` (browser → `dist/client`) then `vite build --ssr` (server → `dist/server`).

- Node (`@rivetjs/router/node`): `start({ dist, origin?, trustProxy?, static?, maxBody?, stream?, csp?, locales?, resolveLocale?, workers?, reusePort? })` — reads manifests from `dist/client/.vite/` at startup, serves `dist/client` (immutable `/assets/`, zstd / br / gzip), `/healthz` + `/readyz`, graceful drain. `workers: n | "auto"` (default 1): node:cluster primary forks n copies of the script (round robin; `reusePort: true` = per-worker `SO_REUSEPORT` socket, kernel balancing on Linux), replaces crashed workers (stops after > 5 in 10 s), `close()` drains all; route / render caches per worker, `revalidate()` relayed to every worker via the primary (async).
  - Client files indexed once at start (real paths, sizes, `.br`/`.gz` siblings; dot-named entries and symlinks leaving the directory skipped, except a root `.well-known/`): a page GET costs a map lookup, not a `realpath` + `stat`. Files added after start are not served; `static: "fs"` looks each GET up on disk instead.
  - Files: `ETag` (weak) + `Last-Modified`; `If-None-Match` (lists, `*`) / `If-Modified-Since` → 304; one `Range: bytes=…` → 206 (video seeking, resumed downloads), unsatisfiable → 416; compression (`compress`, default on; `{ zstd?, precompress? }`, M5 E2 2026-10-18): `negotiate` picks zstd / br / gzip by highest `q` (tie: zstd, then br); dynamic responses zstd 3 (1 for bodies ≥ 256 KiB; streamed bodies by the bytes in hand when streaming starts) / br q4 / gzip 6; immutable files compressed once at the best quality (zstd 19 / br q11 / gzip 9) on their first request, kept in memory and written next to the file (`.zst` / `.br` / `.gz`, hidden temp + rename; not writable → memory only; `precompress: false` → never written), build-time siblings served as they are; other files compressed in memory; `zstd: false` = br / gzip only (no zstd work). Measured: `docs/design/research/2026-10-18-floor-first.md` §9.
  - Request URL = public origin + request path: an absolute-form target for another origin → 400; a malformed `Host` (userinfo, path, spaces) → 400. Request bodies the handler never read are drained after the response (keep-alive stays usable).
  - `trustProxy` off by default (forwarded headers ignored); `true` / hop count / `(address, hop) => boolean` — see [server-code.md](server-code.md#security).
  - Route server modules load once per process (generated `once()`; dev re-imports every request so edits apply).
- Server render: body writes coalesce (one chunk per 16 KiB, or when the renderer waits — a pending `Async` boundary flushes the shell at once); back-pressure from the 64 KiB stream queue as before.
- Fetch / edge (`@rivetjs/router/fetch`): `rivetRouter({ adapter: "fetch" })` (or `{ name: "fetch", origin?, maxBody?, stream?, headers?, locales? }`) → `vite build --ssr` also emits `dist/server/fetch.js`:
  - `export default { fetch(request, env?, ctx?) }`; `export const create(options)` for runtime-only options (`onError`, `serveAssets`, `address`, `resolveLocale`, `csp`) over the build-time defaults.
- CSP (`csp` of `start()`, `loadBuild(dist, { csp })`, fetch `create({ csp })` / build-time `{ name: "fetch", csp }` → `createApp`): default `strictCSP(nonce)`; `{ trustedTypes: true | [names], directives? }` → `strictCSP` + Trusted Types + extra directives (`shared/csp-directives.ts` `cspPolicy`, loaded by `createApp` via dynamic import only when `directives` is set; checked at startup); `(nonce) => policy`; `false` → no header. A `headers()` CSP wins. Static adapter: `prerenderBuild({ csp })` (hash policy, same `{ trustedTypes, directives }`; `<meta>`-ignored directives throw).
  - Client manifests (Vite, resume, route CSS) inlined at build time: no `fs`/`path`, no runtime `import()` of file paths. Dependencies bundled (`ssr.noExternal: true`); route modules are relative chunks in `dist/server/assets/` (deploy all of `dist/server`). Client build must run first.
  - Only node import: `node:async_hooks` (resume state per request) → Cloudflare Workers need `compatibility_flags = ["nodejs_compat"]`; Deno, Bun, Vercel Edge, Netlify Edge have it built in.
  - Same pages as node: identical HTML, strict nonce CSP (nonce from `crypto.getRandomValues`, 16 bytes base64), nosniff + `Referrer-Policy` defaults, CSRF origin check, `maxBody`, data endpoint, 404/500 pages; HEAD → no body; uncaught failure → `500 Internal Server Error` + `onError`.
  - `env` / `ctx` → loaders/actions as `event.platform.env` / `event.platform.ctx` (bindings, `waitUntil`); `address: (r) => r.headers.get("cf-connecting-ip") ?? undefined` → `event.platform.clientAddress`.
  - Origin: request URL as given (edge platforms pass the public URL); `origin: "https://shop.example"` rewrites it when the platform hands an internal URL.
  - Static assets: `dist/client` is the platform's (Workers `assets.directory = "dist/client"`, Deno/Bun static serving, Vercel output `static/`), with `/assets/*` immutable. Unmatched asset URLs reaching `fetch` render the app's 404. Optional `serveAssets(request, env, ctx) → Response | undefined` answers GET/HEAD first. No compression (platform's), no `/healthz`.
  - Workers: `main = "dist/server/fetch.js"`; custom worker: `import { create } from "./dist/server/fetch.js"; export default create({ onError })`.
- Platform targets (`rivetRouter({ adapter: "vercel" | "netlify" | "cloudflare" | "bun" | "deno" })` or `{ name, …options }`; same handler, CSP, CSRF, streaming as fetch/node; contracts cited in `libs/router/adapters/pack.ts`):
  - Vercel (Build Output API v3): `.vercel/output/` — `static/` (client files without `.vite/` + prerendered pages, `overrides` → clean URLs), `functions/_render.func` (Node.js `nodejs24.x` request listener over the node adapter's `createListener`: direct page bodies, `trustProxy: 1`, zstd / br / gzip; or `runtime: "edge"`), `config.json` routes (immutable `<base>/assets/`, filesystem, catch-all). `isr: { expiration }` → prerender functions for `prerender = true` routes (`__rivet_path` rewrite; cached nonce shared by visitors).
  - Netlify (Frameworks API): publish `dist/netlify` (`netlify.toml` `publish`), `.netlify/v1/functions/rivet-server` (Functions v2, `path: "/*"`, `preferStatic`) or `edge: true` → `.netlify/v1/edge-functions/rivet-server` (published paths handed back with `undefined`), `.netlify/v1/config.json` immutable headers.
  - Cloudflare (Workers static assets): `dist/cloudflare/wrangler.json` (+ `.wrangler/deploy/config.json` redirect; project `wrangler.json(c)` / `wrangler` option merged), `static/` + `_headers`; flags `nodejs_als` with `nodejs_compat` off (workerd `Buffer#utf8Write` breaks the renderer's Buffer slabs).
  - Bun / Deno: `dist/server/bun.js` / `deno.js` (`start()` when run directly): `Bun.serve` / `Deno.serve`, `dist/client` first (immutable assets, ETag/304, `.zst`/`.br`/`.gz` siblings), `$PORT` / `$HOST`, graceful stop on SIGTERM/SIGINT.
  - `prerender = true` routes (all routes in `mode: "static"`, then no function) are prerendered into the platform's static dir with a hash CSP (Vercel / Netlify / Cloudflare).
