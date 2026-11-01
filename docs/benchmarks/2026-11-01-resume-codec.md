# Resume codec chunk isolation — 2026-11-01

The optional value-table decoder was pulled into the eager derived-runtime closure by mutable hooks shared through `resume-format.ts`. Moving those hooks to an internal leaf removes roughly 2.1 KB of minified code from the measured UI/docs closures. Public exports, live decoder registration, serialization and fallback behavior stay the same.

Source A: `7e94f810b59a9def6c31f27d8554ccb1d4e69b29`; source B: A plus the exact named candidate recorded in `.artifacts/js-diet/2026-11-01-runtime-leaves/provenance.json`. Both use local production builds on Node 24.18.1. The existing A full-site build is attested against its exact source/toolchain, not inferred from its directory name (`cached-baseline-proof.json`). One heavy process at a time, nice10, V8 heap 2048 MiB, sampled tree cap 3072 MiB. Actual resource receipts remain next to each command.

## Full UI site, real network and interactions

Three rotating A/B repetitions per page, new Chromium contexts, native touch/keyboard, Brotli11, production immutable asset caching. No request interception or cache disabling. The server ledger counts actual JS response bodies; unique raw JS bytes and requests are also retained. Initial navigation settles with networkidle; after scrolling/input, a JS-only ledger must remain unchanged for 500 ms within 15 s. This excludes unrelated non-JS iframe traffic from the measurement boundary. Timing is not compared. A separate repeat of the same protocol records host load1 5.29–8.27; it repeats all24 successful interactions with identical byte/file counts (`network-v3.json`).

| Page / native action | Raw JS A → B (B) | JS body transfer A → B (Brotli B) | Unique JS files A → B |
| --- | ---: | ---: | ---: |
| Button / press | 175214 → 173072 | 62400 → 61754 | 37 → 37 |
| Prompt input / type and send | 284206 → 282044 | 103375 → 102724 | 80 → 80 |
| Tabs / select Analytics | 239488 → 237306 | 82823 → 82184 | 48 → 48 |
| Modal / open and Escape | 306997 → 304835 | 113173 → 112491 | 96 → 96 |

These are medians; min=max for every byte/file count across all three repetitions. All 24 interactions pass, no page errors or external origins; actions add no JS relative to the settled before-input snapshot. This includes the documentation chrome and the opened example. Full-site chunks differ from frames-only chunks; the measurements are separate.

## Frame payloads

`node scripts/size-report/frames.mjs --check --json=<artifact>` builds the same 17 maintained cases, including static/lite examples and large interactive Table/Scheduler/Kanban. Against a fresh A measurement, full-runtime closures lose 2136–2156 raw B and 587–810 Brotli B with unchanged file counts, inline scripts, state and HTML. Lite raw sizes and static zero-JS cases stay unchanged. `resume-demo` changes 2711 → 2714 Brotli B at identical 6011 raw B because its content-hashed full-fallback URL changes; gzip drops 3 B. This is recorded explicitly, never credited as a code reduction. ZERO acceptance targets and classifiers are unchanged.

An earlier DOM-template/ref extraction prototype was rejected: it saved bytes for Button but added a request and increased Brotli payloads on large frames. A dead numeric check cleanup was also dropped because production bytes were identical. Only the measured hook isolation remains.

## Reproduction and evidence

Native minimized regression: `node node_modules/vitest/vitest.mjs run --project runtime libs/runtime/tests/dom-v2-chunks.test.ts -t "derived boot does not carry the table decoder of a lazy root" --maxWorkers=1`. A fails with the asserted eager codec closure; B passes, and the lazy root still contains its real decoder. The focused existing stream/Date/lite-fallback/data tests pass 47/47.

Raw evidence lives under `.artifacts/js-diet/2026-11-01-runtime-leaves/`: `before-a1.json`, `after-hooks-b1.json`, `network-v2.mjs` / `network-v2.json`, `network-v3.mjs` / `network-v3.json`, `measurement-summary.json`, full-site logs, native RED/GREEN and process/resource receipts. Run the production network probe with `node <artifact>/network-v2.mjs`; build both sites first with `node libs/docs-kit/cli.ts build apps/ui-docs` in their attested snapshots. The first global-networkidle protocol timed out symmetrically in A and B and is retained as `network-v1-invalid.json`; it supplies no performance or correctness claim.



## Matched hydration reference

Fresh unchanged real-page suite, Rivet versus isolated Solid1.9.15, Chrome 156.0.8078.79, Node v24.18.1, fast condition, five rotating repetitions (40 samples). All eight SSR markup/hydrated markup/full behaviour cells pass. Byte counts have min=max in every cell. This is the current lite-path advantage on these fixtures; hook isolation does not receive credit for that existing advantage. It is not a comparison of heavy CDK/UI libraries. No timing advantage is inferred from these samples.

| Page | External JS transfer Rivet / Solid (B) | Inline JS source Rivet / Solid (raw B) | Document + JS transfer Rivet / Solid (B) | JS requests each |
| --- | ---: | ---: | ---: | ---: |
| products | 3753 / 7490 | 3967 / 14881 | 8410 / 10677 | 1 |
| dashboard | 4797 / 7714 | 3967 / 9181 | 9338 / 10903 | 1 |
| settings | 3708 / 7624 | 3967 / 624 | 7219 / 9583 | 1 |
| article | 3500 / 7886 | 3967 / 624 | 7355 / 10202 | 1 |

The reference uses its maintained CDP `encodedDataLength` transfer metric (including response overhead); the UI A/B table uses server-counted Brotli bodies. Do not combine those metrics. Document transfer already includes inline scripts, so adding their raw sizes to transfer would double-count them.

Reproduce from the candidate snapshot: `node apps/resume-bench/run.ts --suite real --build --lanes rivet,solid-stable --conditions fast --repeats 5 --out <artifact>/hydration-comparison --report <artifact>/hydration-comparison.md`. Source/artifact/version manifests, per-trial host load and command are in `hydration-comparison/results.json`; the native generated timing tables remain local and supply no claimed speedup here.

Hydration-reference host load1: 5.22119140625–5.79638671875. The full-gates receipt records its starting host load separately.

## Validation and expected-output costs

The original full54-gate run took 941477 ms and remains failed on the three intended expected-output comparisons (frames, zero-cost, size). After native expected-output generation, the unchanged five-gate follow-up covers scripts, frames, zero-cost, size and formatting. All55 affected gates are covered across these immutable receipts: {"pass":53,"known-red":2}. `coverage.json` identifies the actual command/log/receipt behind every row; it is not labelled a single all-green run.

Both runtime projects retain their existing registered `click-defer-browser` frame-timing red (741passed/1failed production;737passed/4skipped/1failed development). No known-red entry, test assertion or classifier changed. Scripts pass142/142, focused runtime47/47, docs site64/64, UI site11/11. All three production docs builds pass. The first candidate UI build freshly checks1368/1368 examples; the later full-gate UI build reuses1366 unchanged checks and executes2. The original size report has the same two recorded interaction errors as the committed/fresh baseline (`loader-data`, `motion-scroll`); those do not become passing interaction claims.

Intended expected outputs: eight runtime pins, six Rivet-router artifact pins,40 frame JS byte fields and generated size baseline tables for28 apps. The standalone public `resume-format` entry grows19 raw B; server-cache and three derived-runtime entries shrink16 B, lite raw sizes stay fixed. Five general fixtures grow2–9 raw client B while their aggregate client Brotli shrinks105–166 B; motion-gestures client Brotli grows3 B. Server bundles shrink raw but some grow compressed, up to170 B. These costs are retained in `expected-output-updates.json`, `size-fresh-ab.json` and `size-update-receipt.json`, rather than hidden behind UI savings. Fresh A differs from the older committed baseline by only two HTML compression values (+10/-1 B); no performance credit is assigned to those. Other framework lanes and package pins are unchanged. No ZERO target, resource limit, classifier, quarantine or assertion was weakened.

Full-run outer sampled peak: 3060465664 B; follow-up outer peak: 3039608832 B, below3221225472 B. Native resource receipts include supervisor overhead. The bounded read-only `gpt-6-astra` review receipt and exact named-path temporary-index commit receipt are retained beside the canonical patch; candidate source hashes are checked before/after review and intake.
