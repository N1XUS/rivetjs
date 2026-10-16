# Core-libs review — verified verdicts (2026-10-06)

Companion to [2026-10-06-core-libs-review.md](2026-10-06-core-libs-review.md). Each claim re-checked against the tree with probes (Node 26, Chromium, desktop CPU). Verdicts: **DO** · **MEASURE-FIRST** (A/B before merge) · **DEFER** · **REJECT** · **USER** (needs a ruling).

## Cross-cutting
- v2 gating (`dom_v2.rs:142-144`) confirmed; i18n disable is per module (only modules importing a static-call binding), not per app.
- "v2 control flow is the krausest size loss" — **false**: krausest imports only `For` + `mount`.
- dev ≠ prod confirmed: `vite.ts:634` `domV2` only in build; `dev.ts:90-92` binds `set`; `dom-resume.ts:7` bypasses the dev façade.
- Diagnostics classified by message prefix (`diagnostics.rs classify()`); no warning tier.
- ssr-bench covers neither `@rivetjs/router` nor `<For>`.

## §1 Server
| # | Verdict | Note |
| --- | --- | --- |
| S1 | DO | lazy AbortController (`work.signal` getter); 2.6 µs/Async boundary. Reject "skip abort when settled". |
| S2 | DO | codegen `once()` import memo + `mergeServer` WeakMap; watch HMR staleness. |
| S3 | DO | node adapter: index `dist/client` at startup (35 µs/req realpath miss); `static: "fs"` opt-out. |
| S4 | DO (coalesce) / DEFER (direct node writer) | ~13 µs/page. |
| S5 | DO | skip re-admission of admitted COMPILED children (quadratic in depth). |
| S6 | USER | `walk_server` `omitted()` slot for arrow handlers; compile.rs scope ("event-handler emission flags"?). |
| S7, S8 | DO | hoisted frozen resume fragments; LOADER/STREAM as cached fragments (~6 KB encode/page). |
| S9 | DO | array collector + frozen EMPTY (2–3× per binding). Reject forwarding reads to outer collector. |
| S10, S14, S20 | MEASURE-FIRST | context walk per token; resume key repetition; per-render WeakMap/WeakSet. |
| S11 | REJECT (compiler) / MEASURE (runtime name classification cache) | |
| S12 | REJECT | compile.rs lowering, out of scope. |
| S13 | DO | `<For>` page + router lane in ssr-bench (gate for the rest). |
| S15 | DO (guards, lazy cookies, empty byURL, lazy head groups) / REJECT (trust Content-Length) | |
| S16 | DO | params on hit, first-segment buckets keeping declaration order. |
| S17 | DO (layout guard/loader check bug) / DEFER (concurrency) | |
| S18, S19 | DEFER | |
| S21 | DO | dev `createApp` cache keyed by entry namespace. |
| S22 | DO (runtime dead branches) / REJECT (compile.rs, `experimentalServerDirect` is used) | |

## §2 Client
| # | Verdict | Note |
| --- | --- | --- |
| C1 | DEFER | v2 resume (Phase 8 of beat-everyone plan); trace first. |
| C2 | DO | `data-r` index (8.45 → 0.38 ms / 1,000 lookups). |
| C3 | DO | v2 `_show` / `_switch` (~2.2 kB brotli per app using Show), v1 semantics kept. |
| C4 | DO (static select/option/textarea, `preload=` diagnostic) / DEFER (`model:`/`prop:`, per-subtree fallback, i18n) | |
| C5 | USER | lazy `fallback` = semantic change + compile.rs scope. |
| C6, C7, C11, C12 | MEASURE-FIRST | loader expand (3–6 ms cold); reactivity node layout (reactivity bench now runs: create 4.79 vs Solid 2.98 ms); `_for` copies; template tag/quote omission. |
| C8 | DO (`fn` only) | clearing `value` would change disposed-computed reads. |
| C9 | DO | `produce` copy-on-write (92.5 ms/op @100k). |
| C10, C15 | DEFER / REJECT | measured cost negligible. |
| C13 | DO (sweep/cap prefetch, abort on nav, memo last match, drop dead `x-rivet-data`) / USER (intent delay) | |
| C14 | DO | data property instead of getter closure in `at()`. |
| C16 | DO | `_observeBindings()` only with a hook; drop unread rings; USER: reset stacks on close. |

## §3 API
A1 USER (rec: dev this-check, 0 prod B) · A2 DO dev warning · A3 USER (rec: `mount` alias of `render`, @deprecated) · A4 DO diagnostic for `each={xs()}` dev≠prod · A5 USER (rec: status quo + rule table) · A6 DO @internal + stable debug API · A7 USER (rec: warn on unknown keys) · A8 DO route.id / isDataRequest / setHeaders / cookies getAll / OPTIONS; DEFER parent() · A9 DO · A10 DEFER ABI rename, DO `css.layers` → `layerOrder` alias · A11 DO devtools link bug (`ui/link.ts:25-26`) + request timeout · A12 REJECT.

## §4–5 DX / diagnostics
D1 USER (publish) · D2 DEFER façade, DO quick-start doc · D3 DO dev resume observability · D4 DEFER · D5 DO docs gaps · D6 DO `rivet-check` (`--help`, `--format json`, exit codes) · D7 DO Link rest/active + `trailingSlash`; USER others · D8 DO devtools a11y/perf · D9 DO HMR option builder · D10 DO wasm panic hook + recreate · D11 DO bugs 1,2,4–8; USER #3 trustProxy · D12 DO stale docs · D13 DO zero-cost gate for router/forms/i18n/kit.
§5 minimal slice DO: codes + severity in `compile_json`, families RV5001–5003 / RV6xxx / RV4004, `libs/compiler/codes.json` + parity test, Vite `[RVnnnn]` + `pluginCode`/`url`; router RV31xx, runtime RV25xx.

## Implementation lanes (disjoint files)
H1 ssr-bench lanes · H2 runtime server (`server.ts`, `server-async.ts`, `server-resume.ts`, `template.ts`) · H3 resume client (`dom-resume.ts`, `resume-loader*`) · H4 reactivity (`index.ts`, `store.ts`) · H5 compiler (diagnostics slice, D9, D10, A4, C4, C12, C3 + `dom-v2.ts`) · H6 devtools (+ `reactivity/debug.ts`) · H7 router server/adapters/build · H8 router client + `runtime/router.ts` · H9 docs + zero-cost gate.

## User rulings (2026-10-06)
- S6 → DO (compile.rs `walk_server` arrow/function-literal handlers, inside the event-handler-emission exception).
- C5 → REJECT (fallback stays eager).
- A1 → DO dev-only this-check; dev no longer binds `set`.
- D11 #3 → DO `trustProxy` off by default.
- Open: A3, A5, A7, C13 intent delay, C16 stack reset, D1 publish, D7 router API shapes.
- Router matcher: indexed matcher stays in the browser (+226 B br per app accepted).
- compile.rs exception #2: spread + plain `style` merged into the spread object; textarea spread gets a `spreadChildren` slot.
- CSP `directives`: merge code loads via dynamic `import()` only when used (API unchanged).

## Rulings (round 2, 2026-10-06)

- Round-2 review (`2026-10-06-core-libs-review-round2.md`) executed in its suggested order; lanes SEC (resume security), RTR (router/node/devtools), BENCH (fair benchmarks: B1–B9), APP (real-app SSR path + eager JS: RA1–RA5, Z1–Z5), CLI (reactivity/DOM correctness + DOM perf losses), CMP (compiler U1, C2–C6, C14, T2, T6, T8, X2, P4 + compile speed).
- Standing goal: optimize every layer further; new algorithms and third-party libraries allowed when they win a measurement (still tree-shakeable, zero-cost).
- `compile.rs` opened for measured optimizations and round-2 fixes; each edit marked `// exception: user ruling 2026-10-06 (round-2 <item>)` and listed in `libs/compiler/rust/CLAUDE.md`.
