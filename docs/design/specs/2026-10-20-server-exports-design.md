# Route server exports are typed wrapper calls (2026-10-20)

- Status: **implemented** (lane SERVER-EXPORTS; the compiler part ships as a root-applied Rust patch + wasm rebuild). User ruling 2026-10-20: option A — every route-module server export becomes a wrapper call; the magic export names go, breaking, no aliases (experimental-framework rule).
- Replaces: magic in-file names `serverLoad` / `serverGuard` / `serverActions` / `serverEntries` / `serverHeaders` / `onRequest` / `onGet` / `onPost` / `onPut` / `onPatch` / `onDelete` / `onOptions`, and the legacy sibling `*.server.ts` names `load` / `guard` / `actions` / `entries` / `headers` / `GET` / `POST` / `PUT` / `PATCH` / `DELETE`. Those names appear in this spec, the migrate codemod and diagnostic texts only.

## 1. Problem

- Magic names: a typo (`onget`, `onGET`, `serverload`) is an ordinary export — silently a helper, no route, no error.
- `event` needs a manual type on every handler (`(event: RequestEvent) => …`).
- Two conventions (in-file names vs sibling names) normalized at runtime (`server/module.ts` `RENAMED` / `LEGACY`).

## 2. API

```ts
import { load, guard, actions, entries, headers, onRequest, onGet, onPost, onPut, onPatch, onDelete, onOptions } from "@rivetjs/router";

export const loader = load(async ({ params }: RequestEvent<"items/[id]">) => db.item(params.id)); // was serverLoad
export const access = guard(({ locals }) => (locals.user ? undefined : redirect("/login")));       // was serverGuard
export const forms = actions({ save: async ({ request }) => ({ ok: true }) });                      // was serverActions
export const paths = entries(() => [{ id: "1" }, { id: "2" }]);                                     // was serverEntries
export const responseHeaders = headers(() => ({ "cache-control": "max-age=60" }));                     // was serverHeaders
export const middleware = onRequest(({ url }) => undefined);                                        // was onRequest
export const GET = onGet(({ url }) => Response.json({ path: url.pathname }));                       // was onGet
export const prerender = true; // plain data exports keep their names: prerender, csrf, live
export const csrf = false;
```

- Export names are free (`getData = onGet(…)` works). The names above are the docs' / codemod's defaults: `loader`, `access`, `forms`, `paths`, `responseHeaders`, `middleware`, `GET` / `POST` / `PUT` / `PATCH` / `DELETE` / `OPTIONS`.
  - Not `data` for the loader: `function Page({ data }: PageProps<typeof data>)` is a circular parameter reference in TypeScript.
- Wrapper names = short kind names; no collision in `@rivetjs/router` (`index.ts` exports `redirect` `deny` `notFound` `error` `HttpError` `fail` `safeRedirect` `BASE` `withBase` `parseCookies` `slashPath` `TRAILING_SLASH` `isHttpError` `ActionFailure` `isActionFailure`). Local collisions (`const headers = …` at module scope) → alias: `import { headers as responseHeaders } from "@rivetjs/router"` (aliases are tracked by the compiler).
- Same rules everywhere: page / layout modules (`x.tsx`, `_layout.tsx`), plain `.ts` endpoints (`api/x.ts`), sibling `*.server.ts`.
- One per kind per module; request handlers: one per method (`onGet` + `onPost` fine, two `onGet` = error naming both exports). Two export names for ONE value (`export { loader, loader as other }`) are one export.

### 2.1 Typing

- `load<T, P>(fn: (event: RequestEvent<P>) => T): ServerExport<"load", (event: RequestEvent<P>) => T>`; `P` inferred from an annotated parameter (`RequestEvent<"items/[id]">`), else `Record<string, string>`. Same shape for `guard`, `headers`, request handlers (`Handler` result: `Response | void | HttpError`). `entries<T extends Iterable<object> | Promise<Iterable<object>>>(fn: () => T)` (no event; param objects may omit optional params — interfaces such as `{ id: string; path?: string }` accepted).
- `actions<A extends Record<string, ActionFn>>(map: A): ServerExport<"actions", A>` (`ActionFn` bivariant: annotated `RequestEvent<"id">` params are accepted).
- `ServerExport<K, V> = V & { readonly [SERVER_EXPORT]: K }` (`SERVER_EXPORT` = `Symbol.for("rivet.server")`, declared `unique symbol`): the tag survives `export { x as y }`, re-exports, `typeof` queries.
- `PageProps<typeof loader>` / `LayoutProps<typeof loader>` / `DataOf` / `Unchecked<typeof loader>` / `ActionResultOf<typeof forms>` / `actionResult<typeof forms>()` work unchanged (the tagged value is still the function / object).
- Generated `.rivet/routes.d.ts` finds exports by TAG, not name: `ModuleData<typeof import("./page")>` = `DataOf` of the export tagged `"load"` (`unknown` without), `ModuleActions<M>` = the export tagged `"actions"` (`{}` without). `InlineData` removed (one helper for in-file and sibling modules).

## 3. Runtime

- `shared/server-exports.ts` (imported by `index.ts`; browser builds never reach it: the compiler removes every wrapper call and then the unused import specifier).
- Tag = own non-enumerable property `Symbol.for("rivet.server")` whose value is the kind. `Symbol.for`, not a module-local WeakMap: the app's route modules and the server bundle's router may be different module instances (Vite SSR graph vs external package).
- Functions: the wrapper returns `fn.bind(undefined)` tagged (a fresh function: `onGet(h)` + `onPost(h)` with one `h` stay two kinds). Actions: a tagged shallow copy `{ ...map }` (own enumerable members; non-functions → `TypeError` at module evaluation). Wrong argument type → `TypeError("load() expects a function")`.
- `server/module.ts` `serverExports(module, file)`: per module object (WeakMap cache, as before) iterate its export names once, read tags → `ServerModule` keys (`load` `guard` `actions` `entries` `headers` `onRequest` `onGet` … `onOptions`), plus `prerender` / `csrf` by name. Errors (thrown at first request, file named): two exports of one kind; an untagged export with a magic name (`serverLoad`… / `onGet`…; in raw-loaded server modules — siblings, endpoints — also the legacy `load`… / `GET`…), with the wrapper fix in the message.
- `mergeServer(inline, sibling, files)`: one kind in both → error (unchanged). Generated loaders return normalized modules for siblings too (`once(async () => serverExports(await import(spec), file, true))`), so `loadServer(load)` = `load?.()`. `LEGACY` / `RENAMED` deleted; `ServerModule.GET`… deleted; endpoints answer from `on<Method>` only.
- Handler pipeline (`handler.ts`) unchanged.
- Cost: the scan runs once per module object (cached); per request nothing new. Browser: 0 bytes (wrappers stripped with their import).

## 4. Compiler (`libs/compiler/rust/src/server_split.rs`, `serverExports` option)

- Wrapper bindings: named imports of `load` `guard` `actions` `entries` `headers` `onRequest` `onGet` `onPost` `onPut` `onPatch` `onDelete` `onOptions` from `"@rivetjs/router"` (aliases followed: `import { load as l }`), and members of a namespace import of it (`import * as r from "@rivetjs/router"; r.load(…)`). Type-only imports ignored.
- Server binding = a module-scope `const` declarator whose initializer is a direct call of a wrapper binding (parentheses allowed). Its kind = the wrapper's imported name.
- Server exports:
  - `export const x = load(…)` — the statement's every declarator must be a server binding (mixed → RV3007 "Declare server exports … in their own export statement").
  - `export { x as y }` (no source) where `x` is a server binding → `y` (specifier removed; the declaration follows through the fixpoint and is also a root: kept code referencing it → RV3008).
  - `export { y } from "<server-only source>"` (`*.server.*`, `node:*`, `@rivetjs/router/server-only`) → `y`, kind `?` (unknown until runtime). Re-exports from other sources stay browser code: share server exports through `*.server.ts` modules.
  - A non-exported server binding is server code too (removed; kept references → RV3008).
- Any other value reference to a wrapper binding (`export default load(f)`, `const x = cond ? load(a) : b`, `load(f)` inside a function, `export let x = load(f)`) → RV3007 "Server export wrapper `load` must initialize a top-level `const`".
- Duplicates: two server bindings of one kind exported → RV3007 "Duplicate server export: `a` and `b` are both `load(…)`; keep one" (request handlers: per method).
- RV3010 (new): an export named `serverLoad` / `serverGuard` / `serverActions` / `serverEntries` / `serverHeaders` / `onRequest` / `onGet` / `onPost` / `onPut` / `onPatch` / `onDelete` / `onOptions` that is not a server export → "Untagged server export `onGet`: wrap it — `export const GET = onGet((event) => …)` with `import { onGet } from \"@rivetjs/router\"`". (Sibling legacy names are not route-module compiles; the runtime check covers them.)
- Output: `serverExports` (names, source order, unchanged meaning) + new `serverKinds` (parallel array: kind per name). `moduleFacts` gains `serverKinds` too.
- Same-length rewrites, fixpoint, RV3008 / RV3009 unchanged.

## 5. Router build

- `build/routes.ts` `_serverExportsOf(dir, files)` → per file the KINDS (from `moduleFacts(…).serverKinds`), plus `prerender` (regex, as before) and `live`. Prefilter: the source mentions `@rivetjs/router`, a `.server` module, `prerender`, `live`, or a magic name (so RV3010 still surfaces). Facts errors RV3010 / duplicates → thrown (route table cannot be built from a module that misdeclares exports).
- `routeTable(files, kinds)`: endpoint = plain `.ts` with a request-handler kind (or `?`); inline = any kind except `live`. The map's values are kinds (`"load"`, `"onGet"`, `"prerender"`, `"live"`, …) instead of names.
- `build/codegen.ts`: generated server loaders call `serverExports(module, file)` / `mergeServer`; types use `ModuleData` / `ModuleActions` for both module kinds.
- `build/vite.ts` server-only import error text: `fix: read it in a server export (load(…), actions(…), onGet(…), …)`.

## 6. Editor (`libs/language-core`)

- RV3010 in `analyzeFile` for route modules (files under the manifest's `routesDir`, `.ts`/`.tsx`/`.js`/`.jsx`): parser-only, same rule and message as the compiler (magic name, initializer not a wrapper call) — `libs/language-core/server-exports.ts`. The editor compiles without the `serverExports` pass, so no duplicate. tsserver analyzes `.tsx` / `.jsx` only (`isRivetFile`): plain `.ts` endpoints get RV3010 from the build (and the runtime).
- Quick fix `rivetWrapServerExport` "Wrap in `onGet(…)`": `export const onGet = (e) => …` → `export const GET = onGet((e) => …)`, `export async function serverLoad(…) {…}` → `export const loader = load(async (…) => {…})` (function expression when the body uses `this` / `arguments` / is a generator / has type parameters), in-file references renamed by symbol (one-file checker, as RV2003's fix), import added (merged into an existing value import of `@rivetjs/router`). Default names as §2; taken module-scope name → `<name>Export`; a module-scope local named like the wrapper → no fix; `export { x as onGet }` → no fix.

## 7. Migration

- `rivet migrate server-exports [--routes dir] [--dry-run]` rewrites route modules under the routes dir: in-file magic names and sibling legacy names → wrapper calls with the default names (§2), references renamed scope-aware across the project (TypeScript language service), import added. Collisions / unsupported shapes (`export { a as serverLoad }` with an old-named local, re-exports of old names) are skipped and reported.
- Import insertion: merged into a value import of `@rivetjs/router`, else a new line after the last import's line (its trailing comment stays); a module-scope local named like the wrapper → aliased import (`load as rivetLoad`).
- Every in-repo consumer migrated in the same change (router fixtures, docs examples, templates, nx generators, bench / demo apps, docs content, AI instruction sources). Not migrated: competitor lanes (`apps/editorial-bench/lanes/sveltekit` `load` is SvelteKit's).

## 8. Measured

- `scripts/zero-cost/packages-hashes.mjs` (minified own code per full public entry, before → after): `@rivetjs/router` 2250 → 3248 B (+998: the wrappers + tag, exported from the index; app browser bundles drop them: the compiler strips every wrapper call and its import, `sideEffects: false`), `@rivetjs/router/server` 27293 → 27565 B (+272: tag scan + messages), `@rivetjs/router/static` 9316 → 8531 B (−785: `LEGACY` / `RENAMED` / `GET`… paths gone). `runtime-hashes`: identical. Lanes (ssr-bench) need the new wasm.
- Per request: nothing new (one tag scan per module object, cached).
