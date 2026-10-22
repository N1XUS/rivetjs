# Server functions — design (2026-10-22)

- Status: **design only** (lane SERVER-FN). Implementation after M6-CUT lands (serialized resume deleted; derived model = the only resume model). Plan: [`plans/2026-10-22-server-functions.md`](../plans/2026-10-22-server-functions.md).
- Closes gap N-11 ([core gap analysis](2026-10-04-core-gap-analysis.md)): RPC today needs a route endpoint file (`routes/api/x.ts` + `onPost(…)`) or a page action. The `"use server"` directive was reserved by the [server-markers spec](2026-10-03-slots-and-server-markers-design.md) B3 / Q6 for this design.
- Builds on: router web-standard handler + CSRF / body limit / guards ([router design](2026-10-03-router-design.md), `docs/guides/server-code.md`), server-export wrappers + `Symbol.for("rivet.server")` tags ([server exports](2026-10-20-server-exports-design.md)), server reach ([server reach](2026-10-20-server-reach-design.md)), the router data codec (`encodeData` / `_decodeWire`, Date / Map / Set / BigInt / `undefined` / cycles), `resource()` ([resource](2026-10-20-resource-design.md)), derived model boundaries / keyed signals / wake lists ([structural resume](2026-10-18-structural-resume-design.md) §3.1–§3.4), forms `action(def, fn)` ([forms](2026-10-03-forms-design.md)).

## 1. Goal / non-goals

- Goal: call server code from browser code as a typed async function — `await addTodo({ title })` — with no route file, no hand-written `fetch`, no client bytes when unused, and the router's security model (CSRF, body limit, guards, `event.locals`) applied by default.
- Goal: the same call on the server (SSR, loaders, other server functions) is an in-process call: no HTTP, no codec.
- Goal: resumable by construction under the derived model — a stub is a module import, never captured state.
- Non-goals (v1): closures that capture component scope (`server$` inside a component), React Server Components / server-rendered JSX results, WebSocket / bidirectional channels (SSE helper exists, BACKEND-EXAMPLES), automatic per-request dedupe / client query cache (Solid `query`, TanStack Query), file uploads outside the forms path.

## 2. Upstream comparison

| Framework | Syntax | Where | Transport / id | Codec | Security defaults | Notes for Rivet |
|---|---|---|---|---|---|---|
| Next 15/16 `"use server"` | file- or function-level directive; inline in Server Components (closure vars encrypted into the action) | any server module; inline in RSC | POST to the page URL, `Next-Action: <hash>` header; ids rotate per build | RSC Flight (rich; CVE-2025-55182 Flight deserialization RCE) | every exported function in a `"use server"` file is a public endpoint; no input validation; Origin vs Host check | exposure by directive is the top footgun; closure encryption = key management; Flight decoding of untrusted input is an attack surface |
| SolidStart `"use server"` | directive in function body (any file) or file top | any module; closures allowed (captures serialized) | POST `/_server` + `X-Server-Id` (file + name hash) | seroval (rich, streams, promises) | no CSRF by default historically; `getRequestEvent()` via ALS | captures from the client = client-controlled inputs to server code |
| Qwik `server$` | wrapper `server$(fn)` anywhere, `$` lexical capture | anywhere (optimizer splits) | POST `?qfunc=<hash>` to the current URL | Qwik serializer (captures included) | `this` = RequestEvent; layout middleware does **not** run for `server$` | captures again; QRL async signatures; skipped middleware = auth holes |
| SvelteKit remote functions (2.27+, experimental) | `query` / `command` / `form` / `prerender` wrappers, schema first arg | only `*.remote.ts` files | `/_app/remote/<hash>/<name>`; `query` = GET (cacheable, batched, refreshable), `command` = POST | devalue | schema required (or `"unchecked"`); file kind is the boundary; `form` works without JS | closest fit: wrapper + dedicated file + schema + GET/POST split |
| TanStack Start `createServerFn` | `createServerFn({ method }).validator(…).middleware([…]).handler(fn)` builder, module scope | any module (compiler extracts `.handler`) | `/_serverFn/<id>` (file + export hash); GET or POST | seroval-ish JSON + streams | middleware chain (auth) explicit; CSRF via middleware | wrapper at module scope = statically splittable; builder is verbose |

Takeaways adopted: wrapper at module scope (TanStack, SvelteKit), dedicated server-only file as the boundary (SvelteKit), schema validation as a first-class option (SvelteKit, TanStack), middleware / guards always applied (lesson from Qwik), id = module + export hash (Solid, TanStack). Rejected: directives (Next / Solid), lexical captures (Qwik / Solid / Next inline), per-build random ids (Next: every deploy breaks open tabs).

## 3. Decisions

### D1 Syntax: `serverFn(…)` export in a server-only module

```ts
// src/lib/todos.server.ts            — server-only module (`*.server.*` or `import "@rivetjs/router/server-only"`)
import { serverFn, notFound } from "@rivetjs/router";
import * as v from "valibot";
import { db } from "./db.server.ts";

export const addTodo = serverFn({ input: v.object({ title: v.pipe(v.string(), v.maxLength(200)) }), guards: "todos" }, async ({ title }, event) => {
  const todo = await db.todos.insert({ title, owner: event.locals.user.id });
  event.invalidate("todos");                       // client router refreshes loaders that depend on "todos"
  return todo;                                      // { id: string; title: string; created: Date }
});

export const listTodos = serverFn({ input: v.object({ page: v.number() }) }, async ({ page }) => db.todos.page(page));
```

```tsx
// src/routes/todos.tsx                — browser code imports it like any function
import { addTodo, listTodos } from "../lib/todos.server.ts";
import { resource } from "@rivetjs/runtime/dom";

export default function Todos() {
  const page = signal(1);
  const todos = resource(page, (p) => listTodos({ page: p }));    // SSR: in-process; browser: RPC on page change
  return <button onClick={async () => { await addTodo({ title: "milk" }); todos.refetch(); }}>Add</button>;
}
```

- `serverFn(fn)` / `serverFn(options, fn)`; `fn(input, event)`. One input value (object for several arguments): one schema, one codec root, one size cap.
- Must be a module-scope `const` initializer of an export (same rule as route server exports, RV3007 family). The wrapper result is tagged `Symbol.for("rivet.server") = "fn"`.
- Must live in a **server-only module**. Browser imports of a server-only module resolve to a generated **facade** (`\0rivet-fn:<module>`) that exports one stub per imported `serverFn` name; any other imported name stays the existing hard error / SERVER-REACH verdict. The browser never sees the module's source, not even after a failed strip — no DCE reliance (the Remix / React Router leak class).
- Why not `"use server"`: exposure by directive (every export public), overloads the reserved directive, inline form needs closure capture → encrypted captures or client-controlled server inputs; Rivet's own ruling (server markers B3) already rejected it for loaders.
- Why not `server$(fn)` anywhere: captures cross the wire from the client (untrusted) into server code, needs per-closure Rust splitting in components (M6-CUT is rewriting that lowering), and a captured-scope RPC is exactly the object graph the derived model removed.
- Why not in-file exports in `.tsx` route / component modules (v1): needs a Rust `server_split.rs` extension for non-route modules and puts secrets one DCE bug away from the browser. Possible v2 (open question Q2): allowed in route modules where `serverExports` stripping already runs.
- Why not a new `*.remote.ts` suffix: `*.server.*` is already the secret boundary users know; one file kind = one rule ("server code lives in `.server.ts`; browser code may import its server functions").

### D2 Types

```ts
export interface ServerFnOptions<S extends StandardSchemaV1 | undefined> {
  input?: S;                                      // Standard Schema (Valibot / Zod / ArkType); output type = fn input type
  guards?: RouteId | readonly GuardExport[];      // D8
  maxBody?: number;                               // bytes, default the app's `maxBody.default` (1 MiB)
  csrf?: false;                                   // D5 opt-out (webhook-like callers), default strict
}
export interface ServerFn<I, O> {
  (input: I, options?: CallOptions): Promise<O>;  // browser: RPC; server: in-process
  readonly id: string;                            // D3
  readonly url: string;                           // `${BASE}_rivet/fn/<id>` (forms, `<form action>`, curl)
}
export interface CallOptions { signal?: AbortSignal; headers?: HeadersInit }
export class ServerFnError extends Error { status: number; data?: unknown; digest?: string; redirect?: string }
export function serverFn<O, I = void>(fn: (input: I, event: FnEvent) => O | Promise<O>): ServerFn<Wire<I>, Awaited<O>>;
export function serverFn<S extends StandardSchemaV1, O>(options: ServerFnOptions<S> & { input: S }, fn: (input: InferOutput<S>, event: FnEvent) => O | Promise<O>): ServerFn<InferInput<S>, Awaited<O>>;
```

- `Wire<T>` / return type checked against the router's `Serializable` (`libs/router/index.ts`, mirrors the codec): a function, symbol or class-with-methods in the input or output type is a type error naming the path (same machinery as `DataOf`).
- `FnEvent` = `RequestEvent` with `route.id: null`, `params: {}`, `fn: { id, name, module }`, `invalidate(key?)` (D9). `locals`, `cookies`, `setHeader(s)`, `signal`, `platform`, `dev` as for actions.

### D3 Ids and the allow-list

- `id` = 10 base-36 chars of FNV-1a 64 over `<module id relative to the Vite root>#<export name>`. Stable across deploys and body edits (open tabs keep working while the function exists; a renamed / removed function answers 404 → `ServerFnError(404)`). Not a secret: security comes from the allow-list + validation + guards, never from id obscurity.
- **Allow-list = functions the browser build imports.** The client build records every `(module, export)` pair a facade served (`.vite/rivet-fns.json`); the server build generates `\0rivet-fns` = `{ [id]: () => import(module).then((m) => m[name]) }` (lazy imports: startup cost 0 for unused modules). A `serverFn` only called in-process (loaders, other server functions) is **not an endpoint**. An id not in the map → 404 before any decode.
- Tag check: a registry entry whose export is not tagged `"fn"` → server startup error naming module + export (and a build error once the compiler reports `serverKinds: "fn"`, plan T7). Own-property lookup only (`Object.hasOwn`), never prototype names.
- Dev: the facade `load` hook registers its pairs in a dev map; the dev handler resolves `id → (module, name)` from it and loads through `ssrLoadModule` (HMR-fresh body each call).

### D4 Transport

- Request: `POST {base}_rivet/fn/<id>`, `content-type: application/x-rivet`, header `x-rivet-fn: 1`, `credentials: "same-origin"`, body = data codec `{ t, r }` of the input (`void` input → empty body). Under the router's base path; `_rivet/` stays reserved (no file route can claim it — route scanner error on a `_rivet` segment).
- Response: always `content-type: application/x-rivet`, `cache-control: no-store`; HTTP status mirrors the outcome (200 / 4xx / 5xx / 303 for logs and proxies); body = codec of one envelope:
  - `{ v }` value (+ `x` builtins chunk as for data answers);
  - `{ e: { status, message, data?, digest? } }` error (D7);
  - `{ redirect, status }` redirect (D7);
  - header `x-rivet-invalidate: <keys | *>` when the body called `event.invalidate()` (D9).
- Handler placement: `createHandler` checks `pathname.startsWith(FN_PREFIX)` **only when the generated entry passes `fns`** (no server functions → the branch and `server/fn.ts` are absent, zero cost). `server/fn.ts` loaded by dynamic import, like `deferred.ts` / `route-cache.ts`.
- Order per call: method check (POST only; v1) → CSRF strict (D5) → body limit (`maxBody`) → root layout `onRequest(…)` handlers (sessions → `event.locals`; rate limits) → registry lookup (404) → `guards` (D8) → decode (data-only, caps, D6) → `input` schema (400 with issues) → `fn` → encode.
- Streaming results (`AsyncIterable` / `ReadableStream` return): not v1; plan T13 (`application/x-rivet-stream`, one codec frame per chunk, the stub returns an `AsyncIterable`, abort = request abort).
- GET functions (`serverFn({ method: "GET" })`, idempotent reads, HTTP / route-cache cacheable, input in `?i=` ≤ 4 KiB): not v1; plan T12. SvelteKit's `query` / `command` split is the model.

### D5 CSRF

- Strict for function endpoints (stricter than pages): `Origin` present → must equal the request origin; else `Sec-Fetch-Site` present → must be `same-origin`; **neither → 403 whatever the content type** (pages let header-less JSON through for non-browser clients; a function endpoint has no such caller by default). Same origin resolution as pages (`origin` / `trustProxy` on the node adapter).
- The custom content type `application/x-rivet` + the `x-rivet-fn` header force a CORS preflight for any cross-origin `fetch`; the endpoint answers no CORS headers, so cross-origin calls fail in the browser before the POST.
- `csrf: false` per function: header checks skipped (machine callers); content type still required.
- Dev: same rules (browsers send `Origin` on every `fetch` POST).

### D6 Codec and limits

- Input (untrusted) = **data-only decode** of the router data codec: primitives, `undefined`, special numbers, BigInt, Date, URL, Map, Set, arrays, plain objects (decoded as null-prototype objects; `__proto__` / `constructor` / `prototype` keys kept as data, never assigned through setters), cycles. Refused (400): function / symbol / context / class / built-in-decoder entries (RegExp / binary / Error need the `resume-builtins` chunk — not accepted as input in v1), unknown entry keys.
- Caps: body ≤ `maxBody` (counted while streaming, 413), ≤ 65 536 table entries, nesting ≤ 64 (iterative decode, no recursion on attacker depth), string / bigint lengths bounded by the body. Exceeding → 400 `{ e: { status: 400, message: "Input too large" } }`.
- Output = the full data codec used for loader data (same `Serializable` rules as `DataOf`, built-in decoders via `x`), plus server-function references (`{F: id}`, D11). A non-serializable result → 500 in prod, dev error naming the path.
- Classes: not revived in either direction in v1 (`registerClass` is on M6's deletion list; untrusted `revive` = code on attacker data). Return plain data. Open question Q5.
- The browser encoder is a new data-only writer (`shared/fn-wire.ts`, target ≤ 450 B br) emitting the same `{ t, r }` table; the browser decoder is the existing `_decodeWire` (whatever M6-CUT keeps as the values codec — plan T0 confirms).

### D7 Errors and redirects

- Thrown `HttpError` (`error(status, message, data?)`, `deny()`, `notFound()`) → envelope `e` with its status / message / data → client rejects with `ServerFnError` (`status`, `message`, `data`).
- `input` schema failure → 400, `data = { issues }` (Standard Schema issues, path-keyed like forms `FormReply.issues`).
- Any other throw → 500, prod `message: "Internal error"` + `digest` (same digest as `onError`), dev: message + stack in `e`, Vite overlay (`phase: "fn"`) + terminal.
- `redirect()` (thrown) → envelope `redirect` (same-origin rules of `redirect()`; non-http(s) `Location` → `{ reload }` like data requests) → the stub navigates (`rivet:go` event = router `navigate`, `location.assign` without a router) and rejects with `ServerFnError { status: 3xx, redirect }` so awaiting code stops; `isRedirect(error)` helper for `catch` blocks.
- Network failure → `ServerFnError { status: 0 }`; abort (`options.signal`) → the `AbortError` passes through and the server's `event.signal` aborts.
- Typed expected outcomes: return a discriminated union (`{ ok: true, todo } | { ok: false, reason }`); thrown errors are for exceptional paths. No typed-throw machinery.

### D8 Auth: guards and locals

- Root layout `onRequest(…)` handlers always run (session parsing → `event.locals`, rate limits; they see `event.fn`). Layout / page `on<Method>` and loaders never run for a function call.
- `guards: "admin/users"` (typed `RouteId`): runs that route's guard chain (layouts outer → inner, then the route's own `guard`) with `params = {}` and the function's `event`; a guard reading params of a parameterised route gets `{}` (dev warning when the route id has params). Expresses "this function needs what that page needs".
- `guards: [requireUser, requireRole("admin")]`: explicit `guard(fn)` wrappers (typically exported from an `auth.server.ts`). Same contract as route guards: return a `Response` / throw `redirect()` / `deny()`.
- Default (no `guards`): only the root `onRequest` chain. Open question Q3 (root layout guards by default?).
- In-process calls (D10) run the declared `guards` too (a loader of a public page calling an admin function must not bypass the function's own guard); `onRequest` is not re-run (the page request already ran it).
- Rate-limit hook: no new API — `onRequest` in the root layout with `if (event.fn) …` (recipe in docs); `createApp({ onServerFn })` only if users ask.

### D9 Cache and revalidation

- Server: function bodies are server code; `revalidate({ path, tag })` from `@rivetjs/router/route-cache` purges route-cache / shell-cache entries as from an action.
- Client: `event.invalidate(key?)` → `x-rivet-invalidate` → the stub dispatches `rivet:invalidate` (`detail: key | "*"`) after resolving; the router (when booted) runs `invalidate(key)` (`event.depends()` keys of loaders) — the same event-coupling style as `rivet:go` (no router import in the stub). No router on the page → no listener, nothing happens.
- Single-flight (fresh loader data in the same response, Remix style) is a v2 option (`serverFn({ refresh: "route" })`): needs the current URL in the request and the route's loader pipeline inside the function call (plan T12 note).
- Response caching: POST never cached (`no-store`); GET functions (T12) take route-rule `cache` semantics.

### D10 Server-side (in-process) calls

- `await listTodos({ page: 1 })` in SSR / loaders / actions / other server functions calls `fn` directly: `input` schema runs (cheap, keeps the function's contract), declared `guards` run, no codec, no CSRF, no HTTP.
- The event comes from a **request scope** (`AsyncLocalStorage`, `server/fn-scope.ts`) the handler opens per request only when the app's server build contains `serverFn` (router usage scan flag in the generated entry). A call with no scope (a script, a test) throws `serverFn "addTodo" called outside a request: pass { event }` and accepts `addTodo(input, { event })` for tests / workers.
- Fetch adapters: `node:async_hooks` is already the only external of `dist/server/fetch.js` (Workers: `nodejs_als`). Gate: scope cost ≤ 1 % SSR CPU / page (plan T1 spike); else fallback API `fn.with(event)(input)` and no ALS.
- SSR results reach the browser through the normal channels only: `resource()` seed (below), loader data, keyed signal values. No hidden per-call cache in the page.

### D11 Derived-model interplay (the only resume model after M6)

- A stub is a module-level import of the boundary's chunk: handlers that call it are re-created by the boundary's adopt run, so **nothing about the function crosses the wire** (no handler records, no captures — D11 costs 0 B of state per call site). 10 server-function callbacks on a page = 0 B tail growth (gate, §5).
- Function reference as **data** (a prop, a keyed signal value, loader data): the server wrapper carries `Symbol.for("rivet.fn") = id`; the values codec writes `{F: id}`, the browser decodes to the memoised stub of that id (`_fn(id) === _fn(id)`; identity equal to the facade's export). So `<Row onSave={addTodo} />` keeps `Row` an **independent** boundary once compiler facts treat a named import from a server-only module as data (Rust patch C-FN-2, plan T7; until then the prop makes `Row` dependent — correct, just not lazy). A function not in the allow-list encoded as data → render error naming it (dev) / 500 (prod).
- Keyed signal writes inside a boundary across `await`: `onClick={async () => { saving.set(true); const t = await addTodo(x); batch(() => { todos.set([...todos(), t]); saving.set(false); }); }}`. Writes after the `await` run outside the event's `_dispatch` batch (each `set` flushes alone unless batched — documented; `batch` recommended). The first write to a revived keyed signal materialises its wake list even when it happens in a continuation (requirement; plan T8 test). A wake target whose chunk is not loaded yet: same path as any wake (the route closure chunk is already loaded because the handler ran from it).
- `resource(source, (s) => listTodos(s))`: server render calls in-process, the value is seeded by the existing resource resume slot (`server-resource-slot.ts`), the browser adopts it and calls the stub only on a source change / `refetch`. Suspense / transitions unchanged.
- Boundaries reading server-function results need no new flags: results are values.
- Chunks: the stub runtime (`client/fn.ts`, target ≤ 900 B br incl. the encoder) is imported by the facade, so it lands in the route closure chunk or the shared chunk per the merge rule; no extra request before input, no extra fetch at first call besides the RPC itself.

### D12 Forms on top

- `action(def, fn)` (page actions, `?/name`, progressive enhancement through the page) stays as is — it is the no-JS path and needs no change.
- New `formFn(def, fn, options?)` from `@rivetjs/forms/server` (v1.1, plan T11): a `serverFn` whose endpoint accepts `application/x-www-form-urlencoded` / `multipart/form-data` (forms `readForm` limits, `_intent` / `validate:<path>` handling) and answers a `FormReply`. Use: a form outside any route action (newsletter box in a shared layout, a dialog form in a component library) — `<form {...form.attrs} action={subscribe}>`; forms' enhanced submit posts to `subscribe.url` and applies the reply as today.
- No-JS for `formFn`: 303 back to the same-origin `Referer` with a one-shot flash (`rivet-fn` cookie, ≤ 4 KiB, `HttpOnly`, `SameSite=Lax`) that `createForm` reads on the next render. Open question Q4 (ship the no-JS path, or `formFn` = JS-only and page actions for no-JS).

### D13 Dev, HMR, diagnostics, docs tooling

- HMR: body edit → Vite SSR module invalidation; the next call runs the new body (dev handler loads via `ssrLoadModule`). Facade exports unchanged → no client update. Export added / removed / renamed → the facade module is invalidated → importers hot-update; the id of an unchanged export is unchanged.
- Error overlay: `dev-errors.ts` `phase: "fn"` (server stack via `ssrFixStacktrace`, function name + module); the browser stub logs `[rivet] serverFn addTodo (src/lib/todos.server.ts) failed: …` once per error in dev.
- Diagnostics (codes assigned at implementation from the next free `RV30xx` / `RV31xx`; docs pages generated by `docs-kit errors`):
  - error: `serverFn(…)` not a module-scope `const` export initializer (RV3007 family);
  - error: `serverFn(…)` in a module that is not server-only — "server functions live in `*.server.*` modules";
  - error (improved existing message): browser import of a name that is not a `serverFn` export from a server-only module — names the export and suggests wrapping it;
  - warning: `serverFn` without `input` whose `fn` reads its input (any shape accepted at runtime) — quick fix "add an input schema";
  - warning: function body reads `window` / `document` / `localStorage` / `navigator` (server-only code);
  - type errors (TS, no code): non-serializable input / output paths (D2).
  - "server function capturing client-only values" is impossible by construction (module scope only, server-only module, no lexical captures). The real mistakes left: the browser-global warning above, and a `.server.ts` importing a `.tsx` component / browser module for its values (server-side imports are legal, so language-core warns: "server function module imports browser code `<specifier>`").
- MCP / AI: docs page `guides/routing/server-functions.md` flows into llms.txt + MCP search automatically; `check_code` gets the diagnostics through language-core; AI instruction sources (`libs/mcp/ai`) get a "server functions" rule (where they live, schema, guards).

### D14 Security summary

- Exposure = only `serverFn` exports the browser build imports (allow-list, D3); never module internals, never other exports of the module; ids own-property checked.
- Every call: strict CSRF, body cap, root `onRequest`, declared guards, data-only decode with entry / depth caps, schema validation, no class revival, prod error masking with digest.
- The browser never receives server module source (facade instead of strip).
- Rate limiting via root `onRequest` (`event.fn`); `event.platform.clientAddress` for keys.
- Threats explicitly out: brute-forcing ids (ids are public anyway), timing of guard failures (same as pages).

### D15 Zero cost

- No `serverFn` import anywhere → no facade module, no `.vite/rivet-fns.json`, no `\0rivet-fns`, generated entry without `fns`, handler without the prefix branch, no request scope: runtime + lanes byte-identical (`scripts/zero-cost` gate), router entries' hashes unchanged.
- `serverFn` itself (server wrapper) lives in `@rivetjs/router` root (route-module API) as a separate leaf module; tree-shaken when unused. Client runtime `@rivetjs/router/fn` reached only from facades.

## 4. ABI summary (new names)

| Where | Name | Shape |
|---|---|---|
| `@rivetjs/router` | `serverFn`, `ServerFn`, `ServerFnOptions`, `FnEvent`, `ServerFnError`, `isRedirect` | D2 |
| `@rivetjs/router/fn` (browser) | `_fn(id, name?)` (memoised stub factory; `name` dev only) | facade import |
| `@rivetjs/router/server` | `createHandler({ fns })`, `createApp({ fns })` | `fns: Record<id, () => Promise<ServerFn>>` from `\0rivet-fns` |
| Vite (router plugin) | facade `\0rivet-fn:<module>`; `.vite/rivet-fns.json` `[{ id, module, name }]`; `\0rivet-fns` | D1 / D3 |
| wire | `POST {base}_rivet/fn/<id>`, `application/x-rivet`, `x-rivet-fn: 1`, envelope `{v}` / `{e}` / `{redirect,status}`, `x-rivet-invalidate` | D4 |
| values codec | `{F: id}` entry | D11 |
| events | `rivet:invalidate` (`detail`: key or `"*"`) | D9 |
| compiler facts | `serverKinds: "fn"`; server-only named import = data in boundary facts | plan T7 |

## 5. Measurement plan (gates)

- Client bytes per stub: facade cost for 1 / 10 functions (min + br) and the one-time `client/fn.ts` runtime; targets ≤ 900 B br runtime, ≤ 25 B br per extra stub. Size-report entries `router/fn` + a fixture route.
- Zero cost: `sh scripts/zero-cost/check.sh` identical for apps without `serverFn` (all existing lanes); new zero-cost line for `@rivetjs/router/fn`.
- Server CPU per call vs an equivalent page action and an equivalent `onPost` endpoint (same body, same input): in-process bench (autocannon-free: `createHandler` loop, 10k calls, interleaved A/B ≥ 5 rounds, load noted). Target ≤ endpoint CPU, ≤ action CPU (no page matching, no form parse).
- In-process call overhead: `listTodos(x)` vs calling the body directly from a loader (schema + scope lookup only); ALS scope cost per page request on ssr-bench `/resume` lanes with a dummy `serverFn` present (≤ 1 % CPU / page, else the D10 fallback).
- Resumability: a page with 10 server-function callbacks (buttons + a `<Row onSave={fn}>` list of 100 rows): state tail bytes vs the same page without the calls (target +0 B for callbacks, `{F}` entries only for data-position refs: ≤ 12 B br each), JS before input unchanged, first-click latency unchanged except the RPC.
- Round trip: click → RPC → DOM paint on the playground fixture (local, Fast 3G profile) vs the same mutation through an enhanced form action.

## 6. Risks

- Build-order coupling: the server registry depends on the client build's facade list. Assumption (verified in plan T1): the router's app build builds the client environment before the server one (the server entry consumes client outputs such as `.vite/rivet-route-css.json`); if not, the registry moves into a `generateBundle`-time file the server entry reads at startup. `rivet sync` / dev do not need it. A server-only build (`--ssr` alone) has an empty allow-list → every call 404 (dev message says why).
- ALS in hot path: measured gate, fallback API (D10).
- Async writes outside `_dispatch`: users forget `batch` → several flushes; correctness unaffected, perf note in docs; dev hint when ≥ 3 un-batched writes follow one RPC (cheap counter in the dev façade).
- Facade vs SERVER-REACH: a page importing only `serverFn` names from a server-only module must not become a document route (reach scan must see facade-eligible imports) — plan T6 changes `build/reach.ts`; regression tests for both verdicts.
- Codec drift after M6-CUT: the values codec is shared with loader data; plan T0 pins its surviving API before T3 starts.
- Skew: an old tab calling a removed function → 404 `ServerFnError`; a changed input schema → 400 issues. Documented; no version negotiation.

## 7. Open questions (user)

- Q1 Syntax confirmation: `serverFn` wrapper in `*.server.*` modules (recommended) vs SvelteKit-style dedicated `*.remote.ts` files vs Next-style `"use server"`.
- Q2 Allow `serverFn` exports inside route modules (`.tsx` pages / layouts) in v2 (needs a Rust `server_split.rs` extension + the DCE guarantee), or keep server-only modules as the only home?
- Q3 Default guards: none (explicit `guards`, recommended: predictable, like endpoints) vs the root layout's guard chain by default.
- Q4 `formFn` no-JS path (303 + flash cookie) in v1.1, or JS-only `formFn` and page actions for no-JS forms?
- Q5 Class instances in input / output: never (recommended, plain data) vs an explicit per-function `classes` allow-list once M6 decides `registerClass`'s fate.
- Q6 GET functions + HTTP caching (T12) and streaming results (T13): in the first release or after adoption feedback?
- Q7 Single-flight route refresh (`refresh: "route"`) in v1, or `invalidate()` keys only?
