# dom-bench

Client DOM benchmarks for Rivet. The scoreboard runs only Rivet (plus a local vanillajs baseline) against stored competitor numbers; those are re-measured only by a full fair-comparison run (all lanes, same browser/machine) and stored with provenance (`apps/ssr-bench/fair-report.ts --store-competitors`; DOM block alone: `--dom <run.ts results.json> --store-competitors`).

## Suites

- **Large DOM** (`build.ts`, `run.ts`, `report.ts`): 1k/5k sections × 10 reactive fields (5k = 285k elements, 50k fields). Adapter contract: `window.bench.{mount,update,dispose}` in `adapters/<lane>.jsx`. A/B: `build.ts --base <dir>` (lane `rivet-base`), `--lane name=compiled.js` (hand-edited compiler output), `--emit` (`dist/rivet.compiled.js`); `mount-quick.ts` = mount-only interleaved A/B (`--gc 0` / `--rewarm 0 --yield 0` = old protocol / `--flags` / `--gc-trace`). Mount protocol: warm-up cycle, forced GC (heap baseline), one unforced re-warm cycle, one macrotask, timed mount. Mount notes: `docs/benchmarks/2026-10-20-dom-mount.md`.
- **krausest-style** (`krausest/`): js-framework-benchmark keyed table. Lanes: `rivet` (`krausest/rivet.jsx`) and `vanilla` (`krausest/vanilla.js`). Contract: DOM only (`#run #runlots #add #update #clear #swaprows`, `tbody>tr`, `td:nth(2)>a` selects, `td:nth(3)>a>span` removes, `tr.danger`).
- **Scoreboard** (`scoreboard.ts`): Rivet-only run of all suites vs stored numbers, WIN/TIE/LOSE per scenario (`verdict.ts`: ≥3% median gap + non-overlapping trial ranges, else TIE).
- **Props suite** (`props/`): component-heavy live props, Rivet vs Solid stable. 1000 rows × 6 components (`Row` → 2 × `Cell` → `Label`, `Badge`): getter props, one component spread (`{...props.badge}`), `mergeProps` defaults + `splitProps` + a DOM spread of the rest. Phases per sample: mount, relabel (every row's label), select (10 single selections: every row's `selected` getter re-runs), bump (every 10th count through spread → merge → split), dispose; heap after GC (mounted table held). `build.ts --base <dir>` (A/B runtime), `--lane name=compiled.js` (hand-edited compiler output: prototype an emission shape), `--emit` (compiler output → `dist/props/rivet.compiled.js`). Results: `docs/benchmarks/2026-10-08-props-suite.md`.
- **Traces** (`trace.ts`, `trace-report.ts`): CPU profile + Performance trace + heap snapshot per lane/op, and a diff report.

## Commands

```sh
node apps/dom-bench/krausest/build.ts [--repo <checkout>] [--out <dir>] [--compile-options '{"experimentalDomCompact":true}']
node apps/dom-bench/krausest/run.ts [--benchmarks all|cpu|mem|startup|01,05,...] [--iterations 15] [--headed]
node apps/dom-bench/krausest/compare.ts <results.json>
node apps/dom-bench/trace.ts --suite dom --lane rivet --op mount|update1|update10|update100|dispose --rows 5000 [--lock]
node apps/dom-bench/trace.ts --suite krausest --lane rivet --op 05_swap1k --throttle [--lock]
node apps/dom-bench/trace-report.ts <dir> [<dir> ...] [--heap] [--md out.md]
node apps/dom-bench/scoreboard.ts [--repo <worktree>] [--quick] [--ssr] [--suites dom,krausest,resume]
```

- Lock: every timed phase takes the shared mkdir lock (`bench-lock.ts`, path `RIVET_BENCH_LOCK`; `none` disables when the caller holds it). krausest locks per benchmark.
- `node apps/dom-bench/krausest/extract-published.ts <results.ts> <commit> <chrome>` regenerates `krausest/published.json`.

## krausest methodology

- **Reference data**: `krausest/published.json`.
  - Source: `webdriver-ts-results/src/results.ts` at js-framework-benchmark commit `bf894b681fb56433ccb6efb4a3c93e35eda2b20d` (2026-10-04), which is the data behind `current.html`. sha256 recorded.
  - Browser: **Chrome 154.0.8037.98**.
  - Reference implementations (all keyed): `vanillajs-keyed`, `solid-v1.9.3`, `svelte-v5.42.1` (plus `svelte-classic-v5.43.2`), `react-hooks-v19.2.0`, `react-compiler-hooks-v19.0.0`, `react-classes-v19.0.0`.
  - Solid 2 has no published krausest entry.
  - Statistic: median of `total`, the results page default (`DISPLAY_MEDIAN`, `CpuDurationMode.TOTAL`).
- **Rules ported from webdriver-ts** (`benchmarksCommon.ts`, `benchmarksPlaywright.ts`, `forkedBenchmarkRunnerPlaywright.ts`, `playwrightAccess.ts`, `timeline.ts`):
  - Browser: real Chrome (`/Applications/Google Chrome.app`, locally 154.0.8037.97), args `--window-size=1000,800 --js-flags=--expose-gc --enable-benchmarking`.
  - Each iteration opens a fresh tab and waits for `networkidle`. It runs the benchmark's warmup `init` steps, forces a major GC (`window.gc({type:'major',execution:'sync',flavor:'last-resort'})`), then applies CPU slowdown (4x: 03, 04, 05, 09; 2x: 06) and traces (`blink.user_timing`, `devtools.timeline`, `disabled-by-default-devtools.timeline`) the `run` step plus 40 ms.
  - Duration: from the click `EventDispatch` start to the end of the first `Commit` after the last click/rAF/timer/layout/FunctionCall work on the main renderer, with krausest's rAF-delay correction. `script` and `paint` are interval unions of the same event sets (`krausest/timeline.ts`).
  - Benchmarks:

    | id | operation | warmup | slowdown |
    |---|---|---|---|
    | 01_run1k | create 1k | 5 | – |
    | 02_replace1k | replace all | 5 | – |
    | 03_update10th1k_x16 | update every 10th row | 3 | 4x |
    | 04_select1k | select row (+10 runs) | 5 | 4x |
    | 05_swap1k | swap rows | 5 | 4x |
    | 06_remove-one-1k | remove row | 5 | 2x |
    | 07_create10k | create 10k | 5 | – |
    | 08_create1k-after1k_x2 | append 1k to 1k | 5 | – |
    | 09_clear1k_x8 | clear 1k | 5 | 4x |

  - Memory: after `run` + forced GC + 40 ms, `performance.measureUserAgentSpecificMemory().bytes / 2^20`. The page is cross-origin isolated (COOP/COEP), as in krausest. Published: 21 ready, 22 run 1k, 25 create/clear 5x.
  - Sizes: 41/42 = uncompressed / brotli bytes of all implementation files (`index.html` + `main.js`, CSS excluded), in kB.
  - First paint (43): `first-paint` entry of an unthrottled load.
- **Deviations / local extensions** (no published counterpart, so ratio-only, no verdict):
  - `local_append1k-to10k`: append 1k to 10k rows, 2x slowdown. krausest's 08 appends to 1k.
  - `26_run-10k-memory`: defined but disabled in webdriver-ts.
  - `local_clear-memory`: run 1k, then clear.
  - Startup under 4x CPU (Lighthouse-like):
    - `ready` = max(DOMContentLoadedEnd, first time `#run` exists).
    - `consistentlyInteractive` = max(FCP, end of the last >50 ms main-thread task after FCP).
    - `scriptBootup` = union of script compile/evaluate/call events up to CI.
    - `totalBytes` = encoded bytes of all responses.
    - Lighthouse itself is not installed (no host installs); these are trace-derived equivalents.
  - CSS: a written Bootstrap-3 subset (`krausest/style.css`), not vendored Bootstrap. Same file for every lane. Absolute ms therefore differ from krausest's page.
  - Headless by default (new headless, the full Chrome renderer). `--headed` matches krausest's headed runs.
  - Iterations: 15 CPU (krausest default; the scoreboard uses 10, or 5 with `--quick`). Memory: 3 iterations (krausest: 1).
  - Lanes interleave per iteration (rotated order) to spread machine noise.
  - vanilla lane: hand-written for this harness, using the same techniques as `vanillajs-keyed` (template clone, firstChild/nextSibling, one delegated listener, manual keyed bookkeeping). It is not a copy of it.
- **Comparison** (`krausest/compare.ts`):
  - Published ratio per framework F and benchmark B: `r_F(B) = median_F(B) / median_vanillajs(B)`, from the published table.
  - Local ratio: `r_Rivet(B) = median_Rivet(B) / median_vanilla(B)`, measured in the same run on the same machine, lanes interleaved.
  - Verdict: `WIN vs F` iff `r_Rivet(B) <= r_F(B)`.
  - Rationale: machine, OS and CSS factors cancel in each ratio; only implementation overhead over hand-written DOM is compared.
  - Overall: krausest's weighted geometric mean of CPU ratios. Weights come from `webdriver-ts-results` `computeGeometricMean`, computed over the benchmarks present.
  - Sizes compare absolute kB, because size doesn't depend on the machine.
  - Overhead above vanilla (`overheads`, second table; scoreboard rows `krausest <B> script|heap above vanilla`): ratios hide implementation cost where layout + paint dominate the total, so the absolute cost beyond hand-written DOM is compared too.
    - Script: `script_Rivet(B) − script_vanilla(B)` (local medians, ms) vs `(script_F(B) − script_vanillajs(B)) × total_vanilla_local(B) / total_vanillajs(B)` (published, scaled to this machine by vanilla's total).
    - Heap: `MB_Rivet(B) − MB_vanilla(B)` vs `MB_F(B) − MB_vanillajs(B)` (memory benchmarks; no scaling).
    - Verdict (compare.ts): `WIN vs F` iff Rivet's overhead ≤ F's; the scoreboard applies its usual 3% margin.
  - Limits:
    - The ratio claim assumes our vanilla ≈ krausest's vanilla relative to their frameworks.
    - Chrome patch versions differ (.97 local vs .98 published).
    - Medians, not significance tests.

## Scoreboard

- Rivet only, under the bench lock. Compared with `competitors.json`:
  - Brief numbers: dom 5k, resume, ssr.
  - `docs/benchmarks/performance-next-comparison-summary.json` dom-final medians: dom 1k.
  - krausest ratios.
- `--repo <path>` runs any branch/worktree through **that checkout's** adapters and scripts, so API changes travel with the branch:
  - dom: `<repo>/apps/dom-bench/{build,run}.ts` (`window.bench` contract).
  - krausest: `<repo>/apps/dom-bench/krausest/build.ts` (else this one with `--repo`), measured by this checkout's runner (DOM contract).
  - resume: `<repo>/apps/resume-bench/run.ts --lanes rivet --conditions slow`.
  - ssr (`--ssr`, Docker): `benchmark.py --frameworks=rivet-compiled,rivet-resume --rows=100,1000,5000 --concurrency=1` with the duration/warmup/repeats/GC profile stored in `competitors.json` `ssr.provenance`, in an isolated compose project (`rivet-ssr-scoreboard`, ports 197xx). rivet-compiled ranks against the static peers (Razor, Solid 1 `hydratable:false`), rivet-resume against the hydratable/resumable ones (Solid 1/2, Qwik 1/2); rps, p50, p99, CPU/page, peak memory. A run whose generator sha / window / GC profile differs from the stored provenance is n/a (round-2 B1).
- Trust rules (round-2 B4/B6/B7):
  - Verdict per competitor WIN/TIE/LOSE; scenario = LOSE if any LOSE, WIN if all WIN, else TIE. Values are median (min–max) over trials; stored legacy plain numbers get margin-only verdicts.
  - The dom-bench fixture server sends COOP/COEP; `run.ts` refuses a page that is not `crossOriginIsolated` (otherwise `performance.now` is clamped to 100 µs).
  - Browser builds are recorded (`browsers` in the JSON): dom vs `competitors.dom.provenance.browser`, krausest vs `published.json` chrome, resume vs `competitors.resume.provenance.chrome`; a major-version drift makes the suite's scenarios n/a.
  - Resume scenarios rank `paintLatency` (input → paint of the update); stored competitors without that metric are n/a.
- Variants:
  - `--dom-build-args "--compact"` passes flags to the branch's dom build.
  - `--krausest-compile-options '{...}'` passes compiler options to the Rivet krausest build.
- Output:
  - `.artifacts/perf-night/scoreboard/<stamp>.json`: every scenario with Rivet Stat, competitor Stats, per-competitor verdicts, losses, ties, notes, browsers.
  - Raw suite results in `.artifacts/perf-night/scoreboard/<stamp>/`.
  - `docs/benchmarks/perf-scoreboard.md` (`--md`, `--no-md`).
- WIN = Rivet at least as good as every listed competitor for that scenario. Lower is better, except ssr rps.

## Traces

- `trace.ts`: Profiler (100 µs sampling) and tracing run together around one operation, so times include instrumentation overhead. Compare only recordings made the same way.
  - Heap snapshot taken after the op; `--no-heap` skips it.
  - DOM counters (`Memory.getDOMCounters`) before, after, and after GC.
- `trace-report.ts`:
  - Main-thread exclusive split: scripting / style / layout / paint+commit / GC / other. For dom-suite ops, the op's JS runs via CDP evaluate and lands in "other"; the "JS self ms" row (from the profile) is the JS figure.
  - GC counts, nodes/listeners created and retained, heap delta.
  - Top self-time functions, symbolized through the external `*.js.map` files both builds emit (bundle bytes unchanged).
  - `--heap`: top constructors by self size.
