# Reject the preserved-record unrolling probe

> Archived: the `apps/ssr-bench/experiments/` sources, probes and snapshots referenced here were removed after commit `876929e`; run commands and links below resolve at that commit (`git show 876929e:<path>`).


Durable evidence: archive (removed from the tree in `db7a4667`: `git show db7a4667^:apps/ssr-bench/experiments/unroll/README.md`), raw 45 trials (removed from the tree in `db7a4667`: `git show db7a4667^:apps/ssr-bench/experiments/unroll/pure-results.json`), and paired summary (removed from the tree in `db7a4667`: `git show db7a4667^:apps/ssr-bench/experiments/unroll/pure-summary.json`). Original `.artifacts` paths below describe the executed run; exact mirrors and source snapshots now live in the archive. Raw JSON SHA-256 is `01b9cba047325c866d7c7b9b03ea275f4c2c0c14d927b1b7b9394385ade616c0`.

Decision: **reject this traversal experiment**. It adds registry/driver/code overhead to an already scalar-fast loop and does not remove records or eager captures. Correctness passing is insufficient justification to retain it. This rejects this bounded implementation, not the broader direct-emission plan or its separately labeled trusted-data lab.

## Exact one-run diagnostic

The coordinator granted a quiet window; root/reviewer/memory worker ran no builds/tests/heavy work during this process. Executed once:

```sh
node --expose-gc .artifacts/server-unroll-probe/pure-probe.mjs --rows 100,1000,5000 --warmup 20 --iterations 100 --repeats 5
```

Exit 0. The worker notified the coordinator immediately after process termination. No timed rerun occurred. There are **45 complete raw trials**, no failed/partial trial. Three lanes × three row counts × five rotated repeats, 20 warmup pages and 100 measured pages/trial. All lanes use their actual adapter bundle's NodeStreamWriter with accepting observable discard sink. Full body/chunk equivalence is verified separately. Per-request eager capture/graph creation remains timed; no output/capture caching.

Artifacts: preserved `709d044c…` (9,242 bytes), new-default `ae2a8bf4…` (9,756), opt-in `d30a0e1f…` (18,139). Exact SHA-256/source identities and methodology are in `builds.json` and raw `pure-results.json` under `.artifacts/server-unroll-probe/`. `pure-summary.json` retains every group value and paired ratio; one-row outputs and per-row-count full-output hashes/lengths/writes are retained. The immutable preserved artifact was not rebuilt.

## CPU and variability

CPU ms/page, median of five trials; bracketed numbers are trial min–max, not confidence intervals:

| Rows | Preserved | New default | Unrolled |
| ---: | ---: | ---: | ---: |
| 100 | 0.193 [0.179–0.299] | 0.216 [0.189–0.279] | 0.270 [0.222–0.352] |
| 1,000 | 1.696 [1.604–1.731] | 1.728 [1.681–1.810] | 1.838 [1.764–1.902] |
| 5,000 | 9.185 [9.072–9.296] | 9.212 [9.159–9.275] | 9.867 [9.652–9.942] |

For each row count/repeat, divide the candidate's CPU/page by that same repeat's control CPU/page. Median paired increases and ratio ranges:

| Rows | New default / preserved | Unrolled / preserved | Unrolled / new default |
| ---: | ---: | ---: | ---: |
| 100 | −1.2% [0.936–1.121×] | +19.5% [1.024–1.510×] | +17.7% [1.066–1.497×] |
| 1,000 | +2.1% [1.012–1.071×] | +10.0% [1.055–1.121×] | +4.1% [1.000–1.101×] |
| 5,000 | +0.3% [0.986–1.017×] | +8.2% [1.038–1.096×] | +6.4% [1.048–1.086×] |

Small/short trials are noisy: paired ratios are not ratios of group medians, hence the 100-row new-default summaries differ. The modest default deltas do not establish a precise lookup cost. Unrolled/preserved is worse in **all 15 paired comparisons**. At 5,000 rows even its best paired ratio is 1.038×, with no observed gain to justify its extra code. This bounded result warrants rejection without another run.

Unrolling adds 8,383 bytes (+85.9%) versus final new-default and 8,897 bytes (+96.3%) versus preserved. New-default adds 514 bytes (+5.6%) merely to carry the registry/driver. Generated adapter source grows 2,744 → 27,331 bytes. No allocation gate was passed or measured; this approach intentionally retains the complete old graph and adds WeakMap entries. CPU/wall samples are host pure-render diagnostics, **not** HTTP, TTFB, competitor/Razor, adoption, allocation or retained-memory evidence.

## Preservation and coordinator-owned scoped revert

Exact post-review experiment source is copied under `.artifacts/server-unroll-probe/source-snapshot/` with per-file SHA-256 manifest before any revert. The old/new actual modules, emitted adapter source, build/browser manifests, raw trials, summary and timing driver remain under the same artifact directory. These snapshots preserve the rejected experiment for audit; they are not active product code.

Proposed root-owned revert, using pre-probe `42966ce` as the reference:

1. Restore only `libs/compiler/index.mjs`, `libs/runtime/server.mjs`, and `libs/runtime/template.mjs` to their pre-probe contents. This removes opt-in recognition/hoists and the default runtime registry lookup/driver/import.
2. Remove only the new live product/helper test files `libs/compiler/server-unroll.mjs`, `libs/runtime/server-unroll.mjs`, and `libs/compiler/tests/server-unroll.test.mjs`, after preserving their snapshots.
3. Retain Task 3 protocol/oracle tests, protocol/approach/probe/decision records, and rejected experiment artifacts. Do not reset whole directories, root manifests, public declarations or unrelated work.
4. Run the appropriate focused/full checks against the restored default and verify its emitted artifact fingerprint before any further work. No further timed rerun is needed to decide this experiment.

The worker performed no Git mutation or product rollback. Coordinator determines evidence tracking/storage and executes the scoped revert. A next implementation needs genuine graph/capture-cost elimination with a separately proven admission-safe/non-escaping boundary; neither DTO assumptions nor another broad unrolling rewrite is justified by this result.
