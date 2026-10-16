# PRELOAD-GROUP — shared chunk merging (2026-10-12)

`rivet({ resume: { merge } })`, default 2048 (`libs/compiler/chunk-groups.ts`). Base = the same snapshot (eb85d5cc + ui-docs) built without merging. Host was **loaded**: the bench lock waited 30 min at load 8–15, then was taken with maxLoad waived. Load was 8.8 at the start and 14 at the end. Static numbers do not depend on load.

## Static (manifest closures, ui-docs full site, 1027 live examples)

| | base | merge | Δ |
| --- | ---: | ---: | ---: |
| preload closure files, median (360 pages with `data-preload`) | 76.5 | 51 | −33 % |
| preload closure files, total | 30 520 | 19 935 | −35 % |
| preload closure bytes, median | 306.9 KB | 302.1 KB | −0.3 % (p90 +8 %, max +21.5 %) |
| preload closure bytes, total | 115.9 MB | 116.4 MB | +0.4 % |
| full state closure files, median (957 pages) | 73 | 48 | −34 % |
| full state closure bytes, median | 259.3 KB | 260.4 KB | 0 % (p90 +7.2 %, max +64 %: radio-group frames, tailwind-variants merged) |
| select-default preload | 125 files / 418.8 KB | 79 / 414.3 KB | |
| date-picker-basic preload | 99 / 483.0 KB | 61 / 482.9 KB | |
| combo-box-default preload | 122 / 418.7 KB | 78 / 414.7 KB | |
| `/components/select` preload / full | 11 / 83.6 KB · 109 / 445.6 KB | 8 / 82.2 KB · 73 / 451.4 KB | |

## Chromium example checks (docs-kit `checkExamples`, br bytes as served)

- All 1027 checks pass on both builds. `tabs-basic` / `tabs-custom-styles` fail only with 6 pages at once and pass when run alone, in both builds (known flake).
- Requests before input, total over all examples: 35 571 → 23 441 (−34 %). br bytes: 48.7 → 46.8 MB (−3.8 %).
- After first input: requests 22 195 → 15 654 (−29 %), br bytes 24.5 → 23.4 MB (−4.6 %).
- select-default: 126 → 80 requests, 150.2 → 140.3 KB br before input.

## First click, Fast 3G (562.5 ms RTT, 1.44 Mbps, CPU 4×), median of 3, ms (`$S/pg/bench.mjs`)

"click" = click on the trigger at the load event until the popup is visible. Cold = new context.

| page | h1 base | h1 merge | h2 base | h2 merge |
| --- | ---: | ---: | ---: | ---: |
| select-default | 13 414 | 8 910 (−34 %) | 3 956 | 3 898 (−1.5 %, within noise: n = 3, loaded host) |
| date-picker-basic | 14 442 | 10 485 (−27 %) | 4 888 | 4 453 (−9 %) |
| combo-box-default | 13 949 | 10 423 (−25 %) | 4 381 | 3 881 (−11 %) |
| /components/select (click after quiet) | 8 057 | 5 172 (−36 %) | 3 484 | 3 011 (−14 %) |

- Warm h1 (cached): 160–370 ms in both builds, within noise.
- h2 warm is not reported: Chrome does not cache responses over the self-signed certificate.
- HTTP/1.1 gains the most: Chrome opens 6 connections per host, and every round of requests costs one RTT.

## island-bench rivet-native lane (479e4cbb page), Fast 3G, 5 samples

| | counter | picker | chart | JS before input |
| --- | ---: | ---: | ---: | ---: |
| as committed (no directives) | 1 428 ms | 518 ms | 1 162 ms | 0 |
| merge | identical build (nothing to merge: 5 symbol chunks + 1 shared `dom`) | | | |
| + `preload="idle"` (counter, picker) / `"visible"` (chart bars) | 31 ms | 9 ms | 17 ms | 8 req / 20.1 KB gz |

- The lane's first-input latency comes from not prefetching, not from chunking.
- The directives that match the Astro lane's `client:load` / `client:idle` / `client:visible` take it to the unthrottled numbers.
- That is a lane-page change for BRIDGES, not part of this commit.

## No-regression checks

- ssr-bench lanes: hashes identical to HEAD (71 entries; rebuilt in a snapshot with the HEAD compiler and with the new one).
- resume-bench rivet lane: build byte-identical (only the provenance hash of `vite.ts` changes).
- size-report vs HEAD compiler:
  - starter-ui eager requests 27 → 26, page JS −0.5 KB br;
  - runtimeJS +4.5 KB min: chunk classification only (a merged chunk that the runtime entry's closure reaches is counted as runtime), not new code;
  - playground `/slots` htmlBr +15 B;
  - everything else identical.

## Fix round 1 (review of ce5c24d1)

Changes: no merge closes a chunk import cycle (a path through any other group or ungrouped module), dynamic-import targets are owners and ungrouped imports are costed, pinned entries do not take page code through barrels, modules sorted by id (deterministic names, `rivet-merge-` prefix), skipped with `advancedChunks`. Static counts only (no timed runs); base = the same snapshot (HEAD 380f7f56 + fixes) with merging off.

| ui-docs, 1027 live examples | off | fix round 1 | Δ |
| --- | ---: | ---: | ---: |
| preload closure files, median (365 pages) | 77 | 50 | −35 % |
| preload closure files, total | 31 014 | 19 560 | −37 % |
| preload closure bytes, median | 308.1 KB | 304.3 KB | −0.2 % (p90 +7.0 %, max +27 %: resizable / input-otp / sidebar frames) |
| full state closure files, median (963 pages) | 73 | 47 | −36 % |
| full state closure bytes, median | 259.4 KB | 261.2 KB | +0.3 % (p90 +7.3 %, max +64 %: radio-group frames) |
| select-default preload | 125 files / 419.0 KB | 76 / 416.0 KB | |
| date-picker-basic preload | 99 / 483.0 KB | 60 / 485.8 KB | |
| combo-box-default preload | 122 / 419.2 KB | 75 / 416.7 KB | |
| `/components/select` preload / full | 11 / 83.6 KB · 109 / 445.8 KB | 8 / 82.3 KB · 67 / 451.4 KB | |

- Groups: 148 merged chunks, 522 modules; `coLoadGroups` ≈ 0.1 s on the 9 465-module graph; the reversed module list gives the same groups.
- Cycle check: 55 merges rejected on ui-docs; no build (off, round 0, round 1) has a cyclic chunk import graph — the check is preventive here.
- The budget stays amortised (per merge step, summed over entries). A cumulative per-entry cap was measured in the same snapshot:

| per-entry cap | preload files median | preload bytes p90 / max | full bytes max |
| --- | ---: | ---: | ---: |
| none (committed) | 77 → 50 | +7.0 % / +27 % | +64 % |
| 16 × budget | 77 → 65 | +1.2 % / +17.5 % | +64 % |
| 10 % of the entry's closure | 77 → 69 | +0.6 % / +16.4 % | +66 % |
| 1 × budget (strict) | 77 → 76 | +0.2 % / +8.8 % | +13 % |

- The worst tails come from owner over-count, not from the budget: owner sets come from the static graph, so side-effect-free modules the bundler tree-shakes away (cdk `color/index.ts` importing every color state module) still count as owned; a merge then makes such a page load the group for real. Fix needs export-level usage (follow-up).
- Chromium example checks and timed first-click runs were not repeated.
