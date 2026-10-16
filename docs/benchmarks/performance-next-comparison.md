# Performance pass — 2026-10-04

Rivet's 5,000-row committed mount fell from **688.8 to 407.2 ms**, full-field update from **66.1 to 43.2 ms**, and mounted JavaScript heap from **137.40 to 82.23 MiB** relative to commit `5217d1d`. These are approximately 41%, 35%, and 40% reductions. The complete fixture bundle grew from **6,119 to 6,879 gzip bytes**. Rivet leads the current SSR comparison runs, including the new Solid 1 buffered control. **The goal of outperforming every framework is not achieved: both Solid versions remain substantially faster and smaller in the large DOM workload.**

Work is isolated on `codex/perf-next` under `.claude/worktrees/codex-perf-next`. The base is the latest committed main code available when this work started, `5217d1d`, not the older app checkout. Concurrent changes in the main checkout are outside this worktree. The [machine-readable evidence](performance-next-comparison-summary.json) retains per-trial values, versions, source/build provenance, errors, and raw artifact paths with SHA-256 fingerprints.

## Changes retained

- Cache validated template slot paths per document and parsing context. Clone the complete outer range with the native template, avoiding extra fragment construction and insertion. Custom elements and customized built-ins retain dynamic target discovery because upgrade callbacks can mutate the clone.
- Compile literal event functions as static handlers and proven template-literal text as specialized text bindings. Dynamic handler selectors, scalar transitions, table parsing restrictions, error cleanup, and text identity retain their contracts.
- Avoid primitive-value disposal bookkeeping and unnecessary tokens for discarded adopted rows. Batch only safe detached fragment moves; connected, cross-document, and custom-element behavior retains the established path.
- Store a singleton cleanup directly and omit computed-only fields from effect nodes. Release successfully initialized inert internal DOM binding owners only when they have no sources, children, cleanup, or observable escapes. Public effects and development/debug graph behavior retain their contracts.
- Correct the stream slab's pending-reference lifetime before recycling. Use digit-pair encoding for signed 32-bit integers and native conversion for wider safe integers. Avoid duplicate server-tree admission and repeated list-tape admission within one render.

These changes preserve public boundary markers, owner identity when observable, context, cancellation, escaping, backpressure, and row/node identity. Native-only integer conversion was rejected: its isolated conversion win became a 36–41% complete-render CPU regression. Reusing scoped read contexts was also rejected after tied timings and roughly 1 MiB extra retained heap. A later shared cursor plan for template slots passed correctness checks but was rejected after a 1,000-row mount screen measured 83.3 ms versus 79.9 ms for a fresh restored control, with 228 extra gzip bytes. Its characterization tests remain; its runtime code does not. Caching/cloning empty boundary pairs also failed its screen (89.9 ms, +30 gzip bytes); other frameworks slowed as well, so this is no demonstrated gain rather than a quantified causal regression. That runtime change was also reverted, retaining its identity/movement/failure tests.

## Current framework releases

The npm registry was checked on 2026-10-04. The comparison now includes **Solid 1.9.15** and **Qwik 1.20.1**, alongside the existing current previews **Solid 2.0.0-rc.13** and **Qwik 2.0.0-rc.0**. React DOM remains 19.3.0. Stable compilers/runtimes and compatible Vite 7 tooling are pinned in an isolated `apps/bench-stable` workspace; no pre-existing locked package version was changed or removed.

SSR and resumability compare both stable and preview Solid/Qwik. The synchronous DOM harness compares Rivet, React, and both Solid versions. Qwik's asynchronous update contract is represented in the resumability harness, not forced into a synchronous-commit benchmark. Builds record exact versions and hashes and reject mixed dependency families or stale resumability artifacts.

## Large DOM results

Production bundles; Apple M4 Pro, macOS ARM64, Node 24.14.1, Chromium 153.0.8010.12. Each group has three fresh browser contexts. Update values are the median of three trial medians: the baseline has three measured samples per trial and the current runs have five, each after three warmups. Resumability uses Chrome 154.0.8037.97; HTTP/2 uses the same Chromium 153.0.8010.12 as the DOM harness. No Codex-managed builds, tests, or other benchmark loads ran concurrently; these local runs do not control all external host activity.

Every framework mounts 285,001 native elements and 50,000 independently reactive fields/buttons at 5,000 rows, without virtualization. All fields, representative DOM identity, real clicks, disposal, and repeated mount/dispose cycles are validated.

| 5,000 rows | Rivet base | Rivet current | React 19.3 | Solid 2 preview | Solid 1 stable |
| --- | ---: | ---: | ---: | ---: | ---: |
| Committed mount, ms | 688.8 | **407.2** | 176.1 | 82.2 | 79.0 |
| Update 100%, ms | 66.1 | **43.2** | 100.0 | 21.0 | 26.7 |
| Mounted JS heap, MiB | 137.40 | **82.23** | 84.19 | 37.44 | 31.15 |
| Fixture bundle, gzip bytes | 6,119 | **6,879** | 69,754 | 14,737 | 5,402 |

Current Rivet mount samples are 397.8, 407.9, and 407.2 ms. At 1,000 rows, current Rivet is 76.1 ms mount / 7.6 ms full update / 16.52 MiB heap, versus its baseline 150.2 / 13.3 / 27.66. A later fresh control with identical retained source measured 79.9 ms mount / 7.7 ms update at 1,000 rows; this variation is retained in the evidence rather than pooled away. The final complete-template clone change alone reduced 5,000-row mount from 439.2 to 407.2 ms at a cost of 51 gzip bytes; its full-update timings overlap prior variation.

| Current 5,000-row update | Rivet | React | Solid 2 | Solid 1 |
| --- | ---: | ---: | ---: | ---: |
| 1% committed DOM, ms | 1.4 | 3.5 | 1.4 | 1.3 |
| 10% committed DOM, ms | 10.3 | 21.8 | 10.9 | 9.7 |
| 100% main-thread task CPU, ms | 487.8 | 548.8 | 442.8 | 446.0 |

Task CPU includes browser/protocol bookkeeping and rendering work in the sampled interval; it is not the same scope as the in-page committed-DOM timer. Heap is forced-GC JavaScript heap above a warmed empty baseline, not process RSS or native DOM memory. Disposal cycles remain recorded; small cycle growth does not prove every possible lifetime leak-free.

Rivet still has **890,007 total nodes**, including **440,006 comments**, versus 450,001 nodes and no comments for the other lanes. Its serialized mounted DOM is 17,294,561 bytes versus 10,254,463. This pass reduces construction and allocation overhead while preserving marker semantics; it does not reduce those node or serialized-DOM counts. The mount gap to Solid remains about 5×.

## HTTP SSR comparison

The measured Rivet lane is **`rivet-compiled`**, using actual JSX compiler/runtime output, not the separate hand-written emitter lane. Every frontend receives the same native unary gRPC DTO, renders ten fields per row, and retains its own valid framework metadata/HTML. No pages or row data are cached. Each complete response is checked for exact identity, field values, token, and completion.

All frontends have **1 CPU / 512 MiB**; the shared backend has 2 CPUs / 1 GiB and the Python validating generator 2 CPUs / 512 MiB. These runs use concurrency 1, three rotated repeats, 5-second warmup and 5-second measurement. They measure this complete HTTP workload, not maximum server capacity or interchangeable interactive applications. Rivet retains its pre-existing `--single-threaded-gc --max-semi-space-size=8` Node flags; opponents use their existing runtime defaults.

The six-lane run validated **98,647 responses, with zero failures, sampling errors, or saturation warnings**. Median successful responses/second:

| Framework / public API | 100 rows | 1,000 rows | 5,000 rows |
| --- | ---: | ---: | ---: |
| Rivet compiled | **1,982.20** | **371.29** | **70.61** |
| Solid 2 stream | 1,084.90 | 143.50 | 30.25 |
| Solid 1 stream | 289.95 | 172.14 | 45.48 |
| Qwik 2 stream | 91.82 | 7.70 | 1.22 |
| Qwik 1 stream | 204.11 | 16.08 | 2.71 |
| .NET 10 Razor | 1,828.06 | 306.69 | 47.67 |

Solid 1's public streaming API schedules its first write with a timer even when this synchronous fixture is already rendered. A second, explicit **`solid-stable-string`** control uses its public `renderToString` with the exact same compiled Page, hydratable output, data, quota, and validation. It buffers the full page and does not demonstrate progressive streaming. The original streaming lane remains available and unchanged.

That three-lane control validated **73,112 responses with zero failures**:

| Framework / public API | 100 rows | 1,000 rows | 5,000 rows |
| --- | ---: | ---: | ---: |
| Rivet compiled | **1,945.11** | **364.06** | **67.23** |
| Solid 1 stream | 286.77 | 165.58 | 42.74 |
| Solid 1 buffered | 1,810.00 | 200.79 | 48.08 |

The buffered control makes the 100-row comparison much closer. A streaming-only headline would substantially understate Solid 1's static serving performance.

At 5,000 rows in the six-lane run, median frontend CPU ms/response is Rivet **6.80**, Solid 2 **32.83**, Solid 1 stream **20.15**, Qwik 2 **827.47**, Qwik 1 **372.08**, and Razor **11.27**. Median sampled peak working sets are respectively **84.4, 107.6, 78.9, 282.2, 216.8, and 131.7 MiB**. Rivet does not win every memory comparison. Qwik retains its resumability metadata; these static response measurements do not establish interactive equivalence.

### Before/after limits

The unchanged baseline's 5,000-row HTTP medians were **70.58 responses/s and 6.38 CPU ms/response**. Current six-lane medians are **70.61 and 6.80**, with per-trial throughput ranging 68.79–73.99. Warmup differs between these runs. **There is no reliable end-to-end SSR improvement over starting Rivet established by these HTTP results.** Earlier candidate results were faster, but the final variability is preserved rather than selecting the most favorable run. Concurrency-10 baseline cases showed generator limits and are excluded from capacity claims.

An isolated, balanced 96-process complete-render experiment supports the hybrid integer optimization: 5,000-row CPU falls **1.83935 → 1.55413 ms/page** against the old integer encoder with identical admission fixes, about 15.5%. This accepting-sink diagnostic includes full output formation but excludes HTTP/gRPC/backpressure costs. A separate before/after private-binding audit, with byte-identical output and six rotated fresh processes per size, found no detectable SSR CPU penalty: 1,000 rows **0.30567 → 0.30448 ms**, 5,000 **1.55986 → 1.55622 ms**. It does not explain all HTTP variance.

## Loading, interaction, and HTTP/2

The five-lane run completed **180 cases without browser errors**: three fresh-context repeats × six scenarios × fast/Slow4G profiles × five lanes. The untouched Rivet baseline completed 36 cases under the same profiles/scenarios. Traces and precise coverage were disabled in both runs. Fixture correctness was verified separately for every lane before measurement. Scenarios act after the prescribed one-second delay (plus hover/scroll work), so these are cold navigations with defined prefetch opportunities, not clicks at the earliest possible paint.

| Slow4G interaction → observed DOM change, ms | Rivet base | Rivet current | Solid 2 | Solid 1 | Qwik 2 | Qwik 1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Click | 6.1 | 6.2 | 5.4 | 3.8 | 17.2 | 17.3 |
| Hover then click | 5.2 | 4.7 | 4.6 | 4.1 | 15.6 | 10.9 |
| Filter 1,000 rows to 100 | 23.4 | 22.0 | 13.6 | 11.2 | 120.9 | 141.6 |
| Navigate to lazy detail | 22.0 | 21.5 | 185.7 | 184.2 | 44.5 | 33.1 |
| Click during scrolling | 5.9 | 4.8 | 4.4 | 4.3 | 73.3 | 45.7 |

Fast Rivet click/filter/navigation medians are **1.2 / 4.7 / 4.4 ms**, compared with baseline **1.2 / 5.0 / 4.4**. The loading/interaction changes are small and do not demonstrate a broad before/after latency win. All recorded Rivet first-input checks remain synchronous. Three repetitions and timer/frame granularity limit close rankings.

| Encoded transfer bytes in load scenario | Rivet base | Rivet current | Solid 2 | Solid 1 | Qwik 2 | Qwik 1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Document | 14,175 | 13,672 | 7,149 | 7,123 | 19,330 | 20,297 |
| External JavaScript | 16,051 | 16,626 | 23,091 | 8,308 | 39,555 | 27,514 |
| External JS requests | 7 | 7 | 2 | 1 | 14 | 10 |

These CDP encoded-byte counters include response overhead; they are not raw source or runtime-only sizes. Rivet's document reduction is offset by JavaScript growth: combined transfer is **30,226 → 30,298 bytes**. Solid 1 ships substantially less in this fixture. Its lazy navigation adds a network request, whereas Rivet/Qwik have already fetched their route work under the fixture's existing preload policies. Rivet's navigation lead therefore includes that bandwidth/scheduling tradeoff.

Median pre-input TBT is zero for Rivet, both Solid versions, and Qwik 1; Qwik 2 records 14 ms in Slow4G load. Slow4G scroll maximum frame gaps are Rivet 50.0 ms, Solid 2 33.4, Solid 1 50.0, Qwik 2 66.6, and Qwik 1 33.3. These are short sampled scroll scenarios, not proof of universal smoothness.

The permanent [HTTP/2 experiment](../../apps/resume-bench/HTTP2.md) compares identical TLS 1.3 edges, compressed bodies, warmed upstream, cache policy, and network profiles. Five alternating H1/H2 pairs per condition give 20 load navigations; all passed full DOM, protocol, completion, and payload checks. Every navigation received the same **28,520 body bytes**. Median FCP was **32/32 ms** on fast H1/H2 and **208/204 ms** on Slow4G. Slow4G paired H2-minus-H1 FCP deltas were −12, −4, −4, 0, and +4 ms. Load/readiness deltas changed sign between pairs.

This small screen provides **no clear latency advantage**. CDP Slow4G is browser emulation, not packet-level WAN congestion/loss. The harness remains available for deployment-specific transport testing; no product server or chunking policy was changed. Backend gRPC already uses HTTP/2. Transport cannot improve already-loaded DOM mount/update timers.

## Validation and remaining work

- Full workspace test rerun: all **22 tasks** passed. All **18 typecheck projects**, the **291-file TSX project check**, and all **7 build projects** passed.
- Compiler oracle: **227/227** cases match after narrowly approving the intended generated ABI changes; runtime/lane fingerprints reproduce. After rejecting the final experiments, **23 focused checks** and runtime typecheck passed, the DOM bundle rebuilt identically, and every retained DOM build input plus all five resumability manifests matched the final source/assets.
- Stable SSR API, escaping, held-write/cancellation, build provenance, live container, and browser checks pass. Stable and preview resumability fixtures all pass their behavior checks.
- One earlier full-suite run failed the unchanged router head-export HMR state-retention assertion. The isolated case, three traced current runs, three traced baseline runs, and the subsequent complete suite passed. This remains an unexplained intermittent observation, not a proven fixed defect or a proven pre-existing flake.
- Independent source reviews covered ownership/escape handling, custom-element cloning, generated argument shadowing, whole-template cloning, stable dependency isolation, transport controls, and buffered Solid fairness. Identified correctness problems were reproduced and fixed before retention.

The main unresolved performance target is Solid's client construction/heap advantage. A further marker/owner representation redesign requires its own correctness proof and measurements. Template-only engines (Jinja, Twig) are out of scope: they are not interactive frameworks, and Razor already covers the server-template comparison.

## Reproduction and provenance

Use the [DOM harness](large-dom-benchmark.md), [SSR harness](../../apps/ssr-bench/README.md), and [resume fixture](../../apps/resume-bench/FIXTURE.md). Run builds and correctness checks before timing. Exact source/bundle hashes and per-trial values are in the accompanying JSON; raw directories remain under `.artifacts/perf-next`.

```sh
# Current DOM production build, then timing (run sequentially).
npm run build:dom-bench
node apps/dom-bench/run.ts --rows 1000,5000 --repeats 3 --samples 5 --out .artifacts/dom-bench/current

# Stable/preview resume build and correctness; --verify exits without timing.
node apps/resume-bench/run.ts --build --verify
node apps/resume-bench/run.ts --repeats 3 --conditions fast,slow --no-traces --no-coverage

# After building the isolated Docker images, with the project/image environment selected:
npm run bench:ssr -- --frameworks=rivet-compiled,solid,solid-stable,qwik,qwik-stable,dotnet --rows=100,1000,5000 --concurrency=1 --repeats=3 --warmup=5 --duration=5 --skip-build --stop
npm run bench:ssr -- --frameworks=rivet-compiled,solid-stable,solid-stable-string --rows=100,1000,5000 --concurrency=1 --repeats=3 --warmup=5 --duration=5 --skip-build --stop

node apps/resume-bench/http2.mjs --repeats 5 --conditions fast,slow --scenarios load
```

The retained six-lane Docker image is `rivet-perf-next-node:stable-candidate`, ID `sha256:9b838267525013d0a8405ad2e5153dc7514d87bc4f7fddefddd180a391ce9d32`; the buffered control uses `rivet-perf-next-node:static-control`, ID `sha256:adf04ee692e8f681c1ac95d8712a10b2fb806bd432b4b79c19ef80f5acb47ff4`. Both retain Rivet SSR bundle SHA-256 `9e95fd56be303ea11f38d9a5399d05ea4b598f64b85152f669712074102f50d8`. Current DOM Rivet bundle SHA-256 is `2b588ce0a6cc8046ef0fd6653d1a0c915b59001a6d7b6918fa996d6a0af8991b`. Existing shared project/images were not replaced; owned benchmark services were stopped after measurement.
