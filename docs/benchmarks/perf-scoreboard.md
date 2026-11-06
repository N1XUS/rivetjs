# Perf scoreboard

- Run: 2026-11-06T10:05:01.601Z → 2026-11-06T10:19:33.350Z
- Measured: main @ 4dddbbf (dirty) (this checkout); real pages: every lane measured in the same run; micro: Rivet only, competitors from apps/dom-bench/competitors.json and krausest/published.json
- Verdicts: WIN = Rivet ≥3% better than every listed competitor with non-overlapping trial ranges (where both have ranges); LOSE = the same in reverse vs any; otherwise TIE. Values: median (min–max).
- Browsers: real {"measured":"156.0.8078.80","reference":"156.0.8078.80","drift":"same"}; dom {"measured":"153.0.8010.12","reference":"153.0.8010.12","drift":"same","crossOriginIsolated":true,"protocol":{"measured":"nowrap-2026-11-06","reference":"nowrap-2026-11-06"}}; krausest {"measured":"156.0.8078.80","reference":"154.0.8037.98","drift":"major"}; resume {"measured":"156.0.8078.80","reference":"155.0.8059.84","drift":"major"}
- Raw: .artifacts/perf-night/scoreboard/2026-11-06T10-05-01-599Z.json

## Real pages (headline)

Totals: 7 WIN / 21 TIE / 4 LOSE / 0 n/a. Products listing, dashboard, settings form, docs article (apps/resume-bench/real-pages); identical markup + behaviour per lane (parity + behaviour gate); slow = Slow 4G + 4× CPU. Report: docs/benchmarks/2026-10-28-real-pages.md.

| scenario | unit | Rivet | competitors | verdict | loses to | ties with |
|---|---|---|---|---|---|---|
| real products slow main interaction to paint | ms | 30.7 (30.0–31.7) | Solid 1.9.15 53.0 (50.4–56.7), Solid 2.0.0-rc.13 48.2 (47.0–54.3), Qwik 1.20.1 47.7 (46.1–49.2), Qwik 2.0.0-rc.0 48.3 (44.0–49.8) | WIN |  |  |
| real products fast main interaction to paint | ms | 32.0 (30.4–32.3) | Solid 1.9.15 37.5 (35.7–39.3), Solid 2.0.0-rc.13 36.8 (35.3–38.2), Qwik 1.20.1 32.1 (31.8–32.5), Qwik 2.0.0-rc.0 32.3 (31.5–33.2) | TIE |  | Qwik 1.20.1, Qwik 2.0.0-rc.0 |
| real products slow JS transfer before input | B | 3,858 | Solid 1.9.15 7,490, Solid 2.0.0-rc.13 22,021, Qwik 1.20.1 24,037, Qwik 2.0.0-rc.0 38,554 | WIN |  |  |
| real products slow JS requests before input | req | 1 | Solid 1.9.15 1, Solid 2.0.0-rc.13 1, Qwik 1.20.1 3, Qwik 2.0.0-rc.0 14 | TIE |  | Solid 1.9.15, Solid 2.0.0-rc.13 |
| real products slow main-thread CPU before input | ms | 65.9 (64.2–68.1) | Solid 1.9.15 66.3 (64.1–71.6), Solid 2.0.0-rc.13 80.4 (76.0–82.9), Qwik 1.20.1 73.0 (68.7–75.6), Qwik 2.0.0-rc.0 74.9 (72.4–80.7) | TIE |  | Solid 1.9.15 |
| real products slow LCP | ms | 228.0 (208.0–244.0) | Solid 1.9.15 232.0 (224.0–232.0), Solid 2.0.0-rc.13 228.0 (224.0–244.0), Qwik 1.20.1 224.0 (220.0–248.0), Qwik 2.0.0-rc.0 228.0 (216.0–240.0) | TIE |  | Solid 1.9.15, Solid 2.0.0-rc.13, Qwik 1.20.1, Qwik 2.0.0-rc.0 |
| real products slow TBT before input | ms | 0.00 | Solid 1.9.15 0.00, Solid 2.0.0-rc.13 0.00, Qwik 1.20.1 0.00, Qwik 2.0.0-rc.0 0.00 | TIE |  | Solid 1.9.15, Solid 2.0.0-rc.13, Qwik 1.20.1, Qwik 2.0.0-rc.0 |
| real products slow HTML transfer | B | 4,788 | Solid 1.9.15 3,187, Solid 2.0.0-rc.13 3,256, Qwik 1.20.1 5,862, Qwik 2.0.0-rc.0 4,558 | LOSE | Solid 1.9.15, Solid 2.0.0-rc.13, Qwik 2.0.0-rc.0 |  |
| real dashboard slow main interaction to paint | ms | 36.0 (34.6–41.8) | Solid 1.9.15 42.9 (38.9–57.2), Solid 2.0.0-rc.13 44.4 (38.8–47.0), Qwik 2.0.0-rc.0 75.9 (54.2–77.1), Qwik 1.20.1 withheld (failed gate) | TIE |  | Solid 1.9.15, Solid 2.0.0-rc.13 |
| real dashboard fast main interaction to paint | ms | 32.9 (32.2–33.7) | Solid 1.9.15 38.4 (36.1–39.5), Solid 2.0.0-rc.13 38.3 (33.3–40.5), Qwik 2.0.0-rc.0 33.1 (32.1–33.7), Qwik 1.20.1 withheld (failed gate) | TIE |  | Solid 2.0.0-rc.13, Qwik 2.0.0-rc.0 |
| real dashboard slow JS transfer before input | B | 4,888 | Solid 1.9.15 7,714, Solid 2.0.0-rc.13 22,281, Qwik 2.0.0-rc.0 38,512, Qwik 1.20.1 withheld (failed gate) | WIN |  |  |
| real dashboard slow JS requests before input | req | 1 | Solid 1.9.15 1, Solid 2.0.0-rc.13 1, Qwik 2.0.0-rc.0 14, Qwik 1.20.1 withheld (failed gate) | TIE |  | Solid 1.9.15, Solid 2.0.0-rc.13 |
| real dashboard slow main-thread CPU before input | ms | 74.8 (72.4–75.6) | Solid 1.9.15 77.7 (74.1–83.0), Solid 2.0.0-rc.13 87.1 (82.4–87.7), Qwik 2.0.0-rc.0 89.2 (76.4–91.3), Qwik 1.20.1 withheld (failed gate) | TIE |  | Solid 1.9.15 |
| real dashboard slow LCP | ms | 228.0 (224.0–244.0) | Solid 1.9.15 244.0 (224.0–244.0), Solid 2.0.0-rc.13 244.0 (212.0–244.0), Qwik 2.0.0-rc.0 244.0 (240.0–244.0), Qwik 1.20.1 withheld (failed gate) | TIE |  | Solid 1.9.15, Solid 2.0.0-rc.13, Qwik 2.0.0-rc.0 |
| real dashboard slow TBT before input | ms | 0.00 | Solid 1.9.15 0.00, Solid 2.0.0-rc.13 0.00, Qwik 2.0.0-rc.0 0.00, Qwik 1.20.1 withheld (failed gate) | TIE |  | Solid 1.9.15, Solid 2.0.0-rc.13, Qwik 2.0.0-rc.0 |
| real dashboard slow HTML transfer | B | 4,610 | Solid 1.9.15 3,189, Solid 2.0.0-rc.13 3,190, Qwik 2.0.0-rc.0 4,413, Qwik 1.20.1 withheld (failed gate) | LOSE | Solid 1.9.15, Solid 2.0.0-rc.13, Qwik 2.0.0-rc.0 |  |
| real settings slow main interaction to paint | ms | 37.3 (36.6–42.7) | Solid 1.9.15 39.9 (38.1–53.3), Solid 2.0.0-rc.13 40.8 (38.1–52.8), Qwik 1.20.1 68.1 (66.9–82.9), Qwik 2.0.0-rc.0 withheld (failed gate) | TIE |  | Solid 1.9.15, Solid 2.0.0-rc.13 |
| real settings fast main interaction to paint | ms | 37.7 (34.9–39.0) | Solid 1.9.15 37.3 (34.4–41.3), Solid 2.0.0-rc.13 37.7 (34.2–39.5), Qwik 1.20.1 49.2 (48.0–49.6), Qwik 2.0.0-rc.0 withheld (failed gate) | TIE |  | Solid 1.9.15, Solid 2.0.0-rc.13 |
| real settings slow JS transfer before input | B | 3,798 | Solid 1.9.15 7,624, Solid 2.0.0-rc.13 21,260, Qwik 1.20.1 24,541, Qwik 2.0.0-rc.0 withheld (failed gate) | WIN |  |  |
| real settings slow JS requests before input | req | 1 | Solid 1.9.15 1, Solid 2.0.0-rc.13 1, Qwik 1.20.1 3, Qwik 2.0.0-rc.0 withheld (failed gate) | TIE |  | Solid 1.9.15, Solid 2.0.0-rc.13 |
| real settings slow main-thread CPU before input | ms | 51.1 (49.9–52.3) | Solid 1.9.15 56.5 (55.1–58.3), Solid 2.0.0-rc.13 61.9 (56.7–64.2), Qwik 1.20.1 58.0 (56.4–62.8), Qwik 2.0.0-rc.0 withheld (failed gate) | WIN |  |  |
| real settings slow LCP | ms | 212.0 (212.0–228.0) | Solid 1.9.15 228.0 (216.0–228.0), Solid 2.0.0-rc.13 224.0 (208.0–228.0), Qwik 1.20.1 228.0 (212.0–228.0), Qwik 2.0.0-rc.0 withheld (failed gate) | TIE |  | Solid 1.9.15, Solid 2.0.0-rc.13, Qwik 1.20.1 |
| real settings slow TBT before input | ms | 0.00 | Solid 1.9.15 0.00, Solid 2.0.0-rc.13 0.00, Qwik 1.20.1 0.00, Qwik 2.0.0-rc.0 withheld (failed gate) | TIE |  | Solid 1.9.15, Solid 2.0.0-rc.13, Qwik 1.20.1 |
| real settings slow HTML transfer | B | 3,579 | Solid 1.9.15 1,959, Solid 2.0.0-rc.13 1,857, Qwik 1.20.1 4,452, Qwik 2.0.0-rc.0 withheld (failed gate) | LOSE | Solid 1.9.15, Solid 2.0.0-rc.13 |  |
| real article slow main interaction to paint | ms | 31.5 (30.4–32.4) | Solid 1.9.15 53.4 (52.4–60.7), Solid 2.0.0-rc.13 39.2 (38.4–39.8), Qwik 1.20.1 48.0 (42.2–48.7), Qwik 2.0.0-rc.0 55.1 (54.5–56.5) | WIN |  |  |
| real article fast main interaction to paint | ms | 32.3 (30.8–32.9) | Solid 1.9.15 38.6 (35.7–41.2), Solid 2.0.0-rc.13 38.0 (36.4–39.0), Qwik 1.20.1 32.5 (32.5–32.7), Qwik 2.0.0-rc.0 32.6 (31.5–33.8) | TIE |  | Qwik 1.20.1, Qwik 2.0.0-rc.0 |
| real article slow JS transfer before input | B | 3,576 | Solid 1.9.15 7,886, Solid 2.0.0-rc.13 21,332, Qwik 1.20.1 24,753, Qwik 2.0.0-rc.0 44,416 | WIN |  |  |
| real article slow JS requests before input | req | 1 | Solid 1.9.15 1, Solid 2.0.0-rc.13 1, Qwik 1.20.1 3, Qwik 2.0.0-rc.0 31 | TIE |  | Solid 1.9.15, Solid 2.0.0-rc.13 |
| real article slow main-thread CPU before input | ms | 67.1 (63.1–71.6) | Solid 1.9.15 67.7 (61.3–69.6), Solid 2.0.0-rc.13 75.1 (71.8–76.1), Qwik 1.20.1 73.4 (71.1–74.9), Qwik 2.0.0-rc.0 95.0 (91.2–98.1) | TIE |  | Solid 1.9.15, Qwik 1.20.1 |
| real article slow LCP | ms | 228.0 (228.0–252.0) | Solid 1.9.15 228.0 (224.0–244.0), Solid 2.0.0-rc.13 240.0 (228.0–244.0), Qwik 1.20.1 240.0 (232.0–244.0), Qwik 2.0.0-rc.0 240.0 (232.0–244.0) | TIE |  | Solid 1.9.15, Solid 2.0.0-rc.13, Qwik 1.20.1, Qwik 2.0.0-rc.0 |
| real article slow TBT before input | ms | 0.00 | Solid 1.9.15 0.00, Solid 2.0.0-rc.13 0.00, Qwik 1.20.1 0.00, Qwik 2.0.0-rc.0 0.00 | TIE |  | Solid 1.9.15, Solid 2.0.0-rc.13, Qwik 1.20.1, Qwik 2.0.0-rc.0 |
| real article slow HTML transfer | B | 3,954 | Solid 1.9.15 2,316, Solid 2.0.0-rc.13 2,226, Qwik 1.20.1 4,172, Qwik 2.0.0-rc.0 3,043 | LOSE | Solid 1.9.15, Solid 2.0.0-rc.13, Qwik 2.0.0-rc.0 |  |

## Micro benchmarks (secondary)

Totals: 8 WIN / 4 TIE / 1 LOSE / 40 n/a. Synthetic stress cases kept on purpose (removing losing cases would be cherry-picking): large keyed lists, krausest, the resume counter / 1,000-row fixture.

| scenario | unit | Rivet | competitors | verdict | loses to | ties with |
|---|---|---|---|---|---|---|
| dom 1000 mount | ms | 18.4 (17.7–18.8) | React 19.3 41.3 (39.4–42.2), Solid 2.0.0-rc.13 18.3 (17.0–18.7), Solid 1.9.15 17.4 (16.8–17.8) | TIE |  | Solid 2.0.0-rc.13, Solid 1.9.15 |
| dom 1000 update100 | ms | 3.64 (3.59–3.69) | React 19.3 20.5 (19.8–20.8), Solid 2.0.0-rc.13 5.18 (4.82–5.38), Solid 1.9.15 5.77 (5.30–6.07) | WIN |  |  |
| dom 1000 update10 | ms | 1.30 (1.22–1.33) | React 19.3 5.10 (4.54–5.48), Solid 2.0.0-rc.13 1.73 (1.66–1.99), Solid 1.9.15 1.84 (1.66–1.89) | WIN |  |  |
| dom 1000 update1 | ms | 0.22 (0.21–0.22) | React 19.3 0.99 (0.97–1.04), Solid 2.0.0-rc.13 0.36 (0.34–0.41), Solid 1.9.15 0.28 (0.25–0.30) | WIN |  |  |
| dom 1000 heap | MiB | 3.18 (3.18–3.18) | React 19.3 16.3 (16.3–16.3), Solid 2.0.0-rc.13 6.57 (6.50–6.58), Solid 1.9.15 5.34 (5.34–5.35) | WIN |  |  |
| dom 1000 DOM nodes (comments) | nodes | 90,001 | Solid 1.9.15 90,001, Solid 2.0.0-rc.13 90,001, React 19.3 90,001 | TIE |  | Solid 1.9.15, Solid 2.0.0-rc.13, React 19.3 |
| dom 5000 mount | ms | 85.0 (84.5–87.5) | React 19.3 217.3 (213.4–235.3), Solid 2.0.0-rc.13 90.5 (84.7–92.0), Solid 1.9.15 82.9 (76.7–88.8) | TIE |  | Solid 2.0.0-rc.13, Solid 1.9.15 |
| dom 5000 update100 | ms | 17.7 (17.2–17.9) | React 19.3 110.5 (104.3–115.2), Solid 2.0.0-rc.13 25.2 (24.5–25.9), Solid 1.9.15 29.6 (28.1–30.9) | WIN |  |  |
| dom 5000 update10 | ms | 6.22 (6.22–6.45) | React 19.3 29.4 (28.1–31.9), Solid 2.0.0-rc.13 11.2 (10.5–11.6), Solid 1.9.15 9.90 (9.41–10.3) | WIN |  |  |
| dom 5000 update1 | ms | 0.79 (0.75–0.91) | React 19.3 4.07 (3.94–4.43), Solid 2.0.0-rc.13 1.40 (1.33–1.54), Solid 1.9.15 1.28 (1.19–1.38) | WIN |  |  |
| dom 5000 heap | MiB | 15.6 (15.5–15.6) | React 19.3 81.7 (81.7–81.7), Solid 2.0.0-rc.13 33.2 (33.2–33.2), Solid 1.9.15 27.2 (26.7–27.3) | WIN |  |  |
| dom 5000 DOM nodes (comments) | nodes | 450,001 | Solid 1.9.15 450,001, Solid 2.0.0-rc.13 450,001, React 19.3 450,001 | TIE |  | Solid 1.9.15, Solid 2.0.0-rc.13, React 19.3 |
| dom bundle gzip | B | 7,811 | Solid 1.9.15 5,402, Solid 2.0.0-rc.13 14,737, React 19.3 69,754 | LOSE | Solid 1.9.15 |  |
| krausest 01_run1k | x vanilla | 1.04 | solid-v1.9.3 1.05, svelte-v5.42.1 1.07, react-hooks-v19.2.0 1.15, react-compiler-hooks-v19.0.0 1.17, react-classes-v19.0.0 1.18 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 02_replace1k | x vanilla | 1.04 | solid-v1.9.3 1.08, svelte-v5.42.1 1.13, react-hooks-v19.2.0 1.37, react-compiler-hooks-v19.0.0 1.35, react-classes-v19.0.0 1.33 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 03_update10th1k_x16 | x vanilla | 1.08 | solid-v1.9.3 1.07, svelte-v5.42.1 1.12, react-hooks-v19.2.0 1.52, react-compiler-hooks-v19.0.0 1.54, react-classes-v19.0.0 1.39 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 04_select1k | x vanilla | 0.99 | solid-v1.9.3 1.28, svelte-v5.42.1 2.00, react-hooks-v19.2.0 2.16, react-compiler-hooks-v19.0.0 2.80, react-classes-v19.0.0 2.08 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 05_swap1k | x vanilla | 1.01 | solid-v1.9.3 1.14, svelte-v5.42.1 1.18, react-hooks-v19.2.0 8.15, react-compiler-hooks-v19.0.0 8.26, react-classes-v19.0.0 8.08 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 06_remove-one-1k | x vanilla | 0.94 | solid-v1.9.3 1.01, svelte-v5.42.1 1.04, react-hooks-v19.2.0 1.12, react-compiler-hooks-v19.0.0 1.19, react-classes-v19.0.0 1.14 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 07_create10k | x vanilla | 1.04 | solid-v1.9.3 1.07, svelte-v5.42.1 1.09, react-hooks-v19.2.0 1.88, react-compiler-hooks-v19.0.0 2.03, react-classes-v19.0.0 2.02 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 08_create1k-after1k_x2 | x vanilla | 1.05 | solid-v1.9.3 1.05, svelte-v5.42.1 1.06, react-hooks-v19.2.0 1.24, react-compiler-hooks-v19.0.0 1.25, react-classes-v19.0.0 1.25 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 09_clear1k_x8 | x vanilla | 1.05 | solid-v1.9.3 1.22, svelte-v5.42.1 1.20, react-hooks-v19.2.0 2.02, react-compiler-hooks-v19.0.0 2.02, react-classes-v19.0.0 2.00 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest local_append1k-to10k | x vanilla | 1.06 | – | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 21_ready-memory | x vanilla | 1.11 | solid-v1.9.3 1.25, svelte-v5.42.1 1.40, react-hooks-v19.2.0 2.48, react-compiler-hooks-v19.0.0 2.31, react-classes-v19.0.0 2.35 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 22_run-memory | x vanilla | 1.34 | solid-v1.9.3 1.43, svelte-v5.42.1 1.54, react-hooks-v19.2.0 2.34, react-compiler-hooks-v19.0.0 2.45, react-classes-v19.0.0 2.42 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 25_run-clear-memory | x vanilla | 1.26 | solid-v1.9.3 1.33, svelte-v5.42.1 1.62, react-hooks-v19.2.0 3.41, react-compiler-hooks-v19.0.0 3.36, react-classes-v19.0.0 3.26 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 26_run-10k-memory | x vanilla | 1.41 | – | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest local_clear-memory | x vanilla | 1.19 | – | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 41_size-uncompressed | kB | 26.0 | solid-v1.9.3 11.5, svelte-v5.42.1 26.6, react-hooks-v19.2.0 190.3, react-compiler-hooks-v19.0.0 183.0, react-classes-v19.0.0 184.6 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 42_size-compressed | kB | 8.96 | solid-v1.9.3 4.50, svelte-v5.42.1 9.70, react-hooks-v19.2.0 51.4, react-compiler-hooks-v19.0.0 50.0, react-classes-v19.0.0 50.2 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 43_first-paint | x vanilla | 0.75 | solid-v1.9.3 0.96, svelte-v5.42.1 1.33, react-hooks-v19.2.0 4.21, react-compiler-hooks-v19.0.0 4.09, react-classes-v19.0.0 4.15 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest startup_ready | x vanilla | 1.08 | – | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest startup_consistentlyInteractive | x vanilla | 1.08 | – | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest startup_scriptBootup | x vanilla | 2.02 | – | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest startup_totalBytes | x vanilla | 4.20 | – | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 01_run1k script above vanilla | ms | 0.36 | solid-v1.9.3 0.97, svelte-v5.42.1 1.56, react-hooks-v19.2.0 4.28, react-compiler-hooks-v19.0.0 4.38, react-classes-v19.0.0 4.87 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 02_replace1k script above vanilla | ms | 1.14 | solid-v1.9.3 1.68, svelte-v5.42.1 2.73, react-hooks-v19.2.0 8.61, react-compiler-hooks-v19.0.0 8.09, react-classes-v19.0.0 7.67 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 03_update10th1k_x16 script above vanilla | ms | 0.56 | solid-v1.9.3 0.59, svelte-v5.42.1 0.98, react-hooks-v19.2.0 7.88, react-compiler-hooks-v19.0.0 7.88, react-classes-v19.0.0 5.32 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 04_select1k script above vanilla | ms | 0.55 | solid-v1.9.3 1.84, svelte-v5.42.1 5.74, react-hooks-v19.2.0 6.65, react-compiler-hooks-v19.0.0 9.64, react-classes-v19.0.0 6.19 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 05_swap1k script above vanilla | ms | 0.84 | solid-v1.9.3 1.87, svelte-v5.42.1 2.91, react-hooks-v19.2.0 37.6, react-compiler-hooks-v19.0.0 41.1, react-classes-v19.0.0 36.4 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 06_remove-one-1k script above vanilla | ms | 0.34 | solid-v1.9.3 -0.16, svelte-v5.42.1 0.16, react-hooks-v19.2.0 1.28, react-compiler-hooks-v19.0.0 2.25, react-classes-v19.0.0 1.45 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 07_create10k script above vanilla | ms | 7.18 | solid-v1.9.3 6.73, svelte-v5.42.1 9.12, react-hooks-v19.2.0 184.8, react-compiler-hooks-v19.0.0 218.2, react-classes-v19.0.0 218.7 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 08_create1k-after1k_x2 script above vanilla | ms | 1.22 | solid-v1.9.3 1.20, svelte-v5.42.1 1.42, react-hooks-v19.2.0 5.68, react-compiler-hooks-v19.0.0 6.01, react-classes-v19.0.0 6.12 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 09_clear1k_x8 script above vanilla | ms | 0.41 | solid-v1.9.3 2.69, svelte-v5.42.1 2.69, react-hooks-v19.2.0 12.8, react-compiler-hooks-v19.0.0 12.6, react-classes-v19.0.0 12.5 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 21_ready-memory heap above vanilla | MB | 0.11 | solid-v1.9.3 0.12, svelte-v5.42.1 0.19, react-hooks-v19.2.0 0.71, react-compiler-hooks-v19.0.0 0.63, react-classes-v19.0.0 0.65 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 22_run-memory heap above vanilla | MB | 0.78 | solid-v1.9.3 0.81, svelte-v5.42.1 1.01, react-hooks-v19.2.0 2.50, react-compiler-hooks-v19.0.0 2.71, react-classes-v19.0.0 2.65 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 25_run-clear-memory heap above vanilla | MB | 0.30 | solid-v1.9.3 0.19, svelte-v5.42.1 0.36, react-hooks-v19.2.0 1.40, react-compiler-hooks-v19.0.0 1.37, react-classes-v19.0.0 1.31 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest 26_run-10k-memory heap above vanilla | MB | 5.37 | – | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest local_clear-memory heap above vanilla | MB | 0.21 | – | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| krausest CPU weighted geomean | x vanilla | 1.03 | solid-v1.9.3 1.08, svelte-v5.42.1 1.13, react-hooks-v19.2.0 1.53, react-compiler-hooks-v19.0.0 1.58, react-classes-v19.0.0 1.53 | n/a (browser drift: published 154.0.8037.98, this run 156.0.8078.80) |  |  |
| resume slow click (to paint) | ms | 30.3 (26.3–31.4) | Qwik 2.0.0-rc.0 32.6 (31.7–46.6), Qwik 1.20.1 32.9 (31.3–33.8), Solid 2.0.0-rc.13 53.4 (35.2–70.7), Solid 1.9.15 51.0 (39.4–66.8) | n/a (browser drift: competitors 155.0.8059.84, this run 156.0.8078.80) |  |  |
| resume slow filter (to paint) | ms | 71.8 (59.7–73.6) | Qwik 2.0.0-rc.0 159.8 (129.2–179.0), Qwik 1.20.1 144.1 (114.0–165.7), Solid 2.0.0-rc.13 87.0 (61.8–90.2), Solid 1.9.15 89.4 (73.2–111.5) | n/a (browser drift: competitors 155.0.8059.84, this run 156.0.8078.80) |  |  |
| resume slow navigate (to paint) | ms | 35.5 (34.3–38.9) | Qwik 2.0.0-rc.0 57.6 (54.8–106.7), Qwik 1.20.1 42.3 (38.9–45.6), Solid 2.0.0-rc.13 188.3 (185.6–193.1), Solid 1.9.15 182.6 (176.8–187.3) | n/a (browser drift: competitors 155.0.8059.84, this run 156.0.8078.80) |  |  |

Notes: real = apps/resume-bench/real-pages (all lanes same run, fresh context per sample, rotating lane order); dom = apps/dom-bench (5k rows = 285k elements, 50k reactive fields; Chromium bundled with Playwright; mount = warm-up cycle, forced GC (heap baseline), one unforced re-warm cycle, one macrotask, timed mount; wrapper-free page checks — protocol nowrap-2026-11-06); krausest = ratios to vanillajs (local Rivet/local vanilla vs published framework/vanillajs, Chrome 154), sizes absolute kB; resume = Slow 4G + 4x CPU, input → paint of the update; ssr = c1 closed loop, rivet-compiled vs static peers (Razor, Solid 1 hydratable:false), rivet-resume vs hydratable/resumable peers (Solid, Qwik), same generator/window/GC profile. Methodology: apps/dom-bench/README.md.
