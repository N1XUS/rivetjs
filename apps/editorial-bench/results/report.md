# Editorial benchmark — generated report

Generated 2026-10-11T15:44:20.773Z by `apps/editorial-bench/run.ts` (raw data: results.json). Host: Apple M4 Pro, 14 CPUs, 48 GB, darwin, Node v26.5.1.

## Versions

| Lane | Packages |
| --- | --- |
| rivet | marked 18.1.0, vite 8.3.2, @rivetjs/* workspace (d9f3852e) |
| astro | astro 7.3.8, marked 18.1.0 |
| eleventy | @11ty/eleventy 3.1.6, marked 18.1.0 |
| hugo | hugo-extended 0.167.0, hugo v0.167.0-3fff6fb5c267dacb26280c78dbe8c344054249c8+extended |
| next | marked 18.1.0, next 16.4.0, react 19.3.0, react-dom 19.3.0 |
| sveltekit | @sveltejs/adapter-static 4.0.0, @sveltejs/kit 3.0.1, @sveltejs/vite-plugin-svelte 7.3.1, marked 18.1.0, svelte 5.57.2, vite 8.3.4 |

## Build (wall s and peak process-tree RSS MB; median (min–max) of valid runs)

| Lane | N=100 s | N=1000 s | N=5000 s | N=100 MB | N=1000 MB | N=5000 MB |
| --- | --- | --- | --- | --- | --- | --- |
| rivet | 0.75 (0.73–0.79) | 2.00 (1.86–2.15) | 8.31 (6.19–8.51) | 218 (215–218) | 215 (208–233) | 236 (233–259) |
| astro | 0.75 (0.75–0.77) | 1.49 (1.39–2.19) | 5.46 (3.82–6.35) | 356 (356–357) | 543 (539–546) | 1089 (1083–1276) |
| eleventy | 0.39 (0.35–0.45) | 1.39 (1.18–1.65) | 7.06 (5.69–7.34) | 141 (138–141) | 228 (216–229) | 435 (434–439) |
| hugo | 0.11 (0.11–0.13) | 0.48 (0.45–0.50) | 2.96 (1.55–3.02) | 67 (67–68) | 150 (148–151) | 553 (552–555) |
| next | 2.30 (2.14–2.40) | over-cap | over-cap | 2328 (2287–2335) | over-cap | over-cap |
| sveltekit | 1.46 (1.45–1.56) | 3.40 (3.20–3.68) | 12.36 (8.24–13.11) | 472 (469–472) | 547 (525–549) | 776 (773–779) |

1-min load at sample start: 7.3–22.8 (void above 8).

## Output, N=100

| Lane | total MB | files | JS files | article HTML raw B | article HTML br B | article inline JS B | article inline data B | article referenced JS files / raw B / br B | index raw B | content parity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rivet | 3.05 | 304 | 22 | 13128.5 | 4848 | 4693 | 822 | 5 / 65281 / 24196 | 13982 | reference |
| astro | 0.98 | 142 | 0 | 6939 | 1976.5 | 0 | 0 | 0 / 0 / 0 | 7794 | 20/20 article texts equal rivet |
| eleventy | 0.99 | 142 | 0 | 6941 | 1987.5 | 0 | 0 | 0 / 0 / 0 | 7797 | 20/20 article texts equal rivet |
| hugo | 0.99 | 143 | 0 | 6940 | 1981.5 | 0 | 0 | 0 / 0 / 0 | 7844 | 20/20 article texts equal rivet |
| next | 8.42 | 706 | 9 | 21978 | 4286.5 | 14220 | 0 | 6 / 568937 / 150249 | 25651 | 20/20 article texts equal rivet |
| sveltekit | 3.06 | 297 | 17 | 15527 | 3182 | 7558 | 0 | 9 / 90577 / 31831 | 15390 | 20/20 article texts equal rivet |

## Output, N=1000

| Lane | total MB | files | JS files | article HTML raw B | article HTML br B | article inline JS B | article inline data B | article referenced JS files / raw B / br B | index raw B | content parity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rivet | 25.42 | 2194 | 22 | 13770 | 5003 | 4693 | 822 | 5 / 65281 / 24196 | 13983 | reference |
| astro | 8.16 | 1087 | 0 | 7581.5 | 2125 | 0 | 0 | 0 / 0 / 0 | 7795 | 20/20 article texts equal rivet |
| eleventy | 8.17 | 1087 | 0 | 7583.5 | 2127.5 | 0 | 0 | 0 / 0 / 0 | 7798 | 20/20 article texts equal rivet |
| hugo | 8.17 | 1088 | 0 | 7582.5 | 2127 | 0 | 0 | 0 / 0 / 0 | 7845 | 20/20 article texts equal rivet |
| sveltekit | 26.24 | 2187 | 17 | 16895 | 3362 | 8255 | 0 | 9 / 90577 / 31831 | 15394 | 20/20 article texts equal rivet |

## Output, N=5000

| Lane | total MB | files | JS files | article HTML raw B | article HTML br B | article inline JS B | article inline data B | article referenced JS files / raw B / br B | index raw B | content parity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rivet | 121.25 | 10594 | 22 | 12934 | 4817.5 | 4693 | 822 | 5 / 65281 / 24196 | 13984 | reference |
| astro | 38.17 | 5287 | 0 | 6742 | 1941 | 0 | 0 | 0 / 0 / 0 | 7796 | 20/20 article texts equal rivet |
| eleventy | 38.18 | 5287 | 0 | 6744 | 1944 | 0 | 0 | 0 / 0 / 0 | 7799 | 20/20 article texts equal rivet |
| hugo | 38.19 | 5288 | 0 | 6743 | 1943.5 | 0 | 0 | 0 / 0 / 0 | 7846 | 20/20 article texts equal rivet |
| sveltekit | 123.99 | 10587 | 17 | 15157.5 | 3115.5 | 7385.5 | 0 | 9 / 90577 / 31831 | 15394 | 20/20 article texts equal rivet |

## Browser, N=1000 (shared static server, gzip)

| Lane | JS loaded (req / decoded B / transfer B) | all requests / transfer B | LH article score | LCP ms | FCP ms | TBT ms | CLS | DOM elements (LH / document) | LH index score | index LCP ms | Fast 3G + 4× DCL ms | load ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rivet | 5 / 65281 / 29135 | 9 / 69044 | 100 (100–100) | 1203 (1203–1211) | 752 (752–759) | 0 (0–0) | 0.000 (0.000–0.000) | 109 / 116 | 100 (100–100) | 1203 (1202–1203) | 1222 (1211–1239) | 1336 (1335–1344) |
| astro | 0 / 0 / 0 | 4 / 36660 | 100 (100–100) | 1052 (1051–1052) | 752 (751–752) | 0 (0–0) | 0.000 (0.000–0.000) | 101 / 107 | 100 (100–100) | 901 (901–902) | 597 (596–614) | 1345 (1344–1361) |
| eleventy | 0 / 0 / 0 | 4 / 36662 | 100 (100–100) | 1052 (1051–1052) | 752 (751–752) | 0 (0–0) | 0.000 (0.000–0.000) | 101 / 107 | 100 (100–100) | 902 (901–902) | 589 (588–597) | 1328 (1327–1335) |
| hugo | 0 / 0 / 0 | 4 / 36661 | 100 (100–100) | 1052 (1051–1052) | 752 (751–752) | 0 (0–0) | 0.000 (0.000–0.000) | 101 / 107 | 100 (100–100) | 902 (902–902) | 589 (589–589) | 1328 (1328–1337) |
| sveltekit | 10 / 90899 / 40401 | 14 / 78769 | 100 (100–100) | 1504 (1503–1505) | 1428 (1427–1428) | 0 (0–0) | 0.000 (0.000–0.000) | 104 / 120 | 100 (100–100) | 1503 (1503–1503) | 1205 (1198–1226) | 2083 (2082–2091) |

Load at start per lane: rivet 7.8/7.0, astro 7.9/7.6, eleventy 7.5/8.3, hugo 6.6/22.3, sveltekit 7.9/8.7 (start/end).

## Dynamic vs static serving, N=1000 (closed loop over 20 article URLs, keep-alive, identity encoding; CPU = server process ps time delta; 10 s per level, 3 rounds)

| Target | c1 p50 ms | c1 TTFB p50 ms | c1 CPU ms/req | c10 rps | c10 p50 ms | c10 p99 ms | c10 CPU ms/req | bytes/req | errors |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rivet-dynamic | 0.28 (0.27–0.29) | 0.28 (0.27–0.29) | 0.294 (0.275–0.304) | 4156 (3848–4249) | 2.07 (2.05–2.26) | 5.13 (4.88–5.60) | 0.266 (0.261–0.286) | 13479 | 0 |
| static:rivet | 0.09 (0.09–0.09) | 0.08 (0.08–0.08) | 0.092 (0.092–0.093) | 27261 (26332–27301) | 0.35 (0.34–0.35) | 0.98 (0.98–1.01) | 0.077 (0.076–0.080) | 13558 | 0 |
| static:hugo | 0.09 (0.08–0.09) | 0.08 (0.08–0.08) | 0.086 (0.085–0.088) | 28035 (27235–28510) | 0.34 (0.34–0.35) | 0.63 (0.62–0.73) | 0.074 (0.072–0.076) | 7369 | 0 |

## Verdict (rivet vs lane; ≥ 1.1× = WIN/LOSE, ratio = worse/better)

| Metric | astro | eleventy | hugo | next | sveltekit |
| --- | --- | --- | --- | --- | --- |
| build s N=100 | TIE 1.00× | LOSE 1.91× | LOSE 6.76× | WIN 3.07× | WIN 1.94× |
| build peak MB N=100 | WIN 1.64× | LOSE 1.55× | LOSE 3.23× | WIN 10.69× | WIN 2.17× |
| build s N=1000 | LOSE 1.34× | LOSE 1.44× | LOSE 4.19× | – | WIN 1.70× |
| build peak MB N=1000 | WIN 2.53× | TIE 1.06× | LOSE 1.44× | – | WIN 2.55× |
| build s N=5000 | LOSE 1.52× | LOSE 1.18× | LOSE 2.81× | – | WIN 1.49× |
| build peak MB N=5000 | WIN 4.62× | WIN 1.84× | WIN 2.35× | – | WIN 3.29× |
| output MB N=1000 | LOSE 3.11× | LOSE 3.11× | LOSE 3.11× | – | TIE 1.03× |
| files N=1000 | LOSE 2.02× | LOSE 2.02× | LOSE 2.02× | – | TIE 1.00× |
| article HTML raw B | LOSE 1.82× | LOSE 1.82× | LOSE 1.82× | – | WIN 1.23× |
| article HTML br B | LOSE 2.35× | LOSE 2.35× | LOSE 2.35× | – | LOSE 1.49× |
| article JS decoded B (loaded) | LOSE (other 0) | LOSE (other 0) | LOSE (other 0) | – | WIN 1.39× |
| article transfer B (all) | LOSE 1.88× | LOSE 1.88× | LOSE 1.88× | – | WIN 1.14× |
| LH article score | TIE 1.00× | TIE 1.00× | TIE 1.00× | – | TIE 1.00× |
| LH article LCP ms | LOSE 1.14× | LOSE 1.14× | LOSE 1.14× | – | WIN 1.25× |
| LH article FCP ms | TIE 1.00× | TIE 1.00× | TIE 1.00× | – | WIN 1.90× |
| LH article TBT ms | TIE (both ~0) | TIE (both ~0) | TIE (both ~0) | – | TIE (both ~0) |
| LH article CLS | TIE (both ~0) | TIE (both ~0) | TIE (both ~0) | – | TIE (both ~0) |
| article DOM elements | TIE 1.08× | TIE 1.08× | TIE 1.08× | – | TIE 1.03× |
| LH index LCP ms | LOSE 1.33× | LOSE 1.33× | LOSE 1.33× | – | WIN 1.25× |
| Fast 3G + 4× DCL ms | LOSE 2.05× | LOSE 2.07× | LOSE 2.07× | – | TIE 1.01× |
| Fast 3G + 4× load ms | TIE 1.01× | TIE 1.01× | TIE 1.01× | – | WIN 1.56× |
