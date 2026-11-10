# Real application page suite (resume-bench `--suite real`)

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes.

Headline suite of resume-bench + the perf scoreboard (lane CX-REALBENCH 2026-10-28). The counter / 1,000-row fixture / krausest stay as **micro** benchmarks (never removed). Report: `docs/benchmarks/2026-10-28-real-pages.md`.

## Pages (server data, whole page = one native framework root)

- `products` — 96 server records, 48 cards / page, 4 category chips, sort select, search input, pagination, header cart counter. Timed: first `.add-cart` click → `#cart-count` "1".
- `dashboard` — 4 KPI cards, 100 records / 50-row page, sortable (`#sort-table`) + paginated table, tabs, dropdown menu, date-range inputs. Timed: sort click → `#sort-state` "Descending".
- `settings` — 15 fields (required + email validation), 2 toggles, confirm modal (cancel / confirm). Timed: invalid submit → `#form-status` "Please correct 15 fields".
- `article` — 12 sections / 48 paragraphs, TOC anchors, search dialog, 12 copy-code buttons (clipboard). Timed: `#open-search` → dialog title.

## Files

- `fixture.ts` — ONE canonical markup / CSS / data / algorithm generator (`appSource(lane, page)`, `serverData`, `css`). Lanes differ only in signal / memo / keyed list / event syntax: Rivet `signal` / `computed` / `For by`, Solid `createSignal` / `createMemo` / `For`, Qwik `useSignal` / `useComputed$` / `.map(key)`. Qwik handlers get `currentTarget` as the 2nd argument and `preventdefault:submit` (Qwik handlers are async). Boolean ARIA states always render `"true"` / `"false"`. No hand-written DOM, no lane-specific behaviour or shortcuts.
- `build.ts` — writes the generated source to `../.build/real-source/<lane>/<page>` and runs the existing `lanes/<lane>/build.ts` in a child with `RESUME_BENCH_SOURCE` (toolchain config, stable aliases, minification unchanged) → `../dist/real/<lane>/<page>` + `data.json` + `build-manifest.json` (sources include `real-pages/`). Solid lanes load data through their resource (`createResource` + `Show` / `createMemo`, `deferStream`), Rivet through the root prop (resume state), Qwik through component props (serialized state).
- `contract.ts` — page list, timed main interaction, `markup()` SSR signature (tags + id / class / type / role / href / name / data-id / disabled / checked / aria-*, normalized text; framework attrs, comments, scripts excluded from parity only), `verifyPage()` behaviour gate (every control, empty search, pagination reset, invalid / valid submit, cancel never saves, clipboard text, anchor navigation).
- `run.ts` — `runRealPages(args)` (+ `sample()`, exported for A/B harnesses): build → per lane/page JS-disabled SSR signature (must equal across lanes) → hydrated markup unchanged → behaviour gate; failing cells are withheld (recorded in `errors`, never timed). Timing: per condition × page × repeat, rotating (Latin-square) lane order, fresh context, cache disabled, one static origin at a time on `--port` (default 4520, allowed 4520–4529), under the shared bench lock.
- `report.ts` — `summarize()` (median / min / max, complete cells only; imported by `apps/dom-bench/scoreboard.ts`) + generated Markdown (`node apps/resume-bench/real-pages/report.ts <results.json> <report.md>`). Never hand-edit numbers.

## Metrics

HTML bytes (source) + HTML transfer, JS transfer + requests before input (CDP `encodedDataLength`, includes preloads), inline script bytes, CPU before input (CDP `TaskDuration`, renderer main thread), FCP / LCP (observers), TBT (long tasks − 50 ms, FCP → cutoff = load + 1 s), input → mutation and input → paint (rAF → MessageChannel proxy, same as the micro runner; trusted mouse click, first-click deferral contract unchanged; the paint is awaited through a promise the arming `evaluate` made before the click — since REALCPU 2026-11-10, before that a `waitForFunction` after the click compiled Playwright's injected script in the page's main world, ~13 ms at 4× CPU, inside the input → paint window of every lane: see "REALCPU" below). `fast` = unthrottled, `slow` = Slow 4G + 4× CPU. Server RSS: N/A (prerendered static serving).

## Commands (repo root, Node 26 PATH, `nice -n 10`)

- Verify only: `node apps/resume-bench/run.ts --suite real --build --verify [--lanes …] [--pages …]`.
- Measure: `node apps/resume-bench/run.ts --suite real --build --repeats 5 --out .artifacts/real-pages/<stamp> --report docs/benchmarks/<date>-real-pages.md`.
- Without `--suite real` `run.ts` runs the micro fixture (scoreboard CLI contract unchanged).

## Known reds (2026-10-28, withheld cells)

- `qwik-stable/dashboard` (Qwik 1.20.1): the export handler of the client-rendered menu writes `status` + `menu`; the menu closes but `#dashboard-status` keeps "Ready" (the SSR text binding is not updated). Qwik 2 RC passes the same source.
- `qwik/settings` (Qwik 2.0.0-rc.0): the first submit logs 30 `QWIK ERROR [object Promise]` page errors (`useComputed$` read during render before its QRL resolved); the final DOM is correct, but the gate requires zero page errors.

## Results 2026-10-28 (base 7d083e587, Chrome 156, n = 5, load1 ~8–12; full tables in the report)

- Scoreboard verdict on the 32 headline rows: 0 WIN / 17 TIE / 15 LOSE. Ties: products paint, CPU before input, LCP, TBT (0 everywhere), fast paint vs Qwik.
- Losses: JS before input ~25.7 KB / 4 requests on every page vs Solid 1 ~7.5–7.9 KB / 1 (3.3–3.4×), Solid 2 ~21–22 KB; HTML transfer +1.4–1.6 KB vs Solid; slow paint on dashboard (sort: 56 vs Solid 1 46.5 ms) and settings (15-field invalid submit: 76 vs 44 ms, Rivet bimodal 49–84).
- Fast paint ~32 ms in Rivet / Qwik vs ~38–41 ms in Solid on every page except settings (48 vs 40): the first-mouse-click one-task deferral shows up as a frame quantum, not framework work.

## Results 2026-10-28 after JS-DIET-2 (report `docs/benchmarks/2026-10-28-real-pages-jsdiet.md`, n = 5, load1 2.5–9.7)

- JS before input: Rivet 3.5–4.8 KB / 1 request on every page (was ~25.7 KB / 4) vs Solid 1 7.5–7.9 KB / 1, Solid 2 ~21–22 KB / 1, Qwik 1 ~24 KB / 3, Qwik 2 RC 38–44 KB / 14–31. The lite runtime + page residual ship as one chunk.
- Slow main interaction → paint: products 32.3 vs Solid 1 48 ms, dashboard 35.4 vs 54.1, article 32.8 vs 48.5; settings 53.6 vs 52 (tie). Fast paint ~32–33 ms except settings 49.7 vs 34.3 (first-mouse-click deferral frame quantum).
- Main-thread CPU before input (slow) lowest on every page (44.5–64 ms vs Solid 1 46.6–67.6).

## LITE-BOOT 2026-10-29 (report `docs/benchmarks/2026-10-29-lite-boot.md`, A/B n = 7, load1 3.4–6.4)

- Loader prime (runtime started + page modules loaded with the idle fetch-ahead): settings paint fast 49.6 → 36.4 ms (Solid 1 34.3), slow 50.6 → 38.1; mutation 36.9 → 1.6 / 41.2 → 7.8. Products / dashboard / article within frame noise (click handlers keep the first-click deferral); CPU before input +0..+4 ms slow.

## REALCPU 2026-11-10 (base c13c09707, Chrome 156, slow unless noted, rivet vs solid-stable, load1 9–22)

- CPU before input (`spikes/real-trace.ts`, n 5 per page, medians, ms at 4×): style + layout + paint 34–45 (17–21 / 13–20 / 6–18 per page, equal in both lanes on the same markup + CSS), navigation (commit, context) 8–10, task / mojo overhead 9–12, parse 5–11, probe + Playwright script ~4–5 in both. Framework-only: Rivet 6–6.5 (inline loader run ~2.5–4.3 + its compile 1.5–1.8, load listener + idle prime callback ~1.5 incl. the modulepreload append ~1.2, lite runtime eval + start ~0.5) vs Solid 1 ~10–12.5 (bundle compile 5–6 + evaluate/hydrate 4–6, inline `_$HY` 0.5–1.9). Rivet's 2–8 ms (3–10 %) lead (runner A/B n 9: products 69.4 vs 71.6, dashboard 77.0 vs 85.5, settings 55.4 vs 58.4, article 69.6 vs 73.0) sits inside the ±5 ms load noise of ~60–90 ms totals → overlapping ranges → TIE by the scoreboard rule; no Rivet-side change brings it past that (largest Rivet-only items are each ≤ 2 ms at 4×).
- LCP = FCP on every page: response time (150 ms RTT) + the first style / layout / paint of identical markup (~45–60 ms at 4×), 16 ms frame quantum; Rivet's +1.2 KB HTML (loader) is ~6 ms of transfer at 1.6 Mbps inside the same frame → TIE is structural.
- Interaction → paint: the runner's `waitForFunction` after the click compiled Playwright's main-world injected script (EvaluateScript ~13–15 ms at 4×) between input and paint in every lane (fixed above). Interleaved A/B legacy → fixed wait, 2 × (4–5 rounds), n 9: slow Rivet products 30.9 → 30.5, dashboard 38.1 (outlier 72.7) → 35.1, settings 40.7 → 40.7, article 32.0 → 32.3; Solid 1 products 54.7 → 40.6, dashboard 43.8 → 43.9, settings 53.1 → 40.9, article 51.4 → 40.7. Fast: within ±2.5 in both lanes. Earlier slow-paint WINs vs Solid 1 were partly this artifact; settings is a TIE.
- Dashboard vs products (+~4.5 ms slow): the sort's deferred flush reorders 50 rows (3.3 ms vs 0.8), a minor GC (1.5) and its frame's style / layout / paint (9.5 vs 2.6 ms) — DOM work both lanes pay. Settings (+~10 ms): `#save` sits below the 800 px viewport (y 905), Playwright scrolls it into view in the click's frame N, which takes Chrome's first-click stall (~25–31 ms idle in BeginMainFrame) in every lane. Deferring the submit the first click fires (lite `delegate`, like the click's own flush) was measured and rejected: mutation 7.6 → 37.7 ms, paint 40.1 → 48.7 slow (the stall comes from the scroll, the deferral only adds a frame).
