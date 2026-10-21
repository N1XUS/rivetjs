# @rivetjs/router — shared (`/head` + internals)

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Code imported by both server and client (and by `@rivetjs/kit`): handler ↔ client wire contract, head model + merge + serialization, control-flow errors, redirect safety, base path, CSP helpers. Web-standard, no DOM, no Node.

## Entry points

- `@rivetjs/router/head` → `head.ts`: `rankMerge`, `metaKey`/`linkKey`/`scriptKey`, `headTags`, `htmlAttributes`, `bodyAttributes`, `inlineScript`/`isInlineScript`, `_scriptBootstrap` (escaping: `@rivetjs/runtime/escape`, JSON in scripts: `escapeJSON`). Consumers: `server/app.ts`, `server/render.ts`, `libs/kit/{dom,shared}.ts`.
- Via `@rivetjs/router` (`index.ts`): `server-exports.ts` (route server-export wrappers `load` `guard` `actions` `entries` `headers` `onRequest` `onGet` `onPost` `onPut` `onPatch` `onDelete` `onOptions`, types `ServerExport` / `ServerKind`; `SERVER_EXPORT` tag key internal), `errors.ts` (`HttpError`, `redirect`, `deny`, `notFound`, `error`, `isHttpError`), `actions.ts` (`fail`, `ActionFailure`, `isActionFailure`), `redirect.ts` (`safeRedirect`), `base.ts` (`BASE`, `withBase`), `cookie.ts` (`parseCookies`), `slash.ts` (`slashPath`, `TRAILING_SLASH`, `TrailingSlash`), types from `data.ts` (`Head`, `HeadMeta`, `HeadLink`, `HeadScript`, `InlineScript`, `ScriptStrategy`, `HeadSink`, `ActionAnswer`, `DataAnswer`, `AnswerError`).
- Via `/server` (and `/static`): `csp.ts` `CSPOptions`, `CSPDirectives`; `data.ts` `DATA_PARAM`, `ActionResult`.

## Layout

- `data.ts` — wire contract: `DATA_PARAM = "_rivet"`, `KEEP_PARAM = "_rivet_keep"`, `KEEP_PAGE = "."`, `withoutRivet(search)` (drops `_rivet`/`_rivet_keep` textually; both sides), `LoaderDeps`, `RoutePayload` (`data`, `head?`, `kept?`, `byURL?`, `deps?`), `ActionResult`, JSON answers `ActionAnswer` (enhanced action: `action` | `redirect`+`status` | `error`; single flight adds `data`/`head?`/`deps?`) and `DataAnswer` (`?_rivet=data`: `data`, `status`, `head?`, `keep?`, `byURL?`, `deps?` | `redirect` | `reload` | `error`) — `handler.ts` `json()` takes only these; `@rivetjs/forms` decodes `ActionAnswer`. `Head` model, `HeadSink`.
- `head.ts` — rank merge `(level, phase, seq)`: level −1 document defaults, layouts 0…n−1, page n; phase 0 route `head` export, 1 kit components; later wins per dedupe key. Serialization in capo.js order; script bootstrap for `load`/`idle`/`interaction` strategies.
- `server-exports.ts` — wrappers tag an own non-enumerable `Symbol.for("rivet.server")` = kind: functions → a fresh tagged `fn.bind(undefined)` (one handler passed to `onGet` and `onPost` keeps two kinds), `actions(map)` → tagged shallow copy (members must be functions: `TypeError` at module evaluation). Types: `ServerExport<K, V> = V & { [SERVER_EXPORT]: K }` (`PageProps<typeof loader>`, `DataOf`, `ActionResultOf<typeof forms>` unchanged); `load<T, P>` infers params from an annotated `RequestEvent<"id">`. Imported by `index.ts` (shared, no Node); the compiler strips every wrapper call from browser builds, so browser bundles keep the module only when something else holds it (tree-shaken otherwise). `server/module.ts` reads the tag.
- `errors.ts` — `HttpError` (thrown or returned by guards/loaders/actions; `expose` = status < 500).
- `actions.ts` — `fail(4xx, data)`.
- `redirect.ts` — `unsafeTarget`, `safeRedirect`, `ABSOLUTE`.
- `base.ts` — `BASE` from `import.meta.env.BASE_URL`, `normalizeBase`, `withBase`, `underBase`.
- `csp.ts` — `CSPOptions` (`trustedTypes`, `directives`), `CSPDirectives`, `nonceCSP(nonce, options?)` (default strict nonce policy + Trusted Types; what `createApp` uses without `directives`), `trustedTypesDirectives`, re-export of `cspPolicy`.
- `csp-directives.ts` — pay-per-use (item 9: an app without `directives` ships none of it; `createApp` loads it via dynamic `import("server/strict-csp.ts")`): `cspPolicy(generated, options, meta?, styles?)` (merge: `script-src`/`script-src-elem` additive; `styles` (the page's own `<style>` sources: request nonce in `strictCSP`, `sha256` hashes in `hashCSP`) appended to a `style-src` / `style-src-elem` the options set, none set = nothing added, a list with `'unsafe-inline'` left as given; `object-src`/`base-uri` replace, others appended; CSP3 name allow-list, source syntax check (no `;` `,` `"` `<>` / unbalanced quotes), Trusted Types names rejected (use `trustedTypes`), `meta` → `frame-ancestors`/`report-uri`/`report-to`/`sandbox` throw; nothing implicit, no `'unsafe-inline'`), Users: `server/strict-csp.ts` `strictCSP` (fast path without directives = `nonceCSP`), `adapters/static.ts` `hashCSP` (static imports).
- `csp-hash.ts` — hash policy parts shared by `adapters/static.ts` `hashCSP` (`<meta>`, node:crypto) and `server/route-cache.ts` (header): `inlineSources(html, styles)` (static: every element) → executable inline script bodies (no `src`; no type / JS / module / `speculationrules`), `<style>` bodies (when `styles`), third-party script origins (`<script src>`, kit `#rivet-scripts` bootstrap list via `BOOT_LIST_END`); `noncedSources(latin1Text, nonce, styles, utf8)` (route cache) → byte ranges of the same, but only for `<script|style|link>` start tags carrying ` nonce="N"` (strict tag regex `NONCED_TAG`), plus each nonce attribute's offset; null when the nonce occurs anywhere else (page not stored); `hashPolicy(scriptHashes, origins, styleHashes, options, meta)` → `cspPolicy` (`script-src` hashes + `'self'` + origins, `object-src` / `base-uri` `'none'`). No hashing inside (callers pick the digest).
- `prefetch.ts` (`@rivetjs/router/prefetch`) — document prefetch: `prefetchSelector(kind | "all", { default, routed, routes })` (`:is(a[data-rivet-prefetch=kind]…)[href]:not([download],[target]:not([target=_self]))`; `:is([data-rivet-reload],[rel~=external])` only when `routed` without `routes`), `speculationRules(url, options)` (document rules, `/*`, not own path (`<path>{/}?`), routed: `or` reload/external selector / `not href_matches "/(<routes>)"`, `eagerness` option (default `moderate`); `<` escaped), `prefetchTags(url, nonce, options)` (rules + `FALLBACK(selector,/^\/(?:<routes>)$/)` inline), `routes` = codegen `routePathRegExp` source (`documentPrefetch` throws `TypeError` on `<`, line terminators, unescaped `/`), `documentPrefetch(shell, options)` (inserts before last `</head>`, else end of `start`), `whenActivated(fn)`. Imports only the type of `server/render.ts`. `prefetch-fallback.min.ts`: generated (`build/prefetch-script.ts`), never edit.
- `cookie.ts` — `parseCookies(header)` → `Map`: the one Cookie-header parser (`event.cookies`, `@rivetjs/i18n` `requestSource`/`browserSource`): names/values trimmed, one pair of `"` stripped, percent-decoded (invalid encoding kept raw), first name wins.
- `nonce.ts` — `nonce()`: the one CSP nonce generator (Web Crypto, 16 fresh bytes base64; node adapter calls it, `/fetch` re-exports it). Bytes are cut from a pooled 4 KiB `getRandomValues` fill (each byte used once) and base64-encoded by table: ~0.12 µs vs ~0.8 µs for one `getRandomValues` + `btoa` per nonce.
- `slash.ts` — `TrailingSlash`, `TRAILING_SLASH` (build-time constant, default `"ignore"`), `slashPath(pathname, policy)` (`/` unchanged; `always` leaves file paths — last segment with an extension, `/sitemap.xml` — unslashed, dot-file segments like `/.well-known` count as directories), `slashHref(href, policy?)` (path hrefs only; query/hash kept). Users: `server/handler.ts`, `client/link.tsx`, `client/navigate.ts`, `adapters/static.ts`, `@rivetjs/kit` `canonical()` (default policy = `TRAILING_SLASH`), `server/app.ts` `GeneratedEntry.trailingSlash` (`Exclude<TrailingSlash, "ignore">`). Exported from `@rivetjs/router`; type also from `/server`.

## Head rules

- Dedupe keys: title (innermost wins, `titleTemplate` applied once to the winner); meta by name/property/http-equiv/itemprop + media; one `canonical`; alternates by hreflang+type (or type+href); icons by rel+sizes+media; other links rel+href+media; scripts by id/src/inline code; styles by key/CSS text; JSON-LD without id never deduped. `key` overrides all.
- `headTags` builds one string per capo.js group (12 fixed slots, `+=`), joined once — no per-call arrays (1.28 → 0.61 µs/call).
- `HeadTagOptions.inlineStyles` (URL → CSS, `rivetRouter({ inlineStylesheets })`): a `styles` URL found in it (own key) is written as `<style nonce>` in its link's place (cascade order kept), else linked. Tests `tests/route-css.test.ts` "inline stylesheets".
- `Head.styles` (inline `<style>`, trusted CSS from components, e.g. `@rivetjs/motion` entrance rules): deduped by `key`, else the CSS text; `headTags` group 5 after the stylesheet links, request nonce, `</style` escaped, never `data-rh` (client navigation keeps them); the server head sink renders them in place after the shell (like links / scripts). Test `libs/kit/tests/head.test.ts` "inline styles".
- Inline scripts only via branded `inlineScript()` (WeakSet brand); plain `{ code }` throws in `headTags`. Code never contains `</script` (escaped).
- One Trusted Types policy per page: `rivet-script`, created by the bootstrap (`document.$rs`), shared with kit's head manager. Charset, viewport, CSP meta belong to the document shell, not `headTags`.
- `html`/`body` attributes need the kit head hold.

## Rules / invariants

- `redirect()` throws at the call for `//x`, backslashes, control chars; `external: true` requires absolute http(s). Handler rejects other-origin absolute targets without `external` (500). User-supplied targets: `safeRedirect(target, fallback)`.
- `fail()` only 4xx; `error()` only 4xx/5xx (`RangeError` otherwise).
- `data.ts` field names are the wire format between `server/handler.ts` and `client/index.ts`/`client/layouts.ts`; change both sides together. Optional fields omitted when empty (byte-identical when unused).

## Gotchas

- `base.ts` must keep reading `import.meta.env?.BASE_URL` in its current form: `build/vite.ts` `transform` regex-rewrites it for i18n client builds (and errors if it no longer matches). `vite.ts` resolves this file by absolute path (`BASE_MODULE`) — don't move it.
- `slash.ts` must keep declaring `export const TRAILING_SLASH = "ignore" as TrailingSlash;` verbatim: `build/vite.ts` (`SLASH_MODULE`/`SLASH_DEFAULT`, a regex matching both the `.ts` source and the published `.js` where the cast is stripped) rewrites the literal when `trailingSlash` is set (errors if missing; before 2026-10-21 the pattern was the `.ts` text only, so npm consumers setting `trailingSlash` hit that error). Test: `tests/build-constants.test.ts` (source + TypeScript-emitted form, also `SHELL_BUILD`); `scripts/package/smoke.ts` "router build constants" runs the installed tarball's plugin on its own `shared/slash.js` / `server/shell-build.js`. Callers gate on `TRAILING_SLASH !== "ignore"` so the minifier folds the code away by default (measured 0 B client/server for unset apps).
- `_scriptBootstrap` is hand-minified; `adapters/static.ts` `hashCSP` searches pages for its `BOOT_LIST_END` marker — keep the marker inside the bootstrap.

## Commands

```sh
npx vitest run --project router libs/router/tests/server.test.ts libs/router/tests/base.test.ts
npx vitest run --project kit   # head merge consumers
```

## See also

- [../CLAUDE.md](../CLAUDE.md), [../server/CLAUDE.md](../server/CLAUDE.md), [libs/kit/CLAUDE.md](../../kit/CLAUDE.md), [docs/guides/kit.md](../../../docs/guides/kit.md)
