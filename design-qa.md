# Runtime Studio homepage QA — 2026-10-24

final result: passed

No actionable P0/P1/P2 visual findings remain in the compared states.

## Visual truth and normalization

- Source homepage: `.artifacts/home-studio/reference-home.png` (921 × 1708 pixels), selected option 3. Original: `/Users/denisseverin/.codex/generated_images/01a16878-90fe-7862-acc9-d48e4543a7a4/exec-320ca0df-063a-4ab6-88cf-e497cc3e6941.png`.
- Source schema: `.artifacts/home-studio/reference-schema.png` (1476 × 1065 pixels), explicitly approved after the homepage concept. Original: `/Users/denisseverin/.codex/generated_images/01a16878-90fe-7862-acc9-d48e4543a7a4/exec-f83ece7b-6455-44f9-919f-078046cba83f.png`.
- Implementation: `http://127.0.0.1:4418/`, production build of the existing docs app.
- Desktop: `.artifacts/home-studio/desktop-dark.png` and `desktop-light.png`, viewport 1440 × 1000 CSS px, deviceScaleFactor 1; full dark capture 1440 × 3457 pixels. Schema crop: `schema-dark.png` / `schema-light.png`, 1184 × 879 pixels.
- Phone: `phone-dark.png` / `phone-light.png`, 375 × 900 CSS px, deviceScaleFactor 1; full light capture 375 × 5087 pixels. Focused hero: `phone-hero-final.png`.
- Source and implementation are combined in `compare-home-final.png` and `compare-schema-final.png`: each half scaled to 720 pixels wide, preserving aspect ratio. These are composition comparisons, not pixel diffs: source images are generated concepts with unspecified CSS density. Actual production text was additionally inspected at native scale, including the schema light crop and live in-app browser at 595 × 842 CSS px.
- Comparison state: dark theme, initial counter 07, architecture final update 08, reduced motion for deterministic captures. The source schema and implementation show the same final state. Full homepage height intentionally differs because the approved schema replaces the brace illustration, measured proof remains visible, and shared docs chrome/footer are retained.

## Findings and comparison history

1. Initial comparisons: `compare-home-initial.png` / `compare-schema-initial.png`.
   - P2: explanatory labels and benchmark caveat were too small. Increased pipeline/caveat and schema label sizes; native phone/desktop captures now remain legible.
   - P2: interaction loop visually extended under the server lane. Aligned it under the browser lane and added the server/browser divider; `compare-schema-final.png` shows the corrected ownership.
   - P2: light-theme cyan code text failed contrast. Darkened the light cyan token to #00677e; light and dark axe checks now pass.
2. User-reported P2: each staggered hero glyph repeated the full gradient. Added a failing rendered-coordinate regression, then shared word-width and per-letter layout offsets. Final hero captures and live browser show one continuous cyan/violet/pink gradient. Resizing and later words are covered; `hero-no-js.png` confirms the server-rendered parent-gradient fallback too.
3. Final full and focused comparisons: `compare-home-final.png`, `compare-schema-final.png`, `hero-final.png`, `schema-light.png`, `phone-hero-final.png`, full phone light capture. No further visual fixes were needed after this pass.

## Required fidelity surfaces

- **Fonts/typography:** real Manrope display/body and Fira Code code/eyebrow assets, waited for document.fonts.ready. Centered two-line hero, stable rotating-word window, large tabular counter, two-line architecture heading and monospaced labels follow the concepts. Source mock code was corrected to signal(7); small labels were checked at native scale rather than the downsampled full-page comparison.
- **Spacing/layout:** split workbench, three-node pipeline, left architecture rail/right server-browser scene, open section spacing and stacked directory preserve the composition. On phones, workbench/architecture stack; only the code pane can scroll horizontally. Both themes have document.scrollWidth equal to 375/1440. No entrance makes sections transparent at rest.
- **Colors/tokens:** docs light/dark tokens, cyan-to-violet-to-pink brand gradient and subtle animated canvas. Word gradient continuity is checked across font/viewport/word changes. Light code and body/link contrast pass axe.
- **Assets/image quality:** actual Rivet logo and installed fonts; lucide icons throughout. No screenshot is used as the page. User explicitly requested a native canvas and interactive schema; native nodes/connectors implement that approved schematic, replacing the earlier brace illustration.
- **Copy/content:** selected headline, CTA and architecture titles retained. Real guides and configured framework/UI/CDK destinations resolve. Benchmark values and loss caveat come from committed report data with direct source links. Server HTML is an illustrative code pane, not fabricated compiler output. Visible browser animations supersede the old no-script-before-input claim; historical Lighthouse data is not presented on this page.

## Interaction and accessibility evidence

- All 73 docs tests passed, including retained clipboard, mobile containment, stable accessible headline, server-button node adoption, theme interaction, no repeated downloads, 100ms warm pointer-to-paint budget at 4× CPU, keyboard tabs and axe.
- Added production cases cover actual canvas pixel changes, user pause/offscreen suspension, counter reversals/9→10/0–99 bounds and digit track geometry, architecture keyboard/manual/replay, headline cycle/pause/live reduced motion, continuous word gradient, no-JS/print and both-theme screenshots/axe.
- Live in-app browser: increment 07→08, switch Component→Server HTML→Component, select architecture Start with the page, return to hero. Browser error log checked: empty. `live-preview.png` records the working page with corrected gradient.
- TypeScript, content, snippets, errors, llms, MCP data, AI sync, home-perf freshness and whitespace checks pass. Production build peak tree RSS 938 MB, below its unchanged 3072 MB budget.

## Accepted deviations and limits

The existing shared navigation/search/theme/mobile drawer/footer remain, as required by the implementation brief. The schema is the later approved revision; the four sourced proof summaries are retained alongside its new layout; UI and CDK each receive a directory link. The refreshed page intentionally loads canvas/Motion code before input. Historical Lighthouse figures remain dated metadata, not fresh measurements or claims. Visual browser coverage is Chromium; Safari/Firefox and fresh Lighthouse runs were not performed.

## Implementation checklist

- [x] Compare selected source and actual production captures together.
- [x] Recapture and inspect earlier P2 fixes.
- [x] Inspect native-scale hero/schema, both themes and phone layout.
- [x] Verify keyboard, counter, animation lifecycle and server-rendered fallback.
- [x] Preserve real documentation links, benchmark sources and truthful startup claims.
