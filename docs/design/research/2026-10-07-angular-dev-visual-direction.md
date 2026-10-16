# Docs site visual direction — angular.dev reference study (2026-10-07)

Goal: rebuild `apps/docs` (+ shared `libs/docs-kit`) so it looks and feels close to angular.dev, in the Rivet brand. Findings measured in the built-in browser + headless Chromium (1440×900 and 375×812, light + dark) on 2026-10-07. Designs described in our own words; no upstream text, code, logos, illustrations or assets are reused. Screenshots (reference only, not committed): session scratchpad `angular-dev/`.

## 1. Global frame / layout grid

- **Three fixed columns, no top bar on desktop.**
  - Primary rail: `--primary-nav-width: 6.875rem` (110 px), full height, sticky, white @ 70 % + `backdrop-filter: blur(16px)`, 1 px right border. Items stacked vertically: logo (≈93 px block), version pill (`v22`, 12.8 px, 1 px border, 4 px radius), search button with `⌘` `K` keycaps, then 4 section icons with 14 px/500 labels below the icon (Docs, Tutorials, Playground, Reference; each ≈90 px tall, padding 20 px 0). Bottom: "more" (social links menu) + theme button. Active section: 2–3 px vertical bar on the rail's left edge + full-contrast label; inactive labels `--quaternary-contrast`.
  - Secondary nav: `--secondary-nav-width: 16.25rem` (260 px), sticky, own scroll, hidden scrollbar. **Drill-down** navigation: entering a group slides the panel horizontally to a sub-list headed by a back-arrow + group title (levels sit side by side, translated with transform). Items: 14 px/500, line-height 22.4 px, letter-spacing −0.14 px, padding 8 px 8 px 8 px 16 px, 1 px left border line for the whole list; active item = violet text + 2 px left gradient bar. Group items end with a chevron; external links an external icon. Small status tags after a title (`New` green, `Updated` blue: 11.2 px/500, padding 4×8, 4 px radius, tinted background).
  - Content: `main.docs-viewer` padding-inline `--layout-padding: 3.12rem` (≈50 px); text column `--page-width: 80ch` → ≈704 px measured at 1440.
  - TOC: fixed right column ≈256 px wide starting at x≈1160; title "On this page" in display font 20 px/500; links 14 px/500, h3 indented 32 px vs h2 16 px; active link = vertical violet→pink gradient text + left bar; "Back to the top" link with arrow at the end. Disappears below ≈1430 px (`--screen-xl`) — then TOC renders inline, collapsible, at the top of the article.
- **Breakpoints** (CSS vars): xs 700, sm 775, md 900, lg 1200, xl 1430, xxl 1800 px.
- **Z-index tokens**: content 50, tutorial nav 75, nav 100, top banner 150, mini-menu / cookie 200.
- **Mobile (375)**: 60 px top bar (translucent + blur 16 px) with a menu button only. Menu opens a drawer = narrow rail (81 px) + secondary nav (261 px) side by side, staggered slide-in (`transform .3s ease-out .1s` rail, `.45s ease-out .2s` secondary). No scrim measured. Article full width with 16 px gutters; h1 stays 36 px; TOC inline after the header box.
- Skip link "Skip to main content" (off-screen, `translateY(0)` on `:focus-visible`).

## 2. Typography

- Fonts (Google Fonts, `display=swap`): **Inter** 400/500/600 (body/UI), **Inter Tight** 500/600 (headings, display), **DM Mono** 400 + italic (code). Icon font: Material Symbols Outlined (we use lucide instead).
- Scale measured:
  - Home hero h2 80 px/500 Inter Tight, line-height normal; home section headings 50.7 px/500; small eyebrow h1 14 px/500 with gradient text.
  - Doc h1 36 px/500; h2 32 px/500 (margin 26.56 px 0 8 px); h3 24 px/500 (margin 24 0 8); TOC/section titles 20 px/500.
  - Body paragraphs **14 px / 22.4 px** (1.6), margin 14 px 0. Lead text in the header box 14 px.
  - Nav + TOC 14 px/500, letter-spacing −0.14 / −0.16 px. Footer headings 14 px/600, −0.14 px.
  - Inline code 14 px DM Mono, padding 0 4.8 px, 4 px radius, tinted pale-blue bg (`bright-blue` @ ≈15 %) with gradient-clipped text in the home page; in docs pink-red text.
  - Code blocks 14 px DM Mono, padding 16 px 0 (lines padded inside).
- Weight discipline: headings never bold — 500 everywhere; 600 only for buttons, footer headings, strong UI labels.

## 3. Color system

- Neutrals: an 8-step **contrast ladder** that inverts per theme (`--primary-contrast` … `--octonary-contrast`, `--page-background`, `--full-contrast`). Light: page white, text oklch(19.4 % .006 301), lines `--senary` oklch(91.75 % .004 301), soft surfaces `--septenary` oklch(97.1 %) / `--octonary` oklch(98.8 %). Dark: page oklch(16.9 % .004 286) (near-black with a violet cast), same ladder reversed. All neutrals carry a slight violet hue (h≈300) — never pure gray.
- Accents (light): bright blue oklch(51 % .274 264) = links; electric violet oklch(53 % .28 297) = active nav, tabs; french violet; vivid pink oklch(69 % .277 333); hot pink/red; orange-red. Dark mode derives each accent by mixing 60–70 % toward white (`color-mix(in srgb, X, var(--full-contrast) 70%)`) — pastel accents on black.
- Symbolic palette for API badges: purple, gray, blue, pink, orange, yellow, green, cyan, magenta, teal, brown, lime (one per symbol kind), badge bg = 10 % mix with white (light) / 17 % with #272727 (dark).
- Gradients (≈25 named tokens): main brand gradient = orange-red → vivid pink → electric violet (90°). Used on: primary button 1 px border, card icon tiles (48×48, 8 px radius), active TOC/nav text (vertical violet→pink), eyebrow text, header banner of landing pages (overview: full-bleed pink→violet radial), selection color (vivid pink), hero stroke field.
- Link states: blue → hover vivid pink → active hot red, `transition: color .3s`.
- Theme switch: menu with System / Dark / Light (icon in rail bottom). Class on `<html>` (`docs-light-mode` / `docs-dark-mode`); an `docs-invert-mode` class flips a sub-tree to the dark ladder (used for dark sections inside a light page).

## 4. Components

- **Page header box** (guides): rounded 10 px panel, bg `--septenary-contrast`, padding 24 px; breadcrumb (14 px, chevron separator), h1, one-paragraph lead, decorative line illustration right, edit (pencil) icon top-right → GitHub source.
- **Callouts** (`docs-alert-*`): no radius, only `border-inline-start: 3px`, bg = accent @ 5 % (10 % dark), padding 24 px, icon (1.3 rem) absolutely placed, text indented 1.65 rem, bold uppercase-ish label ("TIP:") inline. Kinds: note (blue, bookmark), tip (cyan, star), important (red, exclamation), helpful (pink, check), question, summary, tldr, todo — each has accent + its own gradient token.
- **Code blocks**: container 1 px `--senary` border, 4 px radius, bg `--octonary`; Shiki dual theme (github-light / github-dark via `--shiki-light/--shiki-dark` CSS vars per token). Copy button: 40×37 px, top-right, 1 px border, 4 px radius, hidden until hover/focus (shows on `:focus-visible`). Optional header strip 46 px (padding 12 48 12 12) holding a file name, or a "Do/Don't" pill: tinted header (red for avoid, green for prefer) with an uppercase 11.5 px/600 pill (6 px radius, accent @ 20 %) + icon. Multi-file examples = tab bar with file names over one code body; line highlighting and diff lines supported.
- **Headings** are anchors (`docs-anchor`, tabindex −1) with a copy-link button on hover.
- **Cards**: 1 px `--senary` border, 4–8 px radius, white bg, padding 24–32 px, hover = border/bg transition .3 s; landing cards have a 48 px gradient icon tile, title 16 px/500, body, link row at the bottom. Card grid = 2 columns, gap 20 px; tutorial cards have a 140-ish px illustration band on top.
- **Pills** (footer of overview "Join the momentum"): 44 px radius, padding 6×12, 14 px, tinted bg @ 5 %.
- **Tables**: no outer border, header row 14 px/600, rows separated by 1 px lines, generous 16 px cell padding.
- **Buttons**: primary = transparent text over a 1 px gradient frame (pseudo-elements fill the inside), 4 px radius, padding 12×24, 14 px/600; on hover the gradient angle animates (`spin-gradient` 4 s linear infinite) and the fill turns into a soft pink radial glow.
- **Search**: `⌘K` / `/`; centered modal ≈780 px wide, 628 px tall at y≈135, page behind blurred (`::backdrop { backdrop-filter: blur(5px) }`). Single input row with close button; results list: icon per kind (docs page / tutorial code icon / API), title with highlighted match (pink), category label right-aligned, matched sub-heading row underneath with `#` icon; active row bg `--octonary` + 2 px left bar. Footer: keycap hints (enter select, arrows navigate, esc close) + provider credit. Algolia-backed (we keep Pagefind).
- **Footer**: inside the content column (not full-bleed), 4 link columns (14 px/600 heading, 14 px links in `--quaternary`, 37 px row rhythm), then a one-line license/version note 12–13 px.

## 5. Homepage

- Sections (≈5550 px tall at 1440): hero (700 px) → feature showcase (1035) → value tiles (398) → performance/CTA (800) → explore/learn grid (1436) → closing CTA (500) → footer.
- Hero: top-left announcement chip (gradient text label + plain text link, 1 px border, 4 px radius); top-right search field (≈310×44); centered two-line display headline 80 px/500; one-line tagline 16 px secondary; single gradient-frame CTA. Background: an animated field of short diagonal strokes (≈20 px pitch) tinted along the brand gradient, fading out toward edges; it parallaxes/reveals on scroll and repeats behind the performance section. Dark theme shows the same layout on near-black.
- Feature showcase: segmented tab strip (4 tabs, 14 px, 8 px radius pills, active = violet) switching a large rounded panel: left = explanation + live interactive demo + outline CTA; right = stacked file-named code cards. Sticky-ish scroll choreography between tabs.
- Value tiles: 3–4 bordered cards (8 px radius, padding 32 px), gradient icon tile, bold lead word + sentence.
- Motion: scroll-linked reveals, gradient button spin on hover, cross-document/route **View Transitions** (with `prefers-reduced-motion` override disabling all `::view-transition-*` animations).

## 6. Content-page variants

- **Overview landing** (`/overview`): full-width gradient banner header (pink → violet, white text, rounded 10 px), then sections each with a large heading + monochrome line illustration on the right, and a 2-column card grid inside a bordered container; CTA pill row at the end.
- **Guide** (`/guide/signals`): header box + body + TOC; secondary nav drilled into the topic's sub-pages.
- **Index guide** (`/guide/performance`): header box + a two-column link/description table.

## 7. API reference

- Index `/api`: h1; filter text field (≈300 px, search icon) + package select (≈350×42, 1 px border, 4 px radius) on one row; status filter chips (Stable / Developer Preview / Experimental / Deprecated; check icon when on); "filter by identifier type" grid of type toggles (letter badge + name) in 6 columns. Listing: per-package h3 (20 px) + **3-column dense grid** of entries (14 px/500 links, 22×22 letter badge, 14 px gap, 26 px row height). ≈1050 entries on one page, client-side filtering, filter state in the URL query.
- Entry page: package path small above; h1 name + kind pill (green "function" etc.); summary; related-guide pill; "API" section = full signature code block, then **member cards**: header row (name in mono left, return type pill right, rounded, light border) + description body on `--septenary` bg; `@param` / `@returns` block on soft grey panel; usage notes, examples; TOC on the right; secondary nav lists all symbols of the package alphabetically with a back arrow to the package list.

## 8. Tutorial

- Route `/tutorials` = 2-column card grid of tutorials (illustration band + title + "via …" subtitle + link).
- Step page = **split layout**: instructions left (≈640 px), editor/preview right (≈610 px, separated by 1 px border, full height).
  - Left header: step picker (stacked chevrons; tutorial name above, step title below) + "Reveal answer" outline button + prev/next square buttons (40×40, next = gradient frame, pink tint when active). Body uses numbered task blocks: 28 px circled step numbers (violet ring) with h3 titles.
  - Right: vertical split (draggable gutter, `angular-split`): CodeMirror 6 editor (file tabs, open-in-StackBlitz + download icons, line numbers, active-line tint) on top; tabs Preview / Console / Terminal with refresh button below. Loading state: mascot + "Initializing dev server…" text + progress bar.
  - Per-step sources served as `assets/tutorials/<tutorial>/<step>/source-code.json` (≈37 KB gz, 220 KB raw) + `metadata.json`; step Markdown pre-rendered as HTML.
  - Cold start: preview iframe appeared ≈22 s after navigation (fresh WebContainer + install + dev server); later steps reuse the booted container (only files remounted).

## 9. Playground

- `/playground?templateId=…`: page title + template dropdown (6 templates: hello world, signals, control flow, minigame, forms, aria); same editor/preview component as tutorials at full content width (≈1230×745): file tabs + "add file" + open-externally + download; Preview / Console / Terminal; terminal shows the package manager + Vite output.

## 10. Runtime: WebContainers (what angular.dev does)

- Uses **StackBlitz WebContainer API** v1.6.4 (`stackblitz.com/headless?version=1.6.4` hidden iframe, `allow="cross-origin-isolated"`), preview iframe on `*.local-corp.webcontainer-api.io` (port 4200). Editor worker ≈784 KB gz (3.5 MB) on the site origin.
- **Site-wide headers**: `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: credentialless` on every HTML page (checked `/`, `/guide/signals`, `/tutorials/learn-angular`, `/playground`) → `crossOriginIsolated === true` everywhere, so client-side navigation into the tutorial never needs a reload.

### WebContainer requirements for Rivet

- Headers: COOP `same-origin` + COEP `require-corp` or `credentialless` (boot with `WebContainer.boot({ coep: 'credentialless' })` when using the latter).
- Impact on the rest of the docs site if applied site-wide:
  - Our examples iframes (separate examples origin `:4322`) would need `Cross-Origin-Resource-Policy: cross-origin` + their own COEP, or `<iframe credentialless>` — extra moving parts in `tools/serve.ts` and the host files.
  - Cross-origin images/fonts without CORP fail under `require-corp`; `credentialless` loads them without cookies (fine for self-hosted fonts/assets). Our fonts should be self-hosted anyway (Pagefind, logo, Inter files under our origin).
  - COOP `same-origin` breaks `window.opener` (StackBlitz form-post opening a new tab is unaffected; OAuth popups would be).
  - CSP must allow `frame-src https://stackblitz.com https://*.webcontainer-api.io` and `worker-src` for the editor worker.
  - **Recommendation**: send COOP/COEP only on `/playground/**` and `/tutorial/**` (our site already does full page loads between pages via `data-rivet-reload`, so per-route isolation costs nothing). `credentialless` is Chromium + Firefox only; Safari needs `require-corp` (then every subresource on those routes must be same-origin or send CORP) — on isolated routes serve everything from our origin so `require-corp` works for all browsers.
- Browser support: Chromium full; Firefox alpha/limited (previews may hit blocked third-party assets); Safari ≥ 16.4 beta (needs `Atomics.waitAsync`); no mobile story → show a static "open on desktop / open in StackBlitz" fallback on unsupported browsers and narrow viewports.
- One WebContainer per page (`boot()` once; `teardown()` before another): keep a module-level singleton shared by the tutorial steps; remount files per step with `mount()`.
- **Licensing**: free for open source, prototypes and POCs; commercial license required for production use in a for-profit setting (per webcontainers.io/enterprise). Rivet docs (open-source framework docs) fit the free tier — re-check if the docs ever ship under a commercial entity's product site; record the decision in the spec.
- Boot cost: hidden headless iframe + ≈1–2 s boot, then `npm install` dominates. angular.dev: ≈22 s cold to first preview. Mitigations: pre-built **binary filesystem snapshot** (`mount(snapshot)`) incl. `node_modules` per template; use pnpm-like cached installs; start boot on intent (hover/visibility) not on page load.
- Running a Rivet template (`templates/starter-*`: Vite 8 + `@rivetjs/router/vite` + compiler wasm + Tailwind 4) inside WebContainer:
  - Compiler wasm: `libs/compiler/wasm.ts` loads `rivet_compiler.wasm` (3.1 MB) with `readFileSync` + `new WebAssembly.Module` and **no imports (no WASI)** → works in WebContainer's Node unchanged. Compile happens per module → expect slower first transform than native V8 on host; measure.
  - Native deps to verify: Vite 8 = rolldown (native binding; needs its `wasm32-wasi` fallback package to resolve inside WebContainer), Tailwind 4 oxide (`@tailwindcss/oxide-wasm32-wasi` fallback), lightningcss (wasm fallback). The playground of angular.dev shows a Node WASI experimental warning — they run a WASI fallback, so this path works but is slower.
  - **sharp** (`?image` imports, optional peer of `@rivetjs/compiler`): native addon won't load; `@img/sharp-wasm32` exists and is used by StackBlitz — playground templates should avoid `?image` or depend on the wasm build explicitly. Templates must not hard-require sharp.
  - `engines.node >= 24`: WebContainer's Node version may lag (verify `node -v` in the container); anything relying on Node 24-only features (native TS type stripping, new fs APIs) in templates/router build must have a fallback or the playground template pins to supported APIs. **Biggest unknown — spike first.**
  - Packages are "not published to npm yet": a playground needs either published `experimental` tarballs or a snapshot that already contains `node_modules/@rivetjs/*` built from `dist/libs/*` (preferred: deterministic, no registry dependency).
- Alternative if blockers appear: keep the existing iframe examples (pre-built on the examples origin) for read-only demos and use the StackBlitz SDK `embedProject` (no COOP/COEP needed on our pages, but third-party UI chrome).

## 11. Rivet mapping — mirror vs adapt

- **Mirror**: left icon rail + drill-down secondary nav + fixed right TOC; no top bar on desktop; 80ch content column; 14 px / 1.6 body; 500-weight headings in a tight display face; violet-tinted neutral ladder that inverts per theme; header box with breadcrumb + edit icon; thin-left-border callouts; Do/Don't code headers; gradient-frame buttons; cmd-K modal with blurred backdrop and grouped results; dense 3-column API grid with letter badges + filters; split-pane tutorial; template-picker playground; footer inside the content column; View Transitions with reduced-motion override.
- **Adapt to Rivet brand** (logo.svg gradient: cyan #01EEF9 → blue #0360FA → indigo #262CFA → violet #5B00F8/#B815F9 → magenta #F827F5/#F930BF):
  - Brand gradient (their orange→pink→violet) → `--brand-gradient` cyan→blue→indigo→violet→magenta; use on the same spots: button frames, icon tiles, active nav/TOC indicator, hero stroke field, selection colour (magenta), landing banners.
  - Gradient **text** (active TOC item, eyebrows): reuse existing `--brand-gradient-text` (light: royal→indigo→violet→purple→magenta; dark: cyan→blue→purple→magenta) — keeps ≥3:1 on bg; cyan only on dark.
  - Links: their blue → our `--accent` indigo (#2d30f9 light / #8f9bff dark); hover → magenta-ish `#B815F9` light / `#F930BF` dark (check 4.5:1); active → violet.
  - Neutrals: keep the 8-step ladder idea but tint toward our indigo (hue ≈270) instead of 300; dark page ≈ oklch(16–17 % .01 275).
  - Dark accents: derive by `color-mix(in srgb, <stop>, white 60–70%)` like upstream, verify AA.
  - API symbolic badge colors: map kinds onto palette stops first (function = blue, component = indigo, class = violet, type = cyan-dark, const = gray, hook/signal = magenta), rest from Tailwind hues.
  - Fonts: Inter + Inter Tight + a mono (DM Mono or JetBrains Mono) **self-hosted** (woff2 subsets, `font-display: swap`, preload 2 files) — no Google Fonts request (CSP + COEP friendly, perf-first).
  - Icons: lucide via `@rivetjs/kit/icon` for every rail/callout/search icon (file-text, code, flask-conical or play, book-open, search, sun/moon/monitor, ellipsis, arrow-left, chevron-right, external-link, pencil, copy, link, star, info, triangle-alert, circle-check). Keycaps are text, not icons. GitHub stays a text link.
  - Mascot/illustrations: none; replace with the logo and gradient line art generated from our own shapes (not hand-drawn SVG paths — use CSS gradients / lucide compositions).
  - Search modal: build on the cdk div overlay layer (no native `<dialog>`), keep Pagefind.

## 12. Gap list vs current `apps/docs`

| Area        | Now (apps/docs + docs-kit)                                                           | Target                                                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frame       | Sticky horizontal top bar (56 px, gradient strip), centered 90 rem container         | Left icon rail (110 px) + secondary nav (260 px) + content + fixed TOC; mobile 60 px bar + drawer                                                                                             |
| Section nav | Static grouped side list per section (`.side-column` 15 rem), uppercase group titles | Drill-down nav with back arrow, chevrons, status tags, gradient active bar                                                                                                                    |
| TOC         | 13 rem column ≥ xl, uppercase title, `<details>` on mobile                           | 256 px fixed, display-font title, gradient active item + scroll-spy, back-to-top                                                                                                              |
| Type        | System UI stack, h1 30–36 px bold, body 16 px/28                                     | Inter/Inter Tight/DM Mono, h1 36/500, h2 32/500, body 14/22.4                                                                                                                                 |
| Tokens      | slate neutrals, `--accent`, 3 gradients                                              | 8-step tinted ladder per theme, accent family + dark mixes, gradient set, symbolic badge palette, breakpoints + z-index tokens                                                                |
| Page header | Eyebrow + h1 + lead + status                                                         | Rounded header box: breadcrumb, h1, lead, edit icon, optional art                                                                                                                             |
| Callouts    | note/tip/warning/gotcha boxes                                                        | Left-border tinted blocks with lucide icon + inline label; add important/question/summary variants as needed                                                                                  |
| Code        | Shiki classes, figcaption file name, copy on hover                                   | Same + Do/Don't headers, file tabs for multi-file fences, line highlight/diff, dual-theme tokens                                                                                              |
| Cards       | `.card-grid` simple                                                                  | Gradient icon tiles, bordered 8 px cards, hover transitions, illustration band variant                                                                                                        |
| Home        | Logo hero + gradient text + 3 buttons + demo + starters                              | Announcement chip, 80 px display headline, stroke-field background, gradient CTA, tabbed feature showcase with live demo, value tiles, performance section (link our benchmarks), closing CTA |
| Search      | Button + Pagefind dialog                                                             | Rail button with keycaps; blurred-backdrop modal, grouped results with type icons + sub-heading matches + keyboard footer                                                                     |
| API index   | Package groups (docs-kit `routes/api`)                                               | Filter field + package select + status chips + kind toggles; 3-col dense grid with letter badges; URL-synced filters                                                                          |
| API entry   | ApiCard-based                                                                        | Signature block + member cards with type pills, params panel, TOC                                                                                                                             |
| Tutorial    | Plain Markdown pages under `start/tutorial/`                                         | Split pane with editor/preview (WebContainer) + step picker, reveal answer, prev/next                                                                                                         |
| Playground  | none (StackBlitz form post per example)                                              | `/playground` with template picker, file tabs, preview/console/terminal                                                                                                                       |
| Footer      | One centered line                                                                    | Column footer inside content column + license/version line                                                                                                                                    |
| Theme       | Toggle light/dark                                                                    | System / Light / Dark menu in rail                                                                                                                                                            |
| Motion      | `@view-transition { navigation: auto }`                                              | Keep cross-document VT + reduced-motion override; drawer stagger; button gradient spin; scroll reveals (CSS scroll-driven animations, no JS)                                                  |

## 13. Phased plan

1. **Tokens + type** (docs-kit + both apps' `styles.css`, kept in sync): neutral ladder, accent family, gradients mapped to the logo palette, symbolic palette, breakpoints/z-index, self-hosted Inter/Inter Tight/mono; prose scale; links/selection. Gate: contrast checks in `site.test.ts` for each text token pair in both themes.
2. **Frame**: new `_layout.tsx` (rail + secondary nav + content + TOC slots), mobile bar + drawer (cdk overlay, focus trap, Esc), theme menu (System/Light/Dark, pre-paint script extended), skip link, footer columns. `nav.ts` gains per-group icon (lucide name) + optional tags (`new` / `updated`); drill-down state derived from the current path (SSR, no JS needed to render; JS only for the slide transition).
3. **Content components**: header box (breadcrumb from nav, edit link), callout restyle, code block header/tabs/Do-Don't (`markdown.ts` fence meta: `title=`, `group=`, `do`/`dont`), heading anchors with copy-link, cards/pills/tables, TOC scroll-spy (tiny resumable island, IntersectionObserver).
4. **Search**: rail trigger with keycaps, modal restyle (blurred backdrop, grouped results with kind icon, sub-heading rows, key hints) on the cdk overlay layer; Pagefind metadata for kind + section.
5. **Home**: hero (headline, announcement chip, gradient CTA, stroke field via CSS gradients/canvas-free pattern), tabbed showcase driven by existing examples, value tiles, performance section fed by `docs/benchmarks` numbers, closing CTA. Zero JS except the tab switch and demo islands.
6. **API reference**: index filters (text, package, status, kind) + 3-col grid + letter badges, URL-synced; entry layout with signature block, member cards, params panel, TOC. Uses `src/generated/api.json` (no schema change expected beyond `kind` mapping).
7. **Playground + tutorial (WebContainer)** — behind a spike:
   - 7a Spike (1–2 days): boot WebContainer on a scratch page with COOP/COEP, mount `templates/starter-minimal` + locally packed `dist/libs/*`, run `vite dev`; record Node version, rolldown/tailwind/lightningcss wasm fallbacks, compiler wasm transform time, cold/warm boot times; confirm licensing note.
   - 7b Build: per-route headers in `tools/serve.ts` + host files (`/playground/`, `/tutorial/`), CSP additions, binary snapshot per template generated at build (`tools/playground.ts`), editor (CodeMirror 6, lazy chunk) + split panes + preview/console/terminal (xterm lazily), template picker, download zip, open in StackBlitz.
   - 7c Tutorial: convert `content/start/tutorial/*` into step folders (README + `src/` + `answer/`), split layout, step picker, reveal answer (diff mount), prev/next; non-supporting browsers/mobile get the static Markdown + iframe example fallback.
8. **cdk-docs parity**: apply the same frame/tokens to `apps/cdk-docs` (shared components in docs-kit; site-specific nav only).

Risks: WebContainer Node version vs our `engines >= 24`; native-binding fallbacks speed; 3 MB compiler wasm per boot (cache in snapshot); COEP side effects on example iframes (keep isolation route-scoped); licensing if a commercial entity hosts the docs; perf budget — rail/drawer/search must stay zero-JS-until-interaction to keep resumable pages lean.
