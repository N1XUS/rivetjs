# Runtime Studio homepage QA — 2026-10-24

final result: passed

The user correctly rejected the first architecture implementation. That P1 fidelity issue has now been reworked and recaptured: the final comparison matches the approved schematic composition, nested browser panel, counter scale, connected glowing paths and playback rail. No actionable P0/P1/P2 visual findings remain in the revised captures.

## Visual truth and normalization

- Source homepage: `.artifacts/home-studio/reference-home.png` (921 × 1708 pixels), selected option 3. Original: `/Users/denisseverin/.codex/generated_images/01a16878-90fe-7862-acc9-d48e4543a7a4/exec-320ca0df-063a-4ab6-88cf-e497cc3e6941.png`.
- Source schema: `.artifacts/home-studio/reference-schema.png` (1476 × 1065 pixels), explicitly approved after the homepage concept. Original: `/Users/denisseverin/.codex/generated_images/01a16878-90fe-7862-acc9-d48e4543a7a4/exec-f83ece7b-6455-44f9-919f-078046cba83f.png`.
- Implementation: `http://127.0.0.1:4418/`, production build of the existing docs app.
- Desktop: `.artifacts/home-studio/desktop-dark.png` and `desktop-light.png`, viewport 1440 × 1000 CSS px, deviceScaleFactor 1; final dark full-page capture is 1440 × 3496 pixels. Schema crop: `schema-dark.png` / `schema-light.png`, 1184 × 893 pixels.
- Phone: `phone-dark.png` / `phone-light.png`, 375 × 900 CSS px, deviceScaleFactor 1; full light capture 375 × 5087 pixels. Focused hero: `phone-hero-final.png`.
- Source and implementation are combined in `compare-home-final.png` and `compare-schema-final.png`: each half scaled to 720 pixels wide, preserving aspect ratio. These are composition comparisons, not pixel diffs: source images are generated concepts with unspecified CSS density. Actual production text was additionally inspected at native scale, including the schema light crop and live in-app browser at 595 × 842 CSS px.
- Comparison state: dark theme, initial counter 07, architecture final update 08, reduced motion for deterministic captures. The source schema and implementation show the same final state. Full homepage height intentionally differs because the approved schema replaces the brace illustration, measured proof remains visible, and shared docs chrome/footer are retained.

## Findings and comparison history

1. Initial comparisons: `compare-home-initial.png` / `compare-schema-initial.png`.
   - P2: explanatory labels and benchmark caveat were too small. Increased pipeline/caveat and schema label sizes; native phone/desktop captures now remain legible.
   - P2: interaction loop visually extended under the server lane. Aligned it under the browser lane and added the server/browser divider; `compare-schema-final.png` shows the corrected ownership.
   - P2: light-theme cyan code text failed contrast. Darkened the light cyan token to #00677e; light and dark axe checks now pass.
2. User-reported P2: each staggered hero glyph repeated the full gradient. Added a failing rendered-coordinate regression, then shared word-width and per-letter layout offsets. Final hero captures and live browser show one continuous cyan/violet/pink gradient. Resizing and later words are covered; `hero-no-js.png` confirms the server-rendered parent-gradient fallback too.
3. First full and focused comparisons (later rejected for architecture fidelity): `compare-home-final.png`, `compare-schema-final.png`, `hero-final.png`, `schema-light.png`, `phone-hero-final.png`, full phone light capture. The architecture acceptance was too permissive and was reopened after the user correction.

4. User fidelity correction, P1: the previous semantic layout did not reproduce the approved illustration closely enough. Preserved evidence: `schema-dark-before-correction.png` and `compare-schema-final-before-correction.png`. Rebuilt the architecture styling in component-local `home-schema.css`: narrower server box, wider delivery route, nested browser preview, larger 08 counter and controls, blue domain icons, connected cyan packet/magenta trigger-and-update paths, matching two-line process labels and full gradient playback rail. Removed the extra visible caption and eyebrow that shifted the composition.
5. Correction pass 1: `compare-schema-correction-1.png` found remaining path/number alignment, label wrapping and rail-color drift. Aligned the cyan transfer and magenta update junction, restored two-line labels, color-coded rail milestones, and aligned the copy rail vertically.
6. Final correction comparison: `compare-schema-correction-final.png`. To remove source canvas padding, cropped the source to x55/y103, 1376 × 885 pixels, scaled to 1184 × 762; cropped 64px section spacing from top/bottom of the actual 1184 × 893 capture, yielding 1184 × 765. Combined side by side in the same image. This checks the actual content proportions, rather than stretching either image to equal height. `schema-corrected.png` is the actual revised content; the user was shown that capture. The focused native light capture and 375px dark/light captures remain readable and overflow-free. The initial revised block interactions and axe passed 9/9 homepage tests; the complete docs project passes 75/75 after the final review fixes. The finite paused/reduced-motion state shows Play instead of the source's Pause; that control reflects real playback state.

7. Independent whole-change review found two Important issues: copied component source did not reproduce the preview's formatting/controls/limits, and early manual-step labels inherited 0.55 opacity (4.21:1 contrast). Both reproduced in failing production regressions. The displayed source now compiles and executes with matching 07 formatting, increment/decrement and 0–99 limits; illustrative Server HTML agrees. Text stays opaque while decorative icons dim. Both regressions pass; all 75 docs tests pass after the fix pass. Final `compare-home-reviewed.png` combines the selected concept and refreshed production page; `workbench-reviewed.png` was inspected at native size. The complete sample uses a bounded scrollable code pane to retain the workbench proportions. No new actionable visual findings arose in that comparison.

## Required fidelity surfaces

- **Fonts/typography:** real Manrope display/body and Fira Code code/eyebrow assets, waited for document.fonts.ready. Centered two-line hero, stable rotating-word window, large tabular counter, two-line architecture heading and monospaced labels follow the concepts. Source mock code was corrected to signal(7); small labels were checked at native scale rather than the downsampled full-page comparison.
- **Spacing/layout:** split workbench, three-node pipeline, left architecture rail/right server-browser scene, open section spacing and stacked directory preserve the composition. On phones, workbench/architecture stack; only the code pane can scroll horizontally. Both themes have document.scrollWidth equal to 375/1440. No entrance makes sections transparent at rest.
- **Colors/tokens:** docs light/dark tokens, cyan-to-violet-to-pink brand gradient and subtle animated canvas. Word gradient continuity is checked across font/viewport/word changes. Light code and body/link contrast pass axe. The revised schema adds the illustrated cyan and magenta glow, nested surfaces and blue icon strokes.
- **Assets/image quality:** actual Rivet logo and installed fonts; lucide icons throughout. No screenshot is used as the page. User explicitly requested a native canvas and interactive schema; native nodes/connectors implement that approved schematic, replacing the earlier brace illustration.
- **Copy/content:** selected headline, CTA and architecture titles retained. Real guides and configured framework/UI/CDK destinations resolve. Benchmark values and loss caveat come from committed report data with direct source links. Server HTML is an illustrative code pane, not fabricated compiler output. Visible browser animations supersede the old no-script-before-input claim; historical Lighthouse data is not presented on this page.

## Interaction and accessibility evidence

- All 75 docs tests passed after the independent review fixes, including retained clipboard, mobile containment, stable accessible headline, server-button node adoption, theme interaction, no repeated downloads, 100ms warm pointer-to-paint budget at 4× CPU, keyboard tabs and axe.
- Added production cases cover actual canvas pixel changes, user pause/offscreen suspension, counter reversals/9→10/0–99 bounds and digit track geometry, architecture keyboard/manual/replay, headline cycle/pause/live reduced motion, continuous word gradient, no-JS/print and both-theme screenshots/axe.
- Live in-app browser: increment 07→08, switch Component→Server HTML→Component, select architecture Start with the page, return to hero. Revised diagram manual Update step also checked in the live in-app browser. Browser error log checked: empty. `live-preview.png` records the working page with corrected gradient.
- TypeScript, content, snippets, errors, llms, MCP data, AI sync, home-perf freshness and whitespace checks pass. Production builds remain below the unchanged 3072 MB tree budget; latest schema runs are recorded in the archived build logs.

## Accepted deviations and limits

The existing shared navigation/search/theme/mobile drawer/footer remain, as required by the implementation brief. The schema is the later approved revision; the four sourced proof summaries are retained alongside its new layout; UI and CDK each receive a directory link. The refreshed page intentionally loads canvas/Motion code before input. Historical Lighthouse figures remain dated metadata, not fresh measurements or claims. Visual browser coverage is Chromium; Safari/Firefox and fresh Lighthouse runs were not performed. Deferred minor from independent review: actual background/foreground transitions and live reduced-motion preference changes for the canvas lack dedicated production tests; initial reduced motion, explicit pause and offscreen suspension are covered.

## Implementation checklist

- [x] Compare selected source and actual production captures together.
- [x] Recapture and inspect earlier P2 fixes.
- [x] Inspect native-scale hero/schema, both themes and phone layout.
- [x] Verify keyboard, counter, animation lifecycle and server-rendered fallback.
- [x] Preserve real documentation links, benchmark sources and truthful startup claims.
