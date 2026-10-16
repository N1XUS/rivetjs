# Kit + Scoped Styles Implementation Plan

**Goal:** css`` scoped styles (compiler-folded class names, extracted CSS through Vite, per-route links) + stylesheet imports (`.css/.scss/.sass/.less/.styl`, `*.module.<ext>` scoped) + `@rivetjs/kit` head components (Title, Meta, HeadLink, Head, JsonLd, Script, Font, Picture) with head hold, rank merge, strict CSP / Trusted Types.

**Spec:** [2026-10-03-kit-and-scoped-styles-design.md](../specs/2026-10-03-kit-and-scoped-styles-design.md) — Decisions override.

## Constraints
- Zero cost: no `@rivetjs/runtime/css` import → `styles` compile option absent → byte-identical compiler output (oracle 227/227); no kit plugin → router codegen + HTML unchanged except capo `headTags` order (decision k10).
- No changes to existing runtime entries (rd gate); new entry `@rivetjs/runtime/css` only.
- Rust via Docker, volumes `rivet-styles-cargo` / `rivet-styles-target` / `rivet-styles-rustup` (own docker command mirroring `build.sh`).
- Head-link component named `HeadLink` (router `<Link>` = navigation, other agent).

## Tasks — styles
1. Rust `styles.rs`: CSS tokenizer/rewriter (comments, strings, `url()`, escapes, nesting, `:global()/:local()`, attribute selectors untouched, `@media/@supports/@container/@layer` preludes untouched, `@keyframes` + `animation(-name)` rewrite), names readable `<local>_<h5>` / short `r<h6>` (FNV-1a 64 → base36 over `scope + "\0" + local`), `@layer <layer>{…}` wrapper.
2. `compile.rs`: `styles` option; `css` import binding resolution; top-level `const X = css`…`` → `/*#__PURE__*/Object.freeze({…})`; `X.key` → string literal (unknown key / write / interpolation / non-top-level → diagnostics); constant folding of literal/template/`+`/member into static `class` attribute fragments (server + DOM); `<style>` diagnostic text points at css``. Response `css`, `cssClasses`.
3. TS tests (`libs/compiler/tests/styles.test.ts`): rewrite table, diagnostics, folding byte-equal to hand-written class, feature-off identity, resume mode.
4. Runtime `libs/runtime/css.ts` (`css` throws uncompiled, `cx`) + export `./css`.
5. Vite (`libs/compiler/vite.ts` + `libs/compiler/styles.ts`): `rivet({ css })` options; gate on substring; cache CSS per module; prepend `import "<file>?rivet-css&lang.css"`; `load` virtual CSS (+ `@reference`, layer order statement); readable names in dev, short in build; build-wide collision check; `css.modules.generateScopedName` default = same naming for `*.module.<ext>`; CSS-only HMR when compiled JS unchanged. Tests: build output, SSR/client names equal, `.module.css`, `.scss` (sass devDep), Tailwind-free `@reference` text.
6. Router per-route CSS: client build emits `.vite/rivet-route-css.json` (route id → CSS URLs from route modules' chunks + static import closure), only when some route has CSS; `loadBuild` → `createApp({ routeStyles })`; dev: links for CSS modules in the SSR graph of the matched route's modules (`data-rivet-dev-css`), removed by `entry.dev.tsx` after mount.

## Tasks — kit
7. Router head model: `Head` + `titleTemplate`, `html`, `body`, `base`, meta `httpEquiv/itemprop/media/key`, link extras, `scripts`; `rankMerge` (level, phase, seq; dedupe keys table); `mergeHeads` = rankMerge of route levels; `headTags` capo order + scripts/JSON-LD; nonce for scripts.
8. Head hold (`render.ts`): when entry flags `headComponents`, buffer app output until shell end (trailing marker value after the factory), merge sink entries, then write document start + buffer; late entries: body-valid (`link`, `script`) in place, title/meta dropped with dev error.
9. Codegen (gated `head: "components"`): `HeadLevel` Providers per layout/page, sink + nonce in `ServerData`, `export const headComponents = true`; router plugin detects kit plugin.
10. `libs/kit`: `Head`, `Title`, `Meta`, `HeadLink`, `JsonLd`, `Script` (server push; DOM upsert for client navigation), builders `seo`, `openGraph`, `twitterCard`, `canonical`, `alternates`, `jsonLd`, `unsafeInlineScript`; `ThemeScript`.
11. Script strategies: `blocking/eager/defer` tags; `load/idle/interaction` → `#rivet-scripts` JSON + tiny bootstrap inline script (nonce; TT `rivet-script` policy limited to listed URLs); `hashCSP` collects third-party script origins + `#rivet-scripts` origins; JSON-LD never hashed.
12. `@rivetjs/kit/image`: re-export runtime `Picture`/`ImagePreload`; `priority` → head preload push. `@rivetjs/kit/font` + `kit()` Vite plugin `?font` (descriptor + `@font-face` virtual CSS; fallback metrics via optional `@capsizecss/unpack`, skipped with warning).
13. Client head manager (router client): data-endpoint head applied to `[data-rh]` tags on navigation; kit DOM components upsert.
14. Playground demo route (new files only), docs (`docs/guides/kit.md`, `docs/guides/styles.md`), spec decision note (HeadLink).

## Deferred (record in report)
- `style:` custom properties (styles phase 2), CSP `styles` option, orphans sheet, `.module.css` class inlining, critical CSS, `@scope`; icons/manifest, NavLink/Form, `useTitle/useMeta`, `?script` loader, `createApp({ head })` document defaults, i18n `alternates` auto-wiring.

## Gates
rd hash diff (new `@rivetjs/runtime/css` line only), ssr-bench lanes identical, oracle 227/227, `npm run typecheck`, nx test run-many.
