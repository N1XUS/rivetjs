# Perf scoreboard

- Run: 2026-11-03T09:04:17.084Z → 2026-11-03T09:18:05.649Z
- Measured: main @ 672e7e3 (this checkout); real pages: every lane measured in the same run; micro: Rivet only, competitors from apps/dom-bench/competitors.json and krausest/published.json
- Verdicts: WIN = Rivet ≥3% better than every listed competitor with non-overlapping trial ranges (where both have ranges); LOSE = the same in reverse vs any; otherwise TIE. Values: median (min–max).
- Browsers: dom {"measured":"153.0.8010.12","reference":"153.0.8010.12","drift":"same","crossOriginIsolated":true,"protocol":{"measured":"rewarm-2026-10-21","reference":"rewarm-2026-10-21"}}; krausest {"measured":"156.0.8078.80","reference":"154.0.8037.98","drift":"major"}; resume {"measured":"156.0.8078.80","reference":"155.0.8059.84","drift":"major"}
- Raw: .artifacts/perf-night/scoreboard/2026-11-03T09-04-17-077Z.json

## Real pages (headline)

Not run (`--suites` without `real`).

## Micro benchmarks (secondary)

Totals: 8 WIN / 4 TIE / 1 LOSE / 40 n/a. Synthetic stress cases kept on purpose (removing losing cases would be cherry-picking): large keyed lists, krausest, the resume counter / 1,000-row fixture.

| scenario | unit | Rivet | competitors | verdict | loses to | ties with |
|---|---|---|---|---|---|---|
| dom 1000 mount | ms | 16.9 (16.6–17.2) | React 19.3 40.1 (35.5–42.3), Solid 2.0.0-rc.13 17.9 (17.1–19.2), Solid 1.9.15 16.5 (15.1–17.4) | TIE |  | Solid 2.0.0-rc.13, Solid 1.9.15 |
| dom 1000 update100 | ms | 2.51 (2.49–2.55) | React 19.3 18.6 (17.9–20.5), Solid 2.0.0-rc.13 4.54 (4.25–4.89), Solid 1.9.15 5.12 (4.81–5.91) | WIN |  |  |
| dom 1000 update10 | ms | 1.01 (1.01–1.02) | React 19.3 4.95 (4.43–5.88), Solid 2.0.0-rc.13 1.78 (1.62–1.89), Solid 1.9.15 1.71 (1.65–2.00) | WIN |  |  |
| dom 1000 update1 | ms | 0.18 (0.18–0.19) | React 19.3 0.91 (0.81–1.07), Solid 2.0.0-rc.13 0.34 (0.33–0.39), Solid 1.9.15 0.25 (0.23–0.30) | WIN |  |  |
| dom 1000 heap | MiB | 4.06 (4.05–4.06) | React 19.3 16.8 (16.8–16.9), Solid 2.0.0-rc.13 7.37 (7.37–7.37), Solid 1.9.15 6.13 (6.12–6.13) | WIN |  |  |
| dom 1000 DOM nodes (comments) | nodes | 90,001 | Solid 1.9.15 90,001, Solid 2.0.0-rc.13 90,001, React 19.3 90,001 | TIE |  | Solid 1.9.15, Solid 2.0.0-rc.13, React 19.3 |
| dom 5000 mount | ms | 80.7 (80.0–82.2) | React 19.3 204.8 (179.3–221.5), Solid 2.0.0-rc.13 84.6 (78.3–86.7), Solid 1.9.15 79.5 (77.6–84.6) | TIE |  | Solid 2.0.0-rc.13, Solid 1.9.15 |
| dom 5000 update100 | ms | 13.3 (13.3–13.5) | React 19.3 116.5 (112.4–122.3), Solid 2.0.0-rc.13 23.4 (21.5–25.2), Solid 1.9.15 26.6 (25.5–28.8) | WIN |  |  |
| dom 5000 update10 | ms | 5.56 (5.51–5.58) | React 19.3 25.8 (25.4–27.8), Solid 2.0.0-rc.13 11.7 (11.2–12.7), Solid 1.9.15 9.82 (9.62–10.6) | WIN |  |  |
| dom 5000 update1 | ms | 0.73 (0.71–0.84) | React 19.3 3.77 (3.67–4.10), Solid 2.0.0-rc.13 1.54 (1.36–1.70), Solid 1.9.15 1.28 (1.18–1.49) | WIN |  |  |
| dom 5000 heap | MiB | 19.9 (19.9–19.9) | React 19.3 84.2 (84.2–84.2), Solid 2.0.0-rc.13 37.4 (37.4–37.4), Solid 1.9.15 31.1 (31.1–31.1) | WIN |  |  |
| dom 5000 DOM nodes (comments) | nodes | 450,001 | Solid 1.9.15 450,001, Solid 2.0.0-rc.13 450,001, React 19.3 450,001 | TIE |  | Solid 1.9.15, Solid 2.0.0-rc.13, React 19.3 |
| dom bundle gzip | B | 7,369 | Solid 1.9.15 5,402, Solid 2.0.0-rc.13 14,737, React 19.3 69,754 | LOSE | Solid 1.9.15 |  |
| krausest 01_run1k | x vanilla | 1.11 | solid-v1.9.3 1.05, svelte-v5.42.1 1.07, react-hooks-v19.2.0 1.15, react-compiler-hooks-v19.0.0 1.17, react-classes-v19.0.0 1.18 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 02_replace1k | x vanilla | 1.05 | solid-v1.9.3 1.08, svelte-v5.42.1 1.13, react-hooks-v19.2.0 1.37, react-compiler-hooks-v19.0.0 1.35, react-classes-v19.0.0 1.33 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 03_update10th1k_x16 | x vanilla | 1.06 | solid-v1.9.3 1.07, svelte-v5.42.1 1.12, react-hooks-v19.2.0 1.52, react-compiler-hooks-v19.0.0 1.54, react-classes-v19.0.0 1.39 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 04_select1k | x vanilla | 1.10 | solid-v1.9.3 1.28, svelte-v5.42.1 2.00, react-hooks-v19.2.0 2.16, react-compiler-hooks-v19.0.0 2.80, react-classes-v19.0.0 2.08 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 05_swap1k | x vanilla | 1.02 | solid-v1.9.3 1.14, svelte-v5.42.1 1.18, react-hooks-v19.2.0 8.15, react-compiler-hooks-v19.0.0 8.26, react-classes-v19.0.0 8.08 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 06_remove-one-1k | x vanilla | 1.07 | solid-v1.9.3 1.01, svelte-v5.42.1 1.04, react-hooks-v19.2.0 1.12, react-compiler-hooks-v19.0.0 1.19, react-classes-v19.0.0 1.14 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 07_create10k | x vanilla | 1.03 | solid-v1.9.3 1.07, svelte-v5.42.1 1.09, react-hooks-v19.2.0 1.88, react-compiler-hooks-v19.0.0 2.03, react-classes-v19.0.0 2.02 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 08_create1k-after1k_x2 | x vanilla | 1.04 | solid-v1.9.3 1.05, svelte-v5.42.1 1.06, react-hooks-v19.2.0 1.24, react-compiler-hooks-v19.0.0 1.25, react-classes-v19.0.0 1.25 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 09_clear1k_x8 | x vanilla | 1.06 | solid-v1.9.3 1.22, svelte-v5.42.1 1.20, react-hooks-v19.2.0 2.02, react-compiler-hooks-v19.0.0 2.02, react-classes-v19.0.0 2.00 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest local_append1k-to10k | x vanilla | 1.02 | – | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 21_ready-memory | x vanilla | 1.10 | solid-v1.9.3 1.25, svelte-v5.42.1 1.40, react-hooks-v19.2.0 2.48, react-compiler-hooks-v19.0.0 2.31, react-classes-v19.0.0 2.35 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 22_run-memory | x vanilla | 1.33 | solid-v1.9.3 1.43, svelte-v5.42.1 1.54, react-hooks-v19.2.0 2.34, react-compiler-hooks-v19.0.0 2.45, react-classes-v19.0.0 2.42 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 25_run-clear-memory | x vanilla | 1.26 | solid-v1.9.3 1.33, svelte-v5.42.1 1.62, react-hooks-v19.2.0 3.41, react-compiler-hooks-v19.0.0 3.36, react-classes-v19.0.0 3.26 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 26_run-10k-memory | x vanilla | 1.42 | – | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest local_clear-memory | x vanilla | 1.22 | – | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 41_size-uncompressed | kB | 24.6 | solid-v1.9.3 11.5, svelte-v5.42.1 26.6, react-hooks-v19.2.0 190.3, react-compiler-hooks-v19.0.0 183.0, react-classes-v19.0.0 184.6 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 42_size-compressed | kB | 8.55 | solid-v1.9.3 4.50, svelte-v5.42.1 9.70, react-hooks-v19.2.0 51.4, react-compiler-hooks-v19.0.0 50.0, react-classes-v19.0.0 50.2 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 43_first-paint | x vanilla | 1.00 | solid-v1.9.3 0.96, svelte-v5.42.1 1.33, react-hooks-v19.2.0 4.21, react-compiler-hooks-v19.0.0 4.09, react-classes-v19.0.0 4.15 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest startup_ready | x vanilla | 1.09 | – | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest startup_consistentlyInteractive | x vanilla | 1.14 | – | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest startup_scriptBootup | x vanilla | 1.64 | – | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest startup_totalBytes | x vanilla | 4.00 | – | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 01_run1k script above vanilla | ms | 0.93 | solid-v1.9.3 0.90, svelte-v5.42.1 1.44, react-hooks-v19.2.0 3.97, react-compiler-hooks-v19.0.0 4.06, react-classes-v19.0.0 4.51 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 02_replace1k script above vanilla | ms | 1.07 | solid-v1.9.3 1.55, svelte-v5.42.1 2.51, react-hooks-v19.2.0 7.92, react-compiler-hooks-v19.0.0 7.44, react-classes-v19.0.0 7.05 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 03_update10th1k_x16 script above vanilla | ms | 0.41 | solid-v1.9.3 0.45, svelte-v5.42.1 0.75, react-hooks-v19.2.0 5.98, react-compiler-hooks-v19.0.0 5.98, react-classes-v19.0.0 4.04 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 04_select1k script above vanilla | ms | 0.26 | solid-v1.9.3 1.27, svelte-v5.42.1 3.96, react-hooks-v19.2.0 4.60, react-compiler-hooks-v19.0.0 6.66, react-classes-v19.0.0 4.28 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 05_swap1k script above vanilla | ms | 0.53 | solid-v1.9.3 1.37, svelte-v5.42.1 2.14, react-hooks-v19.2.0 27.6, react-compiler-hooks-v19.0.0 30.2, react-classes-v19.0.0 26.7 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 06_remove-one-1k script above vanilla | ms | 0.42 | solid-v1.9.3 -0.12, svelte-v5.42.1 0.12, react-hooks-v19.2.0 0.94, react-compiler-hooks-v19.0.0 1.65, react-classes-v19.0.0 1.06 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 07_create10k script above vanilla | ms | 5.83 | solid-v1.9.3 6.31, svelte-v5.42.1 8.55, react-hooks-v19.2.0 173.2, react-compiler-hooks-v19.0.0 204.6, react-classes-v19.0.0 205.1 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 08_create1k-after1k_x2 script above vanilla | ms | 1.07 | solid-v1.9.3 1.10, svelte-v5.42.1 1.30, react-hooks-v19.2.0 5.22, react-compiler-hooks-v19.0.0 5.52, react-classes-v19.0.0 5.62 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 09_clear1k_x8 script above vanilla | ms | 0.85 | solid-v1.9.3 2.32, svelte-v5.42.1 2.32, react-hooks-v19.2.0 11.0, react-compiler-hooks-v19.0.0 10.9, react-classes-v19.0.0 10.7 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 21_ready-memory heap above vanilla | MB | 0.11 | solid-v1.9.3 0.12, svelte-v5.42.1 0.19, react-hooks-v19.2.0 0.71, react-compiler-hooks-v19.0.0 0.63, react-classes-v19.0.0 0.65 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 22_run-memory heap above vanilla | MB | 0.77 | solid-v1.9.3 0.81, svelte-v5.42.1 1.01, react-hooks-v19.2.0 2.50, react-compiler-hooks-v19.0.0 2.71, react-classes-v19.0.0 2.65 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 25_run-clear-memory heap above vanilla | MB | 0.30 | solid-v1.9.3 0.19, svelte-v5.42.1 0.36, react-hooks-v19.2.0 1.40, react-compiler-hooks-v19.0.0 1.37, react-classes-v19.0.0 1.31 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 26_run-10k-memory heap above vanilla | MB | 5.50 | – | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest local_clear-memory heap above vanilla | MB | 0.24 | – | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest CPU weighted geomean | x vanilla | 1.06 | solid-v1.9.3 1.08, svelte-v5.42.1 1.13, react-hooks-v19.2.0 1.53, react-compiler-hooks-v19.0.0 1.58, react-classes-v19.0.0 1.53 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| resume slow click (to paint) | ms | 31.5 (30.9–33.2) | Qwik 2.0.0-rc.0 32.6 (31.7–46.6), Qwik 1.20.1 32.9 (31.3–33.8), Solid 2.0.0-rc.13 53.4 (35.2–70.7), Solid 1.9.15 51.0 (39.4–66.8) | n/a (browser drift: competitors 155.0.8059.84, this run 156.0.8078.80) |  |  |
| resume slow filter (to paint) | ms | 90.4 (85.8–116.3) | Qwik 2.0.0-rc.0 159.8 (129.2–179.0), Qwik 1.20.1 144.1 (114.0–165.7), Solid 2.0.0-rc.13 87.0 (61.8–90.2), Solid 1.9.15 89.4 (73.2–111.5) | n/a (browser drift: competitors 155.0.8059.84, this run 156.0.8078.80) |  |  |
| resume slow navigate (to paint) | ms | 80.7 (79.2–80.9) | Qwik 2.0.0-rc.0 57.6 (54.8–106.7), Qwik 1.20.1 42.3 (38.9–45.6), Solid 2.0.0-rc.13 188.3 (185.6–193.1), Solid 1.9.15 182.6 (176.8–187.3) | n/a (browser drift: competitors 155.0.8059.84, this run 156.0.8078.80) |  |  |

Notes: real = apps/resume-bench/real-pages (all lanes same run, fresh context per sample, rotating lane order); dom = apps/dom-bench (5k rows = 285k elements, 50k reactive fields; Chromium bundled with Playwright; mount = warm-up cycle, forced GC (heap baseline), one unforced re-warm cycle, one macrotask, timed mount — protocol rewarm-2026-10-21); krausest = ratios to vanillajs (local Rivet/local vanilla vs published framework/vanillajs, Chrome 154), sizes absolute kB; resume = Slow 4G + 4x CPU, input → paint of the update; ssr = c1 closed loop, rivet-compiled vs static peers (Razor, Solid 1 hydratable:false), rivet-resume vs hydratable/resumable peers (Solid, Qwik), same generator/window/GC profile. Methodology: apps/dom-bench/README.md.
