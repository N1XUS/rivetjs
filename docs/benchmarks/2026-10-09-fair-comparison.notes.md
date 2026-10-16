## Notes (hand-written; appended by `fair-report.ts --notes`)

### Why this run

- Docs refresh: `apps/docs/content/about/benchmarks.md`, the homepage benchmark tabs (`apps/docs/content/_charts.ts`) and `perf-scoreboard.md` still showed 2026-10-06 / 2026-10-07 numbers.
- Since then: Node 26 + lean `node:http2` data client for every Node lane (2026-10-09 transport report), and the 2026-10-08/09 perf commits:
  - SSR: WebAssembly SIMD row emitter (f8d173d6), router body stream without the render closure (2ba441b3), async work handle class (91ff8cc5), resume encode (a36585f1), compact resume state (7b143421, 59b82b9f).
  - DOM: delegated cdk interactions (253bd4fb), row creation (6486a443), selector leak fix (41ecc6ba), `_pm` member props (4444a4c1), live-fast prop bags (3ee8372f).

### Run conditions (read before comparing)

- Machine: Apple M4 Pro, 14 cores, Docker Desktop (Linux ARM64 VM).
- The host was shared with other agents' builds and tests. The brief was to wait for a 1-minute load below 4 before each suite, for at most 30 minutes; the load never got that low, so every suite ran with the load caveat:

| suite | 1-minute load (min–max, mean) |
|---|---|
| SSR, all lanes (c1, c10, grid) | 4.8–27.4, mean 12.7 |
| DOM, 1000 rows | 10.0–11.1 |
| resume, all lanes | 5.9–13.5, mean 9.1 |
| scoreboard (krausest, resume Rivet, SSR Rivet) | 9.1–34.4, mean 21.5 |

- Every lane in a suite saw the same host. SSR and DOM repeats are interleaved across lanes, so the load spreads over all of them. Even so, absolute numbers read about 7–20% higher than the quieter 2026-10-09 transport run for every lane (Razor 1000 rows c1 1.34 → 1.64 ms CPU, Solid 1.9 hydratable 1.63 → 1.74, rivet-resume 2.69 → 3.04). Ratios inside one run are the useful signal.
- Sources measured:
  - SSR images were built from a `git archive` snapshot of `2fd6a1b8`.
  - Resume used a snapshot of `ea064b55` with linked `node_modules`, where `@rivetjs/*` resolves inside the snapshot.
  - DOM used the main checkout at `ea064b55`, built at 08:33Z. Its uncommitted changes were in cdk/ui and the resume-only runtime files, none of which the DOM lanes import.
  - The only runtime change between `2fd6a1b8` and `ea064b55` is the `_for` suffix-key fix (5932db67).
- Not re-measured: the DOM 5000-row case. Chromium's process tree went past the 3 GB RSS cap of the agent machine on the first 5000-row page, twice. `competitors.json` therefore keeps its 2026-10-06 `dom` block; `ssr` and `resume` were re-stored from this run. Bun / Deno lanes, the `default` GC profile and the escaping variant were not re-run either; see the 2026-10-06 report for those.

### Headline numbers: docs before → after

Docs before = `apps/docs` charts as of 2026-10-07. They came from the 2026-10-06 fair comparison and the 2026-10-07 speed round: different harness (Node 24, grpc-js) and a quieter host, so this is not a like-for-like A/B.

| metric | docs before (Rivet vs best competitor) | now (Rivet vs best competitor) | now ratio |
|---|---|---|---|
| Static SSR CPU/page, 1000 rows c1 | 0.98 vs Solid 1.9 static 1.34, Razor 1.83 ms | 0.46 vs Solid 1.9 static 1.34, Razor 1.64 ms | 2.93× vs Solid, 3.59× vs Razor (WIN) |
| Interactive SSR CPU/page, 1000 rows c1 (like-for-like) | 5.93 vs Solid 1.9 interactive 6.38 ms | 3.04 vs 6.37 ms | 2.10× (WIN) |
| Interactive SSR vs plain hydratable Solid 1.9 (less work), 1000 rows | 5.93 vs 2.36 ms | 3.04 vs 1.74 ms | 0.57× (LOSE) |
| Interactive SSR CPU/page, 5000 rows (like-for-like) | 30.0 vs 35.4 ms | 15.4 vs 36.7 ms | 2.39× (WIN); vs Solid 1.9 hydratable 14.8 ms: TIE |
| DOM mount 1000 rows | 17.4 vs Solid 1.9 17.7 ms (TIE) | 20.2 vs Solid 1.9 21.2 ms | 1.05× (WIN, small) |
| Resume first click (mouse) to paint | 32.4 vs Qwik 2 32.1 ms | 33.0 vs Qwik 1.20 32.4 / Qwik 2 32.9 ms | TIE |
| Resume keyboard click | 13.9 vs Solid 1 12.1 ms | 13.2 vs Solid 1 10.3 ms | TIE (Solid median lower) |
| Resume filter | 72.4 vs Solid 1 74.4 ms | 118 vs Solid 2 89.4 / Solid 1 90.2 ms | TIE by ranges, Solid median 1.3× lower |
| Resume navigate | 78.4 vs Qwik 2 56.8 ms (LOSE) | 41.8 vs Qwik 1.20 89.7 ms | 2.15× (WIN) |

### Losses and open questions

- **Text grid c10 vs Razor.** CPU/page is level (2.31 vs 2.31 ms). Razor's median response is faster (19.6 vs 24.0 ms) and its throughput is level. At c1 Rivet wins (1.81 vs 3.67 ms CPU).
- **Resumable vs plain hydratable Solid 1.9** (which does less work: no handlers, links or page data): CPU LOSE at 1000 rows (3.04 vs 1.74 ms), TIE at 100 / 5000. Solid 2 rc hydratable wins at 100 rows (0.61 vs 0.74 ms).
- **Resumable peak memory.** It loses to every Solid lane, for example 166 vs 100–142 MiB at 1000 rows. HTML bytes are 1.2–1.3× Solid hydratable (resume state).
- **Resume filter.** 118 ms (88.5–135) vs 72.4 ms in the 2026-10-07 speed round. The scoreboard re-run an hour later gave 108 ms (98.7–120). That is worth a follow-up trace: the competitor lanes in the same run sit at their 2026-10-07 level (Solid 1 90 vs 74).
- **rivet-resume Docker CPU.** 1000 rows c1 measured 3.04 ms here. The 2ba441b3 commit message reports 1.478 ms, but from a single-lane probe, not `benchmark.py`. The interleaved run here does not show that gain: transport run 2.69 → 3.04 with every lane slower.
- **Scoreboard SSR rows** (Rivet-only re-run, load mean 21.5) disagree with this interleaved run. For example rivet-compiled 100 rows c1: 0.30 ms CPU there vs 0.18 ms here. With competitors from this run, that flips 100-row cells to LOSE in `perf-scoreboard.md`. The docs charts use this report: its lanes were interleaved in one window, and the scoreboard's Rivet-only window was not.
- **krausest** (scoreboard, Chrome 154): CPU weighted geomean 1.05× vanilla vs Solid 1.08 (WIN). LOSE on 06_remove-one-1k (1.05 vs 1.01), 43_first-paint (1.18 vs 0.96), sizes (accepted), and on script/heap above vanilla for 03, 06, 07, 21 and 25 vs Solid.
