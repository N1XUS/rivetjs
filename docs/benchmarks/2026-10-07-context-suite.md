# Context / deep-nesting suite (2026-10-07, lane CTX)

- Suite: `apps/dom-bench/context` (`build.ts --base <HEAD extract>`, `run.ts --targets server,dom --rounds 3 --max-depth`); scenarios in `apps/dom-bench/CLAUDE.md`.
- Lanes: `rivet-base` = HEAD `79b231c0`; `rivet` = lane CTX working tree; `solid-stable` = `apps/bench-stable`. Two runs (rivet vs Solid, rivet vs base), interleaved per sample. Medians, ms (heap KB after GC, `max-depth` levels). Raw medians: `2026-10-07-context-suite.json`.
- Machine loaded (load avg 10–14): ±10 % noise; A/B pairs are interleaved.

## Changes measured

- Context frames (`libs/reactivity/index.ts`): owners point at the nearest provider frame; `useContext` / `handleError` walk providers, not owners; lookups past 8 frames memoize on the start frame (memo alone: providers-50 DOM 1.07 → 0.78, server 0.40 → 0.25; 303 B min).
- Owner-first flush `topDirty` with a verified-owner set past 32 ancestors.
- Effect init runs in its own frame when batching (`initializeEffect` / `_bindingEffect`).
- DOM `Provider` returns plain content without a boundary; accessor content keeps a boundary under the provider.
- Server `Provider` / scoped records: provide owner reused, SCOPED admission before the promise check.
- `_c` = `_untrack1` (one frame less per v2 component).

## Results

| target | scenario     | metric | base  | rivet | Solid |
| ------ | ------------ | ------ | ----- | ----- | ----- |
| server | deep-100     | render | 0.026 | 0.024 | 0.009 |
| server | deep-500     | render | 0.270 | 0.263 | 0.050 |
| server | providers-50 | render | 1.247 | 0.387 | 0.407 |
| server | tree-1023    | render | 1.412 | 0.903 | 0.598 |
| server | update-1000  | render | 0.282 | 0.287 | 0.151 |
| server | error-500    | render | 0.082 | 0.082 | 0.123 |
| server | themed-500   | render | 0.239 | 0.241 | 0.031 |
| dom    | deep-100     | mount  | 0.250 | 0.180 | 0.195 |
| dom    | deep-500     | mount  | 1.665 | 1.140 | 1.185 |
| dom    | providers-50 | mount  | 2.695 | 0.555 | 0.645 |
| dom    | tree-1023    | mount  | 3.580 | 0.970 | 2.055 |
| dom    | update-1000  | mount  | 0.725 | 0.685 | 0.540 |
| dom    | update-1000  | update | 1.245 | 1.240 | 2.110 |
| dom    | error-500    | mount  | 1.205 | 1.175 | 1.135 |
| dom    | error-500    | update | 0.095 | 0.090 | 0.180 |
| dom    | themed-500   | mount  | 1.310 | 1.300 | 1.265 |
| dom    | themed-500   | update | 2.790 | 1.270 | 5.820 |
| dom    | max-depth    | levels | 775   | 1079  | 632   |

- Heap (KB): Rivet below Solid in every scenario (providers-50 27.5 vs 95.8, tree-1023 389 vs 1946 — base 682); frames add ≈ 0.
- Pending compiler patch CTX-1 (no IIFE around v2 templates in return position): max-depth 1066 → 1268 in a regex stand-in.

## Remaining losses vs Solid

- Server generic renderer per-level cost: deep-500 5.3×, themed-500 7.8×, update-1000 1.9×, tree-1023 1.5× — admission / visit overhead per nested component, not context lookups.
- DOM update-1000 mount 1.27× — generic binding mount cost (1000 text bindings), not context.

## Bytes

- `@rivetjs/reactivity` 10897 → 11736 B min (frames + memo + `topDirty` + init inlining); `@rivetjs/runtime/dom` 57491 → 58446; per client app ≈ +783 min / +240 br (size-report).

## Lane DEPTH (record shapes, nested-record writers)

- Run: `build.ts --base <HEAD d482b2ca extract of libs/{runtime,reactivity}>`, `run.ts --lanes rivet,rivet-base,solid-stable --rounds 4`; load avg ≈ 4–6. `rivet` = working tree incl. other lanes' WIP; byte-writer lane = scratch `NodeStreamWriter` harness, interleaved A/B.
- Cause of most losses: V8 holds transition maps of class instances / computed-key literals weakly; the suite GCs before each sample → maps cleared → renderer / owner code deopts ("embedded weak objects cleared"). Fix: class records + one lazily pinned instance per shape (`template.ts`, `server.ts`, `server-structural.ts`, `server-boundary.ts`, reactivity `adopt` / `computed`, `_slot`).
- Server string writer: nested compiled records + primitive attributes continue one chunk (direct recursion); flushed before user code.
- Server byte writer: direct recursion into nested compiled records; `rawSize` records the failed raw path, so ancestors skip repeated size passes (deep-500 0.22 → 0.10 ms, themed-500 0.25 → 0.13).

| target | scenario     | metric  | base  | rivet | Solid |
| ------ | ------------ | ------- | ----- | ----- | ----- |
| server | deep-100     | render  | 0.030 | 0.012 | 0.010 |
| server | deep-500     | render  | 0.265 | 0.053 | 0.047 |
| server | providers-50 | render  | 0.382 | 0.182 | 0.395 |
| server | tree-1023    | render  | 1.099 | 0.447 | 0.571 |
| server | update-1000  | render  | 0.277 | 0.115 | 0.137 |
| server | error-500    | render  | 0.083 | 0.081 | 0.120 |
| server | themed-500   | render  | 0.261 | 0.059 | 0.030 |
| dom    | deep-500     | mount   | 1.260 | 1.090 | 1.270 |
| dom    | deep-500     | dispose | 0.060 | 0.025 | 0.115 |
| dom    | tree-1023    | mount   | 0.985 | 0.775 | 2.360 |
| dom    | update-1000  | mount   | 0.735 | 0.570 | 0.585 |
| dom    | update-1000  | update  | 1.280 | 0.975 | 2.130 |
| dom    | error-500    | mount   | 1.190 | 1.050 | 1.150 |
| dom    | themed-500   | mount   | 1.280 | 1.055 | 1.215 |
| dom    | themed-500   | update  | 1.250 | 0.855 | 5.760 |
| dom    | themed-500   | dispose | 0.090 | 0.015 | 0.050 |

- Heap: −5 … −16 % vs base (tree-1023 +3 %, noise level).
- HTML: ssr-bench `rivet-compiled` / `rivet-for` byte-identical to base (0 / 1 / 100 / 1000 rows, numbers + escaped strings, ± article); router `/resume` 131.0 framework calls/row (unchanged).
- Bytes (min, own delta): `@rivetjs/reactivity` +101, `runtime/dom` +67, `runtime/slot` +39, `runtime/server` +1853, `server-resume` +1470.
- Remaining: server themed-500 2.0× and deep-500 1.1× vs Solid (generic visit per nested component). Measured follow-up, not landed: eager stringification of all-static nested records (deep 0.058 → 0.039, themed 0.059 → 0.041, tree 0.47 → 0.52); conflicts with the resume recorder reading record slots and with byte raw paths.
