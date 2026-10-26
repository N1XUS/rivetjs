# Rendering cost per interaction and per mount (lane RENDERCOST, 2026-10-26)

Base `cf13ae791`. Chrome 155.0.8059.86 headless, macOS (Apple silicon, 14 CPU), host load 9–13 (other lanes running). Raw: `2026-10-26-rendercost.json`. Tools: `apps/dom-bench/render/` (see `apps/dom-bench/CLAUDE.md`).

Metric = main-thread **self time** per trace event inside a window, bucketed: script (JS + DOM API work inside JS calls), style (`UpdateLayoutTree`, `ParseAuthorStyleSheet`), layout, prepaint, paint, composite (`Layerize` / `Commit` / `UpdateLayer`). render = style + layout + prepaint + paint + composite. Window: interactions = krausest duration window (click `EventDispatch` → next `Commit`); page load = `ParseHTML` → load + 600 ms. Medians of 5 (7 for krausest), fresh context per sample.

## Verdict

- Kill criteria (≥ 15 % less rendering on two big cases, no visual diff, no regression elsewhere): **not met by any framework-level change**. No land; tooling + data only.
- Two candidates exceed 15 % but break a condition; both need a ruling (below).

## krausest (keyed table): Rivet = vanilla

`node apps/dom-bench/render/krausest.ts --iterations 5 --cpu 1,4`

| benchmark | Rivet render 1× | vanilla render 1× | Rivet render 4× | vanilla render 4× | style els / layout objs (both) |
| --- | --- | --- | --- | --- | --- |
| 01 run 1k | 19.45 | 18.47 | 86.51 | 85.27 | 9001 / 12007 |
| 02 replace 1k | 19.82 | 19.82 | 92.45 | 96.20 | 9001 / 12007 |
| 03 update 10th | 3.06 | 3.09 | 15.65 | 15.88 | 1 / 407 |
| 04 select | 0.76 | 0.77 | 2.60 | 2.84 | 8 / 0 |
| 05 swap | 3.45 | 3.81 | 17.76 | 15.89 | 1017 / 31 |
| 06 remove | 5.43 | 5.55 | 28.68 | 27.28 | 997 / 7 |
| 07 create 10k | 200.7 | 203.2 | 949.1 | 874.9 | 90001 / 120007 |
| 08 append 1k | 22.99 | 24.05 | 111.4 | 107.8 | 9001 / 12007 |
| 09 clear | 0.32 | 0.31 | 2.12 | 1.42 | 1 / 7 |

- Same elements recalculated, same objects laid out: the DOM write shape is already minimal. Differences are noise (4× 07: one run, 1.1 s windows). Script is the only gap (01: 1.93 vs 1.47 ms).
- Containment of rows is not available here: the lane contract fixes the DOM and the shared stylesheet, and `contain` does not apply to table rows.

## ui-docs frames (100–400 elements, fully interactive)

`node apps/dom-bench/render/page.ts --root apps/ui-docs/dist/client --pages apps/dom-bench/render/pages/ui-frames.json --cpu 1,4 --iterations 3`

| frame / step | script 1× | style | layout | prepaint | paint | comp | render 1× | render 4× |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| kanban load | 12.13 | 2.29 | 7.30 | 0.66 | 1.11 | 0.24 | 11.75 | 56.0 |
| kanban move (2nd) | 1.12 | 0.56 | 0.22 | 0.20 | 0.23 | 0.26 | 1.49 | 10.2 |
| kanban add | 1.65 | 0.87 | 0.16 | 0.17 | 0.32 | 0.32 | 1.86 | 13.2 |
| scheduler-views load | 5.17 | 2.28 | 7.05 | 0.62 | 0.94 | 0.17 | 11.04 | 58.5 |
| scheduler next (2nd) | 1.17 | 0.30 | 0.28 | 0.19 | 0.31 | 0.16 | 1.26 | 6.7 |
| scheduler view switch | 3.06 | 1.43 | 0.70 | 0.43 | 0.58 | 0.37 | 3.56 | 19.2 |
| data-grid-virtualized load | 2.86 | 4.28 | 6.03 | 0.39 | 0.97 | 0.31 | 11.99 | 55.8 |
| data-grid sort desc | 3.91 | 1.45 | 0.43 | 0.22 | 0.55 | 0.43 | 3.06 | 11.2 |
| table-selection none | 0.66 | 0.61 | 0.14 | 0.16 | 0.11 | 0.21 | 1.25 | 8.4 |

- Per interaction rendering is 0.8–3.6 ms at 1×; style scales with inserted / moved elements (5–8 µs each).
- Selector matching is not the cost: Chrome selector stats (kanban, load + 4 clicks) total ≈ 0.6 ms; no `:has()` rule shows up. Forced full recalc attribution (CSSOM rule deletion, cross-origin-isolated timer): deleting the attribute-subject rules (`[data-slot="…"]` rightmost) halves a full recalc (data-grid 1.0 → 0.5 ms, kanban 0.4 → 0.2 ms); deleting `:has()`, `:is()` / `:where()`, custom properties, `@property`, `color-mix` or transitions changes nothing measurable. Single toggles: `data-hovered` / `data-pressed` 20–25 µs style (5 µs without attribute-subject or transition rules).
- Hole / boundary comments: static copies (scripts removed) with vs without all comments: kanban render 11.40 vs 11.46, scheduler 11.32 vs 11.46, data-grid 12.28 vs 12.11, table 13.48 vs 13.23 ms (1×). No effect.
- Load rendering is mostly a cold first layout: a one-`div` page with the same stylesheets lays out in 6.0 ms (bare page 2.8 ms).

## Font stack (cold first layout, Chrome macOS)

One-`div` pages, first layout: `-apple-system` 5.7 ms, `BlinkMacSystemFont` 3.2, `system-ui` 3.3, `Times` 3.6, absent families before Arial 6.9, absent `SF Pro Text` 8.5. The cost is a CoreText family lookup in the renderer (not scaled by CPU throttling). First forced layout, 30 fresh contexts, mean ms:

| stack | Chrome | Firefox | WebKit |
| --- | --- | --- | --- |
| `-apple-system, BlinkMacSystemFont, "Segoe UI", …` (Tailwind 4 default) | 6.52 | 6.17 | 2.07 |
| `BlinkMacSystemFont, -apple-system, "Segoe UI", …` | 3.52 | 4.40 | 3.63 |
| `system-ui, sans-serif` | 3.48 | 4.87 | 1.97 |

Firefox / WebKit timers are 1 ms coarse (means of quantised samples).

Frames with every built stylesheet's stack reordered (`BlinkMacSystemFont` first, 37 files, `--css-swap`), load render 1× base → swapped: kanban 11.51 → 9.74 / 11.6 → 9.87, scheduler 11.41 → 9.10 / 11.63 → 9.22, data-grid 11.92 → 9.96 / 12.16 → 10.10, table 11.17 → 9.09 / 11.26 → 9.49 ms (two rounds; −15…−20 %); 4× within noise. Interactions unchanged. Chrome screenshots identical on 8 pages / 14 shots (`render/parity.ts`).

## content-visibility on long docs pages

Rule `.prose > :is(.example, .code-block, .table-wrap) { content-visibility: auto; contain-intrinsic-size: auto 400px }` (all three already clip: `overflow: hidden` / `auto`; out-of-flow descendants escaping them are only hidden tab radios and `sr-only` text at their static position, 117 ui-docs component pages scanned). `page.ts --pages apps/dom-bench/render/pages/ui-docs-pages.json --css-swap /assets/styles-<hash>.css=…`, two rounds:

| page (elements) | render 1× base → cv | render 4× base → cv | style els |
| --- | --- | --- | --- |
| components/table (5271) | 59.6 / 62.4 → 46.2 / 46.6 | 300 / 277 → 230 / 245 | 2228 → 1203 |
| components/scheduler | 66.1 / 64.5 → 52.1 / 52.5 | 299 / 311 → 237 / 271 | 2605 → 1463 |
| components/button | 66.8 / 67.8 → 53.6 / 57.2 | 368 / 319 → 250 / 288 | 1553 → 1060 |
| components/data-grid | 52.6 / 51.5 → 44.2 / 45.5 | 264 / 243 → 215 / 229 | 1616 → 1096 |

Screenshots are not identical: paint containment snaps each contained subtree to whole pixels, so glyph anti-aliasing and ≤ 1 px offsets differ (17 of 20 shots on 4 pages; content unchanged by eye), and page height differs until every block has rendered once.

zero-cards (500 cards, Tailwind grid) with rows contained: `content-visibility: auto` load render 15.1 → 12.5 ms, per click 0.94 → 0.76 ms; `contain: layout style` per click 0.94 → 0.77 ms. The remaining 0.5 ms (1×) / 2.2 ms (4×) per click is the grid re-laying out 500 items after a button label change (script 0.09 ms).

## Rulings needed

- Font order: `BlinkMacSystemFont` before `-apple-system` in `@rivetjs/ui`'s theme `--font-sans` (and starter templates). Chrome macOS −2…−3 ms per cold renderer (frames −15…−20 % load render), pixel-identical by construction on every platform; WebKit +≈1.5 ms, Firefox unclear. Proposed: no (fails "no regression elsewhere").
- `content-visibility: auto` on docs-kit `.prose` blocks: −15…−25 % load render on long docs pages, sub-pixel screenshot diffs. Proposed: no as a strict-parity lane; yes if sub-pixel AA diffs are accepted for docs pages.
