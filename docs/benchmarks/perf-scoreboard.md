# Perf scoreboard

- Run: 2026-10-09T10:48:17.552Z → 2026-10-09T11:06:14.112Z — perf/ssr-beat-razor @ ea064b55, clean HEAD snapshot (git archive + linked node_modules)
- Measured: ? @ ? (../../../../../private/tmp/claude-501/-Users-denisseverin-Projects-claude-test-rivet/d5c17ad1-df18-48dc-b37c-7b09decaac8e/scratchpad/bench-docs/head-ea064b55); Rivet only, competitors from apps/dom-bench/competitors.json and krausest/published.json
- Totals: 26 WIN / 10 TIE / 25 LOSE / 9 n/a. WIN = Rivet ≥3% better than every listed competitor with non-overlapping trial ranges (where both have ranges); LOSE = the same in reverse vs any; otherwise TIE. Values: median (min–max).
- Browsers: krausest {"measured":"154.0.8037.98","reference":"154.0.8037.98","drift":"same"}; resume {"measured":"154.0.8037.98","reference":"154.0.8037.98","drift":"same"}
- Raw: .artifacts/perf-night/scoreboard/2026-10-09T10-48-17-547Z.json

| scenario | unit | Rivet | competitors | verdict | loses to | ties with |
|---|---|---|---|---|---|---|
| krausest 01_run1k | x vanilla | 1.06 | solid-v1.9.3 1.05, svelte-v5.42.1 1.07, react-hooks-v19.2.0 1.15, react-compiler-hooks-v19.0.0 1.17, react-classes-v19.0.0 1.18 | TIE |  | solid-v1.9.3, svelte-v5.42.1 |
| krausest 02_replace1k | x vanilla | 1.06 | solid-v1.9.3 1.08, svelte-v5.42.1 1.13, react-hooks-v19.2.0 1.37, react-compiler-hooks-v19.0.0 1.35, react-classes-v19.0.0 1.33 | TIE |  | solid-v1.9.3 |
| krausest 03_update10th1k_x16 | x vanilla | 1.03 | solid-v1.9.3 1.07, svelte-v5.42.1 1.12, react-hooks-v19.2.0 1.52, react-compiler-hooks-v19.0.0 1.54, react-classes-v19.0.0 1.39 | WIN |  |  |
| krausest 04_select1k | x vanilla | 1.01 | solid-v1.9.3 1.28, svelte-v5.42.1 2.00, react-hooks-v19.2.0 2.16, react-compiler-hooks-v19.0.0 2.80, react-classes-v19.0.0 2.08 | WIN |  |  |
| krausest 05_swap1k | x vanilla | 0.98 | solid-v1.9.3 1.14, svelte-v5.42.1 1.18, react-hooks-v19.2.0 8.15, react-compiler-hooks-v19.0.0 8.26, react-classes-v19.0.0 8.08 | WIN |  |  |
| krausest 06_remove-one-1k | x vanilla | 1.05 | solid-v1.9.3 1.01, svelte-v5.42.1 1.04, react-hooks-v19.2.0 1.12, react-compiler-hooks-v19.0.0 1.19, react-classes-v19.0.0 1.14 | LOSE | solid-v1.9.3 | svelte-v5.42.1 |
| krausest 07_create10k | x vanilla | 1.02 | solid-v1.9.3 1.07, svelte-v5.42.1 1.09, react-hooks-v19.2.0 1.88, react-compiler-hooks-v19.0.0 2.03, react-classes-v19.0.0 2.02 | WIN |  |  |
| krausest 08_create1k-after1k_x2 | x vanilla | 1.05 | solid-v1.9.3 1.05, svelte-v5.42.1 1.06, react-hooks-v19.2.0 1.24, react-compiler-hooks-v19.0.0 1.25, react-classes-v19.0.0 1.25 | TIE |  | solid-v1.9.3, svelte-v5.42.1 |
| krausest 09_clear1k_x8 | x vanilla | 1.12 | solid-v1.9.3 1.22, svelte-v5.42.1 1.20, react-hooks-v19.2.0 2.02, react-compiler-hooks-v19.0.0 2.02, react-classes-v19.0.0 2.00 | WIN |  |  |
| krausest local_append1k-to10k | x vanilla | 0.99 | – | n/a |  |  |
| krausest 21_ready-memory | x vanilla | 1.21 | solid-v1.9.3 1.25, svelte-v5.42.1 1.40, react-hooks-v19.2.0 2.48, react-compiler-hooks-v19.0.0 2.31, react-classes-v19.0.0 2.35 | WIN |  |  |
| krausest 22_run-memory | x vanilla | 1.38 | solid-v1.9.3 1.43, svelte-v5.42.1 1.54, react-hooks-v19.2.0 2.34, react-compiler-hooks-v19.0.0 2.45, react-classes-v19.0.0 2.42 | WIN |  |  |
| krausest 25_run-clear-memory | x vanilla | 1.23 | solid-v1.9.3 1.33, svelte-v5.42.1 1.62, react-hooks-v19.2.0 3.41, react-compiler-hooks-v19.0.0 3.36, react-classes-v19.0.0 3.26 | WIN |  |  |
| krausest 26_run-10k-memory | x vanilla | 1.42 | – | n/a |  |  |
| krausest local_clear-memory | x vanilla | 1.16 | – | n/a |  |  |
| krausest 41_size-uncompressed | kB | 23.7 | solid-v1.9.3 11.5, svelte-v5.42.1 26.6, react-hooks-v19.2.0 190.3, react-compiler-hooks-v19.0.0 183.0, react-classes-v19.0.0 184.6 | LOSE | solid-v1.9.3 |  |
| krausest 42_size-compressed | kB | 8.25 | solid-v1.9.3 4.50, svelte-v5.42.1 9.70, react-hooks-v19.2.0 51.4, react-compiler-hooks-v19.0.0 50.0, react-classes-v19.0.0 50.2 | LOSE | solid-v1.9.3 |  |
| krausest 43_first-paint | x vanilla | 1.18 | solid-v1.9.3 0.96, svelte-v5.42.1 1.33, react-hooks-v19.2.0 4.21, react-compiler-hooks-v19.0.0 4.09, react-classes-v19.0.0 4.15 | LOSE | solid-v1.9.3 |  |
| krausest startup_ready | x vanilla | 1.04 | – | n/a |  |  |
| krausest startup_consistentlyInteractive | x vanilla | 0.96 | – | n/a |  |  |
| krausest startup_scriptBootup | x vanilla | 1.97 | – | n/a |  |  |
| krausest startup_totalBytes | x vanilla | 3.87 | – | n/a |  |  |
| krausest 01_run1k script above vanilla | ms | 0.90 | solid-v1.9.3 1.03, svelte-v5.42.1 1.65, react-hooks-v19.2.0 4.55, react-compiler-hooks-v19.0.0 4.65, react-classes-v19.0.0 5.17 | WIN |  |  |
| krausest 02_replace1k script above vanilla | ms | 1.28 | solid-v1.9.3 1.77, svelte-v5.42.1 2.88, react-hooks-v19.2.0 9.08, react-compiler-hooks-v19.0.0 8.53, react-classes-v19.0.0 8.09 | WIN |  |  |
| krausest 03_update10th1k_x16 script above vanilla | ms | 0.75 | solid-v1.9.3 0.70, svelte-v5.42.1 1.16, react-hooks-v19.2.0 9.29, react-compiler-hooks-v19.0.0 9.29, react-classes-v19.0.0 6.27 | LOSE | solid-v1.9.3 |  |
| krausest 04_select1k script above vanilla | ms | 0.42 | solid-v1.9.3 2.26, svelte-v5.42.1 7.06, react-hooks-v19.2.0 8.19, react-compiler-hooks-v19.0.0 11.9, react-classes-v19.0.0 7.62 | WIN |  |  |
| krausest 05_swap1k script above vanilla | ms | 0.66 | solid-v1.9.3 2.06, svelte-v5.42.1 3.21, react-hooks-v19.2.0 41.5, react-compiler-hooks-v19.0.0 45.4, react-classes-v19.0.0 40.1 | WIN |  |  |
| krausest 06_remove-one-1k script above vanilla | ms | 0.39 | solid-v1.9.3 -0.16, svelte-v5.42.1 0.16, react-hooks-v19.2.0 1.27, react-compiler-hooks-v19.0.0 2.23, react-classes-v19.0.0 1.43 | LOSE | solid-v1.9.3, svelte-v5.42.1 |  |
| krausest 07_create10k script above vanilla | ms | 7.59 | solid-v1.9.3 6.92, svelte-v5.42.1 9.38, react-hooks-v19.2.0 190.0, react-compiler-hooks-v19.0.0 224.3, react-classes-v19.0.0 224.9 | LOSE | solid-v1.9.3 |  |
| krausest 08_create1k-after1k_x2 script above vanilla | ms | 1.29 | solid-v1.9.3 1.26, svelte-v5.42.1 1.49, react-hooks-v19.2.0 5.96, react-compiler-hooks-v19.0.0 6.31, react-classes-v19.0.0 6.42 | TIE |  | solid-v1.9.3 |
| krausest 09_clear1k_x8 script above vanilla | ms | 1.18 | solid-v1.9.3 2.64, svelte-v5.42.1 2.64, react-hooks-v19.2.0 12.5, react-compiler-hooks-v19.0.0 12.4, react-classes-v19.0.0 12.2 | WIN |  |  |
| krausest 21_ready-memory heap above vanilla | MB | 0.19 | solid-v1.9.3 0.12, svelte-v5.42.1 0.19, react-hooks-v19.2.0 0.71, react-compiler-hooks-v19.0.0 0.63, react-classes-v19.0.0 0.65 | LOSE | solid-v1.9.3 | svelte-v5.42.1 |
| krausest 22_run-memory heap above vanilla | MB | 0.82 | solid-v1.9.3 0.81, svelte-v5.42.1 1.01, react-hooks-v19.2.0 2.50, react-compiler-hooks-v19.0.0 2.71, react-classes-v19.0.0 2.65 | TIE |  | solid-v1.9.3 |
| krausest 25_run-clear-memory heap above vanilla | MB | 0.27 | solid-v1.9.3 0.19, svelte-v5.42.1 0.36, react-hooks-v19.2.0 1.40, react-compiler-hooks-v19.0.0 1.37, react-classes-v19.0.0 1.31 | LOSE | solid-v1.9.3 |  |
| krausest 26_run-10k-memory heap above vanilla | MB | 5.47 | – | n/a |  |  |
| krausest local_clear-memory heap above vanilla | MB | 0.18 | – | n/a |  |  |
| krausest CPU weighted geomean | x vanilla | 1.05 | solid-v1.9.3 1.08, svelte-v5.42.1 1.13, react-hooks-v19.2.0 1.53, react-compiler-hooks-v19.0.0 1.58, react-classes-v19.0.0 1.53 | WIN |  |  |
| resume slow click (to paint) | ms | 31.7 (31.5–32.6) | qwik 32.9 (31.8–34.0), Solid 2.0.0-rc.13 58.2 (40.9–66.5), qwik-stable 32.4 (30.7–34.6), Solid 1.9.15 49.3 (44.4–70.1) | TIE |  | qwik, qwik-stable |
| resume slow filter (to paint) | ms | 108.0 (98.7–120.1) | qwik 166.8 (145.7–188.6), Solid 2.0.0-rc.13 89.4 (73.2–108.2), qwik-stable 160.7 (140.7–180.3), Solid 1.9.15 90.2 (88.7–105.2) | TIE |  | Solid 2.0.0-rc.13, Solid 1.9.15 |
| resume slow navigate (to paint) | ms | 38.6 (37.6–54.9) | qwik 114.9 (56.1–133.3), Solid 2.0.0-rc.13 194.1 (188.5–205.1), qwik-stable 89.7 (75.7–118.5), Solid 1.9.15 192.4 (185.4–196.8) | WIN |  |  |
| ssr c1 100 rows rivet-compiled rps | req/s ↑ | 1,556 (1,456–1,812) | Razor (.NET 10) 2,173 (1,756–2,196), solid-stable-static 2,533 (2,364–2,693) | LOSE | solid-stable-static | Razor (.NET 10) |
| ssr c1 100 rows rivet-compiled p50_ms | ms | 0.46 (0.39–0.46) | Razor (.NET 10) 0.40 (0.40–0.44), solid-stable-static 0.33 (0.29–0.33) | LOSE | solid-stable-static | Razor (.NET 10) |
| ssr c1 100 rows rivet-compiled p99_ms | ms | 2.72 (2.58–3.40) | Razor (.NET 10) 1.19 (1.14–1.64), solid-stable-static 1.72 (1.26–1.72) | LOSE | Razor (.NET 10), solid-stable-static |  |
| ssr c1 100 rows rivet-compiled cpu_ms | ms | 0.30 (0.26–0.36) | Razor (.NET 10) 0.38 (0.36–0.49), solid-stable-static 0.23 (0.23–0.26) | LOSE | solid-stable-static |  |
| ssr c1 100 rows rivet-compiled peak_mib | MiB | 60.7 (60.0–62.4) | Razor (.NET 10) 113.8 (113.6–114.2), solid-stable-static 78.9 (78.3–80.5) | WIN |  |  |
| ssr c1 100 rows rivet-resume rps | req/s ↑ | 586 (472–677) | solid-stable-interactive 340 (336–395), Solid 1.9.15 323 (308–368), Solid 2.0.0-rc.13 1,425 (1,350–1,610), qwik-stable 220 (210–231), qwik 125 (117–130) | LOSE | Solid 2.0.0-rc.13 |  |
| ssr c1 100 rows rivet-resume p50_ms | ms | 1.32 (1.10–1.60) | solid-stable-interactive 2.89 (2.65–2.94), Solid 1.9.15 3.02 (2.78–3.23), Solid 2.0.0-rc.13 0.54 (0.47–0.55), qwik-stable 3.21 (3.04–3.37), qwik 7.88 (7.56–8.26) | LOSE | Solid 2.0.0-rc.13 |  |
| ssr c1 100 rows rivet-resume p99_ms | ms | 6.30 (5.91–8.73) | solid-stable-interactive 4.95 (4.37–5.09), Solid 1.9.15 5.04 (4.74–5.21), Solid 2.0.0-rc.13 3.21 (3.01–3.43), qwik-stable 15.6 (14.8–16.0), qwik 13.1 (12.6–17.8) | LOSE | solid-stable-interactive, Solid 1.9.15, Solid 2.0.0-rc.13 |  |
| ssr c1 100 rows rivet-resume cpu_ms | ms | 1.19 (1.12–1.46) | solid-stable-interactive 1.07 (0.93–1.10), Solid 1.9.15 0.78 (0.74–0.90), Solid 2.0.0-rc.13 0.61 (0.53–0.63), qwik-stable 4.54 (4.31–4.75), qwik 7.94 (7.61–8.45) | LOSE | solid-stable-interactive, Solid 1.9.15, Solid 2.0.0-rc.13 |  |
| ssr c1 100 rows rivet-resume peak_mib | MiB | 121.8 (119.2–126.6) | solid-stable-interactive 86.3 (84.2–86.4), Solid 1.9.15 70.7 (70.6–71.0), Solid 2.0.0-rc.13 101.0 (100.7–103.2), qwik-stable 89.9 (89.4–104.1), qwik 140.2 (138.7–184.8) | LOSE | solid-stable-interactive, Solid 1.9.15, Solid 2.0.0-rc.13, qwik-stable |  |
| ssr c1 1000 rows rivet-compiled rps | req/s ↑ | 798 (713–1,071) | Razor (.NET 10) 557 (484–558), solid-stable-static 585 (544–592) | WIN |  |  |
| ssr c1 1000 rows rivet-compiled p50_ms | ms | 0.93 (0.76–1.08) | Razor (.NET 10) 1.48 (1.44–1.59), solid-stable-static 1.40 (1.39–1.46) | WIN |  |  |
| ssr c1 1000 rows rivet-compiled p99_ms | ms | 4.16 (2.48–4.51) | Razor (.NET 10) 5.92 (5.45–7.81), solid-stable-static 4.82 (4.63–5.36) | WIN |  |  |
| ssr c1 1000 rows rivet-compiled cpu_ms | ms | 0.65 (0.50–0.73) | Razor (.NET 10) 1.64 (1.58–1.87), solid-stable-static 1.34 (1.32–1.42) | WIN |  |  |
| ssr c1 1000 rows rivet-compiled peak_mib | MiB | 67.9 (66.1–68.0) | Razor (.NET 10) 122.1 (114.4–123.3), solid-stable-static 107.5 (106.6–110.2) | WIN |  |  |
| ssr c1 1000 rows rivet-resume rps | req/s ↑ | 232 (211–291) | solid-stable-interactive 143 (141–151), Solid 1.9.15 281 (265–282), Solid 2.0.0-rc.13 293 (284–308), qwik-stable 19 (16–20), qwik 12 (12–12) | TIE |  | Solid 1.9.15, Solid 2.0.0-rc.13 |
| ssr c1 1000 rows rivet-resume p50_ms | ms | 3.70 (3.07–4.10) | solid-stable-interactive 6.04 (5.94–6.24), Solid 1.9.15 3.34 (3.30–3.55), Solid 2.0.0-rc.13 2.59 (2.47–2.71), qwik-stable 52.6 (50.4–60.5), qwik 80.2 (79.3–82.0) | LOSE | Solid 2.0.0-rc.13 | Solid 1.9.15 |
| ssr c1 1000 rows rivet-resume p99_ms | ms | 10.2 (7.18–11.1) | solid-stable-interactive 13.4 (12.8–14.2), Solid 1.9.15 6.09 (5.88–6.78), Solid 2.0.0-rc.13 10.2 (9.90–10.3), qwik-stable 92.5 (84.5–94.3), qwik 109.2 (107.1–114.3) | LOSE | Solid 1.9.15 | Solid 2.0.0-rc.13 |
| ssr c1 1000 rows rivet-resume cpu_ms | ms | 3.69 (3.05–4.01) | solid-stable-interactive 6.37 (6.02–6.40), Solid 1.9.15 1.74 (1.71–1.92), Solid 2.0.0-rc.13 3.39 (3.23–3.51), qwik-stable 52.6 (51.2–61.9), qwik 81.8 (81.1–84.2) | LOSE | Solid 1.9.15 | Solid 2.0.0-rc.13 |
| ssr c1 1000 rows rivet-resume peak_mib | MiB | 135.9 (135.4–142.8) | solid-stable-interactive 142.4 (137.7–145.6), Solid 1.9.15 100.1 (98.1–100.5), Solid 2.0.0-rc.13 115.9 (115.1–117.0), qwik-stable 129.3 (128.7–129.4), qwik 242.6 (240.6–243.7) | LOSE | Solid 1.9.15, Solid 2.0.0-rc.13, qwik-stable | solid-stable-interactive |
| ssr c1 5000 rows rivet-compiled rps | req/s ↑ | 309 (281–313) | Razor (.NET 10) 87 (82–91), solid-stable-static 120 (110–130) | WIN |  |  |
| ssr c1 5000 rows rivet-compiled p50_ms | ms | 2.75 (2.68–2.95) | Razor (.NET 10) 6.71 (6.70–7.52), solid-stable-static 8.66 (7.77–9.13) | WIN |  |  |
| ssr c1 5000 rows rivet-compiled p99_ms | ms | 6.02 (5.81–7.48) | Razor (.NET 10) 31.5 (24.8–32.6), solid-stable-static 13.0 (12.2–17.5) | WIN |  |  |
| ssr c1 5000 rows rivet-compiled cpu_ms | ms | 1.94 (1.85–2.07) | Razor (.NET 10) 10.9 (9.97–11.4), solid-stable-static 7.29 (6.77–7.95) | WIN |  |  |
| ssr c1 5000 rows rivet-compiled peak_mib | MiB | 73.2 (72.6–73.3) | Razor (.NET 10) 142.1 (141.1–142.2), solid-stable-static 125.7 (124.0–126.5) | WIN |  |  |
| ssr c1 5000 rows rivet-resume rps | req/s ↑ | 58 (58–62) | solid-stable-interactive 26 (25–27), Solid 1.9.15 66 (63–67), Solid 2.0.0-rc.13 51 (48–51), qwik-stable 3 (3–3), qwik 2 (2–2) | LOSE | Solid 1.9.15 |  |
| ssr c1 5000 rows rivet-resume p50_ms | ms | 16.3 (15.3–16.4) | solid-stable-interactive 37.2 (36.5–39.1), Solid 1.9.15 13.5 (13.1–13.9), Solid 2.0.0-rc.13 17.9 (17.8–18.5), qwik-stable 293.5 (288.3–322.2), qwik 447.2 (438.1–480.5) | LOSE | Solid 1.9.15 |  |
| ssr c1 5000 rows rivet-resume p99_ms | ms | 27.4 (27.3–28.4) | solid-stable-interactive 55.5 (52.1–62.0), Solid 1.9.15 26.6 (26.4–28.4), Solid 2.0.0-rc.13 35.9 (34.0–36.0), qwik-stable 357.9 (345.6–451.8), qwik 625.0 (607.1–639.8) | TIE |  | Solid 1.9.15 |
| ssr c1 5000 rows rivet-resume cpu_ms | ms | 16.4 (15.4–16.6) | solid-stable-interactive 36.7 (35.9–38.9), Solid 1.9.15 14.8 (14.5–15.6), Solid 2.0.0-rc.13 19.6 (19.6–20.6), qwik-stable 298.4 (288.8–325.3), qwik 465.8 (465.6–488.4) | TIE |  | Solid 1.9.15 |
| ssr c1 5000 rows rivet-resume peak_mib | MiB | 172.1 (165.3–177.6) | solid-stable-interactive 181.6 (181.3–181.6), Solid 1.9.15 132.8 (126.6–136.8), Solid 2.0.0-rc.13 139.3 (136.0–140.5), qwik-stable 247.0 (245.8–253.5), qwik 301.0 (300.5–308.3) | LOSE | Solid 1.9.15, Solid 2.0.0-rc.13 |  |

Notes: dom = apps/dom-bench (5k rows = 285k elements, 50k reactive fields; Chromium bundled with Playwright); krausest = ratios to vanillajs (local Rivet/local vanilla vs published framework/vanillajs, Chrome 154), sizes absolute kB; resume = Slow 4G + 4x CPU, input → paint of the update; ssr = c1 closed loop, rivet-compiled vs static peers (Razor, Solid 1 hydratable:false), rivet-resume vs hydratable/resumable peers (Solid, Qwik), same generator/window/GC profile. Methodology: apps/dom-bench/README.md.
