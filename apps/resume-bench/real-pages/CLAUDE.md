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
- `run.ts` — `runRealPages(args)`: build → per lane/page JS-disabled SSR signature (must equal across lanes) → hydrated markup unchanged → behaviour gate; failing cells are withheld (recorded in `errors`, never timed). Timing: per condition × page × repeat, rotating (Latin-square) lane order, fresh context, cache disabled, one static origin at a time on `--port` (default 4520, allowed 4520–4529), under the shared bench lock.
- `report.ts` — `summarize()` (median / min / max, complete cells only; imported by `apps/dom-bench/scoreboard.ts`) + generated Markdown (`node apps/resume-bench/real-pages/report.ts <results.json> <report.md>`). Never hand-edit numbers.

## Metrics

HTML bytes (source) + HTML transfer, JS transfer + requests before input (CDP `encodedDataLength`, includes preloads), inline script bytes, CPU before input (CDP `TaskDuration`, renderer main thread), FCP / LCP (observers), TBT (long tasks − 50 ms, FCP → cutoff = load + 1 s), input → mutation and input → paint (rAF → MessageChannel proxy, same as the micro runner; trusted mouse click, first-click deferral contract unchanged). `fast` = unthrottled, `slow` = Slow 4G + 4× CPU. Server RSS: N/A (prerendered static serving).

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
