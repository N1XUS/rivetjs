# Chunk merge rule: weight the budget by evaluation (design, 2026-10-22)

Lane DIET-CODE item 5 (input: SCOUT-CODE F2, HEAD `c8ba1bab6`). Status: **design only — no code change**. A per-entry `resume.merge` override was considered as item 5b and rejected by its own gate (below).

## 1. Problem

- `resume.merge` (`MERGE_BUDGET = 65536`, `libs/compiler/chunk-groups.ts`; plugin default since 2026-10-18) = extra source bytes accepted per request saved, amortised over the entries a merge touches. Tuned on ui-docs frames (files of a page cut by a third to a half at flat bytes).
- The budget ignores *what the page does with a chunk*. A `data-preload` plan entry `e` / `i` / `v` / `P` is fetched **and evaluated at idle**; `data-fo` is fetch-only (never parsed / run before input); `intent` waits for input. A byte merged into an idle-evaluated chunk costs parse + compile + run on every page that preloads it; the same byte in a fetch-only chunk costs only transfer.
- Planner side (`libs/runtime/server-resume.ts`): `VISIBLE_MAX = 8192` tests a chunk's **own** minified size, not its static closure; `BACKGROUND_DEFAULT` (1 MiB of new closures, minified) then lets a 2.8 KB `P` entry schedule a ~300 KB closure for idle evaluation.
- Measured (SCOUT-CODE, Playwright coverage, load + idle settle): cdk `/button` evaluates 7 chunks / 308.7 KB min / 87.2 KB br before input, 13 % of it run; `rivet-merge-components` (202 KB min, 121 modules) carries 10 % used code; ≈ ⅓ of the evaluated source is not statically reachable from the page (it only shares a merge group with something the page imports).

## 2. Data (scout sweep, br KB before input; chunks)

| page | 65536 (default) | 2048 | 8192 | 16384 | 32768 | false |
|---|---|---|---|---|---|---|
| cdk /button | 7 ch 87.2 | 27 ch 72.0 | 13 ch 68.2 | 10 ch 71.2 | 8 ch 69.9 | 63 ch 78.2 |
| cdk /select | 15 ch 152.9 | 56 ch 156.7 | 32 ch 147.1 | 23 ch 140.6 | 22 ch 143.8 | 113 ch 167.4 |
| cdk /tabs | 10 ch 119.8 | 28 ch 89.2 | 18 ch 92.5 | 14 ch 93.8 | 12 ch 116.6 | 58 ch 93.5 |
| cdk /combobox | 13 ch 132.9 | 60 ch 149.3 | 33 ch 138.8 | 25 ch 138.5 | 20 ch 137.2 | 116 ch 161.4 |
| ui /button | 13 ch 87.2 | 33 ch 85.7 | – | 14 ch 78.3 | – | – |
| ui /tabs | 12 ch 128.7 | 34 ch 104.6 | – | 18 ch 124.9 | – | – |
| ui /modal | 5 ch 81.4 | 14 ch 70.4 | – | 5 ch 67.9 | – | – |
| ui /select-cold | 20 ch 151.4 | 65 ch 169.4 | – | 29 ch 155.8 | – | – |

- 16384: wins 6 / 8 (−3 … −22 %), loses cdk `/combobox` +4.2 % and ui `/select-cold` +2.9 %. 2048: big wins on light pages, +12 % on the heaviest. No global value wins everywhere: the cost of a merged byte depends on the entry, not on the build.
- Minified totals fall further than br at small budgets (cdk `/button` 309 → 206 KB at 2048): many small chunks compress worse, so br understates the parse / compile win.
- Merge-planner fragility (DIET-CODE item 2, 2026-10-22): removing ~1.3 KB min of dev-warning code from cdk modules re-split `rivet-merge-components` (201.9 → 193.1 KB, a 7.5 KB `rivet-merge-behaviour` chunk split off): `/button`, `/tooltip`, `/tabs` −2.0 KB br, `/select`, `/combobox`, `/table` +0.4 KB br and +1 request. A greedy amortised budget turns small byte changes into chunk-graph changes.

## 3. Item 5b gate (rejected)

- Gate from the brief: a 1-hour change (e.g. per-entry `resume.merge` override for story apps / docs) lands only with a measured win on ≥ 6 of the 8 swept pages and no loss > 1 %.
- Best single value (16384): 6 wins, 2 losses of 2.9–4.2 % → fails. Per-app override (`resume: { merge: 16384 }` in the story apps' `vite.config.ts`) = the same numbers. Not landed. A per-page value is not expressible (merge runs per build).

## 4. Proposed rule

1. **Evaluation weight.** `coLoadGroups` gets, per entry, its evaluation class from the planner's static knowledge (route / resume entries: `pinned` = boot; `route:<key>:intent` = intent; component reference entries: their default strategy from `export const preload` / `preload.rules`, else "idle-evaluated" for `P`-eligible handlers). A merge step's cost = Σ over entries of unused bytes × weight, weight 1 for idle-evaluated entries, `FETCH_WEIGHT` (≈ 0.15, transfer only) for fetch-only / intent entries. The 64 K amortised budget stays for fetch-only / intent chunks; idle-evaluated groups effectively see ~8–10 K.
2. **Used share.** Reject a merge that drops an idle-evaluated entry's used share (statically reachable bytes ÷ evaluated bytes) below a floor (proposal 50 %): today `rivet-merge-components` is 36 % unreachable on cdk `/button`.
3. **Planner closure test.** `VISIBLE_MAX` counts the chunk's **new static closure** (manifest `sizes` over `deps`, minus runtime + already-planned closures), not its own size; past it: `intent` (as for an own size past 8 KB today). `BACKGROUND_DEFAULT` unchanged (its 1 MiB was sized for ui-docs `/themes`).
4. Stability: hash-stable tie-breaks already exist; add a hysteresis (a merge must save ≥ 1 request on ≥ 1 entry *and* stay under budget by ≥ 5 %) so byte edits of a few hundred bytes do not flip groups.

## 5. Measurement plan (before landing)

- Pages: the 8 swept story pages + cdk `/tooltip`, `/table`, ui `/data-grid`, `/table`, docs `/`, `/learn/resuming/`, playground `/`, starter-ui `/`.
- Metrics: evaluated-before-input min / br and used share (`$S/sc/cov.mjs` + `agg.mjs`), eager requests, first-click latency (resume-bench, Slow 4G + 4× CPU), ui-docs preload bench (`docs/benchmarks/2026-10-11-preload-background.md`).
- Gate: no page +1 eager request without ≥ 5 % br saved on it; no first-click regression > noise; size-report `--check` growth explained.

## 6. Open questions

- Whether the planner should demote background `P` closures past ~256 KB to `data-fo` (fetched, not evaluated) instead of changing the merge (SCOUT-CODE F2 alternative). Cheaper to build; first press of a below-fold widget then compiles on input.
- Who owns the evaluation class for reference chunks shared by several routes with different strategies (max weight wins?).
