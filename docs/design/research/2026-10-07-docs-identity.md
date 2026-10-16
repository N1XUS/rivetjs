# Docs identity: angular look, de-cloned (2026-10-07)

Docs sites (`apps/docs`, `apps/cdk-docs`) on `@rivetjs/docs-kit`. Follows `2026-10-07-angular-dev-visual-direction.md`.

## Process

- Three mockups (A dense / B "manual" / C editor tabs), rendered as static pages with real compiler output.
- B was picked first. User feedback: "very hard gradient". Direction changed to the earlier angular.dev-style frame, with clone tells removed.
- Kept: the old spacing, density, surfaces and header panel.
- Kept from B: the compiled-output toggle only. Dropped: numbered chapters, spec-sheet header and editorial type sizes.

## Decisions

- **Fonts: Geist + Geist Mono.**
  - Self-hosted from `@fontsource-variable/geist{,-mono}` 5.3.0 (exact pins, OFL in `libs/docs-kit/NOTICE`).
  - Compared on real pages (1440 dark) against Inter and IBM Plex. Geist is closest to Inter in feel and is not angular.dev's face.
  - Only Geist latin is preloaded. Fallback faces use capsize metrics on Arial / Courier New, so CLS = 0.
- **No icon rail.** Areas (`_nav.ts` `areas`) plus API / Examples sit in a sticky top bar, with search field, theme menu and a GitHub text link.
- **Side nav:** one per area, no drill-down. Sections are headings; groups are native `<details>` (collapsible without JS), open when they hold the current page.
- **Gradient: soft and rare.**
  - Indigo → violet at 55–75% opacity, used only on active indicators (top bar, side nav, TOC) and the code-tab underline.
  - No gradient text, no gradient buttons (solid indigo), no glow.
  - The doc header gets only a faint indigo corner wash.
  - `tests/contrast.test.ts` blocks full-spectrum stops and the removed tokens from coming back.
- **Compiled output (`tsx compiled` fence):**
  - Compiled at build time with `@rivetjs/compiler` (dom + server targets).
  - Stacked layout: a switch reveals a "Compiles to" Browser / Server panel. Tabs layout: `File.tsx` / `dom.js` / `server.js` plus "Side by side".
  - Checkbox / radio + `:has()`: works without JS. Compiler-inserted names are highlighted.
- **Search:** cdk `ModalOverlay` / `Modal` / `Dialog` (div overlay layer) replaces native `<dialog>`. The `/` and Ctrl+K listener uses the capture phase, because cdk buttons stop key propagation.
- **Preload rule:** `{ match: "@rivetjs/cdk/", strategy: "intent" }` in both docs vite configs. The frame's cdk chunks no longer prefetch once visible.
- **Homepage:**
  - Hero with Get started and Examples.
  - "The numbers": two compact `BenchChart`s, then a table of exact medians with win / tie / loss pills. The loss row is kept: Rivet is slower than Qwik 2 on client navigation, 78.4 vs 56.8 ms. Links to `/about/benchmarks/`.
  - Compiled sample, six lucide feature tiles, and the quick-start commands with the not-on-npm note.
  - Markdown blocks come from `content/_home-*.md` fragments.

## Page weight (brotli, on idle, Chromium, same method before/after)

| Page | Before | After |
| --- | --- | --- |
| docs `/` | 202.5 KB (fonts 105.4, JS 70.1 / 49 files) | 124.2 KB (fonts 51.3, JS 48.3 / 28; incl. 2 charts) |
| docs `/learn/signals/` | 200.7 KB | 120.8 KB (JS 42.3 / 26) |
| cdk `/components/menu/` | 235.5 KB | 153.3 KB |

- CSS: 12.0 → 12.7 KB (docs), 16.3 → 17.0 KB (cdk).
- CLS: 0.000 everywhere.

## Open

- There is no Playground route. The hero's secondary call to action and the top bar use Examples.
