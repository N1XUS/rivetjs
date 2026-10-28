# CX-LAZYSNAP — plain-array lazy snapshot in the first reconcile (2026-10-28)

Loss #3 of `2026-10-28-night.md`: first filter key to paint, Rivet 69.2 ms vs Solid 43.6 ms; input dispatch 29.5 vs 9.5 ms. Profile: reconcile + repeated Proxy `get` traps on the frozen `lazyNodes` snapshot (`libs/runtime/dom-derived.ts`) + suspected repeated DOM-backed value reads.

## Change

- `dom-derived.ts` `lazyNodes`: each proxy registers its memoized reader in a module `WeakMap`.
- `dom-v2.ts` `assign`: in `DERIVED` builds an array `slot.current` goes through `_adoption.snapshot` once, before replacement / reconciliation; the pass then reads a plain array (no Proxy trap per `current[i]` / `.length`).
- Capture timing unchanged: the first read happens at the same point (after `evaluate`, after the keep-token early return, before any mutation). Late Async segments, keep tokens (live range), row ownership, adoption anchors unchanged.
- DOM-backed reads: audited (`dom-reads`, 1000-row filter): 2000 reads, 2000 unique paths, max 1 read per path on base and candidate — the per-row first-read cache already prevents repeats; nothing to change.

## A/B (same host, interleaved)

- `apps/resume-bench` filterKey, production builds of base (7d083e587) and candidate at 100 and 1000 rows, artifact hashes checked per run; fast + slow conditions; 2 batches × 7 repeats per side (n = 14), side order alternating per repeat. Load (1 min): 8.2–43.4, median 16.1. `firstInputSync` true in every run. Raw runs: `2026-10-28-cx-lazysnap.json`.
- Median (min–max), ms:

| case | metric | base | candidate |
| --- | --- | --: | --: |
| fast 100 | dispatch | 1.1 (0.9–1.3) | 0.9 (0.8–1.0) |
| fast 100 | paint | 32.2 (30.1–34.7) | 31.5 (28.8–37.5) |
| fast 1000 | dispatch | 6.1 (5.6–6.3) | 5.0 (4.6–5.2) |
| fast 1000 | paint | 31.9 (29.9–38.9) | 33.4 (26.1–41.2) |
| slow 100 | dispatch | 4.7 (3.9–5.5) | 4.0 (3.5–5.3) |
| slow 100 | paint | 37.0 (33.7–46.0) | 39.0 (34.4–45.0) |
| slow 1000 | dispatch | 24.9 (22.0–27.1) | 20.6 (18.8–22.6) |
| slow 1000 | latency | 26.6 (23.9–37.0) | 22.6 (21.1–34.9) |
| slow 1000 | paint | 62.3 (57.2–73.0) | 58.5 (53.4–4611\*) |

- \* one candidate outlier (4.6 s, no errors; host load spike); median unaffected.
- Dispatch: −17 % at 1000 rows (slow and fast), ranges do not overlap; −15 / −18 % at 100 rows. Paint: within noise at 100 rows and fast 1000; −6 % median slow 1000.
- Remaining gap vs Solid is reconcile work itself, not the snapshot.

## Bytes / hashes

- Runtime hashes: `/dom [resumed]` +59 B, `/router/dom [resumed]` +59 B, `dom-derived-runtime` +78 / +137 / +135 B (plain / resumed / domData), `testing [resumed]` +59 B; `/dom-lite` hashes changed at equal size; plain `/dom` and `/server` identical.
- size-report (starter-static, starter-ui, example:counter): base passes `--check`; candidate +35 B br runtime (starter-ui), +57 / +50 / +107 B br all-client JS — intended delta (speed over size), baseline update needed.
