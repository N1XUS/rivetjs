---
title: File conventions
description: Every file and folder name the Rivet router and build understand, with the exports each file may have.
template: reference
related: [guides/routing/file-routes, guides/routing/layouts, start/project-structure, reference/config]
---

All paths are relative to the project root. The defaults below can be changed in [`rivetRouter()`](config.md#rivetrouter).

## Project files

| Path | What it is |
| --- | --- |
| `src/routes/` | Route files. One file or folder per URL. |
| `src/document.ts` | The HTML around every page. Default export: a `DocumentShell` function `(input) => ({ start, end })`. |
| `src/styles.css` | Your stylesheet, if listed in `rivetRouter({ styles })`. Any path works. |
| `vite.config.ts` | Vite config with `rivetRouter()` (and `i18n()`, Tailwind, …). |
| `.rivet/` | Generated code. Do not edit; rewritten when route files are added or removed. |
| `dist/client/` | Browser build (`vite build`). |
| `dist/server/` | Server build (`vite build --ssr`), entry `entry.server.js`. |
| `src/rivet-i18n.d.ts` | Generated message types, when you use `@rivetjs/i18n`. |

## Route file names

| File in `src/routes/` | URL | Notes |
| --- | --- | --- |
| `index.tsx` | `/` | `index` adds no segment. |
| `about.tsx` | `/about` | Static segment. Matched case-sensitively. |
| `blog/index.tsx` | `/blog` | One trailing slash is optional. |
| `blog/[slug].tsx` | `/blog/:slug` | Parameter: `params.slug`. |
| `docs/[[lang]]/intro.tsx` | `/docs/intro` and `/docs/:lang/intro` | Optional parameter. Each optional segment makes two routes. |
| `files/[...path].tsx` | `/files/*path` | Rest parameter. Must be the last segment. Matches the rest of the path. |
| `(marketing)/pricing.tsx` | `/pricing` | `(group)` folders add no URL segment. Use them to share a layout. |
| `api/time.ts` (plain `.ts`, no `.tsx`) | `/api/time` | Endpoint only: no page, answers with request handlers (`onGet(…)`, …). |

Rules:

- Page files end in `.tsx` or `.jsx`. Plain `.ts` / `.js` files are endpoint routes only if they export request handlers. Files ending in `.server.ts` or `.server.js` are server-only modules.
- Parameter names must be valid JavaScript names and unique within one route.
- Ignored: files or folders starting with `.`, `*.test.*`, `*.spec.*`, `*.d.ts`, and any file or folder whose name starts with `_` (except the special files below).
- When several routes match, static segments win over parameters, and parameters win over rest parameters.
- Two files that match the same URLs are a build error: `Route conflict: a and b both match /x`.
- Other characters `[ ] ( ) * : ? # \` in a segment are an error: `Invalid route segment`.

## Special files

| File | Applies to | What it does |
| --- | --- | --- |
| `_layout.tsx` | its folder and all folders below | Wraps the pages. Gets `children` plus `data`, `params`, `url` as accessors (`LayoutProps`). Shared layouts stay mounted across client navigation, including nested layouts. Can export `guard(…)`, `load(…)` and other server exports for everything under it; the only special file that runs server code. |
| `_404.tsx` | its folder and below | Shown for URLs that match no route, and when a loader throws `notFound()`. Gets `url`. |
| `_error.tsx` | its folder and below | Shown when a loader or guard fails. Gets `error`. |

The nearest `_404` / `_error` up the folder chain wins. For unmatched URLs, a `_404` in a folder with parameters is not used.

## Page module exports (`*.tsx`)

| Export | Type | Purpose |
| --- | --- | --- |
| `default` | component | The page. Props: `PageProps` = `{ data, params, url }`; `PageProps<typeof loader>` or `PageProps<"route/id">` types them. See [typed routes](../guides/routing/typed-routes.md). |
| `head` | `Head` or `({ data, params, url }) => Head` | Title, meta tags and links. Merged from layouts to page; the inner value wins. |
| `live` | `boolean` | `true`: refresh a page's loader data in place with a `data()` accessor (`LivePageProps`), preserving local state. See [forms in overlays](../guides/forms/forms-in-overlays.md). |
| `transition` | `false` or `{ types: string[] }` | View transition for navigations to this page (with `rivetRouter({ transitions })`). |

## Server exports

Server code lives in the page or layout file itself, as exports made by a wrapper call from `@rivetjs/router` (`export const loader = load(…)`; the export name is free, each wrapper once per file). The compiler removes them (and code only they use) from the browser build.

| Export | Purpose |
| --- | --- |
| `guard((event) => …)` | Runs outer to inner before loaders. Throw or return `redirect()`, `deny()`, `notFound()`, `error()` to stop. |
| `load((event) => …)` | Data for the page or layout. Arrives as the `data` prop; `PageProps<typeof loader>` infers its type. `load(fn, { defer: true })` does not hold the response back: `data` is a `Deferred` handle that `<Async load={() => data}>` streams in ([deferred loaders](../guides/routing/loading-data.md#deferred-loaders)). |
| `actions({ … })` | `{ [name]: (event) => result }`. Form posts to `?/name`, for example `<form method="post" action="?/add">`. |
| `headers((event) => …)` | Extra response headers. |
| `entries(() => […])` | Parameter values to prerender for dynamic routes. |
| `prerender` | Plain `boolean`. Force prerendering on or off (static mode). Default: on for static routes and routes with entries. |
| `onRequest(…)`, `onGet(…)`, `onPost(…)`, `onPut(…)`, `onPatch(…)`, `onDelete(…)`, `onOptions(…)` | Request handlers. They run before guards, outermost module first, `onRequest(…)` before the method's handler. `onRequest(…)` runs for every method, before the 405 method check, so it can answer methods the route does not handle. A returned `Response` ends the request; `undefined` continues. |

Endpoint routes: a plain `.ts` file in `src/routes` that exports request handlers (for example `api/time.ts` with `export const GET = onGet(…)`). Its handler for the method must return a `Response`. Plain `.ts` files without handlers are helpers, not routes.

A separate `name.server.ts` next to a page or layout works too, with the same wrappers; its exports are merged with the route file's (the same wrapper in both is an error). Old export names (`serverLoad`, `onGet`, …, and `load`, `GET`, … in `.server.ts` files) are errors; `rivet migrate server-exports [--routes src/routes] [--dry-run]` (a bin of `@rivetjs/router`) rewrites them. See [server code in routes](../guides/routing/server-code-in-routes.md).

`event` is a `RequestEvent`: `request`, `url`, `params`, `locals`, `signal`, `cookies`, `setHeader(name, value)`, `appendHeader(name, value)`.

Files named `*.server.*`, modules that `import "@rivetjs/router/server-only"`, and modules listed in `rivetRouter({ serverOnly })` never reach browser code. A page that uses one itself is a document route (links load its document, no page code in the browser); a component or layout that uses one fails the build with [RV3011](../errors/RV3011.md); any other browser import stops with `… is server-only and cannot be imported by browser code`.

## Generated files (`.rivet/`)

| File | Mode | Content |
| --- | --- | --- |
| `app.tsx` | all | The app component: router, layouts, pages. |
| `routes.ts` | server, static | Route table for the server. |
| `entry.server.tsx` | server, static | Server build entry. |
| `entry.dev.tsx` | server, static | Browser entry for client-rendered dev pages; ordinary dev pages resume by default. |
| `entry.client.tsx` | csr | Browser entry that mounts the app. |
| `routes.d.ts` | all | Route ids, parameters and typed paths for `Link`. |

## Build output

| Path | Content |
| --- | --- |
| `dist/client/assets/` | Hashed JS and CSS. The Node adapter serves them with `Cache-Control: immutable`. |
| `dist/client/.vite/manifest.json` | Vite manifest. |
| `dist/client/.vite/rivet-resume.json` | Resume manifest: boundary modules, their chunks and dependencies, plus eligible lite chunks. |
| `dist/client/<path>/index.html` | Static mode: one prerendered page per URL. |
| `dist/client/<path>/_data.json` | Static mode: route data for client navigation. Not written when no page resumes. |
| `dist/client/404.html` | Static mode: the not-found page. |
| `dist/client/200.html` | Static mode: browser-rendered shell for routes that cannot be prerendered (only with a `shell`). |
| `dist/client/<locale>/` | With i18n: one client build per locale. |
