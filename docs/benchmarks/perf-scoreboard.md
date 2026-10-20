# Perf scoreboard

- Run: 2026-10-20T07:32:44.813Z → 2026-10-20T07:46:38.171Z — 2026-10-19
- Measured: ? @ ? (../../../../../private/tmp/claude-501/-Users-denisseverin-Projects-claude-test-rivet/d5c17ad1-df18-48dc-b37c-7b09decaac8e/scratchpad/bench-snap); Rivet only, competitors from apps/dom-bench/competitors.json and krausest/published.json
- Totals: 8 WIN / 5 TIE / 3 LOSE / 37 n/a. WIN = Rivet ≥3% better than every listed competitor with non-overlapping trial ranges (where both have ranges); LOSE = the same in reverse vs any; otherwise TIE. Values: median (min–max).
- Browsers: dom {"measured":"153.0.8010.12","reference":"153.0.8010.12","drift":"same","crossOriginIsolated":true}; krausest {"measured":"155.0.8059.85","reference":"154.0.8037.98","drift":"major"}; resume {"measured":"155.0.8059.85","reference":"155.0.8059.84","drift":"patch"}
- Raw: .artifacts/perf-night/scoreboard/2026-10-20T07-32-44-811Z.json

| scenario | unit | Rivet | competitors | verdict | loses to | ties with |
|---|---|---|---|---|---|---|
| dom 1000 mount | ms | 21.4 (20.3–23.4) | React 19.3 53.4 (52.6–54.2), Solid 2.0.0-rc.13 18.4 (18.4–19.0), Solid 1.9.15 17.7 (17.4–17.8) | LOSE | Solid 2.0.0-rc.13, Solid 1.9.15 |  |
| dom 1000 update100 | ms | 2.65 (2.64–2.91) | React 19.3 16.4 (16.2–16.5), Solid 2.0.0-rc.13 3.90 (3.83–3.90), Solid 1.9.15 4.60 (4.50–4.68) | WIN |  |  |
| dom 1000 update10 | ms | 1.25 (1.19–1.29) | React 19.3 4.24 (4.24–4.36), Solid 2.0.0-rc.13 1.63 (1.62–1.66), Solid 1.9.15 1.69 (1.68–1.76) | WIN |  |  |
| dom 1000 update1 | ms | 0.21 (0.20–0.23) | React 19.3 0.89 (0.85–0.90), Solid 2.0.0-rc.13 0.33 (0.31–0.33), Solid 1.9.15 0.24 (0.23–0.26) | WIN |  |  |
| dom 1000 heap | MiB | 4.04 (4.04–4.04) | React 19.3 16.8 (16.8–16.8), Solid 2.0.0-rc.13 7.37 (7.37–7.37), Solid 1.9.15 6.12 | WIN |  |  |
| dom 1000 DOM nodes (comments) | nodes | 90,001 | Solid 1.9.15 90,001, Solid 2.0.0-rc.13 90,001, React 19.3 90,001 | TIE |  | Solid 1.9.15, Solid 2.0.0-rc.13, React 19.3 |
| dom 5000 mount | ms | 105.0 (101.5–105.2) | React 19.3 180.8 (179.3–181.0), Solid 2.0.0-rc.13 84.6 (84.4–98.8), Solid 1.9.15 98.3 (82.5–99.0) | LOSE | Solid 2.0.0-rc.13, Solid 1.9.15 |  |
| dom 5000 update100 | ms | 14.6 (14.3–14.8) | React 19.3 108.2 (104.3–109.2), Solid 2.0.0-rc.13 21.6 (21.3–21.8), Solid 1.9.15 25.7 (25.2–26.1) | WIN |  |  |
| dom 5000 update10 | ms | 6.26 (6.20–6.36) | React 19.3 23.3 (22.9–23.6), Solid 2.0.0-rc.13 10.2 (9.35–10.3), Solid 1.9.15 9.55 (9.55–9.56) | WIN |  |  |
| dom 5000 update1 | ms | 0.79 (0.78–0.81) | React 19.3 3.49 (3.44–3.51), Solid 2.0.0-rc.13 1.32 (1.23–1.33), Solid 1.9.15 1.24 (1.22–1.25) | WIN |  |  |
| dom 5000 heap | MiB | 19.9 | React 19.3 84.2 (84.2–84.2), Solid 2.0.0-rc.13 37.4 (37.4–37.4), Solid 1.9.15 31.1 (31.1–31.1) | WIN |  |  |
| dom 5000 DOM nodes (comments) | nodes | 450,001 | Solid 1.9.15 450,001, Solid 2.0.0-rc.13 450,001, React 19.3 450,001 | TIE |  | Solid 1.9.15, Solid 2.0.0-rc.13, React 19.3 |
| dom bundle gzip | B | 6,637 | Solid 1.9.15 5,402, Solid 2.0.0-rc.13 14,737, React 19.3 69,754 | LOSE | Solid 1.9.15 |  |
| krausest 01_run1k | x vanilla | 1.07 | solid-v1.9.3 1.05, svelte-v5.42.1 1.07, react-hooks-v19.2.0 1.15, react-compiler-hooks-v19.0.0 1.17, react-classes-v19.0.0 1.18 | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest 02_replace1k | x vanilla | 1.04 | solid-v1.9.3 1.08, svelte-v5.42.1 1.13, react-hooks-v19.2.0 1.37, react-compiler-hooks-v19.0.0 1.35, react-classes-v19.0.0 1.33 | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest 03_update10th1k_x16 | x vanilla | 0.99 | solid-v1.9.3 1.07, svelte-v5.42.1 1.12, react-hooks-v19.2.0 1.52, react-compiler-hooks-v19.0.0 1.54, react-classes-v19.0.0 1.39 | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest 04_select1k | x vanilla | 1.08 | solid-v1.9.3 1.28, svelte-v5.42.1 2.00, react-hooks-v19.2.0 2.16, react-compiler-hooks-v19.0.0 2.80, react-classes-v19.0.0 2.08 | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest 05_swap1k | x vanilla | 1.00 | solid-v1.9.3 1.14, svelte-v5.42.1 1.18, react-hooks-v19.2.0 8.15, react-compiler-hooks-v19.0.0 8.26, react-classes-v19.0.0 8.08 | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest 06_remove-one-1k | x vanilla | 1.10 | solid-v1.9.3 1.01, svelte-v5.42.1 1.04, react-hooks-v19.2.0 1.12, react-compiler-hooks-v19.0.0 1.19, react-classes-v19.0.0 1.14 | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest 07_create10k | x vanilla | 1.03 | solid-v1.9.3 1.07, svelte-v5.42.1 1.09, react-hooks-v19.2.0 1.88, react-compiler-hooks-v19.0.0 2.03, react-classes-v19.0.0 2.02 | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest 08_create1k-after1k_x2 | x vanilla | 1.06 | solid-v1.9.3 1.05, svelte-v5.42.1 1.06, react-hooks-v19.2.0 1.24, react-compiler-hooks-v19.0.0 1.25, react-classes-v19.0.0 1.25 | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest 09_clear1k_x8 | x vanilla | 1.03 | solid-v1.9.3 1.22, svelte-v5.42.1 1.20, react-hooks-v19.2.0 2.02, react-compiler-hooks-v19.0.0 2.02, react-classes-v19.0.0 2.00 | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest local_append1k-to10k | x vanilla | 1.00 | – | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest 21_ready-memory | x vanilla | 1.08 | solid-v1.9.3 1.25, svelte-v5.42.1 1.40, react-hooks-v19.2.0 2.48, react-compiler-hooks-v19.0.0 2.31, react-classes-v19.0.0 2.35 | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest 22_run-memory | x vanilla | 1.33 | solid-v1.9.3 1.43, svelte-v5.42.1 1.54, react-hooks-v19.2.0 2.34, react-compiler-hooks-v19.0.0 2.45, react-classes-v19.0.0 2.42 | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest 25_run-clear-memory | x vanilla | 1.26 | solid-v1.9.3 1.33, svelte-v5.42.1 1.62, react-hooks-v19.2.0 3.41, react-compiler-hooks-v19.0.0 3.36, react-classes-v19.0.0 3.26 | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest 26_run-10k-memory | x vanilla | 1.42 | – | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest local_clear-memory | x vanilla | 1.20 | – | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest 41_size-uncompressed | kB | 23.8 | solid-v1.9.3 11.5, svelte-v5.42.1 26.6, react-hooks-v19.2.0 190.3, react-compiler-hooks-v19.0.0 183.0, react-classes-v19.0.0 184.6 | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest 42_size-compressed | kB | 8.28 | solid-v1.9.3 4.50, svelte-v5.42.1 9.70, react-hooks-v19.2.0 51.4, react-compiler-hooks-v19.0.0 50.0, react-classes-v19.0.0 50.2 | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest 43_first-paint | x vanilla | 0.73 | solid-v1.9.3 0.96, svelte-v5.42.1 1.33, react-hooks-v19.2.0 4.21, react-compiler-hooks-v19.0.0 4.09, react-classes-v19.0.0 4.15 | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest startup_ready | x vanilla | 0.99 | – | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest startup_consistentlyInteractive | x vanilla | 0.97 | – | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest startup_scriptBootup | x vanilla | 1.78 | – | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest startup_totalBytes | x vanilla | 3.89 | – | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest 01_run1k script above vanilla | ms | 0.96 | solid-v1.9.3 1.00, svelte-v5.42.1 1.61, react-hooks-v19.2.0 4.42, react-compiler-hooks-v19.0.0 4.52, react-classes-v19.0.0 5.02 | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest 02_replace1k script above vanilla | ms | 1.10 | solid-v1.9.3 1.72, svelte-v5.42.1 2.80, react-hooks-v19.2.0 8.83, react-compiler-hooks-v19.0.0 8.29, react-classes-v19.0.0 7.86 | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest 03_update10th1k_x16 script above vanilla | ms | 0.26 | solid-v1.9.3 0.59, svelte-v5.42.1 0.99, react-hooks-v19.2.0 7.88, react-compiler-hooks-v19.0.0 7.88, react-classes-v19.0.0 5.32 | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest 04_select1k script above vanilla | ms | 0.57 | solid-v1.9.3 1.56, svelte-v5.42.1 4.86, react-hooks-v19.2.0 5.64, react-compiler-hooks-v19.0.0 8.17, react-classes-v19.0.0 5.25 | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest 05_swap1k script above vanilla | ms | 0.53 | solid-v1.9.3 1.70, svelte-v5.42.1 2.64, react-hooks-v19.2.0 34.1, react-compiler-hooks-v19.0.0 37.3, react-classes-v19.0.0 33.0 | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest 06_remove-one-1k script above vanilla | ms | 0.35 | solid-v1.9.3 -0.13, svelte-v5.42.1 0.13, react-hooks-v19.2.0 1.04, react-compiler-hooks-v19.0.0 1.82, react-classes-v19.0.0 1.17 | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest 07_create10k script above vanilla | ms | 6.83 | solid-v1.9.3 6.66, svelte-v5.42.1 9.03, react-hooks-v19.2.0 182.9, react-compiler-hooks-v19.0.0 216.0, react-classes-v19.0.0 216.6 | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest 08_create1k-after1k_x2 script above vanilla | ms | 1.29 | solid-v1.9.3 1.21, svelte-v5.42.1 1.43, react-hooks-v19.2.0 5.72, react-compiler-hooks-v19.0.0 6.05, react-classes-v19.0.0 6.16 | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest 09_clear1k_x8 script above vanilla | ms | 0.53 | solid-v1.9.3 2.59, svelte-v5.42.1 2.59, react-hooks-v19.2.0 12.3, react-compiler-hooks-v19.0.0 12.1, react-classes-v19.0.0 12.0 | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest 21_ready-memory heap above vanilla | MB | 0.08 | solid-v1.9.3 0.12, svelte-v5.42.1 0.19, react-hooks-v19.2.0 0.71, react-compiler-hooks-v19.0.0 0.63, react-classes-v19.0.0 0.65 | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest 22_run-memory heap above vanilla | MB | 0.76 | solid-v1.9.3 0.81, svelte-v5.42.1 1.01, react-hooks-v19.2.0 2.50, react-compiler-hooks-v19.0.0 2.71, react-classes-v19.0.0 2.65 | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest 25_run-clear-memory heap above vanilla | MB | 0.30 | solid-v1.9.3 0.19, svelte-v5.42.1 0.36, react-hooks-v19.2.0 1.40, react-compiler-hooks-v19.0.0 1.37, react-classes-v19.0.0 1.31 | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest 26_run-10k-memory heap above vanilla | MB | 5.50 | – | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest local_clear-memory heap above vanilla | MB | 0.23 | – | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| krausest CPU weighted geomean | x vanilla | 1.05 | solid-v1.9.3 1.08, svelte-v5.42.1 1.13, react-hooks-v19.2.0 1.53, react-compiler-hooks-v19.0.0 1.58, react-classes-v19.0.0 1.53 | n/a (browser drift: published 154.0.8037.98, this run 155.0.8059.85) |  |  |
| resume slow click (to paint) | ms | 31.3 (29.2–34.7) | qwik 32.6 (31.7–46.6), qwik-stable 32.9 (31.3–33.8), Solid 2.0.0-rc.13 53.4 (35.2–70.7), Solid 1.9.15 51.0 (39.4–66.8) | TIE |  | qwik, qwik-stable |
| resume slow filter (to paint) | ms | 90.6 (74.2–108.1) | qwik 159.8 (129.2–179.0), qwik-stable 144.1 (114.0–165.7), Solid 2.0.0-rc.13 87.0 (61.8–90.2), Solid 1.9.15 89.4 (73.2–111.5) | TIE |  | Solid 2.0.0-rc.13, Solid 1.9.15 |
| resume slow navigate (to paint) | ms | 39.7 (37.4–53.4) | qwik 57.6 (54.8–106.7), qwik-stable 42.3 (38.9–45.6), Solid 2.0.0-rc.13 188.3 (185.6–193.1), Solid 1.9.15 182.6 (176.8–187.3) | TIE |  | qwik-stable |

Notes: dom = apps/dom-bench (5k rows = 285k elements, 50k reactive fields; Chromium bundled with Playwright); krausest = ratios to vanillajs (local Rivet/local vanilla vs published framework/vanillajs, Chrome 154), sizes absolute kB; resume = Slow 4G + 4x CPU, input → paint of the update; ssr = c1 closed loop, rivet-compiled vs static peers (Razor, Solid 1 hydratable:false), rivet-resume vs hydratable/resumable peers (Solid, Qwik), same generator/window/GC profile. Methodology: apps/dom-bench/README.md.
