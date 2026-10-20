# Route server code

File routes (`@rivetjs/router`) keep server code next to the page. The compiler removes it from browser builds.

## Wrappers (spec `docs/design/specs/2026-10-20-server-exports-design.md`)
- Server exports = module-scope `const` initialized by a wrapper call imported from `@rivetjs/router` (aliases / namespace members followed); export name free (docs defaults: `loader`, `access`, `forms`, `paths`, `responseHeaders`, `middleware`, `GET`…). One per kind per module (handlers: one per method). Same rule in page / layout modules, sibling `*.server.ts`, plain `.ts` endpoints.
- Tag: `Symbol.for("rivet.server")` = kind (own non-enumerable; functions = tagged `fn.bind(undefined)`, `actions` = tagged shallow copy). `server/module.ts` `serverExports` builds `ServerModule` by tag. Untagged magic names (`serverLoad`… `onOptions`; in siblings / endpoints also `load` `guard` `actions` `entries` `headers` `GET`…`DELETE`) → error (compiler RV3010 for route modules, language-core RV3010 + quick fix `rivetWrapServerExport`, runtime at first request).
- In a page/layout module (`x.tsx`, `_layout.tsx`):
  - `load((event) => …)`: data for the page (`data` prop).
  - `guard((event) => …)`: runs outer → inner before loaders; return a `Response` or throw `redirect()`/`deny()`.
  - `actions({ … })`: `{ name: (event) => result }` form actions (`POST ?/name`).
  - `entries(() => […])`: params for static prerendering.
  - `headers((event) => …)`: response headers.
  - `prerender`: plain flag (`export const prerender = true`).
  - `csrf`: plain flag; `export const csrf = false` in the route module skips the cross-site check (webhooks).
- Request handlers (Qwik-style), in `.tsx` pages/layouts and plain `.ts` routes:
  - `onRequest(…)` (any method), `onGet(…)`, `onPost(…)`, `onPut(…)`, `onPatch(…)`, `onDelete(…)`, `onOptions(…)` (stripped from browser builds).
  - Order per request: CSRF check (unsafe methods) → `onRequest(…)` → `on<Method>(…)` (per module, layouts outer → inner, then the route) → guards (outer → inner) → `headers(…)` → actions → loaders. Endpoint routes: the route's own `on<Method>(…)` answers after the guards.
  - Request handlers run before guards (Qwik-style contract): a handler that must not run for unauthenticated users checks itself; the CSRF check still runs before every handler.
  - Returned `Response` ends the request; thrown `HttpError`/`redirect()` as for guards; `undefined` continues.
  - Page routes: `on<Method>` is middleware; a non-GET method is allowed when the route module defines `on<Method>` (`undefined` → page renders).
  - Endpoint routes: plain `api/x.ts` exporting a handler (or `x.server.ts` without a page); the route module's `on<Method>` must return the `Response`.
  - Plain `.ts` files without handlers in the routes directory stay helpers (no route).
  - `OPTIONS` (CORS preflight): safe method (no CSRF check, no body limit); per module (layouts outer → inner, then the route's own module, page or endpoint) `onRequest(…)` then `onOptions(…)`; no guards, `headers`, loaders. No `Response` → `204` + `Allow` (route's methods + `OPTIONS`). Typical: `export const OPTIONS = onOptions(({ request }) => new Response(null, { status: 204, headers: { "access-control-allow-origin": … } }))`.
- `RequestEvent` (guards, loaders, actions, handlers): `request`, `url`, `params`, `locals` (shallow copy of the handler's `context.locals` seed, else `{}`; route-cache bypass when seeded), `signal`, `dev`, `platform`, `route.id` (file route id, `null` unmatched), `isDataRequest` (`?_rivet=data`), `cookies` (`get`, `getAll()` → `{ name, value }[]` with this request's sets/deletes applied, `set`, `delete`; header parsed on first access), `setHeader(name, value)`, `setHeaders({ … })` (`set-cookie` → TypeError: use `cookies.set`), `depends()` (loaders).
- `ServerExport<K, V>` types: `PageProps<typeof loader>`, `DataOf`, `ActionResultOf<typeof forms>` read the wrapped function / map; generated `.rivet/routes.d.ts` uses `ModuleData` / `ModuleActions` (export found by tag, any name).

## Security
- CSRF, every unsafe method (POST/PUT/PATCH/DELETE), page and endpoint routes, before `onRequest(…)`/`on<Method>`/guards/actions:
  - `Origin` present → must equal the request origin; else `Sec-Fetch-Site` present → must be `same-origin`.
  - Neither header + form content type (`application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`) → 403 (dev exempt). JSON/other types without either (non-browser clients) pass.
  - Opt out per route: `export const csrf = false`.
- Request origin = request URL origin. Node adapter (`serve`/`start`): `origin: "https://shop.example"` (fixed public origin) or `trustProxy` (proxies you run; default off: every `X-Forwarded-*` header ignored). TLS proxy without either → every action 403.
  - `trustProxy: true` / `1`: one proxy (the socket peer); `n`: the last `n` hops; `(address, hop) => boolean`: per hop from the peer inward (Express `trust proxy` function; first untrusted = client).
  - Client address (`event.platform.clientAddress`) = the `X-Forwarded-For` entry the outermost trusted proxy appended (right to left; client-sent entries left of it are ignored); `X-Forwarded-Proto` / `X-Forwarded-Host` read at the same hop (leftmost value when the header has fewer entries).
  - Breaking (2026-10): `trustProxy: true` used the leftmost (client-spoofable) `X-Forwarded-For` / `-Proto` / `-Host` value; now the rightmost (one hop). Chains of several proxies: `trustProxy: <count>`. Fetch adapter: request URL as the platform gives it, or `origin` (see [routing.md](routing.md#file-routes-deploy-adapters)).
- `event.platform.clientAddress`: client IP (node adapter; fetch adapter via `address`). Fetch adapter: `event.platform.env` / `event.platform.ctx` = `fetch(request, env, ctx)` arguments.
- `redirect(location, status?)` / `redirect(location, { status?, external? })` / `redirect(location, status, { external })`:
  - Relative targets ok; absolute URL ok when its origin is the request's.
  - `//x`, `/\x`, `\x`, control characters → throws at the call; other origin → 500 (`external: true` required, http(s) only).
  - User-supplied targets (`?next=`): `safeRedirect(target, fallback)` from `@rivetjs/router`.
- Body limit: `maxBody` (`createApp`/`createHandler`/`start`; number or `{ default, multipart }`; default 1 MiB, multipart 10 MiB). `Content-Length` checked first, then counted while streaming → 413.
- Data requests (`?_rivet=data`, client navigation): a `Response` from `onRequest(…)`/`on<Method>`/guards → 3xx: `{ redirect }` (client: same origin → in-app replace, else `location.assign`); other → `{ reload: true }` (client loads the document). Enhanced action requests get 3xx Responses as `{ redirect }` too.
- Action names end at `&`: `POST ?/save&next=/b` runs `save`. Malformed percent-encoding in the name → 400 (after the CSRF check).
- Data requests with `_rivet_keep=<layout ids>` skip only those layouts' loaders (client still has their data); every request handler and guard still runs ([routing: nested layouts](routing.md#file-routes-nested-layouts)).
  - **Access control belongs in `guard(…)` (or `onRequest(…)`), never in a layout `load(…)`**: `_rivet_keep` is client-controlled, so a layout loader that throws `deny()`/`redirect()` is skipped by `?_rivet=data&_rivet_keep=/` and the page loader below it runs anyway. Dev logs a hint the first time a layout loader answers 401/403/redirect.
- A `Response` returned by `onRequest(…)`/`on<Method>`/a guard/an action/an endpoint keeps what the request set: `cookies.set`/`delete` are appended, `setHeader`/`headers()` values fill in headers it lacks (its own win); immutable headers (`Response.redirect()`, proxied `fetch()`) are copied. A cookie makes it `Cache-Control: private`.
- Data/enhanced requests: a Response `Location` that is not an http(s)/relative target (`javascript:`, `//x`, control characters) → `{ reload: true }` (document load), never `{ redirect }`. The client follows `{ redirect }` only to http(s) URLs.
- Form actions: only own function members of `actions(…)` (`?/toString`, `?/__proto__` → 404 unknown action).
- `cookies.set` validates: `path` (no `;`/control chars), `domain` (host name), finite `maxAge`, valid `expires`, `sameSite: "none"` needs `secure`, `__Secure-`/`__Host-` prefix rules, name + value ≤ 4096 bytes → `TypeError`.
- Render failures: before the first body byte → the `_error` page with 500 + digest (`phase: "render"`); after it (streamed boundaries) → the document ends cleanly with a nonce'd script dispatching `rivet:resume-error` (`detail: { phase: "render", digest, error }`), reported to `onError` with the same digest.

## Browser build
- Compiler option `serverExports` (the router sets it for route modules): server exports, plus module-scope functions/variables/imports only they use, are removed (fixpoint over references; type references do not count).
- Removal keeps byte positions and lines → source maps, diagnostics and resume symbol ids match the server compile.
- Compile errors (both targets):
  - Browser code references a server export.
  - Browser code uses an import from a server-only module (`*.server.*`, `node:*`, `@rivetjs/router/server-only`).
  - A server export shares a declaration with browser exports (`export const loader = load(…), x = …`) (RV3007).
  - A wrapper used anywhere but as a module-scope `const` initializer (RV3007); two exports of one kind (RV3007 "Duplicate server export").
  - An untagged export with a former magic name (RV3010).
  - `export *` in a route module.
  - Resume mode: server-only code renders JSX.
- Secrets live in `*.server.ts` modules (or modules with `import "@rivetjs/router/server-only"`). Browser imports of those fail the build — the guarantee does not depend on removal alone. Type-only imports (`import type { X }`, `import { type X }`) are allowed (erased before bundling).

## Server reach (SERVER-REACH, spec `docs/design/specs/2026-10-20-server-reach-design.md`)
- Server-only = marker `@rivetjs/router/server-only`, `*.server.*` files, `rivetRouter({ serverOnly })` / `rivet({ serverOnly })` patterns (string id/specifier or RegExp), plugin-declared ids (`api.rivetServerOnly`, e.g. docs-kit `virtual:docs/api`).
- Pre-build graph scan (`build/reach.ts`, router `configResolved`): browser import graph of every page / layout / error page (Vite resolver, client conditions; node_modules, `?query`, `\0` ids not followed; other plugins' virtual modules matched by specifier only).
- Page reaching server-only through its own module / non-component helpers (or importing the marker) → **document route**: codegen `modules[n] = [PATHS[n], _endpoint]` (links load the document, no prefetch), client build page import → throwing stub `\0rivet-document-page:<page>`; server unchanged.
- Through a component (`.tsx` / `.jsx` other than the page) on a client-navigated page → **RV3011** error (chain + routes); `serverOnly: { modules, reach: "warn" }` → warning + document route. Layouts / error pages → always RV3011.
- Imports reached only from document-only graphs → stand-in Proxy (`serverOnlyStub`, compiler `server-only.ts`): throws `<id> is server-only; reached from <chain>` on any use. Other browser imports: the existing hard error.
- Dev: re-analysis on route / source change; RV3011 on page load → terminal (once) + error overlay.
- Router fallback (`client/index.ts` `recover`): uncaught `error` / `unhandledrejection` during a client navigation (after the history push, until a frame after the swap) → `location.replace(href)`; sessionStorage `rivet:recover` guard (same URL within 10 s skipped); dev waits for the Vite overlay (`_recover.defer`).

## Sibling `*.server.ts`
- Same wrappers; merged with in-file exports (`mergeServer`). Same kind in both → error at first request.
- Re-exports from server-only modules (`export { access } from "./auth.server.ts"`) are server exports of kind `?` (resolved at runtime by tag).
- Codemod for apps on the former names: `rivet migrate server-exports [--routes src/routes] [--dry-run]` (bin of `@rivetjs/router`). Scope-aware renames (TypeScript language service; references such as `typeof import("./x.server.ts").load` → `.loader` follow), then wrapper calls + router import; unsupported shapes skipped and reported.

## Types
- Generated per-route props (`.rivet/routes.d.ts`, type-only, zero runtime bytes):
  - `PageProps<"items/[id]">`: `params` from the file path (`[id]` → `id: string`, `[[lang]]` → `lang?: string`, `[...path]` → `path: string`), `data` from the route's `load(…)` (in-file or sibling `.server.ts`; `undefined` without a loader).
  - `LayoutProps<"items/_layout">`: layout id = file path without extension (`_layout` = root). Accessors kept: `data()`, `params()`. Root layout params `{}` (stays mounted); nested layouts: the pages' params (optional unless every page under it has it).
  - `actionResult<"items/[id]">()`: union per `actions(…)` name (`{ name, result, status? }`); `actionResult<"items/[id]", "save">("save")` narrows to one action. Success → its return value (`redirect()`/`Response` excluded); `fail(status, data)` → `result: data`, `status: number`. Also `actionResult<typeof forms>()`, `ActionResultOf<…>`.
  - Unknown id (typo, renamed file) → `data`/`params` unusable (`UnknownRoute`); bad action name → error.
  - Generated interfaces: `RouteParams`, `RouteData`, `RouteActions` (route id), `LayoutParams`, `LayoutData` (layout id).
- Hand-written forms still work: `PageProps<typeof loader>` / `LayoutProps<typeof loader>` (data inferred, `DataOf`), `PageProps<Item[]>`, `PageProps<Item, { id: string }>`.
- Serializability check (all forms): functions or class instances in loader data → type error on `data`. Opt out: `PageProps<Unchecked<typeof loader>>`.
- `RequestEvent<"items/[id]">`: params from the route id (`RouteParams`, generated).

## Dev server
- Editing a route file regenerates the route table (adds/removes in-file exports) → full reload when it changed.
- Editing server-only code (`*.server.ts`, an in-file loader) sends `rivet:data` → the page refetches its data and re-mounts (state resets).

## Example
```tsx
// src/routes/items/[id].tsx
import { fail, notFound, type PageProps, type RequestEvent, load, actions } from "@rivetjs/router";
import { actionResult } from "@rivetjs/router/client";
import { db } from "../../services/db.server.ts"; // removed from the browser build

export const loader = load(async ({ params }: RequestEvent<"items/[id]">) => {
  const item = await db.item(params.id);
  if (!item) throw notFound();
  return item;
});
export const forms = actions({
  rename: async ({ request, params }: RequestEvent<"items/[id]">) => {
    const title = String((await request.formData()).get("title") ?? "").trim();
    if (!title) return fail(400, { error: "Title required" });
    await db.rename(params.id, title);
    return { renamed: true };
  },
});
export default function Item({ data, params }: PageProps<"items/[id]">) {
  const failed = actionResult<"items/[id]", "rename">("rename");
  return <h1>{data.title} ({params.id}) {failed?.status !== undefined ? failed.result.error : null}</h1>;
}
```
- Live demo: playground `/slots` (`load(…)`, `onGet(…)` → `/slots?format=json`), `/api/time` (plain `.ts` endpoint).
