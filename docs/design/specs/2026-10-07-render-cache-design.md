# Cross-request render cache (lane OPT-B)

Status 2026-10-07: design + prototype. Runtime `@rivetjs/runtime/server-cache` (`libs/runtime/server-cache.ts`, tests `libs/runtime/tests/server-cache.test.ts`), compiler purity patch queued (`opt-b-purity`), benchmark `apps/ssr-bench/cache-bench/`. Router integration = hooks in OPT-A-owned files (below), not landed.

## Goal

- "Almost zero CPU per request": don't re-render output that cannot have changed.
- Three layers, cheapest proof first:
  1. compiler-proven prop-pure components → memoized fragments (`_cached` call sites);
  2. static shell: layout rendered once per key, request renders only its holes (`shell`);
  3. explicit opt-in (`cached` / `shell` with `key` / `ttl`) for what the compiler cannot prove.
- Never used in the fair-comparison lanes (they render unique data, "No page or data caching" — `apps/ssr-bench/CLAUDE.md`). Measured on its own fixture only.

## Decisions

- D1 Cache unit = HTML fragment of one component call (or a layout with holes), not a page. Pages always carry request data (token, user, nonce); fragments mostly don't.
- D2 Stored form = one frozen fragments array + a shared compiled record (`_compiledRecord(fragments, [])`). Byte writers encode a frozen fragments array once per process (`server.ts` `encodedFragments` WeakMap) → a hit writes pre-encoded bytes (`writeBytes` memcpy); string writers concatenate. No new renderer protocol needed.
- D3 Shell = compiled record whose slots are the request's hole values (`_compiledRecord(fragments, holes)`): the renderer treats it like any compiler template, holes render in place with the current owner / recorder.
- D4 Process-local, in-memory, bounded (bytes + entries), CLOCK eviction (hit = one boolean write, no Map reordering), optional TTL. No shared / distributed cache (security D-S1, invalidation cost).
- D5 Safe default: no request scope (`withRenderCache`) → every wrapper renders normally. An integrator that forgets the scope gets correct, uncached output.
- D6 Resume pages: only resume-inert fragments are cached (no ids / records inside) — nothing to relocate. Relocatable fragments = phase 3 (below).
- D7 Run-time nets stay on in production (miss path only, so ~free): signal reads, async, resume markers, nonce → this request's output used, never stored, wrapper off.
- D8 Admission "second hit" by default (bounded doorkeeper set): unique-key streams (per-user props, attacker-chosen query strings) never evict useful entries.

## API (prototype, `@rivetjs/runtime/server-cache`)

- `createRenderCache({ maxBytes = 16 MiB, maxEntries = 10_000, ttl?, admit = "second" | "first", verify = DEV, maxKey = 8192 })` → `RenderCache` (`stats`, `clear()`).
- `withRenderCache(scope, fn)` — per request; `scope = { cache, variant?, nonce?, partition?, signal?, resumable?, disabled? }` (AsyncLocalStorage; pay-per-use subpath).
- `cached(Component, { id?, key?, ttl?, inert? })` → wrapped component.
- `shell(Layout, { holes = ["children"], id?, key?, ttl?, inert? })` → wrapped layout.
- `_cached(Component, id)` — compiler ABI (`inert: true`, proof already done).
- Planned route-level form (router, OPT-A files): `export const cache = { layout: true, ttl, key: (event) => … }` in a route / layout module → the generated app wraps the layout component in `shell(…)` and the handler opens the scope.

## Purity rules (compiler, conservative — `rust/src/compile/purity.rs`)

- Candidate: module-level `function Name(props)` / `const Name = (props) => …` (capitalised, ≤ 1 param, not async / generator), server target, option `renderCache: true`.
- Pure iff every node in its body (incl. nested arrows, default params) is allowed:
  - identifiers resolve to: own params / locals; module `const` with constant initializer (literals, arrays / objects of constants, `Object.freeze(const)`, other constant consts, no functions); pure components / pure helpers of the module (fixpoint); allow-listed globals (`undefined NaN Infinity Math JSON Object Array String Number Boolean encodeURIComponent encodeURI parseInt parseFloat isNaN isFinite`);
  - calls: pure components / helpers; allow-listed global functions; `Math.*` except `random`; `JSON.stringify`; `Object.keys|values|entries|freeze|fromEntries`; `Array.isArray|from|of`; non-mutating builtin methods on any receiver (`map filter slice join concat includes indexOf lastIndexOf find findIndex findLast some every reduce flatMap flat at toSorted toReversed with toFixed toString toUpperCase toLowerCase trim trimStart trimEnd split replace replaceAll startsWith endsWith padStart padEnd charAt repeat substring localeCompare keys values entries`) — receivers are plain data (runtime key check: no functions in props; module consts carry none), so these resolve to builtins;
  - JSX: native elements; components resolving to pure components; `For` / `Show` / `Switch` / `Match` from `@rivetjs/runtime/server|dom`; i18n static calls (variant is in the key); css`` from `@rivetjs/runtime/css`.
- Impure (rejects the component and, by fixpoint, its callers): `this`, `arguments`, `new.target`, `await`, `yield`, `new`, tagged templates (except css``), `import()`, `delete`, assignments / updates to non-locals or any member target, mutating methods (`push pop shift unshift splice sort reverse fill copyWithin set add clear`), `Date`, `Math.random`, `crypto`, `process`, `globalThis` / `window` / `document`, `performance`, `fetch`; imports other than the allow-list (so `signal`, `computed`, `useContext`, `createId`, `_regionState`, `clientEffect`, `clientEvent`, `clientOnly`, `lazyComponent`, `Async`, `Suspense`, `ErrorBoundary`, `Provider`, `Dynamic`, `Portal`, kit `Head` / `Title` / … (context side effects), router `Link` (`active` reads the URL) all reject); module `let` / `var`; resume sites of kind Event, Model, Ref, Effect, ClientEvent, Computed, Equals, Spread-with-handlers, `ref=`, `model:`, `on*` attributes, `r:slot` / `<slot>`.
- Phase 1: same-module call sites only. Phase 2: `moduleFacts` exports `pure: string[]`; the Vite plugin feeds imported facts back (`pureImports`), so `<SiteHeader/>` from `./header.tsx` is cached too.
- Children: a call with lazy JSX children passes a slot (function) → runtime key check bypasses. Phase 2: children without captures (static JSX) key as the call-site id.
- Output: call sites `Name({…})` → `(__rivetCachedN ??= _cached(Name, "<module>#Name"))({…})` (`let __rivetCachedN;` hoisted; lazy init avoids TDZ for `const` components). Off by default → output byte-identical (zero-cost / oracle unchanged).

## Key design

- `serial \0 variant \0 partition \0 props` — `serial` = per-wrapper counter (a re-created wrapper — HMR re-evaluation, in-process redeploy — never sees old entries; ids are diagnostics only).
- Props encoding: self-delimiting, injective, no hashing (Map key = full string: no collision possible): strings length-prefixed, numbers / bigints `;`-terminated (`-0` distinct), `t f N U`, arrays `[…]`, plain objects `{…}` in insertion order, Date as time. Anything else (functions, signals, slots, records, class instances, Map / Set, symbols) → not keyable → render normally.
- Bounds: depth 32; a props key longer than `maxKey` characters bypasses caching and renders normally (no huge retained keys, no cycles). Every encoded character counts, including property names, primitive encodings, delimiters and shell hole markers; the budget is local to each key build, including reentrant getter calls.
- Getters run inside `_trackReads`: a signal read → re-read for the enclosing tracker, call bypasses.
- Shells: key = non-hole props + presence bit per hole.
- `key(props)` option: user-chosen subset (must cover everything the output depends on — verified in dev).
- Variant (locale) always in the key; nonce never (D-S3).

## Resume

- Inert fragment = renders no `data-r` id, no `<!--rN…-->` markers, records no handler / binding / effect / client event / `_rFn` recipe / `_regionState` / ref. Its bytes are page-independent → cacheable in any page; ids stay unique and deterministic (the fragment consumes none on a hit; a miss may consume For-row ids that `_rBind` unmarks — unused, still unique).
- Holes render live in the request recorder (same region context as an uncached layout: `recorder.region` only changes synchronously inside `_rBind`), so their ids / records are the page's own.
- Detection today: compiler proof (`_cached` ⇒ `inert`), or `inert: true` asserted on `cached` / `shell`; `scope.resumable` without `inert` → bypass. Miss-path net: resume markers in output → not stored, wrapper off; a shell with markers whose holes are invalid throws (records already made with sentinel holes cannot be redone consistently).
- Gap: effects / client events / `_rFn` recipes record without markers. Hook H3 (`server-resume.ts` `_rActivity()`) closes it.
- Phase 3, relocatable fragments (resume-active parts cached): store records with ids relative to the fragment base, HTML split at every id (integer slots, `writeInteger`), hit = `recorder.next += n` + records cloned with ids shifted + captures re-encoded per request (they are props → in the key). Needs recorder internals in `server-resume.ts`; region-local ids would also need loader / format changes (base per region) — not proposed until phase 1–2 numbers justify it.

## Ids (2026-10-08)

- Router renders count ids per request (`rv` + n). A probe renders under its own counter `rv-<FNV-1a(key) base 36>-` + n: deterministic across processes, apart from request ids (`rv-` is no `rv` + digits), and a hit consumes none of the request's ids (request ids after a cached call are the same on hit and miss).
- Fixed bytes ⇒ an entry with ids may appear once per render: its prefix is claimed in a per-render set (keyed by the render's id scope, else the cache scope object); a second use in the page (same props twice, hash collision) renders normally. Sync probes without ids release their claim.
- Wrappers inside a probe render normally: an entry's bytes and prefix never depend on which page populated the cache (no history-dependent HTML).
- Holes of a shell render live with the request's ids; only the layout's own ids use the entry prefix.

## Static shell

- Miss: layout called with sentinel holes (`_slot(() => <!--@rvhole<random>:i-->)` for slots, plain function otherwise), rendered to string, split at the marks → frozen fragments + order.
- Valid only when each present hole renders exactly once and its thunk runs with the wrapper's context frame (`owner.ctx` identity: no `provide` / `catchError` / `Provider` / `ErrorBoundary` of the layout around it). Else: layout renders normally (inert) and the wrapper turns off.
- Marks cannot be forged by content: user text escapes `<`; the random tag guards against a layout's own literal text.
- Hole values must be lazy (slot / function / absent); eager values (strings, records) bypass — a string hole could sit in an attribute.

## Correctness checks

- Production (miss path): signal reads, async render (awaited for this request, never stored), resume markers, nonce substring, abort → not stored; sticky wrapper off.
- Dev (`verify`, default under the `development` condition):
  - every hit also renders fresh and compares; mismatch → `console.warn`, entry evicted, wrapper off, fresh output served;
  - every miss renders twice (second pass under `_rUnrecorded`): different → wrapper off (clocks, random, mutable module state). `createId` is deterministic per probe (below).
- Not detectable at run time (compiler proof or user promise): context reads whose value equals the default this request; side effects into context collectors (kit head tags) — hence excluded by purity rules.

## Security (no cross-request data leaks)

- S1 Same key ⇒ same output is the whole contract; everything else a fragment depends on must be in the key or impossible (compiler) or verified (dev). Process-local only: no shared cache across tenants / processes.
- S2 Keys are full canonical strings, not hashes: no collision ⇒ no other user's fragment.
- S3 CSP nonce: never in a key, never in stored bytes (substring check on every store); a stale nonce would both break the page and disclose another response's nonce. The resume state / loader script tail is never inside a cached fragment (it is written by `tailOf` after the page).
- S4 Request data: compiler rejects `useContext`, request APIs, module mutable state; `partition` (tenant, host, auth class, build hash) separates entries for apps that opt in with `key` over request-derived values. Personalized fragments: don't cache, or key on the user id explicitly (memory: bounded, admission).
- S5 Poisoning: a throwing / aborted / async render stores nothing; output is only ever stored from a complete synchronous render with the same props.
- S6 DoS: bounded bytes / entries, doorkeeper admission, `maxKey`; an attacker can only churn the doorkeeper, not evict admitted entries faster than legit traffic re-admits them.
- S7 Secrets in props become map keys in memory (like any cache): document; use `key` to drop them.
- S8 Dev verification never runs in production (`verify` default from `#dev`).

## Hooks needed (OPT-A files; not edited by this lane)

- H1 `libs/router/server/render.ts`: wrap the page render in `withRenderCache({ cache: app.renderCache, variant, nonce, partition: buildHash, signal, resumable })` when the app configured a cache (`createApp({ renderCache })` / `rivetRouter({ renderCache: true })`); absent → no import (zero cost).
- H2 Router codegen / `render.ts`: route-level `export const cache = { layout, ttl, key }` → wrap the layout component in `shell(layout, { holes: ["children"], inert })` (inert from compiler facts of the layout module).
- H3 `libs/runtime/server-resume.ts` (not OPT-A, needs scheduling): `export function _rActivity(): number` = records made by the current recorder (`next` + effects + clientEvents + fn registrations); `server-cache` compares before / after a probe → exact resume-inertness net. ~10 lines.
- H4 (optional) `server.ts`: expose the render's variant to wrappers (`_renderVariant()`), so the scope need not repeat it.

## Measurement plan / results

- Fixture `apps/ssr-bench/cache-bench/page.jsx`: docs page — site header (8 nav links + search form), sidebar 12 × 12 links with the current page highlighted (144 distinct sidebars), footer (24 links), article per request (unique token, title, 18 paragraphs, 15-row table; pool of 1000 docs, never cached). 24.3 KB HTML.
- Modes: `off` (Rivet, no cache — baseline), `components` (`cached` SiteHeader / Sidebar / Footer = `_cached` emulation), `shell` (`shell(DocsLayout)` keyed by path).
- `node apps/ssr-bench/cache-bench/run.ts --repeats 3 --requests 3000 --rounds 5`: production esbuild bundle per mode, one child process per mode and repeat (interleaved, `--single-threaded-gc --max-semi-space-size=8` = Docker Node lanes), NodeStreamWriter into a discarding sink, 3000 warm-up requests, HTML sha256 identical across modes. CPU = `process.cpuUsage`, alloc = V8 `total_allocated_bytes`, peak RSS = `resourceUsage().maxRSS`.
- Results: see "Measured" below.
- Competitors with cross-request render caching (not built here; candidates for a later lane): ASP.NET Core `<cache>` tag helper (in-memory, vary-by — closest to this design, Razor lane), Next.js `"use cache"` / Cache Components (PPR static shell + dynamic holes ≈ `shell`), Astro server islands (static page + deferred islands; CDN-cached shell), Qwik / Solid / SvelteKit: none in-framework (CDN / full-page only).

## Measured

2026-10-07, Node v26.5.1, macOS host (load 6–7), 3 repeats × 5 rounds × 3000 requests per mode, HTML 24.3 KB identical across modes:

| mode | CPU ms/page | wall ms/page | alloc KB/page | peak RSS MB | CPU vs off | cache entries / KB |
| --- | --- | --- | --- | --- | --- | --- |
| off | 0.083 | 0.080 | 46.8 | 716 | 0% | — |
| components | 0.043 | 0.041 | 34.1 | 705 | −49% | 146 / 5217 |
| shell | 0.040 | 0.039 | 32.5 | 707 | −52% | 144 / 6230 |

- Cache cost: ~36–43 KB per entry (sidebar dominates: 144 keyed variants); bounded by `maxBytes` (default 32 MB).
- Alloc −27% / −31%: the article (per request) still allocates; cached parts = one shared frozen record (byte writers memcpy the encoded fragments).
- Peak RSS ~700 MB in every mode while heapUsed ~45–60 MB: off-heap high-water of the harness (discarding `Writable` + 64 KB slabs at 18k renders), same across modes — not a cache cost. Read RSS from the Docker lanes before any claim.
- Not measured: Docker / HTTP path (needs H1), resumable pages (needs H3 for exact inertness).

## Open questions

- Router API shape (`export const cache` vs `rivetRouter({ renderCache })` only) — OPT-A / root.
- Default `admit`: "second" costs one extra miss per key; "first" is better for small key spaces (layouts).
- Purity across packages (`@rivetjs/ui` components): facts in published packages (`rivet.pure` manifest field).
