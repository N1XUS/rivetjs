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
- D3 **Holes = streamed boundaries reading deferred loader data.** Rivet components cannot read cookies / headers in render; request data reaches pages through loaders. So: non-deferred loaders = shell data (must not read request input outside the key); deferred loaders (T1, `load(fn, { defer: true })`, value `Deferred<T>` = a request-independent handle) = hole data, consumed by `<Async load={data.x}>` / `<Suspense>` + `resource(data.x)`. A handle resolves against the **current render's** deferred map (render scope), not a captured promise — the same handle object works in the fill and on every hit. **As built (T1, PPR-T01 2026-10-21): per-request handle capturing the loader's promise** — a render-scope handle failed `await data` (continuation outside the owner; would need AsyncLocalStorage). Consequence: H-replay (T3) is unaffected (live handles per hit); H-holes (T6) must swap a retained shell's handles for the hit's (frame swap) instead of reusing one object. **As built (T6, PPR-T6):** the fill's handle reads `shellSlots()[index]` (the running recorder's slots, through server-resume's ALS) and falls back to its own promise; a hit puts its promise in that slot, so the retained `load` thunk resolves the hit's data without rebuilding the frame.
- D4 **Two hit strategies, picked per route at fill time.**
  - H-replay (T3, generic): write stored prefix → re-run the page with stored shell data + live deferred handles under a discarding writer and a shell-muted recorder (no HTML bytes, no state encode) → segments render and stream as today. Ids / sites match because the shell is request-independent (§3.4). CPU win = loaders + bytes + encode of the shell; TTFB win full.
  - H-holes (T6, compiler-proven): no shell execution; the entry keeps each boundary's content thunk (`load` + `children` closure) + its context frame; a hit runs only the thunks under a fresh root. Eligible when the compiler proves the thunk's captures are data consts / deferred handles / module refs (`_rFn` capture classes) and the frame holds no signals created in the shell. Else H-replay. **As built (T6, PPR-T6):** picked per route at fill time = every top-level boundary of the page carries the compiler's `$hole: 1` (`<Async>` only; `<Suspense>`, ErrorBoundary-enclosed or unmarked → the whole route replays); "frame holds no signals" is checked per module (the boundary's own component creates none on its path), not through ancestor components' contexts (concern, §3.9). Header `SHELL-HIT` (H-holes) vs `SHELL-HIT-REPLAY`.
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
- Memory charge: prefix bytes + snapshot estimate (`JSON` length of the encoding state) + shellData bytes (encoded once with `encodeData` for the charge); thunks / frames uncharged → H-holes entries cap at `maxEntries / 4`. As built (T6): no cap; the entry's charge adds an estimate (1 kB per retained hole + 64 B per seal table entry for the encoder fork).

### 3.6 Keys, Vary, cookies, headers

- Key = route-cache key (D3 there) + `\0shell`. Cookies / `Authorization` are **not** a bypass (the point of the feature) and never in the key; shell code cannot see them (§3.3).
- Response headers: `Cache-Control: private, no-cache` (holes are per visitor; the composed document is never shared-cacheable), `Vary` = shell's learned names ∪ `varies`, no ETag (body differs per request), `x-rivet-cache: SHELL-HIT | SHELL-HIT-REPLAY | SHELL-STALE | SHELL-STALE-REPLAY | SHELL-MISS` (`-REPLAY` = the shell replayed: H-replay entry or a VERIFY hit; dev `SHELL-BYPASS <reason>`). `cdn` on a `shell` rule = TypeError at startup (until F1).
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

### 3.9 As built (T2 + T3, lane PPR-T23; T3b, lane PPR-T3B; T6, lane PPR-T6; T57, lane PPR-T57, 2026-10-21)

Code `libs/router/server/shell-cache.ts` (+ hooks in `handler.ts`, `app.ts`, `render.ts`, `route-cache.ts`); internals `docs/guides/routing.md` "File routes: shell cache"; user docs `headers-and-caching.md#partial-prerendering-shell-cache`. Deviations from §3.1–3.8:

- **No runtime change** (runtime hashes identical). The cut is found in bytes: after the root state tail (`<script type="rivet/state" data-region="0" …>` + loader script + stream add-on when `data-stream` is set; `shellCut`). No `ShellRecorder`, no snapshot / fingerprint object: the hit's replay is a **full live render whose prefix is compared byte for byte with the stored one** and then discarded. Ids, resume sites, chunk lists and state are in those bytes, so the comparison subsumes §3.4's fingerprint; a mismatch before the first hole is caught every time, not sampled.
- T3 H-replay rendered bytes and encoded state (no runtime hooks), measured §4.1. **T3b muted replay** (PPR-T3B) replaces it on sealed entries:
  - Compare-only writer: `ShellBody` (router `shell-cache.ts`, a `BodyWriter` subclass through `render.ts` option `body`) — each `flush()` until the cut compares the slab's pending bytes with the live-nonce prefix at a rolling cursor (`Buffer#compare`) and reuses the slab: no chunk handed off, no shell bytes materialised. First divergent byte = verdict → after the cut the body drains, the mismatch path runs (as T3).
  - Shell-muted recorder: `@rivetjs/runtime/server-shell` `shellHook` (option `shell`): the root tail (state encode + state / loader / add-on scripts) writes and encodes nothing; the prefix already holds the fill's. Numbering for the holes: the fill seals the root encode (`ShellSeal`: table length, chunks, symbols, events, add-ons) before its first patch; the replay thaws it before its first patch — a segment with no captures seeds the encoder from the seal (no shell walk), else the shell's records are encoded then (same walk as the fill's tail) and checked against the seal. Holes' patches = the fill's byte for byte (test `server-shell.test.ts`).
  - Runtime cost on every resume page: `server-resume` `tailOf` one optional call + `encodeRecords` one optional call (`Recorder#thaw`), +60 B min. `server-shell` itself ships only with the router's shell cache.
  - Verification: the muted replay compares the shell's HTML bytes, not its state bytes. Every 64th hit of an entry (`VERIFY`) and entries without seal / tail replay in full (T3: whole prefix incl. state compared); state nondeterminism the HTML does not show is caught there (≤ 63 hits served).
  - Cut check: `ShellBody.cut` requires the cursor at the stored tail offset (`entry.tail`, counted by the fill's `ShellBody`), so a shell that rendered fewer / more bytes is a mismatch.
- **Prefix before verification:** the hit sends status, headers and the stored prefix right after the guards (TTFB ≈ guards + copy), then replays. A mismatch can therefore not fall back to a full render in the same response: the response ends with `rivet:resume-error` ("Shell mismatch") + reload once (`sessionStorage["rivet:shell"]`), the entry is evicted, the route goes sticky, a warning is logged. R3 rests on the tracker, not on the comparison (the comparison proves determinism, not request independence).
- `h` = FNV-1a over the bare prefix + build + route id + key. Carried by router-written scripts, not the runtime state / patches: `self.$rvh="h"` after the prefix, and before the first hole a script that compares it and reloads once on a difference. Same guard for F1 later; `dom-resume` untouched.
- Nonce slots as D5 (attribute offsets from `noncedSources`); a request whose nonce presence differs from the entry's renders without the store (no overwrite). Policy = the app's nonce policy for the live nonce (`'strict-dynamic'` kept).
- Shell data stored **by reference** (no `structuredClone`, no dev deep-freeze): a hole that mutates shell data changes the next replay's bytes → caught by the comparison (mismatch path), not silently served.
- Loader `setHeader`s of shell loaders are stored (`extra`) and replayed; guard / `headers()` headers are live. `cookies.set` from a shell loader = a read (not stored).
- Tracking (T2) = allow-list Proxies per loader event (free: `params`, `route`, `isDataRequest`, `dev`, `signal`, `depends`, `url` with `TrackedParams`; `locals.locale` / `locals.dir` = partition, in the key) + the render's `url` (tracked `searchParams`, so `useSearchParams` reads are seen). Nonpartition `locals` descriptor reads and any prototype inspection also reject the fill; descriptor reads of `locale` / `dir` preserve the keyed partition (2026-10-29 security audit). No `_trackReads` hook needed: the router hands the render its URL.
- Deferred-outside-boundary detection: each deferred handle is gated during the fill; a handle whose promise settles while the cut has not been reached (one macrotask later) means the render waits for it in order → dev rejects it with `DeferredDataError` (fix hint), prod does not store. False positive: a shell that awaits slow I/O of its own after the deferred data settled (not stored, never wrong bytes).
- "Always stream" = `stream: {}` for shell pages (existing runtime: an `Async` with a fallback always streams in stream mode). No inline-when-ready mode exists, so nothing new.
- Dev: probe only, never stores (no `RIVET_SHELL_DEV`): every shell route answers `x-rivet-cache: SHELL-BYPASS <first reason>` + one `console.warn` per route + reason. The dev double render (§3.3 verify) is **not built**: nondeterminism is caught by prod's comparison (one reload, then sticky).
- Unkeyed requests bypass: a query string outside `query` (`false` / list), `HEAD`, data requests, derived resume model (boundaries script → not stored).
- Stale: hit + one detached anonymous re-fill (route-cache `VISITOR` headers dropped), failures back off like route-cache; `revalidate()` drops entries, voids fills, resets sticky.
- R5: a deferred loader's `redirect()` → `location.replace` script at the document's end (`render.ts` `epilogue`), for every deferred page (not only shell routes).
- Not built: learned `Vary` in the shell key (T4), early-hint learning for shell routes, cluster relay of entries beyond `revalidate`, anonymous `"page"` mode (Q4 ruled out).

**T6 H-holes (lane PPR-T6, 2026-10-21).** A hit renders no shell; only the retained holes re-run. Deviations from §3.4–3.5 / D4:

- Eligibility fact (compiler, `rust/src/holes.rs`): per `<Async>` / `<Suspense>` from `@rivetjs/runtime*`: `<Async>` with `fallback`, no spread, a function child; `load` / `children` / `error` capture only data (globals, module symbols, params, bindings declared in the thunks, `const`s initialised by data); no `let` / local function / class / reassigned capture; no `signal` / `computed` / `createStore` / `_regionState` call on the element's path in its component. `moduleFacts(…, { holes: true })` lists every boundary with the first reason; the server target with `resume` carries the verdict as an `Async` prop `$hole: 1` (no manifest lookup: the runtime sees it on the props it retains). Oracle: one resume-server case re-recorded (`$hole`).
- Retained per entry (runtime `server-shell.ts`, fill `shellHook({ holes })`): each **top-level** boundary `{ A, F, M, props, pin }` — `pin` = a detached owner created under the boundary's owner, i.e. its context frame (router contexts, providers, id scope) kept alive with the entry — and at the cut the numbering `{ n: recorder.next, ids: idScope.n, prefix, contexts, tokens }`; the seal carries `fork` = a copy of the encoder's table + maps at the cut. Nested boundaries re-run with their parent's content. Refused (route stays on H-replay, `holesWhy`): an unmarked boundary, one inside an ErrorBoundary (its fallback path needs the shell's boundary info), none kept.
- Hit (`render.ts` option `holes` = `shellHoles(retained)`; the router's `ShellBody` and `shellHook({ replay, retained, slots })` stay): no layouts / page / document run; per hole `Async({ ...props, fallback: none })` under `_rootIn(pin)` with the hit's id scope shadowed over the frame (`_inIdScope`, `n` = the fill's), `recorder.next = A`, `M` copied; the fallback renders into nothing (the prefix holds it). The replay tail checks the segments' A/F against the retained ones (else mismatch) and starts the hit's encoder from the fork (**COW overlay**: `createEncoder({ base })`, `Overlay` maps read through to the fill's, table copied), so captures of shell values (a signal the hole's handler sets, a shared object) get the fill's refs and patches equal the fill's byte for byte (test `server-shell.test.ts`, e2e `shell-app.test.ts`).
- Deferred handles: frame swap by slot (D3 note), not by rebuilding the frame. The fill's own slot turns `STALE` (a rejected promise) once its stream ends.
- Verification: every 64th hit (`VERIFY`) replays the shell in full and compares (T3), test hook `{ full: true }`; so a shell that changed under an H-holes entry (module state, a clock) is served stored for ≤ 63 hits, then the mismatch path (test `clock`). Escape hatch `RIVET_SHELL_HOLES=0` (read once): every entry on H-replay. Test hook `{ replay: true }`: H-replay per hit (bench `shell-h`).
- Runtime cost on non-shell pages: `server-async` passes its props to `Boundary.defer` (one argument), `Boundary.defer` one optional call, `encoding()` one `base` field, `createEncoder` one optional base branch; segment views (`viewOf`) are now a `View` with `Recorder.prototype` methods instead of `Object.create(root)` (item 3 of the lane: a per-request root turned prototype cost ≈ 0.035 ms per streamed request).
- Concerns (resolved by T57 below): (1) the fact is per module — a signal in an ancestor component's context frame (e.g. a provider value) is not seen by it; the retained frame then holds the fill's signal (cross-request state, R2) — VERIFY catches HTML differences only; (2) provider lists (`lists` WeakMap) are not forked, a hole whose patch needs a provider list the shell already wrote may encode it again (bytes still valid, not the fill's); (3) kit head sinks in a hole's frame are the fill's (a hole that writes `<title>` / meta after the shell is lost on hits, as on H-replay where the head is out already).

**T57 follow-ups (lane PPR-T57, 2026-10-21).**

- Retained-frame watch (concern 1): `frameSignals(holes)` (runtime `server-shell.ts`) walks every retained boundary's frame chain at the cut (≤ 4 levels into each context value, ≤ 1,024 entries; data properties only, signals read through `_inspect`, computeds skipped) and snapshots each signal's value (`ShellHoles.watch`). `shellWritten(retained)` compares: a changed value = a hole wrote a signal an enclosing component provides through context, which every hit's holes would share (R2). Router: an entry with a non-empty watch list stores as H-replay until its fill's stream ends (`Run.watched()`, before `stale()`), then turns H-holes on if nothing was written, else stays H-replay (`holesWhy`, dev log `H-holes off: <why>` once per route); each H-holes hit checks again at the end of `holes()` (`Composer.watched()`) and demotes the entry on a write. Write detection, not presence: a provider whose signals only the shell or the client writes keeps H-holes. Not seen: writes through closures / plain-object mutation of a provided value (VERIFY catches the HTML), two concurrent hits interleaving before the end-of-hit check.
- Provider-list fork (concern 2): provider lists are per encoding (`Encoding.providers`, was a module `WeakMap`), forked into `EncoderFork.providers` and read through an `Overlay` on hits, so a hole's patch reuses a list the shell wrote (byte-equal to the fill's). A frame of an unidentified token (no `id`, or `_contextById(id)` is another token: id-scope and swap frames a hit adds) reuses the list of the frame above (`transparent` in `providersOf`), so the hit's extra frames create no new list identity.
- Hole head tags (concern 3), ruling: holes keep the streamed-boundary head semantics (kit sink after `close()`: links / scripts / styles come out as late markup in place with the sink's nonce; title / meta / html attributes ignored + the dev warning). On a hit, the holes' frame provides the **hit's** closed sink: `shellHoles(retained, swaps)` re-provides each swapped context value around the boundary (`ShellSwap = [token, swap]`), the router swaps `ServerData.headSink` (`swapSink`), and `app.ts` closes the hit's sink before the holes run (`page.shell.headSink`). Before: the fill's sink (wrong nonce, never closed). Test: kit `app.test.ts` shell block.
- `View` / `SHARED` (concern 5): `server-resume-view.test.ts` reflects over a fresh root recorder's own keys; each must be a `View` own slot or a `SHARED` accessor.
- Header sweep (concern 6): no consumer matched `SHELL-HIT` exactly where `-REPLAY` is possible; the editorial bench now asserts `SHELL-HIT-REPLAY` for `shell-h`.

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

### 4.1 T3 measured (H-replay as built, lane PPR-T23, 2026-10-21)

- Same harness, real lanes: `shell` = `/shell/articles/<slug>/` (route rule `shell: { maxAge: 3600, query: false }`, user menu = deferred layout loader under `<Async fallback>`, warm store, each request `SHELL-HIT`), `deferred` = same page with `?bypass=1` (no store). 5 × 1,500, runs 3–5 at 1-min load 7.6–8.2 (runs 1–2 higher, agree).

| lane | CPU ms/req | wall ms/req | TTFB ms | bytes |
| --- | ---: | ---: | ---: | ---: |
| `full` | 0.246–0.250 | 0.208–0.216 | 0.189–0.190 | 12,301 |
| `shell` (hit) | 0.199–0.208 | 0.149–0.152 | 0.0105–0.0107 | 14,475 |
| `deferred` (no store) | 0.310–0.324 | 0.254–0.262 | 0.218–0.221 | 14,223 |
| `floor` | 0.059–0.069 | 0.043–0.044 | 0.038 | 5,827 |

- **CPU 1.18–1.26× vs `full` (bar 1.5×: missed); TTFB 0.011 ms ≤ `floor` + 0.05 (met, ~17× better than `full`).**
- Why below T0's 1.75–1.83×: the replay is the whole `renderDocument` incl. bytes + state encode (profile: `renderResumable` 0.129 ms of a 0.147 ms hit in main-thread JS; `encodeState` 0.036, `admit` 0.028; shell-cache's own code ≈ 0.01), not `r-shell-null` (0.052, no bytes / no encode); the hit also allocates ~2× `full`'s garbage (replay bytes compared then dropped, prefix copy with the live nonce). Saving = the shell loader only (0.093).
- Next: T3b muted replay (runtime: compare-only writer + shell recorder without state encode, est. 1.6–1.8×) or T6 H-holes (≈ `hole` + copy, ~3×). T3b done: §4.2.

### 4.2 T3b measured (muted replay, lane PPR-T3B, 2026-10-21)

- Same harness (`bench.ts --rounds 5|9 --requests 1500 --pages editorial`), 6 runs at 1-min load 6–29 (host shared with other lanes; never ≤ 8 for the 3 scripted runs). `shell` = muted hit, `shell-h` = the same hits replayed in full (T3 cost); cached-loader variant (T0 caveat: article memoised per slug, shell loader ≈ 0): `full-cached` / `shell-cached`.

| lane | CPU ms/req | TTFB ms | bytes |
| --- | ---: | ---: | ---: |
| `full` | 0.254–0.311 | 0.196–0.209 | 12,514 |
| `shell` (muted hit) | 0.141–0.205 | 0.0101–0.0110 | 14,688 |
| `shell-h` (full replay) | 0.196–0.255 | 0.0109–0.0121 | 14,688 |
| `deferred` (no store) | 0.319–0.350 | 0.222–0.237 | 14,436 |
| `floor` | 0.076–0.087 | 0.045–0.047 | 6,040 |
| `full-cached` | 0.131–0.164 | 0.102–0.107 | 12,517 |
| `shell-cached` (muted hit) | 0.158–0.180 | 0.0100–0.0110 | 14,692 |

- **CPU vs `full`: 1.40–1.84× (median 1.61×; 4 of 6 runs ≥ 1.5×, the two below at load 6 and 29). TTFB 0.010–0.011 ms ≤ `floor` + 0.05 (met).** Muted vs full replay: 1.23–1.39× (−0.04 to −0.05 ms per hit = state encode + byte hand-off).
- Cached-loader page: **0.83–0.95× vs `full-cached`** (the hit costs more CPU than the page without a shell), TTFB 10× better. The shell saves its loader and its state encode; the hit pays the deferred hole (`deferred` − `full` ≈ 0.04–0.08 ms: deferred handle, `Async` fallback + streamed segment, patch) + prefix copy with the live nonce. Shell rules pay off in CPU when the shell's loaders cost more than ≈ 0.04 ms, in TTFB always.
- Remaining hit (≈ 0.16 ms, `--cpu-prof`): shell content render ≈ 0.07 (compared, not sent), hole + deferred machinery ≈ 0.05–0.06, router pipeline / guards / prefix copy / `$rvh` ≈ 0.02, segment views (`viewOf` `Object.create` on a fresh prototype per request) ≈ 0.006, GC rest.
- T6 (H-holes) estimate from it: drops the shell render → ≈ 0.09 ms/hit ≈ 2.8× `full`, ≈ 1.7× `full-cached`. A cheaper deferred / hole path helps every deferred page (not only shells).

### 4.3 T6 measured (H-holes, lane PPR-T6, 2026-10-21)

- Same harness, `bench.ts --pages editorial --requests 1500`: `shell` = H-holes hit (asserts `SHELL-HIT`), `shell-h` = the same hits on H-replay (T3b muted, hook `{ replay: true }`), `shell-full` = full replay (T3). Three runs: A `--rounds 5` (1-min load 6.8–7.6), B `--rounds 9` (load 8.0–8.6), C `--rounds 5` after the pre-View build (load 6.4–7.1; item 3 before/after).

| lane | A CPU ms/req | B CPU ms/req | C CPU ms/req | TTFB ms (A / B) | bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| `full` | 0.258 | 0.248 | 0.245 | 0.204 / 0.198 | 12,514 |
| `shell` (H-holes hit) | 0.058 | 0.056 | 0.057 | 0.0094 / 0.0094 | 14,688 |
| `shell-h` (muted replay) | 0.139 | 0.141 | 0.145 | 0.0107 / 0.0108 | 14,688 |
| `shell-full` (full replay) | 0.188 | 0.192 | — | 0.0107 / 0.0108 | 14,688 |
| `deferred` (no store) | 0.305 | 0.306 | 0.295 | 0.216 / 0.214 | 14,436 |
| `floor` | 0.076 | 0.073 | 0.080 | 0.043 / 0.044 | 6,040 |
| `full-cached` | 0.137 | 0.142 | 0.154 | 0.102 / 0.104 | 12,517 |
| `shell-cached` (H-holes hit) | 0.063 | 0.059 | 0.053 | 0.0094 / 0.0095 | 14,692 |
| `shell-cached-h` (muted replay) | 0.142 | 0.137 | — | 0.0108 / 0.0107 | 14,692 |

- **CPU vs `full`: 4.46× / 4.43× / 4.27× (bar ≥ 2×). vs `full-cached`: 2.16× / 2.38× / 2.88× (bar ≥ 1.3×; T3b was 0.83–0.95×). TTFB 0.0094 ms ≤ `floor` + 0.05 (met).** H-holes vs muted replay: 2.4–2.5× less CPU per hit. Bytes = the replayed hit's (byte-identical modulo nonce, e2e).
- A hit now costs less than `floor` (a one-element page through the whole pipeline + render + state encode): the hit skips the document render and the root encode; what is left is the request pipeline and the hole.
- Deferred cost (lane item 3, `--cpu-prof` `deferred` vs `full` at load ~7, then C): segment views were `Object.create(root, accessors)` — each request's root recorder became a prototype (V8 prototype map setup ≈ 5 µs self + every later root access slower). Now a `View` (`Recorder.prototype` methods, shared members read through to the root): `deferred` − `full` 0.080 → 0.050 ms in the bench (C before / after), 0.064 → 0.026 ms in an isolated process (`run.ts`, 3 × 8,000, A/B alternating); `shell` 0.069 → 0.057, `shell-h` 0.161 → 0.145, `shell-cached` 0.076 → 0.053; `full` unchanged (0.249 / 0.245). Rest of `deferred` − `full` (≈ 0.025–0.05, diffuse, each < 3 µs): the segment's own patch encode pass (`encodeRecords` setup closures + `stateJSON` / `encodeState` / `symbolList` ≈ 6 µs), `Stream.run` / admit / abort listener ≈ 3 µs, the hole content's binding under the `Async` thunk (`_rBind`) ≈ 2.5 µs, deferred handle + gate ≈ 1 µs, GC of the above.
- Remaining H-holes hit (≈ 0.046 ms in `--cpu-prof`, 20,000 hits, inclusive): holes render + segment stream + patch encode ≈ 0.008 (of which every 64th hit's full VERIFY replay ≈ 0.003, `Stream.run` + patch ≈ 0.004), shell cache `hit` / `begin` / `answer` / body pull (prefix copy with the live nonce, `$rvh`, holes script) ≈ 0.006, WHATWG `Request` / `Response` / web streams ≈ 0.006, router pipeline (match, guards, `parseCookies`, `headers()`, CSP) ≈ 0.010, GC ≈ 0.004, harness read loop ≈ 0.008.

### 4.4 T5 measured (HTTP loadgen, lane PPR-T57, 2026-10-21)

Report `docs/benchmarks/2026-10-21-ppr-shell.md` (+ `.json`). `apps/editorial-bench/spikes/ppr-shell/loadgen.ts` (node adapter `serve.ts`, closed loop, `sid` cookie, c1 + c10, 3 × 10 s, load 5.4–9.0), signed-in article:

| lane | req/s c1 | req/s c10 | p50 c10 ms | p99 c10 ms | CPU ms/req c10 | RSS MB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `full` | 2,949 | 4,034 | 2.13 | 5.29 | 0.274 | 291 |
| `shell` (H-holes) | 10,203 | 14,934 | 0.50 | 2.53 | 0.090 | 306 |
| `shell-h` (`RIVET_SHELL_HOLES=0`) | 5,167 | 6,893 | 1.17 | 3.75 | 0.175 | 295 |
| `floor` | 10,260 | 14,695 | 0.54 | 2.55 | 0.081 | 274 |

- `shell` = 3.7× `full` req/s at c10, ≈ `floor`; `shell-h` 1.7×. In process (`bench.ts`, load 5.1–6.0): `shell` 0.052 vs `full` 0.265 ms CPU (5.1×), TTFB 0.010 ms. Gate (≥ 1.5× CPU vs bypass, TTFB ≤ route-cache hit + 0.05 ms) met.

## 5. Plan

| Task | What | Gate |
| --- | --- | --- |
| T0 | Measure shell share: in-process script over the editorial dynamic build + `/resume` (boundaries' contents stubbed, `process.cpuUsage`, 5 × 1,500 req) → fill §4 with numbers; go / no-go (bar: ≥ 1.5× CPU on the signed-in article) | **done 2026-10-21 (PPR-T01): GO** — §4 |
| T1 | Deferred loaders (N-6): `load(fn, { defer: true })` → `Deferred<T>` handle, resolved per render; `Async` / `resource` accept it; streamed via existing segments; data endpoint sends resolved values; types (`DataOf`) | router + runtime tests, resume fuzz, zero-cost (0 B unused), docs `guides/routing` + llms — **done 2026-10-21 (PPR-T01)**: per-request handle (D3 note), data endpoint awaits, auto `stream: {}`, late header / cookie writes throw |
| T2 | Read tracking: `LoaderEvent` read sets, render-phase request-signal tracking, deferred-outside-boundary dev throw, "always stream" mode for shell routes | tests per forbidden read — **done 2026-10-21 (PPR-T23)**: allow-list event Proxies + tracked render URL + deferred gate; dev probe header per forbidden read (§3.9) |
| T3 | `shell` rule + store kind + fill capture (prefix offset, nonce slots, snapshot, fingerprint) + H-replay + mismatch fallback + `h` in state / patches | router e2e (Chromium): signed-in hit = byte-identical to a fresh render modulo nonce; resume fuzz on a shell fixture; CSP `'strict-dynamic'` test — **done 2026-10-21 (PPR-T23)**: byte cut + byte-compare replay instead of snapshot / fingerprint, `h` in router scripts (§3.9); guards on hit, swr re-fill, revalidate, R5 client redirects included (part of T4); bench §4.1: bar missed (1.18–1.26×), TTFB met (H-replay renders + encodes) |
| T3b | Muted replay: compare-only writer for the prefix + shell-muted recorder (no root state encode, numbering kept) | runtime hashes delta minimal; bench ≥ 1.5× CPU vs `full`, TTFB ≤ floor + 0.05 — **done 2026-10-21 (PPR-T3B)**: `ShellBody` + `@rivetjs/runtime/server-shell` (§3.9), every 64th hit full; bench §4.2: 1.40–1.84× (median 1.61×) at load 6–29, TTFB met; cheap-loader page 0.83–0.95× |
| T4 | Headers / Vary / guards-on-hit / `revalidate` / swr re-fill / cluster relay | `route-cache` test suite extended — **partly done (PPR-T23)**: headers, guards on hit, swr re-fill, `revalidate` (shell-app e2e); learned `Vary` in the key + cluster relay not built (§3.9) |
| T5 | Bench: editorial `rivet-dynamic-shell` target (session cookie + hole), in-process + loadgen; report `docs/benchmarks/2026-10-2x-ppr-shell.md` | ≥ 1.5× CPU vs bypass, TTFB p50 ≤ route-cache hit + 0.05 ms — **done 2026-10-21 (PPR-T57)**: `loadgen.ts` + `serve.ts`, report `docs/benchmarks/2026-10-21-ppr-shell.md`, §4.4: 3.7× req/s vs `full`, ≈ `floor` |
| T6 | H-holes: compiler eligibility fact per boundary (capture classes) → retained thunks + frame swap + COW encoding overlay | same e2e + fuzz in both modes; CPU ≥ 3× vs bypass — **done 2026-10-21 (PPR-T6)**: `$hole` fact (`holes.rs`, `moduleFacts` `holes`), retained `Async` props + pinned frames, slot swap for deferred handles, `Overlay` over the fill's encoder fork, VERIFY every 64th hit, `SHELL-HIT` vs `SHELL-HIT-REPLAY` (§3.9); segment views without prototype churn (deferred − full −0.03 ms); bench §4.3: 4.3–4.5× vs `full`, 2.2–2.9× vs `full-cached`, 3.1–3.5× vs bypass (`deferred`), TTFB met |
| T7 | Docs (guide "Partial prerendering", route rules reference, diagnostics), CLAUDE.md (router, runtime), MCP data, skills / AGENTS | content / llms / AI-files `--check` — **done 2026-10-21 (PPR-T57)**: `headers-and-caching.md` shell section (eligibility incl. provided-signal rule, dev reason log, headers, hit cost, hole limits incl. head tags), `loading-data.md`, config reference (`RIVET_SHELL_HOLES`), `docs/guides/routing.md`, CLAUDE.md files, llms / MCP / AI regenerated |

- Risks
  - R1 resume numbering drift → corrupt resume (wrong handler / binding on a region). Mitigation: shell-phase determinism (always-stream), dev double render, fingerprint before the first segment, `h` in state + patches, reload fallback, sticky off. Fuzz: `RIVET_FUZZ_ROUTES` on shell fixtures with hit / miss alternation.
  - R2 cross-request leak through retained closures / frames (H-holes): compiler-proven captures only, fill-time + per-hit watch of signals provided through the retained frames (T57: a write → H-replay), request frames swapped (deferred slots, head sink), shell data by reference with the HTML compared on every 64th hit; H-replay has no retained closures.
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
