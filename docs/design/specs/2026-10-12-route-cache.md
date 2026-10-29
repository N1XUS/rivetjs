# Route cache — design (2026-10-12)

- Status: implemented, lane ROUTE-CACHE (PERF-GAPS #6 response cache / SWR / ISR on any host, #7 validators + 304); review fix round 1 (2026-10-12) applied below (D2–D7, D10).
- Problem: editorial rivet-dynamic costs 0.294 ms CPU/req vs 0.092 ms for a static file (3.2×), 4,156 vs 27,261 rps c10 (`docs/benchmarks/2026-10-11-editorial.md`). Pages answer `cache-control: no-cache` without validators, so every revalidation is a full render and a full body.
- Goal: a cache hit costs about the same as serving a static file (within 1.3×), on any host. A miss costs at most one buffered render. An app without rules pays 0 B and 0 CPU.

## Decisions

- D1 **Rules.**
  - Shape: `routeRules: { [pattern]: RouteRule }` (Nitro model), on `rivetRouter()` (plain data → generated entry `routeRules` export) and `createApp` / `start` / `loadBuild` (runtime overrides; functions allowed).
  - Patterns match the pathname below `base`: exact `/about`, `*` = one segment, a trailing `/**` = the path and everything below it.
  - Every matching rule merges, less specific first; more literal characters win.
  - `RouteRule = { headers?, cache?: CacheRule | false, swr?: number | true, isr?: number | true, cdn?: { maxAge, swr? } }`.
    - `swr: n` = `cache: { maxAge: n, swr: true }`.
    - `isr: n | true` = `cache: { maxAge: n | ∞, swr: true }`.
  - `CacheRule = { maxAge (s), swr?: (s) | true, tags?, varies?: header names (not cookie / authorization), query?: true | false | string[], cookies?: false }`.
  - `isr` (and `maxAge: Infinity`) needs a fixed origin: `routeCache.origin` (node `start` / fetch adapter pass their `origin`); else `TypeError` at server start (`rivetRouter` config check skips it).
- D2 **What is cached.** GET / HEAD page documents only. Data requests (`?_rivet=data`), actions, endpoints and other methods pass through.
  - Bypassed:
    - requests with `Cookie` / `Authorization` (unless `cookies: true`: cookies are ignored in the key, and the fill / refresh render gets a detached request WITHOUT `cookie` / `authorization` — stored pages are anonymous). Fills also drop the client `address` and per-visitor proxy headers (`forwarded`, `x-forwarded-*`, `x-real-ip`, `true-client-ip`, `x-client-ip`, `cf-*`, `fastly-client-ip`) unless `varies` names them (O5);
    - fills that read request-specific `platform` facts, including the original Node `req` / `res`, platform `ctx`, custom fields, reflection and reads during streamed output. `platform.env` is deployment-wide and remains cacheable; a full body is consumed before deciding admission (2026-10-29 security audit);
    - responses that set cookies, that are not `200 text/html`, or whose route set `cache-control` to `private` / `no-store`;
    - responses with `Vary: *`, or a `Vary` naming `cookie` / `authorization` when the rule has no `varies` or has `cookies: true` (i18n guard with a locale cookie; O2) — a credentialed visitor then gets a render of their own request;
    - renders that reported a failure (`onError` → the app sets `Symbol.for("rivet.renderFailed")` on the request; error-boundary fallback in a 200 page);
    - renders started before a matching `revalidate()` (each fill registers `{ path, tags }` in `store.filling`; `revalidate` voids the ones its path / tag predicate matches — O6, was a store-wide generation);
    - non-canonical path encodings (served, never stored).
  - Admission is checked before buffering and again after the body completes. Mutable streamed Response headers can introduce `Set-Cookie`, private/no-store, a different content type or new `Vary`; the final policy controls admission and key learning. Rejected buffered answers preserve those final headers.
  - A cached route is public: request handlers and guards do not run on a hit (the same contract as a CDN or Nitro).
- D3 **Key** = request origin + decoded pathname (`normalPath`: segments percent-decoded, decoded `/` kept as `%2F`; rules match the same path) + (search per `query`) + values of `varies` headers + values of headers responses named in `Vary` (learned per rule, then part of every key).
  - Only the canonical encoding of a path (WHATWG path percent-encode set, upper-case hex) is stored: `/%61dmin` matches `/admin/**` rules but is never stored.
  - Origin: a fixed `routeCache.origin` → other origins bypass; without it the key includes the `Host`-derived origin (forged hosts store their own copies, on their second miss; documented).
  - Stored pages answer with `Vary` = response names ∪ `varies`; the node adapter adds `Accept-Encoding` (identity, encoded, 304) when a compressed copy exists.
  - Keys of client-chosen input are admitted on their second miss (doorkeeper `secondMiss`): a query string, a non-empty value of a `varies` / learned header, or any key when there is no fixed origin (forged `Host`; O3). Attacker-chosen query strings, header values and hosts never evict useful pages. Others are admitted on the first miss.
- D4 **Store.**
  - Process-local and bounded: `maxBytes` 32 MiB (body + key + headers + adapter zstd / br / gzip copies via `CachedPage.charge`), `maxEntries` 5,000.
  - CLOCK eviction, the same scheme as `@rivetjs/runtime/server-cache` (a hit writes one flag).
  - Entry = body bytes, headers, weak ETag (`W/"<sha-1 base64url>"`, WebCrypto), `Last-Modified`, created / stale / expires times, tags.
  - Concurrent misses for one key share one render (single flight). A waiter compares its key again after completion, using any newly learned `Vary` fields; a different representation renders its own request. A stale hit inside `swr` is served at once and starts one background refresh.
  - Refresh failures: 404 / 410, a 3xx or a `Set-Cookie` answer (moved / now personal; O4) drop the entry; any other non-storable result or a throw keeps the stale page and backs off (1 s doubling to 5 min, `CachedPage.retry`), so a failing page is not re-rendered per request.
  - Misses are buffered from the renderer's slabs (`DIRECT_BODY` sink, one copy), the miss answer carries `DIRECT_BODY` too (node writes it without a stream). A render failure after the head (stream error) → the miss answers 500.
  - `revalidate({ path } | { tag })` (`@rivetjs/router/route-cache`, process-wide registry) drops entries, for actions that publish.
- D5 **CSP without per-request nonces.**
  - A cached body must be byte-identical across requests (so it can be precompressed and served from memory), so it cannot carry a fresh nonce.
  - Misses render with the request's nonce (the miss answer keeps it); the entry stores a hash policy of ONLY the elements carrying that nonce (`noncedSources`: start tags `<script|style|link … nonce="N">` parsed strictly, before the strip): hashes of their inline bodies, origins of their `src`, the kit bootstrap list; then the ` nonce="N"` byte ranges are cut out. Injected markup never enters the policy.
  - The nonce anywhere else (text, attribute value, malformed tag) → not stored (warned once per path). A policy that trusts the nonce but is not converted (`csp` function, a route's own) → not stored (one nonce for every visitor would be a leak).
  - `'strict-dynamic'` parity: not expressible with hashes (a hash's trust does not reach `import()`, which the resume loader uses). The stored policy is hashes + `'self'` + nonce'd script origins: no trust propagation to scripts inserted by third-party scripts (stricter), but `'self'` admits same-origin parser-inserted files the nonce policy would block (looser). Checked in Chromium + Firefox (`libs/router/tests/route-cache-csp.test.ts`, 2026-10-12; Firefox skipped where not installed, CI is Chromium-only), probe also in WebKit: under `hashes + 'strict-dynamic'` a hashed inline script's `import("/a.js")` is blocked in Chromium and Firefox (classic and module scripts; the import is fetched with the importer's nonce, a hash-allowed script has none), allowed in WebKit; `createElement("script")` modules load in all three. The CSP3 reading that a hash's trust reaches `import()` (review 2, O1) does not match two of three engines, so `'strict-dynamic'` is not stored. The test also pins: the stored hash + `'self'` policy runs the `import()` chain with a clean console, an injected inline script stays blocked on MISS and HIT, and a parser-inserted same-origin `<script src>` runs on the HIT only (the `'self'` delta, documented in the guide). Full parity would need the loader to load modules through `createElement("script")` (runtime follow-up).
- D6 **Validators.**
  - Hits and misses send `ETag`, `Last-Modified`, `Age` and `x-rivet-cache: HIT | MISS | STALE`.
  - `Cache-Control` defaults to `public, max-age=0, s-maxage=<maxAge>, stale-while-revalidate=<swr>`: browsers revalidate (304), shared caches and CDNs (Vercel, Netlify, Cloudflare) follow the rule.
  - `isr` rules: `public, max-age=0, s-maxage=0, must-revalidate` (`revalidate()` reaches only this server's processes — node `start({ workers })` relays it to every worker — and cannot purge a CDN); `cdn: { maxAge, swr }` opts into longer CDN caching.
  - `If-None-Match` (weak comparison) / `If-Modified-Since` → `304` with no body and no CSP header, so the stored copy keeps its matching policy.
  - Uncached rendered pages stay streamed with no ETag: a validator there needs the whole body, which costs the streaming TTFB and saves no CPU.
- D7 **Hit path.**
  - Web-standard: `createApp` wraps its handler, so fetch / Workers / Bun / Deno get the cache.
  - Node fast path: the listener asks the cache before building a `Request` (`ROUTE_CACHE` hook on the handler) and writes stored bytes, with zstd / brotli / gzip variants compressed once per entry and memoized like static files.
  - Target: CPU/req and rps within 1.3× of `static:rivet`.
- D8 **Fragment cache.** `createApp({ renderCache })` (`createRenderCache()` from `@rivetjs/runtime/server-cache`) opens `withRenderCache` around every render (scope: cache, locale variant, nonce, signal, resumable). `cached()` / `shell()` / `_cached` components then hit across requests on misses and uncached routes. The module is loaded on demand: 0 B when unused.
- D9 **Zero cost.** `server/route-cache.ts` is imported dynamically by `createApp` only when rules exist (the same pattern as `strict-csp.ts`). The handler gains no code on its hot path.

## Out of scope (follow-ups)

- Endpoint / data-request caching.
- A shared or distributed store (Redis, KV).
- Mapping `isr` to Vercel / Netlify build output (headers already reach their CDNs).
- `revalidate` across servers and CDNs (node `start({ workers })` workers: relayed by the primary since MULTICORE 2026-10-12).
- Static adapter: route rules do not apply to prerendered files.

## Measure

- editorial-bench rivet-dynamic N=1000, closed loop over 20 article URLs, c1 / c10, bench lock, 5 rounds (medians).
  - 25810dd4 (load 7.7–16.9): uncached 0.376 ms CPU/req, 3,730 rps c10; hit 0.025 ms, 58,484 rps; `static:rivet` 0.110 ms, 22,699 rps.
  - Fix round 1 (load 7.3–18.6): uncached 0.348 ms, 3,553 rps; hit 0.023 ms, 66,192 rps; `static:rivet` 0.100 ms, 22,949 rps. Hit = 0.23× static CPU (goal ≤ 1.3×: met).
- Miss overhead, in-process (`loadBuild` handler, 20 articles, `maxEntries: 1`, 5 × 1,500 requests, 2 runs, load ≈ 8): goal ≤ 10 %.
  - 25810dd4: 402 µs vs 254 µs uncached (+58 %): `response.arrayBuffer()` stream read + text decode / replace / re-encode.
  - Fix round 1: 290 / 282 µs vs 264 / 253 µs (+10 % / +11 %): `DIRECT_BODY` sink, byte-range CSP scan of nonce'd tags only, `DIRECT_BODY` miss answer. CSP off: 283 / 282 vs 258 / 256 (+10 %). Rules that do not match: +1–4 % (noise band). Hit 21 µs.
- Zero cost: apps without rules ship and run none of it; the ssr-bench `rivet-router` lane (a router app) gains the lazy `route-cache-*` / `server-cache-*` chunks and a changed `entry.server.js` (`createApp`'s dynamic imports + `RENDER_FAILED` mark): `scripts/zero-cost/lanes.txt` updated in fix round 1.
