# Kit

`@rivetjs/kit`: document head as components (title, meta, head links, scripts, JSON-LD, fonts, image preloads) for file-routed apps, working under strict nonce CSP, static hash CSP and Trusted Types. Design: [spec](../design/specs/2026-10-03-kit-and-scoped-styles-design.md).

## Setup

```ts
import { kit } from "@rivetjs/kit/vite";
import { rivetRouter } from "@rivetjs/router/vite";
export default defineConfig({ plugins: [kit(), rivetRouter()] });
```

- `kit()` → router `head: "components"` (detected by plugin name; explicit `rivetRouter({ head: "components" | "early" })` wins).
- Browser builds resolve `@rivetjs/kit` → `@rivetjs/kit/dom`, `@rivetjs/runtime/image` → `/image/dom`.
- Shell passes the whole input: `headTags(input.head, input)` (styles, nonce, managed marks); `htmlAttributes` / `bodyAttributes` from `@rivetjs/router/head`.
- Trusted Types: `strictCSP(nonce, { trustedTypes: ["rivet-script"] })` / `hashCSP(html, { trustedTypes: ["rivet-script"] })`. `rivet-script` created once per page: the bootstrap creates it and leaves `document.$rs` (`{ p: policy, l: script list }`, `libs/router/shared/head.ts`); the client head manager reuses it (or creates it when no bootstrap ran). No `'allow-duplicates'`.
- Router only in v1 (no head sink → components throw with setup hint).

## Components

```tsx
import { Title, Meta, HeadLink, Script, JsonLd, Head, ThemeScript, seo } from "@rivetjs/kit";

export const head = { titleTemplate: "%s | Shop" }; // route export, layout or page

<Title>Item {name}</Title>
<Meta name="description" content={summary} />
<HeadLink rel="icon" href="/icon.svg" type="image/svg+xml" />
<Script src="https://t.example/a.js" strategy="idle" />
<JsonLd data={{ "@context": "https://schema.org", "@type": "Product", name }} />
<Head value={seo({ title, description, url, image })} />
<ThemeScript />
```

- Render nothing in place; entries merge into the route head.
- `HeadLink`, not `Link`: `Link` is the router's navigation component (decision k1 overridden).
- Precedence: rank `(level, phase, seq)`: deeper level wins (document defaults −1, layouts 0…n−1, page n); at one level components beat the route `head` export; later wins per dedupe key.
- Dedupe keys: `meta` by name / property / http-equiv / itemprop (+ media), `key` overrides; links: canonical once, alternates by hreflang, icons by sizes/media, others by rel+href; scripts by id/src; JSON-LD only by `id`.
- `titleTemplate` (`%s`) applies once to the winning title.

## Server

- Head hold: page renders before the document start is written; app chunks buffered until shell rendered, then `<head>` written with merged head. Sync pages: one write as before.
- Late entries (inside streamed `Async` parts): body-valid links/scripts render in place; title/meta warn (dev).
- Output order (capo.js): base, title, preconnect, async scripts, blocking scripts, stylesheets (route CSS first), preloads, deferred scripts + bootstrap, prefetch, meta, SEO links, JSON-LD.
- `data-rh` marks client-managed tags; root-layout component entries `data-rh="0"` (kept across navigation).

## Scripts

| `strategy` | Output |
|---|---|
| `blocking` | `<script src>` |
| `eager` | `<script async>` |
| `defer` (default) | `<script defer>` (module: plain) |
| `load` / `idle` / `interaction` | one inline `#rivet-scripts` bootstrap with the list |

- All script tags carry the request nonce. JSON-LD = data block: no nonce, not hashed, `<` escaped.
- Bootstrap: one inline script per page (`{let l=<list>,…}`), code for the page's strategies only: ≤ 400 B gzip with all three (399 B; load-only 258 B), list excluded. Only on pages with such scripts. TT policy `rivet-script` `createScriptURL` passes listed URLs only (others → `""`); `idle` = `requestIdleCallback` after load (4 s timeout) with 150 ms scroll guard; `interaction` = first pointerdown/keydown/wheel in the bootstrap (touch arrives as pointerdown); the client head manager (`libs/kit/dom.ts`) also listens to `touchstart`.
- Inline code: `{ inline: unsafeInlineScript(code) }` only (branded; plain objects throw). Closing tags escaped.
- `hashCSP` (static): inline hashes + `'self'` + origins of `<script src>` and the bootstrap's list entries; `{ directives }` merges extra directives (router `shared/csp-directives.ts` `cspPolicy`: `script-src` additive, `object-src`/`base-uri` replace, rest appended, names + sources validated, meta-ignored `frame-ancestors`/`report-uri`/`report-to`/`sandbox` throw, no implicit `'unsafe-inline'`). Same option on `strictCSP` / `createApp({ csp })`.
- `loadScript(src, { type })` (browser): load once, through the policy allowlist.

## Client navigation

- Route data's head + mounted components' entries re-merge; keyed diff over `[data-rh]` tags (persistent `data-rh="0"` kept); title updated.
- JSON-LD swapped via the policy's `createScript` (JSON only).
- Approximation: layout components rank below the route head; page-level components win.

## Builders

- `seo({ title, description, url, image, canonical, twitter, robots, baseUrl })` → `Head`.
- `canonical(url, { baseUrl, trailingSlash, query })`, `alternates({ locales, xDefault, baseUrl })`, `openGraph(…)`, `twitterCard(…)`, `jsonLd(data, id?)`.
- Social/SEO URLs must be absolute (or `baseUrl` given): relative → error.

## Images

- `@rivetjs/kit/image`: runtime `Picture` / `Image` re-exported + head preload (`preload: "auto"` = when `priority`; never for `sizes="auto"`). `imagePreloads(image, sizes)`: art direction → one preload per media, mutually exclusive (`(not (m))`).

## Icons

- `@rivetjs/kit/icon` `Icon`: lucide `IconNode` (`import { Check } from "lucide"`, per-icon ES module, optional peer) → `<svg>` with lucide defaults (24, `currentColor`, stroke 2, round caps/joins); `size`, `color`, `strokeWidth`, `absoluteStrokeWidth` (`strokeWidth * 24 / size`), `title` (`<title>` + `role="img"`), else `aria-hidden="true"` unless `aria-label` / `aria-labelledby`; other svg attributes pass through.
- Same component on server / DOM / resume; client-rendered icons keep the SVG namespace (G4). Not a head component: not on the resume site-less allow-list; constant props still record nothing.
- Compile time (Vite plugin, `libs/compiler/static-icons.ts`, default on, `rivet({ staticIcons: false })` / `rivetRouter({ staticIcons: false })` off): `<Icon icon={LucideImport} …/>` with only constant `size` / `color` / `strokeWidth` / `absoluteStrokeWidth` / `class` / `data-*` → the inline `<svg>` (same bytes; one static template, no call, no resume state). Not rewritten: `title` / `aria-*` / `role` / `style`, dynamic values, spreads, shadowed names, entity strings. 1000 icons: SSR 0.61 → 0.074 ms, Chromium mount 2.4 → 1.2 ms.
- Shapes: runtime-internal twin `_svgShapes(icon)` (import `@rivetjs/runtime/dom`, compiler-rewritten to `/server` on the server target): one cached record per `IconNode` identity (server: pre-escaped chunk via the spread attribute encoder, byte-identical; DOM: elements built once per document in the inert template doc, `cloneNode(true)` per icon). Root `mode(props)`: FIXED (no getters: attributes written once, no binding), STATIC (only `icon` a getter: shapes one binding), LIVE (root getter or `title`: one binding per attribute), SPREAD (other svg attributes / Proxy props: one `{...root(props)}` spread). Perf (1000 icons, Chromium): mount 6.7 → 3.0 ms (getter `icon`) / 2.4 ms (constant), heap 1466 → 247 / 73 KB; SSR 3.0 → 0.71 ms (lane IMPL-ICON 2026-10-09).
- SVG files (logos, illustrations): `?image` / `?svg` imports ([vite-integration](vite-integration.md#svg)).

## Fonts

```tsx
/// <reference types="@rivetjs/kit/client" />
import inter from "./Inter.woff2?weight=100..900&fallback=Arial&font";
import { Font } from "@rivetjs/kit/font";
<Font font={inter} preload />   // style: font-family: inter.stack
```

- Params: `family` (default file name), `weight` (`400`, `100..900`), `style`, `display` (default `swap`; `kit({ fonts: { display } })`), `fallback`, `unicodeRange`. Typed import needs `&font` last.
- `@font-face` sheet joins the importer's CSS chunk; file never inlined (preload and CSS share one asset).
- `fallback` metrics (`size-adjust`, ascent/descent/line-gap overrides) need optional `@capsizecss/unpack` (3.x/4.x, `fromBuffer`; 4.x dropped root `fromFile`) + `@capsizecss/metrics`; absent / font not in metrics → warning, no fallback face.
- Google Fonts (`google-font:` ids, `google-fonts.ts`, like next/font/google): `import inter from "google-font:Inter?weight=100..900&fallback=Arial&font"`. Build-time only: `resolveId` fetches the css2 sheet (Chromium UA → woff2 per unicode-range subset) + the one woff2 of `subset` (default `latin`), caches both under `kit({ fonts: { cacheDir } })` (default `<root>/node_modules/.rivet/fonts`, keyed by URL hash, atomic writes), resolves to `<cache>/<family>-<subset>-<hash>.woff2?family&weight&style&unicodeRange&font` → regular `?font` pipeline (hashed asset, `@font-face` + `unicode-range`, fallback metrics, preload). Pages never contact Google.
  - Params: `weight`, `style` (`normal`/`italic` → `ital` axis), `subset` (one per import; import again for more), `axes=opsz:8..144,GRAD:-200..150` (css2 tag order: lowercase then uppercase), `text` (css2 `text=` subset), `display`, `fallback`, `family` (CSS name override).
  - Offline: warm cache = no network; cold cache + no network → build error naming the cache dir and the local `?font` alternative. Refresh = delete the cache dir. Only `https://fonts.gstatic.com/` file URLs accepted.

## Deferred

- `?script` loader, `useTitle`/`useMeta`, `NavLink`/`Form`, icons/manifest, document defaults via `rivetRouter`, i18n alternates auto-wiring, `renderWithHead()` without router, bootstrap merge into resume loader.
