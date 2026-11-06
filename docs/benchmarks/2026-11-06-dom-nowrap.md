# DOM benchmark: wrapper-free page checks, competitor re-store (lanes BENCHPROTO + BENCHPROTO-02R, 2026-11-06)

Base `7a79bffdf`, macOS arm64 (Apple M4 Pro), Playwright Chromium **153.0.8010.12** headless shell, cross-origin isolated. The store run was the only benchmark on the host (ordinary desktop apps active): per-trial 1-minute load **3.2–8.7** (the upper end from the React 5000 trials' own renderer; 2026-10-21 store: 2.0–7.7). Raw numbers: [`2026-11-06-dom-nowrap.json`](2026-11-06-dom-nowrap.json).

## Result

- **Protocol `nowrap-2026-11-06`** (`apps/dom-bench/run.ts`): the `rewarm-2026-10-21` mount, plus wrapper-free page checks. Size, page-size and field checks use XPath `count()` and `#host` `textContent` (`metrics.ts` `fieldRevisions`). They never use node lists, walkers or `childNodes`, so the harness creates no JS wrapper for page nodes before or between timed phases.
- **Why**: lane GC found that the old size count, a `TreeWalker` over `#host` right after the timed mount, wrapped every page node: about 90k nodes at 1000 rows and about 450k at 5000 (285k elements plus text). It did this before the updates, the dispose and the mounted-heap measurement, in every lane.
  - A later sparse update that reaches a walk-made wrapper misses cache. Solid 1.9 u10 went 1.58 → 1.91 ms at 1000 rows; Rivet with the GC-01 `_te` binding went +11 %.
  - The mounted heap counted the walk's wrappers.
- **Equivalence** (lane BENCHPROTO): XPath counts equal the TreeWalker counts in every lane (10 / 1000 rows: elements, nodes, comments, text nodes). The old per-field check (each `[data-field]` = `value-<i>-<rev>` in document order) is kept: the regex on `textContent` is anchored between the caption and the button, and XPath checks that each field's text starts with its own index.
- **Verdicts** (`apps/dom-bench/verdict.ts`: ≥ 3 % median gap and non-overlapping trial ranges), Rivet vs each lane:
  - mount 1000 / 5000: TIE vs both Solids (Rivet median −2.4 % / −7.1 % at 1000, −3.2 % / −11.3 % at 5000 vs Solid 1.9 / Solid 2; ranges overlap), WIN vs React;
  - every update (1 / 10 / 100 %) and heap row: WIN vs every lane (updates −28…−47 % vs the Solids, heap −40…−53 %);
  - dispose (not charted, not in `competitors.json`): 1000 rows LOSE vs Solid 1.9 (+8.3 %), TIE vs Solid 2; 5000 rows TIE vs both.
- **Heap** (load-independent; mounted Δ, forced GC), 2026-10-21 → now: every lane dropped by the walk's wrappers.

| rows | Rivet | Solid 1.9 | Solid 2 rc | React 19 |
|---|---|---|---|---|
| 1000 MiB | 4.06 → 3.18 | 6.13 → 5.34 | 7.37 → 6.57 | 16.85 → 16.33 |
| 5000 MiB | 19.90 → 15.53 | 31.15 → 27.25 | 37.44 → 33.22 | 84.23 → 81.70 |

## Re-stored competitors (run.ts, protocol `nowrap-2026-11-06`)

- 1000 rows: `node apps/dom-bench/run.ts --frameworks rivet,react,solid,solid-stable --rows 1000 --repeats 3 --samples 5 --offset <1|2|3>`, three runs.
- 5000 rows: 9 rounds of one `run.ts --rows 5000 --repeats 1 --frameworks <lane>` per lane, lane order rotated per round.
  - One browser per 5000-row trial: one browser over the four lanes reached 3.0–3.3 GB footprint, because a closed context's renderer overlaps the next one.
  - React 5000 peaks at 2.8–3.4 GB footprint. Two of its trials (rounds 1 and 7) were killed by the 3 GB watchdog and re-run right after the store run (one re-run was killed again and repeated).
- Each run held the bench lock, under a process-tree `footprint` watchdog.
- Merged: 9 trials per lane. Stored with `node apps/ssr-bench/fair-report.ts --dom <merged results.json> --store-competitors` (DOM block only).
- Median (min–max) over trials; updates = per-trial median of 5 samples:

### 1000 rows

| metric | react | solid | solid-stable | rivet | Rivet verdict |
|---|---:|---:|---:|---:|---|
| mount | 41.3 <sub>39.4–42.2</sub> | 18.3 <sub>17.0–18.7</sub> | 17.4 <sub>16.8–17.8</sub> | 17.0 <sub>16.3–17.4</sub> | TIE react:W solid:T solid-stable:T |
| update100 | 20.5 <sub>19.8–20.8</sub> | 5.18 <sub>4.82–5.38</sub> | 5.77 <sub>5.30–6.07</sub> | 3.37 <sub>3.27–3.56</sub> | WIN react:W solid:W solid-stable:W |
| update10 | 5.10 <sub>4.54–5.48</sub> | 1.73 <sub>1.66–1.99</sub> | 1.84 <sub>1.66–1.89</sub> | 1.17 <sub>1.10–1.28</sub> | WIN react:W solid:W solid-stable:W |
| update1 | 0.99 <sub>0.97–1.04</sub> | 0.36 <sub>0.34–0.41</sub> | 0.28 <sub>0.25–0.30</sub> | 0.21 <sub>0.19–0.22</sub> | WIN react:W solid:W solid-stable:W |
| heap | 16.3 <sub>16.3–16.3</sub> | 6.57 <sub>6.50–6.58</sub> | 5.34 <sub>5.34–5.35</sub> | 3.18 <sub>3.18–3.19</sub> | WIN react:W solid:W solid-stable:W |

### 5000 rows

| metric | react | solid | solid-stable | rivet | Rivet verdict |
|---|---:|---:|---:|---:|---|
| mount | 217 <sub>213–235</sub> | 90.5 <sub>84.7–92.0</sub> | 82.9 <sub>76.7–88.8</sub> | 80.2 <sub>75.6–87.2</sub> | TIE react:W solid:T solid-stable:T |
| update100 | 111 <sub>104–115</sub> | 25.2 <sub>24.5–25.9</sub> | 29.6 <sub>28.1–30.9</sub> | 17.0 <sub>16.4–17.5</sub> | WIN react:W solid:W solid-stable:W |
| update10 | 29.4 <sub>28.1–31.9</sub> | 11.2 <sub>10.5–11.6</sub> | 9.90 <sub>9.41–10.3</sub> | 5.98 <sub>5.74–6.58</sub> | WIN react:W solid:W solid-stable:W |
| update1 | 4.07 <sub>3.94–4.43</sub> | 1.40 <sub>1.33–1.54</sub> | 1.28 <sub>1.19–1.38</sub> | 0.77 <sub>0.72–0.82</sub> | WIN react:W solid:W solid-stable:W |
| heap | 81.7 <sub>81.7–81.7</sub> | 33.2 <sub>33.2–33.2</sub> | 27.2 <sub>26.7–27.3</sub> | 15.5 <sub>15.5–15.5</sub> | WIN react:W solid:W solid-stable:W |

### Busy-host attempt (lane BENCHPROTO at `297388c58`, load 8.2–30.9) → this store

The first store under this protocol ran beside three other agent lanes; it was held and re-run here. Same verdicts; timings drop with the load, Rivet also by the runtime commits between the two bases:

| rows / metric | Rivet | Solid 1.9 | Solid 2 rc | React 19 |
|---|---|---|---|---|
| 1000 mount ms | 18.8 → 17.0 | 18.3 → 17.4 | 19.4 → 18.3 | 44.4 → 41.3 |
| 1000 u100 ms | 3.67 → 3.37 | 6.34 → 5.77 | 5.53 → 5.18 | 21.5 → 20.5 |
| 1000 u1 ms | 0.23 → 0.21 | 0.30 → 0.28 | 0.40 → 0.36 | 1.06 → 0.99 |
| 5000 mount ms | 92.6 → 80.2 | 87.5 → 82.9 | 96.6 → 90.5 | 234 → 217 |
| 5000 u100 ms | 18.2 → 17.0 | 31.4 → 29.6 | 26.8 → 25.2 | 115 → 111 |

## Memory

- Count the process tree with macOS `footprint -p <pid>` (phys_footprint), not an RSS sum: the RSS sum counts shared pages once per process.
- 5000-row trial peak tree footprint: Rivet / Solid 2.4–2.6 GB, React 2.8–3.4 GB (over the 3 GB cap in 3 of 12 attempts). The renderer reaches this in the warm-up cycles, under both protocols.

## GC-01 prototype under the new protocol (lane BENCHPROTO, base `297388c58`, lane GC `_te` binding, hand-lowered)

- Lanes:
  - `te` = `lanes/gc/proto/te.js` (the compiled output the queued Rust patch emits) against the GC-01 runtime;
  - `rivet-base` = base runtime + base compiler output;
  - Solid 1.9.
- Same split runs as above, 9 trials per lane, load **14.3–51.9** (very high; all three lanes interleaved).
- te vs base, median Δ (verdict.ts):

| rows | mount | u1 | u10 | u100 | dispose | heap |
|---|---|---|---|---|---|---|
| 1000 | 18.88 vs 19.09, −1.1 % TIE | 0.23 vs 0.25, −6.1 % TIE | 1.32 vs 1.38, −4.3 % TIE | 3.88 vs 3.75, +3.2 % TIE | +2.8 % TIE | −0.2 % |
| 5000 | 89.14 vs 94.35, −5.5 % TIE | 0.83 vs 0.88, −5.7 % TIE | 6.56 vs 6.97, −5.9 % TIE | 18.10 vs 18.09, 0.0 % TIE | −2.2 % TIE | −0.5 % |

- Landed since as `7d7548009` (Rust lowering, same output), so the re-stored Rivet numbers above include `_te`.
- The old protocol showed u1 +5–8 % and u10 +11–12 % for `_te`. Under the new protocol that regression is gone (u1 / u10 −4…−6 %), matching lane GC's no-walk probe. Mount stays −1…−5 %.
- vs Solid 1.9: mount TIE (−0.4 % / −2.0 %); updates −29…−44 % WIN; heap −40 % WIN.
