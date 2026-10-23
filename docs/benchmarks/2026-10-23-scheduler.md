# Scheduler implementation and measurements — 2026-10-23

This report separates focused measurements, integration gates and remaining limitations. It is not an upstream parity certification. The [306-row mapping](../design/research/2026-10-23-scheduler-upstream-cases.md) contains 305 product cases and one helper: 185 title correspondences, 105 audited/composed equivalents and 16 explicit deviations. Upstream suites were not executed.

Environment: M4 Pro desktop, Node 26.5.1, ordinary desktop apps active. This was not a quiet benchmark host. Heavy commands ran serially with `maxWorkers=1` and one Chromium project at a time. Process-tree RSS was not measured because sandbox process inspection is restricted. [Machine-readable evidence](2026-10-23-scheduler.json).

## Layout and complete rendering

| Measurement | Method | Result | Unchanged target |
| --- | --- | --- | --- |
| Pure week layout | Exactly 1,000 DateValueString events inside seven visible days; normalization, slicing and clustering; 50 warmups + 50 measured runs | Median 0.413 ms; min 0.357, max 0.503 | < 2 ms: PASS |
| Pure month layout | Exactly 1,000 events; normalization, slicing and lanes; 50 warmups + 50 measured runs | Median 0.428 ms; min 0.417, max 0.534 | < 2 ms: PASS |
| Complete visible-week SSR | Exactly 1,000 rendered timed chips inside seven days, UTC; 50 warmups + 50 measured runs | Median 11.072 ms; min 9.770, max 16.459; 1,067,231 UTF-8 bytes | < 6 ms: UNMET |

The layout measurements were supplied at T11 HEAD and were not rerun unchanged. The earlier whole-month fixture measured 2.0 ms and about 73 KiB; it collapses most events behind overflow, so it is not equivalent to rendering all 1,000 visible week chips. The week completeness check counts all 1,000 chip IDs. The < 6 ms target was not raised or presented as passing.

An isolated V8 profile excluded compilation/import and sampled 200 complete week renders after 50 warmups: 500 µs sampling, 3,010 samples. Server HTML/string work accounted for 972 self samples (32.3%), DateFormatter.format for 433 (14.4%), GC for 267 (8.9%), Scheduler frames for 373 (12.4%) and derived recording for 100 (3.3%). Output and per-chip accessible/time text dominate over integer layout. No broad renderer/compiler optimization was attempted; there is no evidence of a bounded Scheduler-only correction that closes 11 ms to < 6 ms.

## Cold overflow input

`cold-latency.ts --targets scheduler-more --repeats 3 --conditions fast,slow --trace` uses fresh browser contexts and disabled HTTP cache. Default router fetch-ahead may download code before input. Adding `--lean --scenarios click` disables fetch-ahead and measures cold network input. Slow applies 150 ms RTT, 1.6 Mbps down, 750 kbps up and 4× CPU throttling. Latency runs from the first relevant input event to the first paint after the real panel/action condition holds. Hover-click timing starts at click after 600 ms of hover; keyboard timing focuses the trigger first. Three samples per condition/scenario is a small sample.

| Policy | Input | Fast p50 (ms) | Slow p50 (ms) | JS transferred before / after input |
| --- | --- | ---: | ---: | --- |
| Default fetch-ahead | click | 66.9 | 107.8 | 93 requests / 230.5 KiB before; 0 after |
| Default fetch-ahead | hoverClick | 56.9 | 57.0 | 93 requests / 230.5 KiB before; 0 after |
| Default fetch-ahead | keyClick | 21.5 | 64.4 | 93 requests / 230.5 KiB before; 0 after |
| Default fetch-ahead | tapClick | 54.5 | 91.3 | 93 requests / 230.5 KiB before; 0 after |
| Lean | click | 86.8 | 3583.4 | 0 requests before; 85 requests / 226.0 KiB total after |

All 30 samples completed with 0 timeouts and 0 page errors. Rounded lean samples were fast [97, 87, 83] ms and slow [3603, 3583, 3572] ms. Encoded CDP transfer bytes include protocol/compression effects; they are not min+Brotli file sizes. Requests alone do not prove code execution.

A separate current cold focus/key/click test requested 87 scripts: 533,950 emitted minified bytes and 176,920 bytes summed per-file Brotli. That set includes page/runtime and the static Scheduler renderer closure, including state and intl. It is not a Scheduler-only bundle or drag-only closure measurement. The historical ≤ 6 KiB intent-handler and ≤ 14 KiB first-drag-only targets remain **UNMET**. No architecture redesign or budget ratchet was used.

## Warm real drag

The production month story performs a real pointer drag and requires a rendered preview before sampling. Initialization/import and initial geometry are outside the trace. Twelve subsequent inputs alternate between distinct date cells, each separated by two animation frames, and cause real preview changes. LayoutCount deltas were [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]: at most one layout per sampled input frame. The 11 Layout events took 3.181 ms total; none carried a JavaScript stack. This is a bounded observation, not a claim about every event count, device or uninterrupted high-frequency stream.

The initial run found a runtime defect: a new child resize-handle list consumed its adopted parent event-list rows, corrupting pass stamps and retaining a removed map key. Duplicate detection correctly threw despite unique next keys. The separate runtime correction consumes the adoption hook once (`bf4a83d3a`); the final drag passes without errors. Month rows additionally use actual rendered-date identities because unchanged numeric row indices retained stale cells after Today/date navigation. Event edits and ghosts do not rekey rows.

## Focused fuzz and remaining gates

One default-plan focused fuzz run covered `/scheduler` and `/scheduler-zone`, with 78 steps. Existing design pins reproduce and remain. `/scheduler` differs at step 1 by a CSR-only event `aria-describedby`, and at step 13 after context-menu Escape by resumed `tabindex=0` versus CSR `tabindex=-1`. `/scheduler-zone` compares preserved server UTC 09:00 / top 37.5% with fresh CSR local 12:00 / top 50%, plus CSR-only describedby. No clean-parity claim or pin removal was made. Repeated clean-run evidence was unnecessary because the differences still occur.

Public documentation includes 15 UI demos and eight companion CDK demos. Both complete docs builds and all 23 changed demo manifests pass. Focused axe/RTL/interaction checks are listed separately from the broad gates below. No quarantine was introduced.

## Integration validation

| Gate | Result |
| --- | --- |
| Scheduler unit | 109/109, seven files |
| Scheduler browser | 237/237, ten files |
| Scheduler resumed production | 6/6 |
| UI unit, complete project | 1,220/1,220, 221 files |
| Scheduler UI production, after queued-scroll fix | 16/16; combined Scheduler/Popover production 23/23 |
| Overlay position/trigger unit | 35/35 |
| Menu and Popover browser | 34 passed, one existing skip |
| Script tooling, complete project | 42/42, eight files |
| UI docs production build | 4,135 pages, 1,048 live demos; 15/15 changed Scheduler manifests |
| CDK docs production build | 4,822 pages, 649 live demos; 8/8 changed Scheduler manifests |
| Full UI production project | 430 passed / 20 failed; 68 files, 450 tests; see scope below |

The complete UI production run preceded the final bounded overlay queued-scroll fix; all then-current Scheduler cases passed. Its 20 failures were outside Scheduler: carousel, cell-select-dev, combo-box-dev, data-grid (three), disclosure-group, navbar (two), removed-region (three), scroll-area, sidebar-resize, stepper (two), table, theme-scope and wave1 (two). Two controlled comparisons changed only the derived runtime to the pre-fix revision and built fresh story outputs. The first reproduced ten matching failures across data-grid/table/removed-region/stepper/wave1; the second reproduced the remaining ten across nine files, including the virtualized grid and development-server cases. All 20 failures therefore reproduce without the runtime correction. The exact current source was restored and its hash verified after each comparison. This report does not claim a green full UI production gate.

The docs CRUD flow exposed a separate queued-scroll defect: focus scrolled the trigger before a range menu opened, but the queued scroll notification arrived after it opened and closed the new menu. Overlay positioning now compares both the actual trigger viewport position and window scroll offsets with their values at opening. A stable queued notification leaves the menu open; subsequent trigger or document movement still dismisses it, including fixed/sticky triggers that keep the same viewport coordinates. Permanent unit and real production regressions cover both scroll axes and retain the original queued-scroll case. Review also found length-derived identity collisions after deleting events in the two menu demos. Both now use a per-instance serializable monotonic allocator; expanded production manifests cover repeated create/duplicate/delete and independent edits/deletes of retained siblings.

External backlog drop was additionally exercised with real stepped Chromium CDP input, both cold and after activation, in UI and CDK production docs. Assertions cover preview, event creation, backlog removal and the exclusive October 20–21 range. Playwright's HTML-drag adapter misclassified a synthetic drag-start event and waited for a native interception; direct input bypassed only that adapter. No drag-library workaround or source change was made.

Heavy gates ran serially under a 3,072 MiB process-tree limit. Measured peaks: full app-size check 2,141 MiB, scripts suite 2,654 MiB, the remaining baseline comparison 2,703 MiB, UI docs 1,573 MiB and CDK docs 1,378 MiB. These later integration samples do not replace the unmeasured RSS of the earlier performance runs.

The UI parent page was checked at 1,280 px and 390 px: all 15 iframe planners remained after two seconds idle, with no “Example missing” fallback and no console/page errors. Docs/month/week HTML and body widths matched the viewport; the narrow month/week content scrolls inside its own scroller. Desktop and narrow screenshots were visually reviewed. Content, snippets, generated llms text, MCP data, AI synchronization and UI brand checks pass.

Final zero-cost, full app-size, selected Scheduler UI-size and changed-file formatting checks pass. The complete app-size pre-update run measured 25 apps; across the 24 prior apps and 31 routes, every changed minified-JS value was exactly +9 bytes for the single-use runtime adoption fix. Server bundles, lanes, CSS, state/inline bytes, response status and normalized request sets/counts were unchanged. Compression-dependent JS/HTML sizes changed with runtime/chunk names. The full app baseline is regenerated for this explicitly reviewed correction. The older UI component size report had 108 differing rows including the new Scheduler row; existing package own-code hashes were unchanged by this task. Its unrelated rows remain preserved, and only Scheduler is added.


## Generated bundle baselines

| Measurement | Bytes / Brotli bytes | Scope |
| --- | --- | --- |
| UI Scheduler DOM (minified JS) | 12,284 / 3,861 | Own UI code; CDK and other packages external |
| UI Scheduler server (minified JS) | 11,140 / 3,432 | Own UI code; CDK and other packages external |
| Scheduler compiled stylesheet | 18,408 / 2,601 | Compiled CSS measured verbatim; generated per-component stylesheet |
| CDK Scheduler DOM / server | 232,812 / 215,611 minified | Own CDK graph; not a cold network closure |
| Pure CDK scheduler/layout | 23,962 minified | Independent server-safe layout/date/time entry |

The final fixed-trigger scroll correction adds 74 minified bytes to the new standalone Scheduler fixture. The follow-up full app-size comparison showed no growth in the other existing apps, and the final independent full check passes. The standalone headless demo ships 493,197 minified / 162,302 Brotli JavaScript bytes in total; its page closure and default fetch-ahead are separate from the UI own-code rows above. These measured baselines do not replace the unchanged historical cold-handler budgets.

Zero-cost coverage now includes public CDK `scheduler` and `scheduler/layout`, while the UI subpath is discovered from exports. Intentional deltas are the nine-byte single-use derived-list correction, new Scheduler exports/styles, the bounded overlay correction and transitive router client chunk hashes. Existing unrelated package own-code JS hashes and server lane output are unchanged. The final check reports identical runtime/lanes, no development leaks across 224 entries, condition parity across 18 entries and 176/176 compiler corpus cases matching.

The selected UI-size update was checked against the previous JSON: every earlier component/page row and bundle metadata is unchanged; only Scheduler was added. The complete older UI component report still has 107 unrelated differing rows. Neither that exact gate nor the complete UI production project is presented as green. The partial-update helper now preserves unmeasured app/lane/component/page/bundle entries, with three regressions included in the passing 42-test script suite.

The main benchmark index links this report. Its complete 1,028-page build, strict content (198 pages), snippets (481 fences), llms, MCP and AI synchronization checks pass. Existing npm configuration, image-plugin and bundler diagnostic warnings remain; no warning was converted into an ignored assertion or quarantine.

## Implementation choices

- Used the existing main checkout as required by repository instructions; the cost is no branch isolation, mitigated by explicit-path commits.
- Replaced the missing historical command wrapper with serial heavy jobs, one browser project and a 3 GiB limit; the cost is more validation time.
- Resumed the existing approved design/plan without another design approval; the cost is rework if that scope differs from the user's intent.
- Followed current derived renderer adoption rather than redesigning the compiler/runtime boundary; the cost is the disclosed larger first-interaction closure.
- Left removed intent-preload/context-registration infrastructure removed; the cost is that the old optimization is unavailable in the current architecture.
