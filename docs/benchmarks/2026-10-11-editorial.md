# Editorial sites: Rivet vs Astro, Eleventy, Hugo, Next.js, SvelteKit (2026-10-11)

Question: is Rivet better than the editorial-site frameworks for an editorial website? Harness: `apps/editorial-bench` (README = method, fairness rules, deviations). Generated tables: `apps/editorial-bench/results/report.md`; raw data: `2026-10-11-editorial.json` (copy of `results/results.json`).

## Setup

- Same seeded site in every lane: N = 100 / 1000 / 5000 Markdown articles (3–6 KB bodies, 2 images, code block, lists, links), 20 per index page, 20 tag pages, 12 author pages, related rail of 4. Same markup, same 2.3 KB stylesheet, same 4 JPEGs, no fonts, no image pipeline, no prefetch. Visible text of 20 article pages per lane checked equal to Rivet's: 20/20 for every lane at every N measured.
- Markdown: marked 18.1.0 in every JS lane (Rivet: marked's token tree rendered as JSX, it has no raw-HTML sink); Hugo: Goldmark.
- Versions: Rivet workspace @ d9f3852e + the shared working tree (Vite 8.3.2, rolldown 1.2.12), Astro 7.3.8 (brief said Astro 5; 7.3.8 is current stable), Eleventy 3.1.6, Hugo 0.167.0 extended, Next.js 16.4.0 + React 19.3.0 (Turbopack), SvelteKit 3.0.1 + Svelte 5.57.2 + adapter-static 4.0.0.
- Host: Apple M4 Pro, 14 CPUs, 48 GB, macOS, Node 26.5.1. Shared agent host: builds ran when the 1-min load was ≤ 8 (one sample at 22.8 voided and repeated); end load includes the build itself. Lighthouse / navigation ran under the host bench lock, start load 6.6–7.9.
- Defaults kept per framework: Rivet static pages carried its resume loader, client router and a `_data.json` per page (until STATIC-ZERO-JS, below: now zero JS); Next ships React + RSC payloads; SvelteKit hydrates with inline data.

## Build (wall s, peak process-tree RSS MB; median of 3, min–max in report.md)

| Lane | N=100 s | N=1000 s | N=5000 s | N=100 MB | N=1000 MB | N=5000 MB |
| --- | --- | --- | --- | --- | --- | --- |
| rivet | 0.75 | 2.00 | 8.31 | 218 | 215 | 236 |
| astro | 0.75 | 1.49 | 5.46 | 356 | 543 | 1089 |
| eleventy | 0.39 | 1.39 | 7.06 | 141 | 228 | 435 |
| hugo | 0.11 | 0.48 | 2.96 | 67 | 150 | 553 |
| next (default workers) | 2.30 | over cap | over cap | 2328 | > 2800 | > 2800 |
| sveltekit | 1.46 | 3.40 | 12.36 | 472 | 547 | 776 |

- Next.js with its default worker count (CPUs − 1 = 13) exceeds the 2.8 GB build-tree cap at N = 1000 (killed at 2.74 GB) and N = 5000. Single unlocked probes at N = 5000 with `NEXT_CPUS` (`experimental.cpus`, lane config hook): 4 workers 2735 MB (still at the cap), 2 workers 11.4 s / 1931 MB, 1 worker 24.8 s / 1539 MB — i.e. even at 2 workers Next is slower (1.4×) and heavier (8.2×) than Rivet. The 3-run `next-cpus2` variant (`run.ts --as next-cpus2`) never got the host bench lock (load 13–18, lock held by another lane for > 1 h) and was abandoned; Next N = 1000 output / browser numbers are therefore missing.
- N = 5000 fit the RAM / time budget for every lane except default-worker Next.

## Output (N = 1000)

| Lane | total MB | files | article HTML raw B | article HTML br B | inline JS per article B | JS files referenced per article (raw / br B) |
| --- | --- | --- | --- | --- | --- | --- |
| rivet | 25.42 | 2194 | 13770 | 5003 | 4693 (+ 822 B state JSON) | 5 (65281 / 24196) |
| astro | 8.16 | 1087 | 7582 | 2125 | 0 | 0 |
| eleventy | 8.17 | 1087 | 7584 | 2128 | 0 | 0 |
| hugo | 8.17 | 1088 | 7583 | 2127 | 0 | 0 |
| sveltekit | 26.24 | 2187 | 16895 | 3362 | 8255 | 9 (90577 / 31831) |

- Rivet's extra bytes per article: the inline resume loader (4.7 KB), the state script (0.8 KB), range-marker comments, plus a `_data.json` sidecar per page (≈ 8 KB, the client router's navigation data) — 2× the files and 3.1× the bytes of Astro / Eleventy / Hugo. Same picture at N = 100 (3.05 vs 0.98 MB) and 5000 (121 vs 38 MB).
- Client JS bytes for the static lanes: Astro, Eleventy, Hugo 0. Non-zero: Rivet (inline 4.7 KB + 65 KB in 5 module files, fetched at low priority and booted on idle), SvelteKit (91 KB), Next (N = 100: 8.42 MB / 706 files total, article HTML 21978 B raw / 4286 B br, 14.2 KB inline RSC payload, 6 JS files 569 KB raw / 150 KB br; Rivet at N = 100: 3.05 MB / 304 files, 13129 / 4848 B).

## Browser (N = 1000, shared static server with gzip)

| Lane | JS loaded req / B | transfer B (all) | LH score | LH LCP ms | LH FCP ms | TBT | CLS | DOM elements | LH index LCP ms | Fast 3G + 4× DCL ms | load ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rivet | 5 / 65281 | 69044 | 100 | 1203 | 752 | 0 | 0 | 116 | 1203 | 1222 | 1336 |
| astro | 0 / 0 | 36660 | 100 | 1052 | 752 | 0 | 0 | 107 | 901 | 597 | 1345 |
| eleventy | 0 / 0 | 36662 | 100 | 1052 | 752 | 0 | 0 | 107 | 902 | 589 | 1328 |
| hugo | 0 / 0 | 36661 | 100 | 1052 | 752 | 0 | 0 | 107 | 902 | 589 | 1328 |
| sveltekit | 10 / 90899 | 78769 | 100 | 1504 | 1428 | 0 | 0 | 120 | 1503 | 1205 | 2083 |

- Lighthouse 13.5.0 mobile preset (simulated slow 4G + 4× CPU), 3 runs, medians; min–max spread ≤ 10 ms everywhere. Navigation: Playwright Chromium, cold cache, Fast 3G (562.5 ms RTT, 1.44 Mbit/s) + 4× CPU, 5 runs.
- Rivet's DCL is one round trip later than the zero-JS lanes: its loader is a parser-inserted classic inline `<script>` at the end of `<body>`, so the parser waits for `/site.css` before running it and DCL waits with it. `load` is equal (images + CSS dominate). LH LCP +150 ms (article) / +300 ms (index) comes from the extra HTML + modulepreload bytes in Lighthouse's simulation.

## After STATIC-ZERO-JS (2026-10-12, N = 1000)

Rivet static pages that resume nothing ship zero JS (router listeners + the routes region are `standalone: false` with `clientRouter` off, the static-mode default); no `_data.json` when no page resumes; `prerenderBuild` prunes unreferenced scripts. Same harness (`run.ts --phases output,serve`, lanes rebuilt from the same fixture; other lanes' builds unchanged). Browser phase under the bench lock, start load 5.6–7.6.

| Metric | rivet before | rivet after | astro | eleventy | hugo |
| --- | --- | --- | --- | --- | --- |
| total MB / files | 25.42 / 2194 | 8.20 / 1090 | 8.16 / 1087 | 8.17 / 1087 | 8.17 / 1088 |
| article HTML raw / br B | 13770 / 5003 | 7592 / 2139 | 7582 / 2125 | 7584 / 2128 | 7583 / 2127 |
| index / tag HTML br B | 4575 / 6199 | 1699 / 3298 | 1675 / 3270 | 1680 / 3278 | 1686 / 3274 |
| inline JS + state per article B | 4693 + 822 | 0 | 0 | 0 | 0 |
| JS loaded req / B | 5 / 65281 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| transfer B (all) | 69044 | 36682 | 36660 | 36662 | 36661 |
| LH article / index LCP ms | 1203 / 1203 | 1052 / 902 | 1052 / 902 | 1052 / 902 | 1052 / 902 |
| Fast 3G + 4× DCL / load ms | 1222 / 1336 | 597 / 1344 | 597 / 1344 | 596 / 1344 | 597 / 1345 |

- Every former LOSE on output / browser metrics vs Astro / Eleventy / Hugo is now a TIE (≤ 0.7 %). Remaining bytes: `<!doctype html>` case, the `<div data-rivet-routes>` wrapper + `<!--r0[-->` range markers (~45 B raw, ~14 B br per page) and 3 more files (`.vite/manifest.json`, `.vite/rivet-resume.json`, and `404.html` vs Astro's set).
- DCL halves (the end-of-body classic loader no longer waits for `/site.css`); LCP matches because the HTML + modulepreload bytes are gone from Lighthouse's simulation.

## Dynamic vs static serving (N = 1000, 20 article URLs, closed loop, keep-alive, identity encoding, 3 rounds × 10 s)

| Target | c1 p50 ms | c1 TTFB p50 ms | c1 server CPU ms/req | c10 rps | c10 p50 ms | c10 p99 ms | c10 CPU ms/req | bytes/req |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rivet-dynamic (node adapter, render per request) | 0.28 | 0.28 | 0.294 | 4156 | 2.07 | 5.13 | 0.266 | 13479 |
| static: rivet output (shared static server) | 0.09 | 0.08 | 0.092 | 27261 | 0.35 | 0.98 | 0.077 | 13558 |
| static: hugo output (shared static server) | 0.09 | 0.08 | 0.086 | 28035 | 0.34 | 0.63 | 0.074 | 7369 |

- Driver: `apps/ssr-bench/loadgen/client.ts` `Connection` (the ssr-bench loadgen validates only its own page format, so it was not used as is). The node adapter rendered every request (no cache): Markdown token tree from memory, JSX render, 13.5 KB HTML.
- "Dynamic at static cost" does not hold on this host: rendering costs 3.2× the CPU of serving the same page as a file (0.294 vs 0.092 ms at c1) and 6.6× fewer requests per second at c10. In absolute terms 0.27–0.29 ms CPU per article page ≈ 3,500 pages/s per core.

## Verdict (Rivet vs each lane; ratio = worse / better, ≥ 1.1× = WIN / LOSE)

| Metric | astro | eleventy | hugo | next | sveltekit |
| --- | --- | --- | --- | --- | --- |
| build s N=100 | TIE 1.00× | LOSE 1.91× | LOSE 6.76× | WIN 3.07× | WIN 1.94× |
| build peak MB N=100 | WIN 1.64× | LOSE 1.55× | LOSE 3.23× | WIN 10.69× | WIN 2.17× |
| build s N=1000 | LOSE 1.34× | LOSE 1.44× | LOSE 4.19× | WIN (over cap) | WIN 1.70× |
| build peak MB N=1000 | WIN 2.53× | TIE 1.06× | LOSE 1.44× | WIN (over cap) | WIN 2.55× |
| build s N=5000 | LOSE 1.52× | LOSE 1.18× | LOSE 2.81× | WIN (over cap) | WIN 1.49× |
| build peak MB N=5000 | WIN 4.62× | WIN 1.84× | WIN 2.35× | WIN (over cap) | WIN 3.29× |
| output MB | LOSE 3.11× | LOSE 3.11× | LOSE 3.11× | WIN 2.76× (N=100) | TIE 1.03× |
| files | LOSE 2.02× | LOSE 2.02× | LOSE 2.02× | WIN 2.32× (N=100) | TIE 1.00× |
| article HTML raw B | LOSE 1.82× | LOSE 1.82× | LOSE 1.82× | WIN 1.67× (N=100) | WIN 1.23× |
| article HTML br B | LOSE 2.35× | LOSE 2.35× | LOSE 2.35× | LOSE 1.13× (N=100) | LOSE 1.49× |
| article referenced JS raw B | LOSE (other 0) | LOSE (other 0) | LOSE (other 0) | WIN 8.72× (N=100) | WIN 1.39× |
| article transfer B (all) | LOSE 1.88× | LOSE 1.88× | LOSE 1.88× | – | WIN 1.14× |
| LH article score | TIE | TIE | TIE | – | TIE |
| LH article LCP ms | LOSE 1.14× | LOSE 1.14× | LOSE 1.14× | – | WIN 1.25× |
| LH article FCP ms | TIE | TIE | TIE | – | WIN 1.90× |
| LH TBT / CLS | TIE (0) | TIE (0) | TIE (0) | – | TIE (0) |
| article DOM elements | TIE 1.08× | TIE 1.08× | TIE 1.08× | – | TIE 1.03× |
| LH index LCP ms | LOSE 1.33× | LOSE 1.33× | LOSE 1.33× | – | WIN 1.25× |
| Fast 3G + 4× DCL ms | LOSE 2.05× | LOSE 2.07× | LOSE 2.07× | – | TIE 1.01× |
| Fast 3G + 4× load ms | TIE 1.01× | TIE 1.01× | TIE 1.01× | – | WIN 1.56× |

- Output / HTML / browser rows at N = 1000 unless marked; Next column at N = 100 (its only completed build), browser rows for Next not measured. "WIN (over cap)" = Next could not build within the 2.8 GB cap with default settings.

Summary: Rivet wins against the two hydrating frameworks (Next.js, SvelteKit) on build time, build memory, page weight and paint metrics (brotli HTML excepted: their HTML compresses better), and against every lane on build memory at N = 5000. Against the zero-JS generators (Astro, Eleventy, Hugo) it loses on build time (1.2–6.8×, Hugo by the most), output size (3.1×), file count (2×), HTML bytes (1.8× raw, 2.35× brotli), client JS (65 KB vs 0), DCL on a slow network (2×) and Lighthouse LCP (1.14–1.33×); Lighthouse score, TBT, CLS and `load` tie. For a purely static editorial site Rivet is not better than Astro / Eleventy / Hugo today; it is better than Next.js / SvelteKit static exports.

## What Rivet would need (from the losses)

1. A zero-JS static output for pages with no handlers, state or client navigation (or an option to opt out of the client router): no inline loader (4.7 KB), no state script (0.8 KB), no modulepreloads (65 KB), no `_data.json` sidecars. That alone removes the output-size, file-count, HTML-bytes, client-JS, DCL and most of the LH LCP losses (Rivet's HTML minus those parts is the same markup as Astro's).
2. If the loader stays: make it non-parser-blocking (module / async form or deferred insertion) so DCL does not wait for render-blocking CSS (−1 RTT on Fast 3G).
3. `_data.json` per prerendered page only when the client router is in use, or one shared data format with the HTML (it doubles the file count and adds ≈ 8 KB per article).
4. Build time: Rivet runs two Vite builds (client + SSR) and a prerender that sends every page through the request handler and writes HTML + `_data.json`; Hugo builds N = 1000 in 0.48 s vs 2.00 s, Astro 1.49 s, Eleventy 1.39 s. A per-phase profile of `prerenderBuild` at N = 5000 is the next step (not done here).
5. Dynamic rendering at ≈ 0.29 ms CPU per article is 3.2× a static file; a render cache for unchanged pages (spec `docs/design/specs/2026-10-07-render-cache-design.md`) is the lever if "dynamic at static cost" is a claim to make.

## Deviations and caveats

- Next: default settings build N = 100 only (2.30 s, 2.3 GB); N ≥ 1000 over the RAM cap; the reduced-worker variant was probed once, not benchmarked (lock / load).
- Astro 7.3.8, not 5. Astro bodies via marked + `set:html`, not Astro's remark `render()`.
- Hugo: Goldmark instead of marked; one extra `/page/1/` alias file.
- Rivet content module named `content.ts` (a rolldown 1.2.12 resolve-option race fired the router's server-only guard at random on `*.server.ts` imports; fixed separately in 2d198ad1).
- Builds run with a warm OS file cache, framework caches deleted before each build. Peak RSS = process-tree sum sampled every 50 ms, max'd with `/usr/bin/time -l`.
- Shared host: other agents' processes ran concurrently; timed browser and load phases held the host bench lock.
