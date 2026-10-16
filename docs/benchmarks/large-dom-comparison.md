# Large DOM comparison — 2026-10-02

The large page exposes two major Rivet costs: mounting and mounted memory. Rivet's committed updates beat React DOM in this fixture, but that does not translate into a CPU win. Solid is ahead on mounting, heap, and full-field updates. These are exploratory results for this workload, not a universal framework ranking.

The run used source `b710b72`, Chromium 153.0.8010.12, Node 24.14.1, and an Apple M4 Pro on macOS ARM64. Production React DOM 19.3.0 and Solid 2.0.0-rc.13 are pinned; Solid is a prerelease. All 27 trials passed: three frameworks × three row counts × three rotated repeats. Every update was validated, including unchanged fields, representative text/element identity, clicks, disposal, and remounting. Five samples follow three warmup updates per percentage. No builds, tests, profilers, or other benchmark loads ran alongside the timings.

## The 5,000-row case

Every framework mounted the same 285,001 native HTML elements, 50,000 field components, and 50,000 working buttons. No virtualization or containment shortcut was used. Numbers below are group medians; update numbers are medians of the three trial sample medians.

| Metric | Rivet | React DOM | Solid |
| --- | ---: | ---: | ---: |
| Mount committed DOM, ms | 728.9 | 178.1 | 85.1 |
| Update 1% of fields, committed DOM ms | 1.9 | 3.5 | 1.5 |
| Update 10%, committed DOM ms | 15.5 | 23.0 | 11.3 |
| Update 100%, committed DOM ms | 89.7 | 106.6 | 21.7 |
| Update 100%, main-thread task CPU ms | 551.5 | 544.8 | 447.1 |
| Mounted JS heap above warmed baseline, MiB | 173.65 | 84.20 | 37.44 |
| Disposed JS heap above baseline, KiB | 57.79 | 1,351.25 | 18,462.46 |
| First-to-last of five disposal cycles, KiB | 5.28 | 35.24 | 2.17 |
| Total descendant nodes | 890,007 | 450,001 | 450,001 |
| Comment nodes | 440,006 | 0 | 0 |
| Serialized mounted HTML, bytes | 17,294,561 | 10,254,463 | 10,254,463 |

Rivet's marker nodes nearly double the node count despite identical native elements. Its mounted JavaScript heap is about twice React's and 4.6 times Solid's. This makes template clone/binding setup, owner/effect allocation, and scalar marker removal useful optimization targets. The evidence identifies costs; it does not yet attribute each millisecond or byte to a particular implementation detail.

CPU is Chromium `TaskDuration` with `threadTicks`, read before and after the update evaluation. It includes main-thread browser tasks and protocol/evaluation bookkeeping in that interval, including automatically scheduled rendering work. It is **not** just the JavaScript interval measured by `performance.now()`, so the CPU and committed-DOM columns have different scopes. Forced layout and frame settling are separately retained in the full results. Two animation frames are not a direct paint measurement. Small values, including zero, can be limited by the browser timer's precision.

Memory is forced-GC JavaScript heap, not process RSS or native DOM storage. Disposal cycles show little further growth in this run. Different retained caches and engine behavior can explain the disposed-baseline differences; these numbers do not demonstrate a competitor leak or prove Rivet cannot leak under other lifetimes.

## Bundle size

These are complete production fixture bundles with their imported runtimes, not runtime-only package sizes:

| Framework | Raw bytes | Gzip bytes |
| --- | ---: | ---: |
| Rivet | 11,959 | 4,777 |
| React DOM | 224,700 | 69,754 |
| Solid | 37,538 | 14,737 |

Exact bytes and hashes in the machine-readable result take precedence over rounded display numbers.

## Failure retained and fixed

The first large run stopped at Rivet's 5,000-row full update: its scheduler rejected more than 10,000 total effect executions, even though the 50,000 effects were independent. That incomplete run is excluded from the comparison. Commit `b710b72` bounds repeated executions of an individual effect per flush, preserves cycle error recovery, and traverses the pending set with one live iterator rather than repeatedly scanning deleted entries. Regression tests cover 50,000 effects across consecutive batches, feedback cycles, recovery, and requeue ordering. Full workspace checks passed after the fix.

The local failed artifact is `.artifacts/dom-bench/task7-large/failed.json`, 136,511 bytes, SHA-256 `244c8f9fb84a8de077809cc186578caeaa20f5394db52306771efd6da8d0b158`. It records 18 completed smaller trials before the failure; none are pooled into the rerun.

## Reproduce and audit

See [runnable benchmark instructions](large-dom-benchmark.md). The complete successful result, including every sample, heap cycle, source/bundle fingerprint, installed version, methodology, and environment is [large-dom-comparison-results.json](large-dom-comparison-results.json). Its original artifact is `.artifacts/dom-bench/task7-large-fixed/results.json`, 194,122 bytes, SHA-256 `a1bc83aaff996e4da11a865e807f695caaed8a700eb35f3c956fc6a69215623f`.

The generated local report is `.artifacts/dom-bench/task7-large-fixed/report.html`. This browser comparison does not change the saved SSR-versus-Razor result, and Lighthouse scores on the small playground remain excluded from performance conclusions.
