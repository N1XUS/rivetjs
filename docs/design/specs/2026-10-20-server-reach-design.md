# Server reach: document routes, RV3011, throwing stand-ins, navigation fallback (SERVER-REACH)

Status: implemented (lane SERVER-REACH, 2026-10-20). Base `f1091e4b`.

## Incident

- `ApiCard` (docs-kit component) → `docs-kit/api.ts` → `virtual:docs/api`. Client build served an empty model `{ entries: [], symbols: [] }` (api.json is 5–7 MB; API pages ship no browser code).
- Client navigation to a page with an `::api` card: URL pushed, render threw `ApiCard: unknown symbol …`, page stayed on the old content. Fixed for the card in 5d611f11 (card data inlined as props); this lane closes the class.
- Root causes: (1) nothing knew `virtual:docs/api` was server-only; (2) the empty stand-in failed silently far from the cause; (3) a failed client render left URL and page diverged.

## Model

- Server-only module = marker `@rivetjs/router/server-only` (its importer), `*.server.*` file, `rivetRouter({ serverOnly })` / `rivet({ serverOnly })` pattern (string = id or specifier, RegExp tests both), or an id another plugin declares (`api.rivetServerOnly: ServerOnlyPattern[]`; docs-kit: `virtual:docs/api`).
- `serverOnly` option: `ServerOnlyPattern[] | { modules?: ServerOnlyPattern[]; reach?: "error" | "warn" }`.
- Shared helpers: `libs/compiler/server-only.ts` (re-exported from `@rivetjs/compiler/vite`): `isServerOnly`, `matchesServerOnly`, `declaredServerOnly`, `serverOnlyStub`.

## Reach analysis (`libs/router/build/reach.ts`)

- Runs in the router's `configResolved` (both builds, dev, `sync`); csr mode skipped.
- Graph: every page / layout / special page module as the browser sees it.
  - Resolution: `config.createResolver()` with client conditions (alias + node resolve). Unresolvable virtual ids matched by specifier.
  - Edges: `.tsx` / `.jsx` / route modules → `compile(src, { target: "dom", serverExports: isRoute })` (server exports and their imports already removed); `.ts` → `transformWithOxc` (type imports erased); then `parseSync` static imports / re-exports / literal dynamic imports. mtime cache.
  - Not followed: `node_modules`, `?query` ids, `\0` ids (other plugins' virtual modules: specifier match only).
- Classification per page:
  - Chain page → … → server-only with no component (`.tsx` / `.jsx` other than the page) in between, or the page imports the marker → **document route**.
  - Chain through a component → **RV3011** (the component renders on the client navigation that reaches the page). `reach: "warn"` → warning, page becomes a document route.
  - Layouts and special pages (`_error`, `_404`) reaching one → always RV3011 (rendered by every page under them; cannot be document routes).
- `documentOnly`: importers reached only from document routes' graphs → resolveId serves a stand-in instead of the hard error.

## Diagnostic RV3011

- Registered in `libs/compiler/codes.json` (error), `libs/language-core/explain.json`; page `apps/docs/content/errors/RV3011.md` (generated).
- Text (page case, the ApiCard incident before 5d611f11):

```txt
[rivet:router] RV3011 @rivetjs/docs-kit/components/ApiCard.tsx → @rivetjs/docs-kit/api.ts → virtual:docs/api (server-only), rendered by /guides/assets/images, /guides/components/async, /guides/components/browser-only, /guides/components/conditional, /guides/components/context and 25 more (client-navigated page routes)
  fix: pass the data to the component as props (inlined at build time, or read in the page's `load(…)`), keep server-only modules out of components, or make the page a document route (`import "@rivetjs/router/server-only"` in the page module); `rivetRouter({ serverOnly: { reach: "warn" } })` turns this into a warning (those pages render as document routes)
  docs: https://rivetjs.severyn.pro/errors/RV3011
```

- Layout case: `rendered by the layout of every page under /x (client-rendered on navigation and resume)`, fix = read the data in the layout's `load(…)`.
- Display paths: root-relative, else `<package name>/<path>`; ≤ 5 routes + `and N more`.
- Build: `buildStart` → `this.error({ message, plugin, pluginCode: "RV3011" })` (client + server builds), warnings via `this.warn` (client build only).
- Dev: re-analysis after a route / source change; on a GET HTML page request, the matched route's problems → terminal (each once) + hint comment + Vite error overlay injected into the response.

## Document routes

- Codegen `documents` option: `for (const n of [..] as const) modules[n] = [PATHS[n]!, _endpoint];` → `isPage` false → links load the document (no interception, data request, chunk prefetch); excluded from the prefetch `routePathRegExp`. No document routes → byte-identical output.
- Client build: `.rivet/app.tsx`'s import of a document page → `\0rivet-document-page:<page>` (component that throws `… is a document route …`); the page module and its server-only data leave the client bundle. Server build unchanged.
- `navigate()` / back / forward to a document route render through the router → the stub throws → navigation fallback loads the document.
- Dev: page imports not stubbed (dev renders real modules; stand-ins only for server-only ids).

## Stand-ins

- `serverOnlyStub(id, chain, names)`: `export default` + one export per name the graph saw (rolldown has no `syntheticNamedExports`), all the same Proxy; every trap (`get` `set` `has` `apply` `construct` `ownKeys` …) throws `[rivet] <id> is server-only; reached from <chain>. The browser gets this stand-in, never the module: …`.
- Router: `\0rivet-server-only:<key>` for document-only importers. docs-kit: client `virtual:docs/api` = the stand-in (was the empty model).

## Navigation fallback (`libs/router/client/index.ts` `recover`)

- `error` / `unhandledrejection` listeners from the first `started()`.
- Fires when a navigation is in flight (`current`, URL ≠ `committed`) or within a frame after its swap (`rendering`, cleared by `requestAnimationFrame` → `setTimeout`; the routes region renders the new page after `swapRoute` commits).
- `location.replace(href)` (not `assign`: the history entry is already pushed; `assign` would duplicate it).
- Loop guard: sessionStorage `rivet:recover` = `<ms><href>`; same href within 10 s → skipped. In-page: once (`recovering`).
- Dev: `_recover.defer` (`client/dev.ts`) waits for `vite-error-overlay` (≤ 1.5 s, then until it closes) so the error is seen before the document loads.

## Cost

- Runtime entries (zero-cost hashes): identical.
- Client-routed pages: router client fallback ≈ +0.45 KB min / +0.15 KB br (size-report, every client-routed app). Apps without the client router: 0.
- Build: analysis 130–560 ms per config resolve on apps/docs; docs build peak RSS 1.1 GB.

## Limits

- Edges through other plugins' virtual modules are not followed (specifier match only).
- The fallback may also fire for an unrelated uncaught error during an in-flight navigation (loads the target's document: URL and page still agree).
- Resume chunks of a document route that name a server-only module import the stand-in: they throw if ever loaded (docs API pages: bindings over static data never re-run, so never loaded).
- No session storage: no cross-document loop guard.

## Tests

- `libs/router/tests/server-reach.test.ts` (fixture-reach): analysis error / warn / layout / marker page, stand-in Proxy, `vite build` reject + warn build, dev overlay + terminal once.
- `libs/router/tests/document-links.test.ts` (fixture-documents, Chromium): document rows, no page code / server data in client assets, links load documents, throwing client render → document, back to a document route → document.
