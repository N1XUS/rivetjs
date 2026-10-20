## Notes (hand-written; appended by `fair-report.ts --notes`)

### How this run was made
- SSR (2026-10-19 20:59–21:49): `apps/ssr-bench` tuned GC, c1 100/1000/5000, c10 100/1000, grid 1000, 3 repeats, every lane in one Compose project. Host NOT quiet: Rider + ReSharper, a VM and Spotlight indexing ran alongside (load 7–12). The 100-row c1 ranges are wide (rivet-compiled 1,040–3,185 rps, Razor 1,305–2,310); ratios inside one row/concurrency cell are the signal, not absolutes. The 1000- and 5000-row cells are tight.
- Resume (`apps/resume-bench`, 2026-10-20 09:18–09:40, Chrome 155): Slow 4G + 4× CPU, 10 repeats, while two agent lanes ran test suites (load 25–40). `paintLatency` ties with Solid on every scenario; the `latency` (first DOM mutation) losses on click / filter / scrollClick are the resume runtime's boot before the first handler runs (Solid's hydrated handlers are already attached) — the paint, which the user sees, is the same.
- DOM / krausest (`apps/dom-bench/scoreboard.ts` on a HEAD snapshot, 2026-10-20): the first attempt's snapshot linked the whole `node_modules` directory, so `@rivetjs/*` resolved to the main checkout and the dom + resume suites refused to run (`does not resolve inside that check`); the part-3 rerun uses a real `node_modules` dir with `@rivetjs/*` links into the snapshot. krausest rows are `n/a` by design: the published reference numbers are Chrome 154, this host runs Chrome 155 (browser drift) — the local Rivet/vanilla ratios are still listed.

### Reading the SSR result
- Static class (rivet-compiled vs Razor .NET 10 / Solid 1.9 static): WIN or TIE on every metric. The 2026-10-09 short-text grid loss to Razor (`razor-adversarial.md`) is closed: 365 vs 300 rps, p50 2.63 vs 3.34 ms at 1000 rows c1.
- Resumable class: rivet-resume wins at 1000 / 5000 rows and against Qwik 1 / 2 everywhere. The remaining losses are the 100-row c10 cell against Solid 1.9 hydratable (rps 1,657 vs 2,644; CPU/page 0.59 vs 0.36 ms) — `rivet-router` (same page without handlers) ties/wins that cell, so the cost is the per-row handler + state encode on a small page under concurrency (lane RESUME-SMALL) — peak RSS (116 vs 62 MiB; Node baseline + semi-space + retained buffers, same lane) and grid HTML bytes ×1.5 (resume state + markers; lazy rows, `2026-10-19-lazy-collection-rows-design.md`).

### RESUME-SMALL: the 100-row c10 resume loss + peak RSS (2026-10-20)
Local lane servers (macOS host, Node 26.5.1, compose flags `--single-threaded-gc --max-semi-space-size=8`, in-process closed-loop load, shared host at load 9–17); ratios match Docker (resume ≈ 2× router, ≈ 2× Solid CPU/page at 100 rows c10).

CPU/page split (profiles, `apps/ssr-bench/cpu-breakdown.ts`-style owners, µs/request, 1 row → 100 rows):

| owner | rivet-resume | rivet-router | solid-stable |
|---|---|---|---|
| framework (lane bundle) | 81 → 160 | 54 → 54 | 3.8 → 31 |
| GC | 17.5 → 28 | 11.6 → 21 | 6.5 → 48.5 |
| Node core (http writes) | 22–36 | 22–36 | 22–36 |
| undici `Request` (router adapter) | 5–6 | 5–6 | 0 |

- Fixed cost (1 row): resume 0.125 ms, router 0.103, Solid 0.061. Per row: resume 1.36 µs, router 0.64, Solid 0.89 — the resume page loses on both; GC is NOT the gap (Solid pauses more per request: 44 vs 32 µs; promotion 27.5 vs 12.7 KB/request).
- Router 1-row fixed framework cost: `renderDocument` 56.5 µs (render 41.5), `encodeState` 31.5 (`encodeRecords` 24.6: capture refs 9.0, `special` 5.2, `needs` 4.8; `stateJSON` 4.6) — router context state (~35 table entries ≈ 0.7 µs each), structural.
- Resume 100-row phases (instrumented, inflated): `encodeState` 95–106 µs = `encodeRecords` 69–83 (`planRows` ~20, `_listRows` ~23, `planPreload` 9–10) + `stateJSON` ~16 (table `t` 8.0 µs, bindings `b` 4.1). j-tree encode of the 100 rows ~12 µs (identity registration, inherent).
- Allocation/page: resume 385–395 KB, router 188, Solid 287; `encodeState` = 38.5% of resume allocation, `planRows` self 13.8% (RowRecord, tape, `_trackReads` collector + result per row).

V8 fast `JSON.stringify` bail-outs (the shipped wins; output byte-identical, `/resume` rows 0/1/5/20/100/1000 + `/page` 100 compared with nonces stripped):
- One sliced string (the origin-relative URL `h` the encoder slices off `href`) sent the whole table stringify to the slow serializer: 100-row table 7.8 → 26 µs. `resume-format.ts` `flat()` internalizes it (~0.1 µs).
- Bindings `b`: a region entry's row template `[9]` holds the integer-keyed `e` handler map → slow path for every entry; `bindingsJSON` writes the template like `idMap`: 4.0 → 1.6 µs.
- `escapeJSON`: `indexOf` / `replaceAll("<")` memchr scans, regex only for U+2028 / U+2029 (10 KB state 2.5 → 0.2 µs).
- `planPreload`: a lone row-handler id list stays a list (no Set of every row id; copied into the schedule).
- Local interleaved A/B (resume, c10, 6 repeats, median and range): 100 rows CPU/page 0.388 (0.358–0.463) → 0.343 (0.319–0.365) ms, rps 2,106 → 2,569; 1000 rows 1.793 (1.770–2.125) → 1.692 (1.602–1.821); 1 row 0.182 → 0.184 (noise). Allocation 385 → 377 KB/page (100 rows), 2,182 → 2,134 KB (1000).

Peak RSS attribution (heap snapshots after 3× GC, warm lanes; Docker peak = container usage − inactive_file):
- Live heap after GC: resume 17.9 MB vs Solid 12.5 MB. +3.2 MB code (router + resume runtime + compiled routes), +1.1 MB `JSArrayBufferData` (the 1 MiB wasm row-emitter `Memory`, `server-rows.ts`, fixed by design, + 64 KB slab pools), +0.8 MB strings (manifest, templates), ~1.8 MB pending finalizer objects of undici `Request` signals (`AbortSignal`, listeners, `WeakCell` / `WeakRef`; freed once finalization runs — router node adapter `toRequest`).
- Under a constrained heap the peak heap gap is 8–25 MB, not 54 MiB: the Docker 100-row peak inherits the benchmark's prewarm (`benchmark.py` prewarms at the largest rows c10, then measures 100 rows c1 first; idle shrink takes ~15 s) and scales the live heap by the young-generation / old-space growth factor under c10 (10 in-flight 100-row pages: ~2 × 390 KB allocation each).
- Nothing Rivet-owned grows without bound (no caches over request data found). Not changed: the router's per-request web `Request` + its `AbortSignal` (web-standard handler contract) and the ~6 `URL` parses per request (API isolation copies).
- Docker A/B (2026-10-20 10:38–10:58, `benchmark.py` rivet-resume / rivet-router / solid-stable, 100 / 1000 rows, c1 / c10, 3 repeats, tuned GC; HEAD image then patched image, `--skip-build` both): inconclusive — host load 7–16 during the HEAD run, 14–73 during the patched run (another lane's test suites); the untouched Solid lane itself got 1.09–2.0× slower in the second run. At 100 rows c10 resume/Solid CPU per repeat: 2.00 (HEAD) → 1.85 (patched). The local interleaved A/B above is the measurement of record; a quiet-host rerun is open.
