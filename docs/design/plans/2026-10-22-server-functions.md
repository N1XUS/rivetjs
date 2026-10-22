# Server functions — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `serverFn(options?, fn)` exports in server-only modules, callable from browser code as typed async functions (RPC over the router's handler) and in-process on the server, zero cost when unused, resumable under the derived model without state.

**Architecture:** server wrapper in `@rivetjs/router` (tag `"fn"`); browser imports of a server-only module resolve to a generated facade of stubs (`@rivetjs/router/fn` `_fn(id)`); the client build records the allow-list, the server build generates a lazy registry; `createHandler` serves `POST {base}_rivet/fn/<id>` through `server/fn.ts` (strict CSRF → body limit → root `onRequest` → guards → data-only decode → schema → fn → encode); in-process calls read the request from an `AsyncLocalStorage` scope opened only in apps that use server functions.

**Tech stack:** TypeScript (Node 26 local / 24 CI, vitest, Playwright Chromium for browser suites), Vite 8 environments (router plugin), Standard Schema v1, router data codec (`encodeData` / `_decodeWire`), Rust/oxc compiler only through queued patches (T7).

**Spec:** [`docs/design/specs/2026-10-22-server-functions-design.md`](../specs/2026-10-22-server-functions-design.md) (decisions D1–D15, open questions Q1–Q7).

## Global constraints

- Starts after **M6-CUT** lands (serialized resume deleted; derived = only model). No task touches resume lowering before that.
- Open questions Q1 (syntax) and Q3 (default guards) must be answered before T2; Q2 / Q4–Q7 only gate their own tasks (T11–T13).
- Rust rule: compiler Rust is edited by the root / orchestrator only (or a lane in its own snapshot when the rule allows it at that time); T7 = patch files `$K/SERVER-FN-patches/NN-*.patch` + `.md` (what / why / emission before → after / verify), one wasm build by the root.
- Zero cost (D15): every task keeps `sh scripts/zero-cost/check.sh` identical for apps without `serverFn`; new entries get their own zero-cost lines (T5, T6) — `--update` only for those intended additions, listed in the commit.
- Perf first: T14 numbers decide the D10 ALS question and the stub-runtime budget; no semantic trade for bytes.
- Docs follow code: each task updates the nearest `CLAUDE.md` (`libs/router/{,server,client,build,shared}/CLAUDE.md`, `libs/forms/CLAUDE.md`, `libs/language-core/CLAUDE.md`, `libs/compiler/CLAUDE.md`) + `docs/guides/server-code.md` / `routing.md` in the same change; T15 sweeps user docs, llms outputs, MCP data, AI files.
- Limits: vitest `--maxWorkers 1`, `NODE_OPTIONS=--max-old-space-size=1536`, `nice -n 10`, one browser project at a time, ≤ 3 GB tree RSS.
- `export PATH=/Users/denisseverin/.nvm/versions/node/v26.5.1/bin:$PATH`; `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`; repo root, absolute paths; zsh.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; `git add` own paths only.

## Gate commands

```bash
cd /Users/denisseverin/Projects/claude-test/rivet
export PATH=/Users/denisseverin/.nvm/versions/node/v26.5.1/bin:$PATH NX_DAEMON=false NX_ISOLATE_PLUGINS=false NODE_OPTIONS=--max-old-space-size=1536
# G-ROUTER
nice -n 10 npx vitest run --project router --maxWorkers=1
nice -n 10 npx nx run router:typecheck --output-style=static --skip-nx-cache
# G-FORMS (after handler / forms changes)
nice -n 10 npx vitest run --project forms --maxWorkers=1
# G-RT (codec / resource / derived hooks)
nice -n 10 npx vitest run --project runtime --project runtime-dev --maxWorkers=1
# G-LC (diagnostics)
nice -n 10 npx vitest run --project language-core --maxWorkers=1
node libs/docs-kit/cli.ts errors apps/docs --check
# G-ZC / G-SIZE
nice -n 10 sh scripts/zero-cost/check.sh
nice -n 10 npm run size-report -- --check
# G-DOCS
node libs/docs-kit/cli.ts check-content apps/docs --strict && node libs/docs-kit/cli.ts check-snippets apps/docs
node libs/docs-kit/cli.ts llms apps/docs --check && node libs/mcp/build-data.ts --check && node libs/mcp/ai/sync.ts --check
npm run format:check
```

## Tasks

### T0 — Prerequisites check (no code)

- [ ] Confirm M6-CUT landed; record which values codec survived (`encodeData` in `libs/router/server/handler.ts`, `_decodeWire` / `createEncoder` in `libs/runtime/resume-format.ts` or their successors) and whether `registerClass` / `resume-builtins` still exist (spec D6, Q5).
- [ ] Record answers to Q1 / Q3 at the top of this plan (status line).
- Output: status line here; no files otherwise.

### T1 — Spike: build order, facade resolution, ALS cost (throwaway snapshot)

- Files (snapshot only): `libs/router/build/vite.ts` (hack), `apps/ssr-bench` lane copy.
- [ ] Verify the router app build order (client environment before server) and that a client-env `resolveId` for `./x.server.ts` can return a `\0rivet-fn:` facade before the SERVER-REACH guard fires (`build/vite.ts` `resolveId`, `build/reach.ts`).
- [ ] Microbench: `AsyncLocalStorage.run` per request around `createHandler` on ssr-bench `/resume` 100 / 1000 rows (interleaved A/B, ≥ 5 rounds, load noted). Gate: ≤ 1 % CPU / page → ALS (spec D10); else the `fn.with(event)` fallback.
- [ ] Bytes: hand-written `client/fn.ts` draft (fetch + data-only encoder + envelope + error class) min / br. Gate: ≤ 900 B br.
- Output: `$K/SERVER-FN-T1.md` (numbers + verdicts), snapshot removed.

### T2 — Server wrapper + in-process calls

- Files: `libs/router/shared/server-fn.ts` (new; `serverFn`, `ServerFn`, `ServerFnOptions`, `FnEvent`, `ServerFnError`, `isRedirect`, tag `Symbol.for("rivet.server") = "fn"`, `Symbol.for("rivet.fn")` id slot), `libs/router/server/fn-scope.ts` (new; ALS scope `runInRequest(event, fn)`, `currentEvent()`), `libs/router/index.ts` (exports), `libs/router/shared/server-exports.ts` (kind `"fn"` accepted by `serverExports` without being a route export), `libs/router/server/module.ts` (ignore `"fn"` exports when building `ServerModule`).
- Interfaces: spec D2; `serverFn(fn)` / `serverFn(options, fn)`; server call `(input, { signal?, event? })` → validates `input` (Standard Schema `~standard.validate`, async allowed) → runs `guards` (T4 shares the guard runner) → `fn(input, event)`.
- Id: `fnId(moduleRel, name)` (FNV-1a 64 → 10 base-36) in `shared/fn-id.ts`, shared with the Vite side.
- Tests (`libs/router/tests/server-fn.test.ts`): tag + id stamping; schema pass / fail (Valibot, Zod, ArkType fixtures already in forms tests); no-scope call throws the named error; `{ event }` override; guard order; type tests `tests/server-fn-types.test.ts` (non-serializable input / output → error, `InferInput` / `InferOutput` mapping).
- Docs: `libs/router/CLAUDE.md` entry points + `shared/CLAUDE.md`; `docs/guides/server-code.md` "Server functions" section (draft, completed in T15).
- Gates: G-ROUTER, G-ZC (router root entry hash unchanged for apps not importing `serverFn`).

### T3 — Wire codec: browser encoder + hardened server decoder

- Files: `libs/router/shared/fn-wire.ts` (new; browser data-only encoder → `{ t, r }`), `libs/router/server/fn-decode.ts` (new; data-only iterative decoder with caps: entries ≤ 65 536, depth ≤ 64, refused entry kinds → `FnInputError`), envelope helpers `encodeFnAnswer(value | error | redirect)` next to `encodeData`.
- Interfaces: `encodeArgs(value): string`; `decodeArgs(text, caps): unknown`; the decoder output must equal `_decodeWire` for every accepted value.
- Tests: round-trip table (primitives, `undefined`, NaN / ±0 / ±Infinity, BigInt, Date, URL, Map, Set, cycles, null-proto objects, `__proto__` / `constructor` keys stay data); refusals (function / symbol / class / builtins entries, unknown keys, depth 65, 65 537 entries, truncated JSON); property-based fuzz with `fast-check` (root devDependency); parity test against `_decodeWire`.
- Measurement: encoder bytes (min / br) into `$K/SERVER-FN-T3.md`.
- Gates: G-ROUTER, G-RT (if the shared codec moved), G-ZC.

### T4 — Handler endpoint

- Files: `libs/router/server/fn.ts` (new; dynamic import from `handler.ts`), `libs/router/server/handler.ts` (prefix branch only when `options.fns`), `libs/router/server/security.ts` (strict CSRF variant `checkFnOrigin`), `libs/router/server/app.ts` + adapters `createApp` / `start` / fetch `create` (`fns` option pass-through), `libs/router/build/routes.ts` (route scanner error on a `_rivet` path segment).
- Behaviour: spec D4 order; D5 strict CSRF; D7 envelopes + HTTP status mirror; `cache-control: no-store`; `x-rivet-invalidate` from `event.invalidate()`; `onError` with `phase: "fn"` + digest; `event.fn` = `{ id, name, module }`; client abort → `event.signal`.
- Tests (`libs/router/tests/server-fn-handler.test.ts`, drive `createHandler` directly): 404 unknown id / non-own name; 405 non-POST; CSRF matrix (Origin same / other / missing + Sec-Fetch-Site variants, `csrf: false`); 413 body; 400 decode / schema (issues payload); guards: route-id chain + explicit list + `deny()` / `redirect()`; root `onRequest` sees `event.fn` and can answer (rate-limit recipe); prod error masking vs dev stack; redirect envelope + non-http `Location` → reload; invalidate header; `onError` phase.
- Gates: G-ROUTER, G-FORMS (handler shared), G-ZC (handler hash unchanged without `fns`: the branch is inside a `fns`-guarded block the generated entry never enables — verify with the zero-cost lanes).

### T5 — Browser stub runtime

- Files: `libs/router/client/fn.ts` (new; `_fn(id, name?)` memoised by id, `call`, `ServerFnError` re-export, redirect → `rivet:go` / `location.assign`, `rivet:invalidate` dispatch, abort pass-through), `libs/router/client/index.ts` (router listens to `rivet:invalidate` → `invalidate(key)`), `libs/router/package.json` (`./fn` export), `scripts/zero-cost` line for `@rivetjs/router/fn`, size-report entry.
- Dev twin: `client/fn-dev.ts` via the package `development` condition (named console errors, one per failure) — never in production (`dev-leaks.mjs` scan).
- Tests: `libs/router/tests/fn-client.test.ts` (happy-dom: fetch mock, envelopes → resolve / reject, redirect, invalidate event, abort, network failure status 0, memo identity); browser e2e in T6.
- Measurement: bytes vs the T1 budget.
- Gates: G-ROUTER, G-ZC (new line, `--update` for the addition only), G-SIZE.

### T6 — Vite integration: facades, allow-list, registry, reach

- Files: `libs/router/build/fn.ts` (new; facade `resolveId` / `load` for client-env imports of server-only modules: names from the importer's import statement (`es-module-lexer`, present in `node_modules` through Vite — add it as an explicit router devDependency/dependency if used at build time) checked against the module's `serverFn` exports; collect pairs; `generateBundle` → `.vite/rivet-fns.json`; server env virtual `\0rivet-fns`), `libs/router/build/vite.ts` (wire it; dev map + `ssrLoadModule` loader; HMR: facade invalidation on export-set change), `libs/router/build/reach.ts` (imports satisfied by a facade do not make a page a document route / RV3011), `libs/router/build/codegen.ts` (generated server entry passes `fns` only when the registry is non-empty; request-scope flag for D10).
- Export detection before T7: parse the server module's exports in TS (`es-module-lexer` export names) and confirm the `serverFn` wrapper by a scope-exact pattern check (`export const X = serverFn(` with the import from `@rivetjs/router` resolved); T7 replaces it with compiler `serverKinds`.
- Fixture: `libs/router/tests/fixture-fn/` (todos page + layout `onRequest` session + guard route + a component passing a function as a prop + a document route control).
- Tests: `libs/router/tests/server-fn-build.test.ts` (facade content, allow-list = browser-imported only, a server-only in-process function absent from the registry, non-`serverFn` import → build error naming it, zero-cost: fixture without `serverFn` emits no facade / registry / `fns`), `server-fn-browser.test.ts` (Playwright: click → RPC → DOM update; redirect; invalidate refreshes loader data; CSRF from a cross-origin page fails), `server-fn-dev.test.ts` (dev: body edit → next call new result, no client reload; export added → importer HMR).
- Gates: G-ROUTER (incl. the browser suites one at a time), G-ZC, G-SIZE.

### T7 — Compiler patches (queued for the root; no lane edits `.rs` on the main checkout)

- C-FN-1: `rust/src/server_split.rs` wrapper list + `serverKinds` / `moduleFacts`: `serverFn` (from `@rivetjs/router`, aliases followed) = kind `"fn"`; RV3007 family for non-module-scope / shared declarations; new error "server functions live in server-only modules" when the module is not server-only (the compiler receives `serverOnly` facts from Vite as an option).
- C-FN-2: boundary facts — a named import from a server-only module used as a component prop / child value counts as **data** in `calls[].data` (so `<Row onSave={addTodo} />` keeps `Row` independent, spec D11); `libs/compiler/facts-fixpoint.ts` (TS) consumes it.
- Patch files: `$K/SERVER-FN-patches/01-server-fn-kind.patch`, `02-server-fn-data-facts.patch` (+ `.md` each: emission / facts before → after for 3 cases, verify = `npx vitest run --project compiler`, `npx nx run compiler:parity`, `typescript-plugin:build`).
- After the root installs the wasm: T6 export detection switches to `serverKinds` (TS-only follow-up in `build/fn.ts`), compiler `CLAUDE.md` + `codes.json` entries.
- Gates: compiler tests, parity, G-ZC (corpus N/N), G-LC.

### T8 — Derived-model integration

- Files: values codec (post-M6 location) `{F: id}` encode for values carrying `Symbol.for("rivet.fn")` (server; registry membership check: not browser-callable → named render error) + decode to `_fn(id)` (browser, imports `@rivetjs/router/fn` lazily only when a `{F}` entry exists — the entry names the module like built-ins' `x`); `libs/runtime/dom-derived.ts` only if wake materialisation after `await` needs a fix.
- Tests: `libs/router/tests/server-fn-derived-browser.test.ts` on `fixture-fn` — (a) handler in an adopted boundary calls a stub; (b) keyed signal writes after `await` materialise the wake list (parent text updates, no reload); (c) `resource(page, listTodos)` SSR seed adopted without a browser call, source change → one RPC; (d) `<Row onSave={addTodo}>` × 100: rows stay unmaterialised until clicked (after C-FN-2), `{F}` entries in the tail; (e) 10-callback page tail bytes = baseline + 0 for handler-only use.
- Measurement → T14 table.
- Gates: G-RT, G-ROUTER, derived fuzz shards untouched (no cdk / ui change).

### T9 — Dev experience

- Files: `libs/router/build/dev-errors.ts` (`phase: "fn"` overlay + terminal), `client/fn-dev.ts` (named failure logs), dev envelope stack (dev only).
- Dev hint: ≥ 3 un-batched signal writes in the same task after one RPC resolution → one console hint "wrap writes after await in batch()" (dev façade counter; production none).
- Tests: `libs/router/tests/server-fn-dev.test.ts` additions (overlay payload, dev-leak scan clean).
- Gates: G-ROUTER, G-ZC (dev leaks: none).

### T10 — Language-core diagnostics + explain pages

- Files: `libs/language-core/` (rules: no input schema warning + quick fix "add an input schema" (inserts `{ input: v.unknown() }` with the project's schema lib if detectable, else a TODO comment), browser globals in a server function body warning, `.server.ts` importing browser modules warning, improved non-`serverFn` import error message), `libs/language-core/explain.json`, `libs/compiler/codes.json` (codes from T7), generated `apps/docs/content/errors/RV*.md` (`docs-kit errors`).
- Tests: `libs/language-core/tests/server-fn.test.ts` (each diagnostic + quick fix output).
- Gates: G-LC, `typescript-plugin:build`, G-DOCS (errors `--check`).

### T11 — Forms: `formFn(def, fn)` (gated on Q4)

- Files: `libs/forms/server/form-fn.ts` (new; `serverFn` with form content types: `readForm` limits, `_intent` / `validate:` handling, `FormReply`), `libs/forms/enhance.ts` / `submit.ts` (enhanced submit posts to `fn.url` when the form's `action` is a server function), `libs/router/server/fn.ts` (accept form content types for `formFn`-tagged functions only; strict CSRF unchanged → header-less form posts 403 as today outside dev), no-JS path per Q4 (303 to same-origin `Referer` + one-shot `rivet-fn` flash cookie read by `createForm`).
- Tests: `libs/forms/tests/form-fn.test.ts` (handler-driven: valid / invalid / intent / files / limits), browser e2e (enhanced submit from a layout form; no-JS round trip if Q4 = yes).
- Docs: `libs/forms/CLAUDE.md`, `docs/guides/forms.md`, `apps/docs/content/guides/forms/**`.
- Gates: G-FORMS, G-ROUTER, G-ZC.

### T12 — GET functions + caching (gated on Q6 / Q7)

- `serverFn({ method: "GET" })`: input in `?i=<encoded>` (≤ 4 KiB, else 414), no CSRF (documented: must be side-effect free; dev warns on `cookies.set` / `setHeader("set-cookie")` inside a GET function), route-rule `cache` / `swr` keyed by id + input, `revalidate({ tag })` drops them. Optional `refresh: "route"` single flight (Q7): the stub sends the current URL; the answer carries fresh loader data like enhanced actions.
- Tests + docs as T4 / T6. Gates: G-ROUTER, G-ZC.

### T13 — Streaming results (gated on Q6)

- `AsyncIterable` / `ReadableStream` return → `application/x-rivet-stream` (length-prefixed codec frames), stub returns an `AsyncIterable` (abort = `return()` → request abort → `event.signal`), errors mid-stream as a final error frame; in-process calls return the iterable unchanged.
- Tests: handler + browser (progressive list render; abort on dispose). Gates: G-ROUTER.

### T14 — Measurement

- Fixture: `apps/ssr-bench` in-process bench `spikes/server-fn/` (or `libs/router/tests/bench/` if ssr-bench lanes must stay untouched): server CPU per call vs equivalent page action vs `onPost` endpoint (10k calls, interleaved, ≥ 5 rounds); in-process call overhead vs direct body call; ALS scope cost per page (ssr-bench `/resume` with a dummy `serverFn`); client bytes (stub runtime, per-stub, facade for 1 / 10 functions); resumability (10-callback page: tail bytes, JS before input, first-click latency excluding the RPC; 100-row `onSave` page: `{F}` bytes, rows materialised); round trip click → paint vs enhanced form action (local, Fast 3G).
- Output: `docs/benchmarks/2026-10-XX-server-functions.md` (+ `.json`), index line in `docs/CLAUDE.md`.
- Gates: numbers meet spec §5 targets or the report says which do not and why.

### T15 — Docs sweep

- User docs: `apps/docs/content/guides/routing/server-functions.md` (new: define, call, input schemas, guards, errors, redirects, invalidate, in-process calls, `resource()`, security model, rate-limit recipe, limits), `guides/routing/actions-and-forms.md` (when to use actions vs server functions vs `formFn`), `reference/glossary.md` ("Server function" entry — today the word describes loaders / guards / actions; reword those to "server code" to free the term), `start/coming-from-other-frameworks.md` (Solid `"use server"`, Qwik `server$`, Next server actions rows → `serverFn`), `reference/config.md` (`maxBody` applies), `learn/resuming.md` (server functions resume as module imports / `{F}` values).
- Internal: `docs/guides/server-code.md`, `docs/guides/routing.md`, `docs/guides/resumability.md`, every touched lib `CLAUDE.md`, root `CLAUDE.md` repo map row for `libs/router` (mention server functions), `docs/design/specs/2026-10-04-core-gap-analysis.md` N-11 implementation-log line, this plan's status lines, the spec's "As built" notes.
- Templates / AI: `libs/mcp/ai` sources (server-functions rule) → `node libs/mcp/ai/sync.ts` (starter AGENTS.md / CLAUDE.md / skills / Cursor / Copilot), `skills/` regenerated, MCP data `node libs/mcp/build-data.ts`, llms outputs via the docs build.
- Grep before finishing: `server\$`, `"use server"`, `endpoint (`routes/api` for RPC wording, "server function" in glossary-style sentences.
- Gates: G-DOCS, `NX_DAEMON=false npx nx run docs:build`.

## Order and lanes

- T0 → T1 → T2 → T3 → T4 → T5 → T6 (one lane, router-owned files; T3 can run beside T2).
- T7 patches queued right after T2 (facts only); root builds wasm once; T8 needs T6 + C-FN-2.
- T9, T10 after T6 (parallel lanes; T10 after T7 codes).
- T11 / T12 / T13 after their rulings; T14 after T8; T15 last (each task still carries its own CLAUDE.md / guide updates).

## Risks (plan level)

- SERVER-REACH interplay (T6): facade-satisfied imports must not flip pages to document routes, and a mixed import (`serverFn` + a constant) must still error — covered by build tests both ways.
- Build order (T1): if the client environment does not build first, the registry moves to a runtime-read JSON (`.vite/rivet-fns.json` shipped into `dist/server`), adding one startup read.
- ALS gate (T1 / T14): failing it switches D10 to the explicit `fn.with(event)` API — a spec change the user sees; report before T2 continues.
- Codec ownership after M6 (T0 / T3): if M6-CUT moved or renamed the values codec, T3's parity test targets the new one; no second codec.
