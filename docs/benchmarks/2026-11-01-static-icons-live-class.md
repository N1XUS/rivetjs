# Static glyphs with live classes — 2026-11-01

A fixed lucide glyph no longer needs the runtime Icon component solely because its class is live. The existing static-icon source pass emits the same SVG shapes and retains the original class expression as one native binding. Explicit string aria-hidden="true" repeats the default without adding a duplicate. Geometry/color/data props must still be constants; titles, accessible-name props, other live props, spreads, events and duplicates keep Icon. Source expressions never run at build time. staticIcons:false remains an opt-out.

Base: ab5ee94cad89f7ced0835dae0743f00c90244d65; candidate: the declared source overlay in the local provenance receipt. Node24.18.1, one heavy command at a time, nice10, sampled process-tree cap3072MiB/V8 heap2048MiB. No Rust, runtime ABI, dependencies, resource caps or classifier changes.

## Actual full UI pages

Three rotating A/B repetitions per page, fresh Chromium contexts, native touch/keyboard and production immutable asset caching. Brotli quality11; local server ledger records actual JS body bytes. No request interception/cache disabling. Initial navigation uses networkidle; after scrolling/input a JS-only ledger must settle500ms within15s, excluding unrelated non-JS iframe traffic. All24 interactions pass without page errors/external origins; the actions add no JS. Host load1: 4.47–5.10. Timing is not compared.

| Page / action | Raw JS A → B (B) | JS body A → B (Brotli B) | Requests/files A → B |
| --- | ---: | ---: | ---: |
| button | 173072 → 167698 | 61754 → 59623 | 37 → 35 |
| prompt-input | 282044 → 282461 | 102724 → 102345 | 80 → 77 |
| tabs | 237306 → 237306 | 82184 → 82184 | 48 → 48 |
| modal | 304835 → 304835 | 112491 → 112491 | 96 → 96 |

These are medians, with min=max for all byte/request counts in all3 repeats. Button saves5374 raw/2131 Brotli B and2requests. PromptInput raw grows417B but its transferred body falls379B and it makes3fewer requests. Tabs/Modal are unchanged. The cached A production source tree is attested against all13719 base files; the cached build's source/toolchain and previous checks remain in the preceding codec evidence folder. B is a fresh full UI build with all1368 example checks executed. Full-site and frames-only chunk graphs differ; do not substitute one table for the other.

## Small and large frames

The maintained17-case production frame gate compares the same small/static/lite pages and interactive Table/Scheduler/Kanban. PromptInput:216749→212025 raw B,71877→69631 Brotli B,19→16files. Other affected frames have smaller Brotli and no request increase. ChatAttachment/DataGrid raw grows142/210B while Brotli falls9/83B. ChainOfThought loses1file; DataGrid/Kanban each lose2. Unaffected small/lite/static cases and Scheduler are identical. Inline scripts, serialized state and boundary record counts are unchanged; PromptInput's internal holes fall12→4 as static shapes stop needing an insertion range.

Exact rows/deltas are in the JSON sidecar and frame-updates.json. The31 intended frame fields track these measured outputs, including both raw increases. ZERO acceptance targets are unchanged. No claim that every raw JS file shrank is made.

## Behavioral proof

Native optimization regression: base keeps Icon for a live class (AssertionError), candidate inlines it. SSR tests compare all lucide glyphs across5 constant prop sets and original-vs-native ClassValue strings, empty/null/undefined, numbers/bigint, booleans, arrays and records, special text, multiline Unicode offsets and side-effect order. Browser A/B compares the full element/attribute tree, namespaces, reader counts and retained SVG/path identity across those values. Internal comment anchors/attribute insertion order differ by construction, so those are recorded as private template details; server bytes are checked exactly.

The initial browser diagnostic asserted raw outerHTML and failed only on those private details; it remains retained separately. The semantic comparison preserves all supported attribute/value, namespace, identity and reader assertions. Unrelated title/aria-label/other live prop/event/spread/duplicate forms remain untransformed.

## Reproduce and receipts

From the attested candidate snapshot:

- Native regression: node node_modules/vitest/vitest.mjs run --project compiler libs/compiler/tests/static-icons.test.ts -t "a static glyph with a live class keeps native SVG and matching server output" --maxWorkers=1.
- Full site: node libs/docs-kit/cli.ts build apps/ui-docs.
- Frames: node scripts/size-report/frames.mjs --check --json=<artifact>/frames.json.
- Real pages: node <artifact>/network.mjs (both attested production sites must exist).

Raw evidence: .artifacts/js-diet/2026-11-01-shared-closures/, including source/module graphs, exact native RED/GREEN, production builds, A/B ledger, resource receipts and full affected gates. An earlier DOM helper leaf extraction was rejected (extra requests/larger heavy frames) and restored byte-for-byte; it contributes no code or performance claim to this patch. No timing or fresh hydration comparison is claimed.

## Final verification

All55 affected gates are covered across immutable receipts: {"pass":55}. The initial two-worker compiler run was automatically stopped by the unchanged3GiB guard at 3230793728B; that run remains a resource failure. Its first44 passing rows are retained. The exact same full compiler project then passes with1worker:511passed/1existing skipped across101/101 collected native files, sampled peak 1910833152B. Only concurrency/reporting changed; no selectors, test skips, assertions or thresholds changed. The remaining10 gates run with their original commands, including142/142 scripts tests,64/64 docs tests,11/11 UI site tests, all3 production builds and repeated frame/zero-cost/size checks. Resource receipts include supervisor overhead.

Runtime/package/lane hash pins and general size baselines stay unchanged; only31 measured frame fields update. The observed baseline matches all17 metrics of an independently built uninstrumented baseline exactly (`observer-output-proof.json`); the observer is absent from the candidate. Fresh final native RED/GREEN uses the identical final test-file bytes on the base/candidate.

The bounded read-only Astra review, canonical patch/source hashes and named-path temporary-index commit receipt are retained in the same evidence directory. No local source or final verification record is fabricated by the model worker; these are supervisor-run native commands.
