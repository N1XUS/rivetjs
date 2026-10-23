# Scheduler T12 measurements — 2026-10-23

These are focused measurements, not an all-project gate or upstream parity certification. The [306-row mapping](../design/research/2026-10-23-scheduler-upstream-cases.md) contains 305 product cases and one helper: 185 title correspondences, 105 audited/composed equivalents and 16 explicit deviations. Upstream suites were not executed.

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

Public documentation/API generation is T13. T14 owns all-project gates, intended runtime zero-cost baseline reconciliation, full size checks and the new Scheduler docs-example size baseline. Focused axe/RTL/interaction checks do not replace those gates. No quarantine was introduced.
