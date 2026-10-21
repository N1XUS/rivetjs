# Shell cache — partial prerendering for Rivet (lane PPR-SHELL, 2026-10-20)

- Status: **approved 2026-10-20** (user: "Ok" to the defaults below; build after M2 of the derived-client plan lands). Rulings: Q1 `shell: true` + `load(fn, { defer: true })`; Q2 opt-in per rule; Q3 server-composed holes, CDN-composed = follow-up F1; Q4 always shell + live holes; Q5 H-replay first, T6 only if replay misses 2×. Design only (no code). Answers the user's 2026-10-20 question "was Partial Prerendering checked?": yes, as the `shell` candidate in `2026-10-07-render-cache-design.md` (layout-only, resume-inert, prototype) and the PPR row of `2026-10-04-core-gap-analysis.md` (❌ vs Next ✅). This spec is the page-level, resume-aware version.
- Depends on: N-6 deferred loader data (gap analysis, not built) — T1 here. Builds on `server/route-cache.ts` (store, keys, `revalidate`), `server-resume.ts` `Stream` / `Segment` (segments + `rivet/state` patches), render-cache fragments (`server-cache.ts`).
- Not for fair-comparison lanes (`apps/ssr-bench` rule: no page / data caching). Measured on editorial-bench + an own fixture only.

## 1. PPR as shipped (Next 16, Cache Components)

- Model: one React tree; at build (or ISR fill) React `prerender` renders until every `<Suspense>` boundary whose content touches request data (`cookies()`, `headers()`, `searchParams`, unknown `params`, `connection()`) or uncached I/O; result = **static shell** (HTML incl. fallbacks + RSC payload for the shell) + `postponed` state (replay paths to the holes).
- Request: shell bytes go out at once (Vercel: from the edge cache; self-host: cache handler), origin `resume(tree, postponed)` re-executes components on the path to each hole (output suppressed) and streams the holes' HTML + RSC chunks into the **same response**.
- Granularity: `"use cache"` on functions / components (key = args + captured values + build id; `cacheLife`, `cacheTag`, `revalidateTag` / `updateTag`); cached output joins the shell; `use cache: private` / `remote` variants. Unknown params → "App Shell" (param parts behind fallbacks), ISR upgrades it in the background.
- Enforcement: dev / build validation ("blocking-route" insight) when a runtime API or uncached await sits outside `<Suspense>`; `Date.now()` / `Math.random()` / `crypto` flagged unless behind `connection()` or `use cache`.
- Buys: TTFB = CDN (shell independent of origin latency), FCP / LCP from the shell (header, hero, text), one round trip (holes not fetched separately).
- Costs: status + headers fixed by the shell (200; a hole cannot 404 / redirect / set cookies except via client script); resume re-executes the path to the holes (CPU not zero); HTML + RSC payload ≈ double bytes; dynamic metadata streams after the shell (bots get a full dynamic render, UA list); `use cache` serialization constraints; everything keyed by build id. Vercel post publishes no numbers (qualitative only).

## 2. Rivet today

| Piece | What it does | PPR-relevant limit |
| --- | --- | --- |
| Static prerender (`prerender`, static adapter) | whole page HTML at build | no holes; route rules ignored by static adapter |
| Streaming `Async` / `Suspense` (`server-async.ts`, `server-suspense.ts`) | shell written before any await; boundaries → `Segment` {A marker, F fallback region, M claimed region}, rendered later in a recorder view sharing `root.next`; written as `<template data-a>` + `rivet/state` patch + swap (`Stream.segmentChunk`) | holes need closures created by the shell render |
| Resume state | `tailOf` writes the shell's state script at the shell's end (`data-fo`, loader, chunks, symbols); patches append (symbol indexes per written segment, table `t0`, add-ons once per page); derived model `BoundaryTail` / `derivedPatch` | patch encoding depends on the shell's `Encoding` + add-on flags |
| Loaders | all loaders `Promise.all` before render (handler step 10) | first byte waits for the slowest loader (bench hint "loaders block the first byte") |
| `routeRules` `cache` / `swr` / `isr` (`route-cache.ts`) | whole buffered page, process-local, CLOCK, single flight, `revalidate({ path, tag })`, nonce → hash policy, validators; hit 0.023 ms CPU (editorial) | bypassed for `Cookie` / `Authorization`; holes frozen into the stored page |
| Render cache `shell()` (OPT-B) | layout fragments with live holes | resume-inert layouts only, no page state, not route-level |
| Ids | `withIdScope("rv")` per render; `_inIdScope` for probes / lazy rows | — |

- Already falls out: anonymous traffic on a page with `Async` holes + `swr` = the whole resolved page cached (better than PPR: 0 render, holes stale ≤ `maxAge`). Streaming TTFB on a miss = shell before awaits (but after loaders).
- Does not: (a) signed-in traffic (cookie → bypass → full render every request), (b) per-request-fresh holes (stock, cart, "for you"), (c) TTFB independent of loaders, (d) CDN-served shell.

## 3. Design: shell cache

### 3.1 Decisions

- D1 **Server-composed by default.** Stored shell prefix + live holes in ONE response from the origin process (Next self-host model). Client-composed holes (CDN shell + hole fetches, Astro server islands) = follow-up F1. Reason: one round trip, holes keep the existing segment / patch protocol, no new endpoint security surface (guards per hole fetch), personal data never in a CDN object.
- D2 **Opt-in rule** `routeRules: { "/blog/**": { shell: true } }` (or `shell: { maxAge, swr, tags }`, defaults = the rule's `cache` / `swr` values, else `isr` semantics in-process). Not inferred in v1: dev prints a hint for routes whose fills pass every check (§3.3) with ≥ 1 deferred boundary. Inference/default-on = decision ask.
- D3 **Holes = streamed boundaries reading deferred loader data.** Rivet components cannot read cookies / headers in render; request data reaches pages through loaders. So: non-deferred loaders = shell data (must not read request input outside the key); deferred loaders (T1, `load(fn, { defer: true })`, value `Deferred<T>` = a request-independent handle) = hole data, consumed by `<Async load={data.x}>` / `<Suspense>` + `resource(data.x)`. A handle resolves against the **current render's** deferred map (render scope), not a captured promise — the same handle object works in the fill and on every hit. **As built (T1, PPR-T01 2026-10-21): per-request handle capturing the loader's promise** — a render-scope handle failed `await data` (continuation outside the owner; would need AsyncLocalStorage). Consequence: H-replay (T3) is unaffected (live handles per hit); H-holes (T6) must swap a retained shell's handles for the hit's (frame swap) instead of reusing one object.
- D4 **Two hit strategies, picked per route at fill time.**
  - H-replay (T3, generic): write stored prefix → re-run the page with stored shell data + live deferred handles under a discarding writer and a shell-muted recorder (no HTML bytes, no state encode) → segments render and stream as today. Ids / sites match because the shell is request-independent (§3.4). CPU win = loaders + bytes + encode of the shell; TTFB win full.
  - H-holes (T6, compiler-proven): no shell execution; the entry keeps each boundary's content thunk (`load` + `children` closure) + its context frame; a hit runs only the thunks under a fresh root. Eligible when the compiler proves the thunk's captures are data consts / deferred handles / module refs (`_rFn` capture classes) and the frame holds no signals created in the shell. Else H-replay.
- D5 **CSP: nonce slots, not hashes.** The stored prefix is split at every `nonce="…"` the render wrote (sentinel nonce at fill, render-cache D2 fragments); a hit writes fragments + the live nonce. The response keeps the app's exact nonce policy incl. `'strict-dynamic'` (route-cache's hash conversion loses it: `import()` from a hash-trusted script is blocked in Chromium / Firefox, route-cache D5). Segments carry the live nonce as today. Sentinel found anywhere outside a strict `<script|style|link … nonce>` start tag → not stored (route-cache rule).
- D6 **Same store as route-cache**: entries of kind `shell` in `route-cache.ts`'s store (bytes charge, CLOCK, doorkeeper, single-flight fills, `filling` voids, `revalidate({ path, tag })`, cluster relay). One module, loaded only when a rule has `shell`.

### 3.2 Request flow

- Miss (fill): normal pipeline + render; `ShellRecorder` captures (a) the byte offset where `Stream.run` starts (= after `tailOf`; head hold already released), (b) the snapshot (§3.5), (c) the read log (§3.3); response streams to the filler as today (no buffering → TTFB of today's streaming). At render end: checks pass → store `{ prefix fragments, suffix (around.end + failure marker slot), snapshot, shellData, headers, tags, Vary }`.
- Hit: match → CSRF n/a (GET) → `onRequest` / guards / `headers()` **run** (unlike route-cache hits: auth redirects and per-visitor headers must still apply; cost ~30 µs) → write status + headers + prefix with live nonce → start deferred loaders with the live request (non-deferred loaders skipped, `shellData` reused) → H-replay or H-holes → `Stream.run` writes segments + patches → suffix.
- Bypass (serve as today, no store): non-GET, data requests (`?_rivet=data`: client navigation keeps the JSON path; F3), `x-rivet-cache: SHELL-BYPASS <reason>` header in dev.

### 3.3 Making the shell request-independent

- Allowed shell inputs = the key: origin, normal path (params), query per `query`, `varies` headers, locale variant, build hash.
- Read tracking (fill only, so ~free on hits):
  - Loaders: extend `LoaderEvent` getters (they already note `url` / `request` for `byURL`) with a per-loader read set: `cookies`, `request` (raw), `request.headers` (except `varies`), `url.search` / `searchParams` (unless `query`), `locals` (except declared partition keys, e.g. `locale`), the client address. A non-deferred loader with a forbidden read → fill not stored, reason = loader id + member.
  - Render: request-derived signals (router `url` / search context) read under the shell phase via `_trackReads`; search read without `query` in the key → not stored.
  - Deferred handles read outside a boundary in the shell (sync `.value`, `await` in a component) → dev throw with a fix hint ("wrap in `<Async>` / `<Suspense>`"), prod: not stored.
  - `Set-Cookie`, status ≠ 200, `cache-control: private|no-store` from shell loaders / headers → not stored. Deferred loaders cannot set headers / cookies / status (first byte already out): TypeError at the call, same as streaming after the head; their redirect / 404 / error → boundary error path (ErrorBoundary fallback segment, `caught`).
- Determinism: every boundary in a shell route streams (never inlined when its value happens to be ready before the shell end), so shell bytes never depend on loader timing. Dev verify (render-cache `verify`): each fill renders the shell twice (second pass with an anonymous detached request, `_rUnrecorded`) and compares prefix bytes + snapshot; mismatch → not stored, warn (clocks, random, module state).
- Fallbacks and the shell's head (kit `Head`) render in the shell → same rules. Head tags rendered inside holes keep today's streamed-head behaviour.
- Sticky off: a route whose fills fail checks 3× in a row stops attempting (counter per rule pattern; reset by `revalidate` / redeploy).

### 3.4 Ids and resume numbering

- `createId` (`rv` + n), resume sites (`data-r`, `rN` markers, `root.next`), segment markers A / F / M are allocated in render order. Shell = deterministic for a key ⇒ the counters at the shell end are a pure function of the key.
- H-replay: the replay recomputes them; hit asserts `fingerprint(replay) == snapshot.fingerprint` before the first segment: `{ next, idN, boundaries [A, F, M.id, parent], record counts per list, encoding sizes (chunks, symbols, events, table length) }`.
- H-holes: restore `root.next = snapshot.next`, id scope `{ prefix: "rv", n: snapshot.idN }`, region stubs `M` (id, `held`, `async`, parent id) from the snapshot; segments then allocate exactly as after a fresh shell.
- `_inIdScope` prefixes (`rv-<hash>-` render-cache probes, `rvr<forId>_<k>_` lazy rows) are key-derived already → stable.
- Content hash `h` (FNV-1a of prefix bytes with nonce slots blanked + fingerprint) written into the shell state (`h` field) and into every segment patch; `dom-resume` drops a patch whose `h` differs (dev error) — guards any future path where shell and holes come from different fills (F1 client-composed, CDN races).
- Mismatch on a hit (bug: nondeterministic shell that passed dev verify): entry evicted, route sticky off, `onError` (phase `render`, reason `shell-mismatch`), the response ends with the existing `failureMarker` + `<script nonce>location.reload()</script>` guarded by a `sessionStorage` once-flag; the reload gets a full render. Never streams holes against a mismatched shell.

### 3.5 Snapshot (what a hole render needs)

- Recorder: `next`, id counter, `used`, add-on flags (`rowsAddon`, `lazyAddon`, `expandAddon`, `repeatAddon`), derived-model tail state.
- Encoding: `chunks` / `chunkOf`, `symbols`, `events`, encoder table length + interned strings (patches reference `t0` / string refs) — stored frozen; a hit encodes patches against a **copy-on-write overlay** (base Maps read-only, per-hit Map for additions) instead of cloning.
- Preload plan: chunks already scheduled / in `data-fo` (segments must not re-list them).
- Boundaries: `[A, F, M, parent, frame]` in creation order; `frame` = the boundary's `owner.ctx` chain (H-holes only) with request frames (router url / params, request scope, nonce) marked so a hit swaps in the live ones.
- `shellData`: non-deferred loader results (frozen, `structuredClone` once at store; holes must not mutate — dev deep-freeze).
- Memory charge: prefix bytes + snapshot estimate (`JSON` length of the encoding state) + shellData bytes (encoded once with `encodeData` for the charge); thunks / frames uncharged → H-holes entries cap at `maxEntries / 4`.

### 3.6 Keys, Vary, cookies, headers

- Key = route-cache key (D3 there) + `\0shell`. Cookies / `Authorization` are **not** a bypass (the point of the feature) and never in the key; shell code cannot see them (§3.3).
- Response headers: `Cache-Control: private, no-cache` (holes are per visitor; the composed document is never shared-cacheable), `Vary` = shell's learned names ∪ `varies`, no ETag (body differs per request), `x-rivet-cache: SHELL-HIT | SHELL-MISS | SHELL-STALE`. `cdn` on a `shell` rule = TypeError at startup (until F1).
- `shell` + `cache` / `swr` on the same pattern: one rule; `shell` wins for documents, `maxAge` / `swr` / `tags` apply to the shell entry; anonymous requests could still take a whole-page `cache` entry first (option `anonymous: "page"`, decision ask Q4).
- Early hints: shell routes learn `Link` hints from the stored head (route rule `earlyHints` path unchanged); a hit can skip 103 (prefix arrives as fast).

### 3.7 Invalidation

- `revalidate({ path })` / `revalidate({ tag })` drop shell entries and void in-flight fills (shared store). Tags = rule `tags` ∪ tags set by non-deferred loaders (`event.tags(…)`, decision ask if the API is new — route-cache has rule tags only).
- `swr` on a shell entry: stale shell served at once, one background re-fill = detached anonymous request through the full pipeline (route-cache `fill`), holes of that fill rendered and discarded.
- Redeploy / HMR: key includes build hash; dev disables the shell store unless `RIVET_SHELL_DEV=1` (verification mode always on there).

### 3.8 Static build, adapters, CDN

- Static adapter / `prerender`: v1 none (`shell` on a prerendered route = build warning: the page is already static). F2: prerender writes the shell `.html` with boundaries marked `continued` + a holes endpoint → needs F1.
- node: full (fast path stays route-cache only; shell hits go through the handler because guards run). fetch / cloudflare / vercel-edge / deno / bun: same code via `createApp` (in-isolate store, cold isolates refill; documented). Vercel Build Output PPR mapping = F4.
- CDN trade-off: server-composed ⇒ TTFB = RTT to origin + ~0.05 ms, not edge RTT. Client-composed (F1) ⇒ shell from CDN (edge TTFB, `public, s-maxage`), holes = one extra round trip each (or one batched `?_rivet=holes` fetch with cookies), hole LCP later, guards rerun per hole request, `h` check mandatory. Pick: server-composed now; F1 when a deploy target with far-from-origin users asks for it.

## 4. Measured shell share (T0, lane PPR-T01, 2026-10-21)

- Harness `apps/editorial-bench/spikes/ppr-shell/bench.ts` (CLAUDE.md there): in-process, `process.cpuUsage` per request (process CPU incl. GC threads), 5 interleaved rounds × 1,500 requests per lane, median round; Apple M4 Pro, Node 26.5.1, no bench lock on this host (none exists; other lanes running), 1-min load 5.4–8.6 beside each run. 4 runs; runs 2–4 (load 5.4–6.7) quoted, run 1 (load 8.1–8.6) agrees within 5 %.
- Editorial article (rivet-dynamic shape: lane `content.ts` loader = marked lexer + tree per request, `Markdown` component, server mode) + signed-in user menu (~0.44 KB, `sid` cookie → session loader) in the header, through the real router pipeline (`loadBuild` of a Vite build):

| lane | CPU ms/req | TTFB ms (handler → first body byte) | bytes |
| --- | ---: | ---: | ---: |
| `full` = today, signed in (cookie → route-cache bypass, full render) | 0.213–0.224 | 0.177–0.182 | 11,983 |
| `stub` = same page, hole replaced by a constant same-shape placeholder (no request read) | 0.221–0.230 | 0.178–0.180 | 11,904 |
| `hole` = pipeline + session loader + user menu in an empty document (H-holes proxy) | 0.063–0.073 | 0.037–0.038 | 5,978 |
| `floor` = pipeline, no loader, one element | 0.062–0.067 | 0.032–0.033 | 5,529 |
| `loader` = the article loader alone (marked lexer) | 0.092 | — | — |
| `r-shell` / `r-shell-null` = the shell's render in-process into the byte writer / a no-op writer | 0.057 / 0.052 | 0.050 / — | 6,155 / 0 |
| `r-hole` = the user menu render in-process | 0.0035–0.006 | 0.002 | 439 |
| `prefix-copy` = one copy of the 11.9 KB stored prefix | 0.0015–0.007 | — | — |

  - Estimates: **H-replay ≈ `hole` + `prefix-copy` + `r-shell-null` = 0.116–0.127 ms → 1.75–1.83× less CPU than today**; **H-holes ≈ `hole` + `prefix-copy` = 0.065–0.075 ms → 3.0–3.3×**. TTFB of a hit ≈ `floor` TTFB + prefix (~0.035 ms) vs 0.18 ms today (and independent of the deferred loader's latency).
  - Where the shell's cost is: loader 0.092 ms (43 % of the request), pipeline floor 0.065 (30 %), page JS 0.052 (24 %), bytes ≈ 0 (`r-shell-null` ≈ `r-shell`: writing the bytes is not the cost, running the components is). The hole itself is ~2 % of the page.
  - Caveat (decides T6): ~0.09 ms of H-replay's saving is the per-request markdown parse this fixture's loader does. An app that caches its parsed article (common) has today ≈ 0.13 ms → H-replay ≈ 1.05–1.1× (below the bar), H-holes ≈ 1.8×. H-replay's win = loader cost of the shell; H-holes' win = loader + page JS.
- ssr-bench `/resume` 1000 rows (lazy-cost source, in-process `renderResumable` into the router's byte writer; no pipeline / gRPC): full 1.20–1.23 ms, shell (rows → constant placeholder) 0.010–0.012 ms (**shell share ≈ 1 %**), rows alone 1.19–1.20 ms → H-replay / H-holes 1.00–1.03×; TTFB 0.26–0.27 → 0.008 ms (render only). Not a target (as estimated); deferred loaders (T1) give the TTFB without a cache.
- **Go / no-go: GO for T3+ on the signed-in article (bar ≥ 1.5×: H-replay 1.75–1.83×, H-holes 3.0–3.3×), with the caveat that H-replay clears the bar only when the shell's loaders cost real CPU / I/O.** Expect T5 (H-replay) to miss 2× on pages with cheap shell loaders → plan T6 (H-holes) as likely, not optional (Q5 trigger). Rule of thumb confirmed: win ≈ shell share of (loader I/O + render CPU); data grids gain nothing.

## 5. Plan

| Task | What | Gate |
| --- | --- | --- |
| T0 | Measure shell share: in-process script over the editorial dynamic build + `/resume` (boundaries' contents stubbed, `process.cpuUsage`, 5 × 1,500 req) → fill §4 with numbers; go / no-go (bar: ≥ 1.5× CPU on the signed-in article) | **done 2026-10-21 (PPR-T01): GO** — §4 |
| T1 | Deferred loaders (N-6): `load(fn, { defer: true })` → `Deferred<T>` handle, resolved per render; `Async` / `resource` accept it; streamed via existing segments; data endpoint sends resolved values; types (`DataOf`) | router + runtime tests, resume fuzz, zero-cost (0 B unused), docs `guides/routing` + llms — **done 2026-10-21 (PPR-T01)**: per-request handle (D3 note), data endpoint awaits, auto `stream: {}`, late header / cookie writes throw |
| T2 | Read tracking: `LoaderEvent` read sets, render-phase request-signal tracking, deferred-outside-boundary dev throw, "always stream" mode for shell routes | tests per forbidden read |
| T3 | `shell` rule + store kind + fill capture (prefix offset, nonce slots, snapshot, fingerprint) + H-replay + mismatch fallback + `h` in state / patches | router e2e (Chromium): signed-in hit = byte-identical to a fresh render modulo nonce; resume fuzz on a shell fixture; CSP `'strict-dynamic'` test |
| T4 | Headers / Vary / guards-on-hit / `revalidate` / swr re-fill / cluster relay | `route-cache` test suite extended |
| T5 | Bench: editorial `rivet-dynamic-shell` target (session cookie + hole), in-process + loadgen; report `docs/benchmarks/2026-10-2x-ppr-shell.md` | ≥ 1.5× CPU vs bypass, TTFB p50 ≤ route-cache hit + 0.05 ms |
| T6 | H-holes: compiler eligibility fact per boundary (capture classes) → retained thunks + frame swap + COW encoding overlay | same e2e + fuzz in both modes; CPU ≥ 3× vs bypass |
| T7 | Docs (guide "Partial prerendering", route rules reference, diagnostics), CLAUDE.md (router, runtime), MCP data, skills / AGENTS | content / llms / AI-files `--check` |

- Risks
  - R1 resume numbering drift → corrupt resume (wrong handler / binding on a region). Mitigation: shell-phase determinism (always-stream), dev double render, fingerprint before the first segment, `h` in state + patches, reload fallback, sticky off. Fuzz: `RIVET_FUZZ_ROUTES` on shell fixtures with hit / miss alternation.
  - R2 cross-request leak through retained closures / frames (H-holes): compiler-proven captures only, request frames swapped, shellData frozen, dev deep-freeze; H-replay has no retained closures.
  - R3 a request read the tracker misses (new `RequestEvent` member, user ALS) → personal data in a shared shell. Mitigation: allow-list (unknown members = forbidden), detached anonymous re-fill for swr, dev verify with an anonymous request.
  - R4 TTFB-before-guards temptation: guards always run first; documented.
  - R5 semantics: holes cannot set status / headers / cookies; redirects become client redirects — documented, TypeError at the call.
  - R6 memory: snapshots + retained thunks; charged / capped (§3.5).
- Measure: CPU/req, rps c1 / c10, TTFB p50 / p99, complete p50, bytes/req (prefix + segments), entry bytes, hit ratio, peak RSS — interleaved vs bypass + route-cache hit, bench lock.

## 6. Decision asks

- Q1 **ruled**: `shell: true` + `load(fn, { defer: true })`. Was: API name: `shell: true` (proposed) vs `ppr: true` vs `partial: true`; deferred loader option `load(fn, { defer: true })` vs `load.defer(fn)` vs a `defer()` value wrapper.
- Q2 **ruled**: opt-in per rule. Was: Default: opt-in per rule (proposed) vs inferred / on for every route whose fills pass §3.3 (Next's default model).
- Q3 **ruled**: follow-up F1. Was: CDN-composed holes (F1, Astro server islands style) now or follow-up (proposed: follow-up).
- Q4 **ruled**: always shell + live holes. Was: Anonymous traffic on a shell route: whole-page route-cache entry first (`anonymous: "page"`, cheaper, holes stale) or always shell + live holes (fresh, proposed default).
- Q5 **ruled**: H-replay first; T6 only if T5 misses 2×. Was: Go / no-go on T6 (H-holes, compiler fact) after T5 numbers, or H-replay only.

## Follow-ups

- F1 client-composed holes (`?_rivet=holes`, CDN shell). F2 static prerender of shells. F3 client navigation: JSON data path with deferred values streamed (T1 covers the transport). F4 Vercel Build Output PPR mapping. F5 shared store (KV) — out of scope like route-cache.
