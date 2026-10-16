# Kit (`@rivetjs/kit`) + inline scoped styles (design)

Status: draft 2026-10-03, not implemented. Two features, one spec: both touch head assembly (`libs/router/server/render.ts` `headTags`, `app.ts` `mergeHeads`), CSP (`libs/router/shared/csp.ts`, `adapters/static.ts` `hashCSP`) and the document shell.

Inputs read: [router](2026-10-03-router-design.md), [images](2026-10-03-images-design.md) (+ plan, in progress), [i18n](2026-10-03-i18n-design.md), [resumability](2026-10-03-resumability-design.md), [async streaming](2026-10-03-async-streaming-design.md), [docs/guides/resumability.md](../../guides/resumability.md), `libs/compiler/vite.ts`, `libs/compiler/rust/src/{lib,compile}.rs`, `libs/router/{shared,server,adapters}`, `libs/router/adapters/node.ts` (b80d16a one-write bodies), `apps/playground`. cdk+aria spec not present yet; interactions noted under open questions.

Facts this design builds on:
- Head today: route `head` exports (object | fn of `{data, params, url}`), merged layout → page by `mergeHeads` (title; meta by name/property; links by rel+href, one canonical) **before** render; `renderPage` writes `document(input).start` (incl. `headTags`) first, then the app.
- Node adapter: a body that completes before the event loop turns goes out in one write (b80d16a). Every sync page is effectively buffered already.
- Compiler: `<script>`/`<style>` JSX = compile error ("use build-time assets"); `style` attribute rejected everywhere (`safe_attribute_name`, runtime `bindAttribute`, `template.ts`).
- CSP: `strictCSP` = `script-src 'nonce-N' 'strict-dynamic'; object-src 'none'; base-uri 'none'` (+ TT opt-in, policy `rivet`); static `hashCSP` = hashed inline executable scripts + `'self'`. No `style-src` anywhere today.
- Server context: codegen wraps the App in `<Provider token={ServerData} value={{ data, url, head }}>`; context reads work in sync render only ("no context after await").
- `clientEffect(fn, { when: "load"|"idle"|"visible"|"interaction"|"media:…" })` exists (resumable).
- Images: `Picture`, `ImagePreload`, `preloadLink()` in `@rivetjs/runtime/image` (+ `/image/dom`); placeholder = inline `style` from a validated builder.

---

# Part 1 — `@rivetjs/kit`

## Goal
- Boilerplate-grade building blocks: head (title/meta/links), SEO (canonical, hreflang, OG, Twitter, JSON-LD), scripts with load strategies, images with LCP hints, fonts, icons/manifest, thin router helpers.
- Rules: zero client JS for static head on resumed pages; CSP-correct by construction (nonce, static hash, Trusted Types); no change for apps that don't install kit (router output byte-identical).
- One head data model for route `head` exports and in-component head.

## Non-goals (v1)
- Partytown/worker scripts; remote font download (Google Fonts fetch); font subsetting; runtime image endpoint; kit without `@rivetjs/router` (helper later); head updates from inside streamed `Async` segments.

## Options compared — in-component head vs route `head`

| Option | How | Streaming / early flush | Data-dependent head | Client nav | Cost | Verdict |
|---|---|---|---|---|---|---|
| A. Route exports only (+ typed builders) | `export const head = seo({...})` | head flushed before render (today) | yes (loader data) | data endpoint returns head | zero | keep as primary |
| B. In-component, collected during shell render, head written after shell ("head hold") | `<Title>`/`<Meta>`/`<Head value>` push into request collector; document start written once shell done | head waits for sync shell; sync pages: no change (already one write) | yes, anything rendered | DOM head manager | one Provider per route level, collector array per request | **adopt (with A)** |
| C. Compile-time hoist of static in-component head | compiler lifts literal `<Title>` into route table | early | no (literals only) | yes | build-only | rejected: covers little, binds kit to compiler |
| D. Emit in place in `<body>` | tags where rendered | early | yes | n/a | zero | rejected: `meta`/OG in body ignored by scrapers |
| E. Buffer whole body | render all, then head | kills streaming TTFB | yes | — | memory | rejected |

## Recommendation
- A + B. Route `head` export stays the data-driven primary (computed before render, after loaders). Kit components add component-owned head (fonts, LCP preload, product JSON-LD, scripts).
- Head hold enabled only when kit is in the build (`rivetRouter` detects the kit plugin via plugin `api`; or `rivetRouter({ head: "components" })`). Without kit: codegen, `renderPage`, output unchanged.
- Hold point = end of the shell: sync pages → end of render; streamed pages → shell done (before first `Async` segment). Matches React 19 hoisting; Rivet shells are sync, so cost ≈ shell render time, which the node adapter already waits for.

## Head model (extends `libs/router/shared/data.ts`)
```ts
interface Head {
  title?: string;
  titleTemplate?: string;                 // "%s · Shop"; innermost wins; applied once at merge
  html?: { lang?: string; dir?: "ltr" | "rtl" | "auto"; class?: string }; // needs held start; i18n sets lang/dir
  body?: { class?: string };
  base?: { href: string; target?: string };
  meta?: readonly HeadMeta[];             // + httpEquiv, itemprop, media (theme-color)
  links?: readonly HeadLink[];            // + imagesrcset, imagesizes, fetchpriority, title, color, integrity, referrerpolicy
  scripts?: readonly HeadScript[];        // src | inline (branded) | jsonLd
}
interface HeadMeta { name?: string; property?: string; httpEquiv?: string; itemprop?: string; content: string; media?: string; key?: string }
type HeadScript =
  | { src: string; type?: "module" | "classic"; strategy?: ScriptStrategy; id?: string; integrity?: string; crossorigin?: "anonymous" | "use-credentials"; referrerpolicy?: string; key?: string }
  | { inline: InlineScript; strategy?: "blocking" | "eager" | "defer"; data?: unknown; id?: string; key?: string }
  | { jsonLd: object; id?: string; key?: string };
type ScriptStrategy = "blocking" | "eager" | "defer" | "load" | "idle" | "interaction";
```
- `InlineScript` = branded string from `import x from "./init.ts?script"` (built + minified at build, static content → stable hash) or `unsafeInlineScript(code)` (escape hatch, named so in review). Plain strings rejected by types and at runtime (brand check).

### Dedupe keys (explicit `key` overrides)
| Entry | Key |
|---|---|
| title / titleTemplate / base / html.* / body.class | single (html/body attrs merged per attribute) |
| meta | `n:name` / `p:property` / `h:httpEquiv` / `i:itemprop`, + `media` when present |
| link canonical | single |
| link alternate | `rel + hreflang + type` (feeds: rel+type+href) |
| link icon / apple-touch-icon | `rel + sizes + media` |
| link preload / modulepreload / preconnect / stylesheet | `rel + href` (image preload: `href ?? imagesrcset`) |
| script src | `id ?? src` |
| script inline | `id ?? hash(content)` |
| jsonLd | `id`; no id → never deduped (several blocks allowed) |

### Merge order (rank, last wins per key)
- Rank = `(level, phase, seq)`:
  - `level`: document defaults −1, layouts 0…n−1 outer → inner, page n.
  - `phase`: 0 = route `head` export, 1 = components rendered under that level.
  - `seq`: render order within level.
- ⇒ inner route beats outer; within a level a component beats the export (component is more specific). A layout component's `<Title>` never beats the page's `head.title`.
- Level known at render: codegen wraps each layout/page element in `<HeadLevel n>` (server `Provider`, no markup) — only when head hold is on.
- Document defaults: new `createApp({ head })` (level −1) instead of hardcoding defaults inside the shell (playground's description fallback moves there) → defaults survive client navigation.

### Tag order (`headTags`, capo.js order)
1. shell: `charset`, `viewport`, CSP `<meta>` (hashCSP inserts after `<head>`) · 2. `base` · 3. `title` · 4. `preconnect` · 5. async/eager scripts · 6. sync (blocking) scripts · 7. stylesheets (global `styles` first, then route CSS outer → inner) · 8. preloads (fonts, LCP image) · 9. defer/module scripts · 10. prefetch / dns-prefetch · 11. SEO meta, OG, Twitter, icons, manifest, alternates, canonical · 12. JSON-LD.
- `headTags(head, { styles })` emits all 1–12 except shell items; existing escaping kept (`escapeText`/`escapeAttribute`).
- Order change affects router snapshots/playground only (pre-1.0); bench lanes don't use the router.

## API examples
```tsx
// routes/items/[id].tsx — route export (primary, data-driven)
import { seo, jsonLd } from "@rivetjs/kit";
export const head = ({ data, url }) => ({
  ...seo({ title: data.name, description: data.summary, url, image: data.photo, type: "product" }),
  scripts: [jsonLd({ "@context": "https://schema.org", "@type": "Product", name: data.name, sku: data.sku })],
});

// any component — component-owned head (collected during shell render)
import { Title, Meta, Link, Head, Script, JsonLd } from "@rivetjs/kit";
import { Picture } from "@rivetjs/kit/image";
import { Font } from "@rivetjs/kit/font";
import inter from "../fonts/Inter.woff2?font&family=Inter&weight=100..900&fallback=Arial";
import gtagInit from "./gtag-init.ts?script";

export function ProductHero({ product }) {
  return (
    <>
      <Title>{product.name}</Title>
      <Meta name="description" content={product.summary} />
      <Link rel="preconnect" href="https://cdn.example.com" />
      <Head value={{ meta: [{ property: "og:type", content: "product" }] }} />
      <Font font={inter} preload />
      <Picture image={product.photo} alt={product.name} priority />   {/* → eager + fetchpriority=high + head preload */}
      <JsonLd data={{ "@type": "Offer", price: product.price }} id="offer" />
      <Script src="https://www.googletagmanager.com/gtag/js?id=G-1" strategy="idle" />
      <Script inline={gtagInit} data={{ id: "G-1" }} strategy="idle" />
    </>
  );
}
```
- Components render nothing in place (server: push to collector, return `undefined`). `<Picture>` renders in place and pushes its preload.
- Values are read once at SSR (props are values). Live updates after resume: `useTitle(() => …)` / `useMeta(name, () => …)` = `clientEffect`-backed hooks (resumable like any effect; zero JS until the effect's schedule).

## Kit modules
| Subpath | Contents | Depends |
|---|---|---|
| `@rivetjs/kit` | `Head`, `Title`, `Meta`, `Link` (head), `Script`, `JsonLd`, `useTitle`, `useMeta`, `loadScript`, builders `seo`, `openGraph`, `twitterCard`, `canonical`, `alternates`, `jsonLd`, `unsafeInlineScript`, `ThemeScript` | router (shared types) |
| `@rivetjs/kit/dom` | DOM target of the above (head manager); Vite plugin resolves `@rivetjs/kit` → `/dom` in client envs (same as images' `/image/dom`) | runtime/dom |
| `@rivetjs/kit/image` | `Picture`, `Image` (= `Picture as="img"`) over `@rivetjs/runtime/image` + head preload | images feature |
| `@rivetjs/kit/font` | `Font`, font descriptor types | — |
| `@rivetjs/kit/router` | `NavLink`, `Form` (typed via `.rivet/routes.d.ts`) | router |
| `@rivetjs/kit/vite` | `kit({ fonts?, icons?, scripts? })`: `?script`, `?font` loaders, icon/manifest emission, flags router head hold | compiler/vite, images processor |
| `@rivetjs/kit/client` | ambient types for `*?script`, `*?font` | — |

## Feature details

### Head / Title / Meta / Link
- Server: `useContext(HeadSink)` (from `ServerData` value) → `sink.push(level, entries)`; no sink (kit used outside router) → dev error "kit head needs @rivetjs/router (or renderWithHead)".
- Builders are pure, usable in route exports and `<Head value>`: one shape everywhere.
- `canonical(url, { baseUrl, trailingSlash?: "keep"|"never"|"always", query?: string[] })` → strips query except allowlist, absolute.
- `alternates({ url, baseUrl })` → `hreflang` links + `x-default`; uses `@rivetjs/i18n/router` (`localizeHref`, locale list) when installed, else explicit `{ [locale]: href }`. `og:locale` + `og:locale:alternate` from the same.
- `openGraph({ title, description, url, image: ImageDescriptor | string, type, siteName, locale })` → `og:*`; descriptor → `og:image`, `:width`, `:height`, `:type` (fallback-format variant); `twitterCard({ card: "summary_large_image", site, creator })` reuses OG values (no duplication of title/description: Twitter falls back to OG).
- Absolute URLs: `createApp({ baseUrl })` (also used by i18n hreflang); relative `og:image`/canonical without `baseUrl` → dev error, prod: resolved against request origin.

### Head hold (router `render.ts`)
- `renderPage` with hold: writer wrapper buffers app chunks → at shell end: `merged = rankMerge(routeHeadRanked, sink)` → `document({ ...input, head: merged })` → write `start`, buffered chunks, then pass-through.
- `renderResumable` gains `onShell?(): void | Promise<void>` (called after state/loader scripts of the shell, before the first segment). `renderToWriter` (dev/no manifest): hold until done.
- Late entries (pushed after `onShell`, i.e. inside streamed segments): `link` preload/modulepreload/stylesheet + `script` → written in place in the segment (valid in body); `title`/`meta`/`html` → dropped, dev error naming the component; prod `onError`-style warning once per route.
- Errors before shell end → nothing written yet → status still changeable (bonus: `_error` page can render cleanly for shell-time throws).

### Client head manager (`@rivetjs/kit/dom` + `@rivetjs/router/client`)
- SSR marks managed tags with `data-rh` (only pages with client navigation runtime; ~8 B/tag). Shell tags (charset, viewport, global CSS, CSP meta) unmarked → never touched.
- On navigation: router passes data endpoint `head` (route exports, ranks) + components' DOM-side pushes (Head components run on the DOM target when the new page renders) → keyed diff over `head > [data-rh]`: update attrs in place, insert missing, remove stale. `document.title`, `<html lang dir>` updated.
- Scripts: never re-executed (registry by key); removed only from DOM bookkeeping. JSON-LD: stale blocks removed; new blocks inserted via `rivet` TT policy `createScript` restricted to kit-serialized JSON (see CSP) — recommend SSR-first, see open Q.
- Resume: static head components never execute in the browser → zero JS. Manager chunk (~0.7 KB br est.) only in route chunks / CSR bundles.

### Script
- Strategies:
  | Strategy | Output | When runs |
  |---|---|---|
  | `blocking` | `<script src>` in head (dev warning: render-blocking) | parse |
  | `eager` | `<script async src>` (classic) / `<script type=module async>` | ASAP |
  | `defer` (default) | `<script defer src>` / module | after parse |
  | `load` | bootstrap list | after `load` |
  | `idle` | bootstrap list | `requestIdleCallback` after `load` (timeout 4 s), 150 ms scroll guard (same rule as resume preload) |
  | `interaction` | bootstrap list | first `pointerdown`/`keydown`/`touchstart`/`wheel`, fallback `maxDelay` (default none) |
- Bootstrap: one inline `<script>` (target ≤ 400 B min, measured) + `<script type="application/json" id="rivet-scripts">[…]</script>` at body end, only on pages with `load|idle|interaction` scripts. Works on pages without the resume runtime (static, no-JS pages).
- `inline` scripts: static content (`?script` build output); `data` → JSON block read by the inline script (`document.currentScript.previousElementSibling`), never string-concatenated into code.
- `loadScript(src, { strategy })` client helper (promise; same registry) for code that needs `onLoad`: `clientEffect(async () => { await loadScript(GTAG); gtag(…) }, { when: "idle" })`. No closures on `<Script>` (would need resume symbols).
- Dedupe across components and navigations by key.

### JsonLd
- `<script type="application/ld+json">` + `escapeJSON` (from `@rivetjs/runtime/resume-format`: `<`, `>`, `&`, U+2028/9 escaped → `</script>` in data can't break out).
- Data block, not executable → no nonce, not hashed (`hashCSP` `executable()` already skips non-JS types; test).
- Types: generic `JsonLd<T extends object>`; optional peer `schema-dts` for typed Things.

### Image / Picture (`@rivetjs/kit/image`)
- Wraps images' `Picture` (unchanged markup builder `pictureHtml`); adds `preload?: boolean | "auto"` (default `"auto"` = on when `priority`).
- `priority` → `loading=eager fetchpriority=high` (images spec) + head preload via `preloadLink()`: one `<link rel=preload as=image imagesrcset imagesizes type>` for the **best** type only (browsers skip unsupported-type preloads; fallback fetched normally → no double download).
- Art direction (media map): one preload per media with mutually exclusive queries built as `(q2) and (not (q1))` (MQ L4 `not`), keyed per media.
- `sizes="auto"` keeps lazy (no preload; images spec TypeError on `priority`).
- Images spec stays explicit ("no hidden head side effects") at runtime level; kit is the opinionated layer.
- Placeholder inline `style` → needs `style-src-attr` when a style CSP is enabled (see CSP table).

### Fonts (`@rivetjs/kit/font` + `kit({ fonts })`)
- Import: `./Inter.woff2?font&family=Inter&weight=100..900&style=normal&display=swap&fallback=Arial&unicodeRange=U+0000-00FF` → `FontDescriptor { family, stack, src, format, weight, style, display, preload: HeadLink }`.
- Plugin emits `@font-face` (+ fallback face: `src: local(Arial); size-adjust; ascent-override; descent-override; line-gap-override` from metrics read at build by optional peer `@capsizecss/unpack`) into a virtual CSS module imported by the `?font` module → lands in route CSS (external sheet; CSP-clean).
- `font.stack` = `"Inter", "Inter Fallback", sans-serif` → use in Tailwind `@theme { --font-sans: … }` or css``.
- `<Font font preload />` → head preload `<link rel=preload as=font type=font/woff2 crossorigin href>` (fonts always need `crossorigin`). Preload explicit: each preload competes with LCP.
- Default `font-display: swap`; asset hashed under `assets/`.

### Icons / manifest (`kit({ icons })`)
- `icons: { src: "src/icon.svg", name, shortName, themeColor, background, maskable? }` → build (images processor/sharp) emits `icon.svg`, `icon-32.png`, `apple-touch-icon.png` (180, flattened on `background`), `icon-192.png`, `icon-512.png` (+ maskable), `manifest.webmanifest`; adds level −1 head entries (icon links, manifest, `theme-color`). Dev: served from memory.

### NavLink / Form (`@rivetjs/kit/router`)
- `<NavLink to="/items/[id]" params={{ id }} prefetch="intent" | "none">` → plain `<a href>` (router interception is delegated → zero JS per link); typed by generated route ids; `prefetch="none"` → `data-rivet-noprefetch`; `aria-current="page"` at SSR when matched; router client updates `[data-current]` links after navigation (one delegated pass, no per-link bindings).
- `<Form action="save">` → `<form method="post" action="?/save">` typed by the route's `actions`; enhancement = router's existing behaviour.

### ThemeScript
- `<ThemeScript storageKey="theme" attribute="data-theme" />` → blocking inline (static content per props → stable hash; nonce under strict CSP) setting the attribute before first paint. Only kit inline script allowed `blocking`.

## Compiler / runtime / build changes (kit)
- Compiler (Rust): none. Kit renders through `template([html])` / DOM `template({ html, slots: [], context: "html" })` like images; `<script>` JSX ban stays.
- Runtime: `renderResumable` `onShell` hook; export `escapeJSON` already exists.
- Router: `shared/data.ts` (Head extension, ranked entries), `server/app.ts` (`rankMerge`, `createApp({ head, baseUrl })`), `server/render.ts` (hold, capo `headTags`, `data-rh`), `build/codegen.ts` (`HeadSink` in `ServerData`, `HeadLevel` wrappers, gated), `client/index.ts` (manager hook), `adapters/static.ts` (`hashCSP` additions below), `shared/csp.ts` (policy names, style options).
- Kit Vite plugin: `?script` (bundle entry as IIFE via `this.environment` build of a virtual entry / esbuild transform + minify; output string + sha256), `?font`, icons, sets router `head: "components"`.

## SSR / resume / CSP impact (kit)
| Output | Nonce policy (`strictCSP`) | Static (`hashCSP`) | Trusted Types |
|---|---|---|---|
| `<script src>` same-origin | `nonce` attr from render context | `'self'` | parser-inserted, not a sink |
| `<script src>` third-party | `nonce` (strict-dynamic: no host list) | `hashCSP` adds the origin (scans `<script src>`) | — |
| bootstrap inline | `nonce` | hashed (existing inline-hash path) | creates scripts: `src` via policy `rivet-script` `createScriptURL` (allowlist = URLs in `#rivet-scripts`) |
| bootstrap-injected script | trusted via `'strict-dynamic'` | `hashCSP` adds origins from `#rivet-scripts` JSON | TrustedScriptURL |
| `?script` inline | `nonce` | hash (static content) | — |
| JSON-LD | data block, no nonce | not hashed | SSR only; client insert via `createScript` on JSON we serialized |
| ThemeScript | `nonce` | hash | — |
| image placeholder `style=""` | needs `style-src-attr 'unsafe-inline'` iff style CSP on | same | — |
| `@font-face`, route CSS | external sheet | external | — |
- Nonce source: `ServerData` value gets `nonce` (router already has it per request); kit never reads `Request`.
- `trustedTypesDirectives` adds `rivet-script` only when kit's bootstrap/manager can run (kit sets `CSPOptions.policies`).
- Resume: kit adds no resume symbols, no state entries; `useTitle`/`useMeta` = ordinary resumable effects.
- Streaming: see head hold; stream add-on unaffected.

## Zero-cost (kit)
- No kit in build → router codegen identical, no `HeadLevel`, no hold, no `data-rh`, `headTags` order change only (playground snapshots) — ssr-bench lanes don't use router → byte-identical.
- Kit installed, page without head components → hold costs one collector array + ≤ n Providers; sync page still one write (measure `apps/playground` `latency` p50; budget ≤ +2%).
- Static head → zero browser JS on resumed pages (Chromium: zero module requests before interaction unchanged).

## Testing (kit)
- Unit (`libs/kit/tests`, `node --test`): rank merge table (levels × phases × keys), dedupe keys, `titleTemplate`, capo order snapshot, builders (OG/Twitter/canonical/alternates incl. i18n), JSON-LD escaping (`</script>`, U+2028), `InlineScript` brand rejection.
- Router: hold — sync page byte-equal except head; streamed page: head before shell, segments after; late title → dev error; shell-time throw → clean `_error`; no kit → codegen/output unchanged (snapshot).
- Static: `hashCSP` origin collection, bootstrap hash, JSON-LD not hashed.
- Chromium (Playwright): strategies timing (`idle` after `load`, `interaction` on first input, scroll guard), dedupe across navigations, head manager diff on nav/back, `document.title`, `html lang`; zero CSP violations under `strictCSP` + TT, and under static hash CSP with third-party origin; LCP preload used (no double download, `currentSrc` vs preload URL), font preload consumed (no "preloaded but not used" warning).
- Playground: Lighthouse SEO 100, Best Practices 100, no CLS from fonts (fallback metrics).

## Phases (kit)
1. Head model + rank merge + hold + `Head/Title/Meta/Link` + builders (`seo`, OG, Twitter, canonical) + capo `headTags` + `createApp({ head, baseUrl })` + client manager.
2. `Script` (strategies, bootstrap, `?script`), `JsonLd`, `loadScript`, CSP/TT additions, `hashCSP` origins.
3. `@rivetjs/kit/image` (after images lands), `Font` + fallback metrics, `alternates` (after i18n router integration).
4. Icons/manifest, `NavLink`/`Form`, `ThemeScript`, `useTitle`/`useMeta`.

---

# Part 2 — Inline scoped styles

## Goal
- Component-owned CSS co-located in TSX, scoped, extracted to static CSS at build; no runtime style injection in prod; Vite HMR in dev.
- SSR links exactly the CSS a route can render (per-route chunks), in head, early; dedupe across islands/resume chunks.
- Dynamic values via CSS custom properties bound to signals; no `style` attribute injection.
- Coexists with Tailwind (both directions: `@apply` inside, utilities override from parent). CSP-clean (external sheets; nonce/hash only for opt-in inline critical CSS).
- Zero-cost: compiler output byte-identical when unused; ssr-bench lanes unaffected.

## Options compared — syntax
| Option | Co-location / DX | Static extraction | SSR class cost | Types / typo safety | Tailwind | Editor tooling | Compiler work | Verdict |
|---|---|---|---|---|---|---|---|---|
| `<style>` child in component TSX (Vue/Svelte-like) | high, implicit | yes | static (needs element tagging) | n/a | `@apply` via `@reference` | needs custom TSX grammar; `{}` clash with JSX text → template-literal child | selector↔element matching analysis, implicit scope attrs on elements; lifts current `<style>` ban | rejected v1 |
| **css\`\` tagged template → class map** (Linaria/CSS-Modules semantics) | high, explicit | yes | **inlined into static fragments → 0** | unknown key = compile error | yes | existing `css\`` highlighters (lit/styled plugins) | tokenizer + constant inlining | **adopt** |
| `.module.css` co-located file | medium (2 files) | yes (Vite native) | runtime object lookup → dynamic class slot (escape per render) | generic `Record` | yes | full CSS tooling | none v1; table inlining v3 | support (works today) |
| Style objects (`style={{}}` / vanilla-extract `.css.ts`) | TS-typed | vanilla-extract: yes; inline objects: no | inline `style` = per-render + CSP `style-src-attr` | strong | poor | TS | large; `style` banned today | rejected |

## Options compared — scoping
| Option | Mechanism | Browser support | Bytes | Specificity / overrides | Verdict |
|---|---|---|---|---|---|
| **Hashed class (CSS Modules)** | `.card` → `.card_k3x9a` | all | class names only | 1 class; explicit; parent override via layers/utilities | **adopt** |
| Per-element scope class/attr (Svelte/Vue) | `.card.s-k3x9` + attr on every matched element | all | + attr per element | +1 class/attr | rejected (analysis + bytes) |
| `@scope (…) to (…)` | native donut scope | Baseline only since Firefox 146 (Dec 2025); older browsers drop the rules entirely | scope root marker | proximity | later opt-in |
| Shadow DOM | DSD | broad | template dupes | isolates Tailwind (breaks it) | rejected |
| Cascade layers | `@layer components { … }` | all evergreen | none | orthogonal: decides utilities vs component order | **adopt as wrapper** |

## Options compared — what CSS ships
| Option | Ships | Early flush | Render cost | Caching | Verdict |
|---|---|---|---|---|---|
| One app sheet | everything | yes | 0 | one file, best | option `css.split: "app"` |
| **Per-route chunks (build-time, Vite code split)** | CSS of route's module graph | yes | 0 | per chunk | **default** |
| Per-render collection (only rendered components) | exact | needs head hold | `Set.add` per component render (hurts row lists) | poor (per page combos) or inline | rejected (zero-cost rule) |
| Inline critical `<style>` | above-fold | yes | build or per-request | none | later opt-in (`css.inline`) |

## Recommendation
- `css` tagged template from `@rivetjs/runtime/css` at module top level, returning a frozen class map; compiler inlines `s.card` into static template fragments.
- Hashed class names (deterministic from root-relative module id + local name; never from content → stable across edits, equal in SSR and client builds).
- Output wrapped in `@layer components` (configurable; `false` = unlayered).
- Extracted per module into a virtual CSS module → Vite CSS pipeline (Tailwind, lightningcss/postcss, minify, code-split) → per-route CSS linked by the router in head.
- Dynamic values: `style:name={…}` → custom property `--name` only. Plain `style` stays banned.
- `.module.css` supported as-is (Vite); route CSS discovery covers it.
- `<style>` in JSX stays a compile error; message updated to point at css``.

## API examples
```tsx
import { css, cx } from "@rivetjs/runtime/css";
import { signal } from "@rivetjs/reactivity";

const s = css`
  .card { padding: 1rem; border: 1px solid var(--color-slate-200); border-radius: .75rem; }
  .card:hover .title { color: var(--accent, var(--color-teal-700)); }
  .title { font-weight: 600; @apply tracking-tight; }      /* Tailwind @apply via css.reference */
  @media (width >= 48rem) { .card { padding: 1.5rem; } }
  @keyframes pulse { 50% { opacity: .5 } }                  /* scoped: pulse_k3x9a */
  .busy { animation: pulse 1s infinite; }                   /* rewritten to pulse_k3x9a */
  :global(.dark) .card { background: #0f172a; }             /* .dark untouched */
`;

export function Card(props: { title: string; accent?: () => string; class?: string; busy?: () => boolean }) {
  return (
    <article class={cx(s.card, props.class)} style:accent={props.accent}>
      <h2 class={`${s.title} text-lg`}>{props.title}</h2>                 {/* static → class="title_k3x9a text-lg" */}
      <p class={() => cx(props.busy?.() && s.busy)}>…</p>
    </article>
  );
}

// Parent override: Tailwind utilities (layer utilities > components) or own class
<Card title="Hi" class="p-8" accent={() => color()} />
```
- SSR of `<h2>`: `<h2 class="title_k3x9a text-lg">` — same bytes and same template shape as a hand-written class string.
- `style:accent={sig}` SSR: `style="--accent:#0f766e"`; DOM: `el.style.setProperty("--accent", v)` in an effect; resumable binding when it reads signals, else static.

## Compiler changes (Rust, `libs/compiler/rust/src`)
- `lib.rs`: `CompileOptions.styles?: { scope: string; names?: "readable" | "short"; layer?: string | null }` (absent → feature off). Response adds `css?: string`, `cssClasses?: Record<string, Record<string,string>>` (binding → map), diagnostics as today.
- New `styles.rs`:
  - Binding resolution: `css` imported from `@rivetjs/runtime/css` (import binding, not name — same rule as i18n `staticCalls`; shadowing safe).
  - Allowed: `const X = css\`…\`` at module top level; no `${}` (diagnostic: "css`` interpolations are not supported; use style:name custom properties"); elsewhere → diagnostic.
  - Tokenizer (hand-written CSS Syntax L3 subset: comments, strings, `url(…)`, idents incl. escapes/unicode, numbers incl. `.5em`, hash, delims, `{}` `()` `[]` blocks, at-rules). Rewrites in selector preludes (top-level and nested rules, `:is/:where/:not/:has` args): `.ident` → scoped; `:global(sel)` unwrapped untouched; `:local(sel)` scoped. At-rules: `@media/@supports/@container/@layer` preludes untouched; `@keyframes n` → scoped name; `animation`/`animation-name` values rewritten for names declared in the same block.
  - Output: rewritten CSS (wrapped `@layer <layer>{…}`) + map `{ local → scoped }`.
  - Names: readable `<local>_<hash5>` (dev default), short `r<hash6>` (prod default); hash = base36 sha of `scope + local`; build-wide collision check in the plugin registry → error.
- `compile.rs`:
  - Pre-pass collects css bindings → `FxHashMap<SymbolId, ClassMap>`.
  - Constant folding where a value is statically known: `X.card` (non-computed, known key) → string literal; unknown key → diagnostic ("unknown class 'titel' in css block X"). Template literal / `+` of literals and folded members → literal. `class`/`className` attr with folded literal → static fragment (`walk_server` static path; `walk_dom` html part) — byte-identical to authored string.
  - `X[expr]`, passing `X` around → keep object: declaration replaced by `const X = /*#__PURE__*/Object.freeze({card:"card_k3x9a",…})`.
  - `style:<name>` (JSXNamespacedName, namespace `style`, local `[a-z][a-z0-9-]*`) on native elements only: static literal → validated at compile time → static fragment; dynamic → new slot kind. Several `style:` on one element → one `style` attribute (server) / one target (DOM). Plain `style`, `style:` on components → diagnostic. `safe_attribute_name` keeps rejecting `style`.
  - `<style>`/`<script>` diagnostic text: "…; use css`` from @rivetjs/runtime/css or build-time assets".
- `resume.rs`: site kind `StyleVar` (like `Attr`): signal-reading `style:` values → resumable binding (`bindStyleVar` symbol); symbol modules referencing `X` dynamically get a copy of the frozen literal (no import of the source module, no CSS import).
- `facts.rs`: `styles: bool` in module facts (used by grouping/route CSS diagnostics; cheap).
- Wasm size: tokenizer ≈ 10–20 KB (vs 2.6 MB today); no `lightningcss`/`cssparser` crate (keeps wasm small); Vite pipeline does real CSS processing afterwards.

## Runtime changes
- `libs/runtime/css.ts` (`@rivetjs/runtime/css`): `css` marker (throws if reached uncompiled: setup hint), `cx(...parts)` (string join, falsy skipped; ~80 B), `cssUrl(url)` brand for custom-property URLs.
- Server (`server.ts`): `_styleVars(names, values)` slot writer → `style="--a:v;--b:w"`; separate export (tree-shaken when unused).
- DOM (`dom.ts`): `bindStyleVar(el, name, read)` → `setProperty`/`removeProperty` in effect.
- Shared validator `cssValue(v)`: numbers → `String`; strings rejected if containing `; { } < > \ !` or `url(`/`image(`/`image-set(`/`src(`/`expression(`/`@` (case-insensitive), unbalanced quotes/parens, length > 1024; `cssUrl` brand → `url("…")` with escaping, http(s)/relative only; invalid/nullish → property omitted (+ dev warning). Same function server + DOM + compile-time literal check (Rust port of the same rules; table-tested for parity).
- `jsx-runtime.ts` types: `` [k: `style:${string}`]: string | number | null | undefined | (() => string | number | null | undefined) `` on intrinsic elements.

## Vite plugin / build (`libs/compiler/vite.ts`)
- `rivet({ css?: { layer?: string | false; names?: "readable" | "short"; reference?: string; split?: "route" | "app" } })`.
- Gate: pass `styles` option to `compile` only when source contains `@rivetjs/runtime/css` (substring precheck) → otherwise identical call → byte-identical output.
- `transform`: store `result.css` by module id; prepend `import "<file>?rivet-css&lang.css";` (both envs; Vite SSR build drops CSS content).
- `load("<file>?rivet-css&lang.css")`: CSS from cache (compile on demand if CSS loaded first); prefix `@reference "<css.reference>";` (Tailwind v4 needs it for `@apply`/theme in separate CSS modules) → normal Vite CSS pipeline.
- Resume: `compileSymbolModule` output never imports CSS (CSS ships with route/entry chunks; symbol chunks stay JS-only) → no duplicate loads across islands/resume chunks.
- Orphans (modules with CSS unreachable from any client chunk; SSR-first apps without router): shared registry (`sharedDuringBuild`, like images); client `generateBundle` emits `assets/rivet-orphans-<hash>.css` + build warning; linked on all pages.
- Dev HMR: class names don't depend on CSS text → on edit, if compiled JS (minus css) is unchanged, `hotUpdate` returns only the CSS module (Vite swaps `<style>`; component untouched); else normal component hot replace (state kept) + CSS update.
- Library components (node_modules are not transformed): libraries ship precompiled JS + sidecar CSS (`import "./x.css"`), hashed with package name; documented, tooling later.

## Router / SSR CSS delivery
- Build (`adapters/build.ts`): today all entry CSS goes to every page. New: per route id → ordered CSS list = global `styles` → shared chunks → layout chunks outer → inner → page chunk, from the Vite client manifest (`css` of route chunk + static `imports` closure + `dynamicImports` that are SSR-rendered lazy components — v1: all dynamic imports except route modules; over-ship small, never FOUC).
- `DocumentInput.styles` becomes per route; `headTags` position 7 (capo). `css.split: "app"` → single sheet for all routes.
- Client navigation: Vite's preload helper loads a route chunk's CSS `<link>` before the module executes → no FOUC; external sheet → CSP `style-src 'self'` OK.
- Dev: router middleware walks the SSR module graph of the matched route modules, emits `<link rel=stylesheet data-rivet-dev-css href="/src/x.tsx?rivet-css&direct&lang.css">` (no FOUC); `entry.dev.tsx` removes them once Vite's injected `<style>`s for the same ids exist.
- Cascade order: Tailwind declares `@layer theme, base, components, utilities;` in the global sheet, linked first → component layer slots in correctly; each extracted chunk also starts with the configured order statement (`css.layers`, default Tailwind's) so order holds even if a chunk loads first.

## Tailwind, theming, overrides
- Both coexist: utilities in `class` strings next to `s.x`; `@apply` + theme vars inside css`` (via `reference`).
- Override from parent: child merges `props.class` (`cx`); Tailwind utilities beat component CSS (utilities layer later); parent css`` vs child css`` in the same layer → same specificity → source order: child module is imported by parent → child CSS precedes parent's in the chunk/link order → parent wins (documented guarantee for import-ordered modules).
- Theming: tokens = CSS custom properties (Tailwind v4 `@theme` vars or own `:root` vars); variants by `[data-theme]` / `prefers-color-scheme`; per-instance values via `style:`; no theme provider JS. Kit `ThemeScript` prevents flash.

## SSR / resume / CSP impact (styles)
- SSR: static classes = static fragments (no slot); `style:` dynamic = one attribute slot per element.
- Resume: zero JS for static classes; `style:` bound to signals = ordinary attr-like binding; CSS never travels in resume state.
- CSP (default unchanged: no `style-src` set). New opt-in `strictCSP(nonce, { styles: true | { attributes: boolean } })` → `style-src 'self' 'nonce-N'` + `style-src-attr 'unsafe-inline'` (when `style:` or image placeholders used; `attributes: false` → `'none'`, kit disables placeholders, `style:` initial values then come only from CSSOM after resume — documented trade-off). Static: `hashCSP` `styles` → `style-src 'self' 'sha256-…'` for inline `<style>` + same `style-src-attr` rule.
- CSSOM (`style.setProperty`) is not governed by CSP; not a Trusted Types sink. Extracted sheets are external → no TT/CSP concerns. Dev: Vite-injected `<style>` fine with default policy; with `styles: true` in dev, nonce passed via Vite `html.cspNonce`.
- Inline critical CSS (later): `<style nonce>` (server) / hashed (static).

## Zero-cost (styles)
- No `@rivetjs/runtime/css` import → `styles` option not passed → Rust path untouched → compiled output byte-identical (all existing compiler snapshots unchanged; test asserts).
- `style:` only parsed when present; `_styleVars`/`bindStyleVar` separate exports.
- ssr-bench lanes don't use the feature → byte-identical HTML/compiled artifacts; optional non-claim lane variant `rivet-compiled-styled` (same markup, classes via css``) must equal the plain lane's HTML byte-for-byte and CPU within noise.
- Client: no runtime for static classes; CSS cached external files.

## Testing (styles)
- Rust unit (tokenizer/rewriter): comments, strings, `url()` with dots, `.5em`, escapes/unicode idents, nesting, `:is/:not/:has`, compound `.a.b`, attribute selectors (untouched), `@media/@supports/@container/@layer`, `@keyframes` + `animation` rewrite, `:global/:local`; fuzz against `lightningcss` parse equivalence (dev-dependency in TS tests, not shipped).
- Compiler snapshots: folded class = byte-equal to hand-written; dynamic map access; unknown key / interpolation / non-top-level / `<style>` diagnostics; `style:` server/DOM/resume output; shadowed `css` not matched; feature-off byte-identity.
- Runtime: `cssValue` table (Rust/TS parity), `_styleVars` merge/omission, `bindStyleVar` updates/removal.
- Vite (`libs/compiler/tests`): virtual CSS through Tailwind `@apply` with `reference`; build per-route CSS; orphans; SSR + client class names equal; CSS-only HMR keeps component state; JS change hot-replaces.
- Router: per-route link order; `split: "app"`; dev links + removal.
- Chromium: no FOUC at first paint (computed style before `load`), client nav applies route CSS before render, zero CSP violations with `styles: true` (+ `style:`) and TT on, parent utility override wins.

## Phases (styles)
1. css`` + tokenizer + class folding + virtual CSS + per-route CSS links + dev links + HMR.
2. `style:` custom properties (server/DOM/resume) + validator + CSP `styles` options (+ `hashCSP`).
3. `.module.css` class inlining via a registered class table (reuses i18n's data-table hook), orphans polish, `css.inline` critical CSS, `@scope` opt-in, library precompile tooling.

---

## Open questions (recommended answer first)

Kit
1. Head-link vs navigation `Link` name clash → **`Link` = head link (as requested), navigation = `NavLink` in `@rivetjs/kit/router`**; alt: `Link` = navigation (Next convention), head = `HeadLink`.
2. Same-level precedence route export vs component → **component wins within a level; inner level always wins**; alt: export always wins (export = authoritative).
3. Hold scope → **always on when kit installed** (sync pages already one write; measure streamed TTFB); alt: per-route hold from build facts (complex: needs transitive component graph); escape: `rivetRouter({ head: "early" })` disables component head.
4. Head inside streamed `Async` segments → **dev error for title/meta, in-place for body-valid tags**; alt: patch via stream script (extra JS, crawler-invisible).
5. Script bootstrap → **separate tiny inline script v1** (works without resume runtime); later merge into resume loader when both present (one listener set).
6. JSON-LD on client navigation → **SSR authoritative; client removes stale, inserts new via `rivet` TT policy restricted to kit-serialized JSON**; alt: SSR-only, no client insert (crawlers do full loads).
7. `priority` ⇒ preload → **yes in kit** (images runtime stays explicit); alt: explicit `preload` only.
8. Font fallback metrics → **optional peer `@capsizecss/unpack`**, skipped with warning when absent; Google Fonts download → later.
9. Kit without router → **v1 router-only**; later `renderWithHead(factory, writer, { document })` in kit.
10. Capo reordering of existing `headTags` output → **yes** (pre-1.0; playground/router snapshots update).
11. `html`/`body` attrs in `Head` → **yes** (i18n `lang`/`dir` need it; free with hold; without kit, router keeps shell-provided attrs).
12. cdk+aria interplay (spec pending) → **kit stays SEO/document-level; cdk owns interactive primitives; cdk components style via css`` + `style:` (no runtime injection)**; re-check when that spec lands.

Styles
1. Primary syntax → **css`` tagged template**; alt: `<style>` in JSX (needs element matching, lifts a safety ban).
2. css`` interpolations → **none v1**; later compile-time constants only (literal module consts), never runtime values (use `style:`).
3. Default layer → **`@layer components`**, configurable / `false`.
4. Parent-over-child guarantee beyond import order → **v1 rely on import order + utilities layer**; later `css.layer("overrides")` sublayer if real cases appear.
5. Granularity → **per-route default**, `split: "app"` for small sites; per-render collection rejected (zero-cost).
6. Critical CSS inlining → **later opt-in threshold**, nonce/hash aware; default external links.
7. Prod class names → **short hashed `r<hash6>` with build collision check**; readable in dev; alt: global counter minification (needs cross-env registry, non-deterministic risk).
8. Tokenizer → **hand-written in Rust** (wasm size, exact control); alt: `cssparser` crate (+size, still need rewriting logic).
9. `.module.css` inlining → **phase 3 via class table**; v1 runtime map lookup.
10. `@scope` → **later opt-in** once old-browser share negligible.
11. `style:` naming → **literal kebab (`style:accent-color` → `--accent-color`)**, no camelCase conversion.
12. Invalid `style:` value → **omit property + dev warning**; alt: throw (crashes render on user data).
13. Third-party/library css`` in node_modules → **precompiled sidecar CSS**; plugin keeps skipping node_modules.

## Decisions (user, 2026-10-03)
- Scoped styles: `css` tagged templates (primary) plus importing stylesheet files of any Vite-supported language (`.css`, `.scss`/`.sass`, `.less`, `.styl`); `*.module.<ext>` files give scoped class maps like `css` (preprocessor package installed by the app).


## Decisions — open questions resolved (user, 2026-10-03)
Unpicked questions take the recommended answer.
- kit-styles-k1 · Link name clash: Link = head link; NavLink = navigation — As requested; navigation in @rivetjs/kit/router.
- kit-styles-k2 · Head precedence: Component wins; inner level always wins — Closest to the content wins.
- kit-styles-k3 · Waiting for head: Always on with kit — Sync pages already send in one write; measure streamed pages; head: 'early' opts out.
- kit-styles-k4 · Head in streamed parts: Dev error for title/meta — Body-valid tags stay in place.
- kit-styles-k5 · Script bootstrap: Separate tiny inline script now — Later merged into the resume loader when both exist.
- kit-styles-k6 · JSON-LD on navigation: Update, restricted to kit JSON — Server is authoritative; client swaps via a locked-down Trusted Types policy.
- kit-styles-k7 · priority implies preload: Yes in kit — Less boilerplate.
- kit-styles-k8 · Font fallback metrics: Optional @capsizecss/unpack peer — Skipped with a warning when absent; Google Fonts download later.
- kit-styles-k9 · Kit without router: Router-only in v1 — Later renderWithHead() for non-router use.
- kit-styles-k10 · Reorder head tags: Yes — Pre-1.0; playground and router snapshots update.
- kit-styles-k11 · html/body attributes: Yes — Free with head hold; without kit the shell keeps its attributes.
- kit-styles-k12 · Kit vs cdk roles: Kit = document/SEO; cdk = interactive — cdk styles via css`` + style:, no runtime injection; re-check later.
- kit-styles-s2 · Values inside css``: None in v1 — Later compile-time constants only; runtime values go through style:.
- kit-styles-s3 · Default CSS layer: @layer components — Configurable or disable with false.
- kit-styles-s4 · Parent overrides child: Import order + utilities layer — Later css.layer('overrides') if real cases appear.
- kit-styles-s5 · Stylesheet grouping: Per route; split: 'app' option — Small sites can use one file.
- kit-styles-s6 · Critical CSS inlining: Later opt-in threshold — Default stays external links.
- kit-styles-s7 · Production class names: Short hash r<hash6> + collision check — Deterministic; readable names in dev.
- kit-styles-s8 · CSS tokenizer: Hand-written in Rust — Smaller wasm, exact control.
- kit-styles-s9 · CSS modules inlining: Phase 3 via class table — v1 uses runtime map lookup.
- kit-styles-s10 · Native @scope: Later opt-in — Once old-browser share is negligible.
- kit-styles-s11 · style: naming: Literal kebab-case — style:accent-color → --accent-color; no conversion.
- kit-styles-s12 · Invalid style: value: Omit property + dev warning — Page still renders.
- kit-styles-s13 · Library css`` in node_modules: Precompiled sidecar CSS — Libraries ship CSS; plugin keeps skipping node_modules.


## Decisions — implementation (2026-10-03)
- kit-styles-k1 overridden · Head link = **`HeadLink`**; `Link` = the router's navigation component (built by the route transitions work). Kit's `NavLink`/`Form` (`@rivetjs/kit/router`) not built: navigation link lives in the router.
- Bootstrap: per-page code (only the strategies used) with the list inlined in the same script (no separate JSON block); code ≤ 400 B gzip in every combination (worst 399 B, load-only 258 B; list excluded). `touchstart` dropped (touch → pointerdown). Not merged into the resume loader.
- Trusted Types: `rivet-script` created once per page — bootstrap creates it (`createScriptURL` allowlist = its list; JSON-only `createScript` for JSON-LD) and exposes `document.$rs`; the head manager reuses it, else creates it. No `'allow-duplicates'` (handle reachable only by running script, outside TT's injection threat model). Apps list `rivet-script` in `trustedTypes` themselves (`CSPOptions.policies` auto-wiring not built).
- Client ranking approximation: layout components rank below the route `head` export of the matched route; page-level components win. Level-0 (root layout) component entries render `data-rh="0"` and persist across navigation.
- Inline scripts: always classic, run during parsing; `?script` loader deferred (only `unsafeInlineScript`).
- `createApp({ head })` document defaults (level −1) exist; not reachable from `rivetRouter` options yet.
- `?font`: typed import needs `&font` last (`*&font` / `*?font` module patterns); font file imported `?url&no-inline` so preload and `@font-face` share one asset.
- Shells pass `headTags(head, input)` (styles, nonce, managed marks) — shell contract, not automatic.
- Bundle hash gate: only new `@rivetjs/runtime/css` entry; `@rivetjs/kit*` entries are new packages.
