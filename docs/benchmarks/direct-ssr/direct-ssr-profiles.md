# Direct SSR cost-attribution profiles

> Archived: the `apps/ssr-bench/experiments/` sources, probes and snapshots referenced here were removed after commit `876929e`; run commands and links below resolve at that commit (`git show 876929e:<path>`).


The profiling milestone adds separate CPU and allocation sampling to the [diagnostic controls](direct-ssr-baseline.md). It does not change the compiler/runtime, add a new competitive lane, or establish a .NET result.

The isolated frontend used immutable image `sha256:c933975b67161d431a3bfd974c4635c97f3de6e6b4bbbbab3c5b5b05f5e59310`, one CPU/512 MiB and the shared two CPU/1 GiB gRPC backend. Experimental source/emitter directories were mounted read-only. The profiled compiled module was 9,242 bytes, SHA-256 `709d044cb4e4d6abb505e294387c0e0a50fdb5b45b6679051605669eb8459c33`. The Node 24.14.1/V8 `13.6.233.17-node.44` host driver had no resource quota. The frontend had no OOM event and was removed after raw-artifact preservation.

CPU profiling at 1 ms sampling and V8 heap sampling at 32 KiB intervals ran independently. Every window warmed up before starting its sampler. The running inspector's `/json/protocol` explicitly advertised both `includeObjectsCollectedByMajorGC` and `includeObjectsCollectedByMinorGC`; both flags were enabled for allocation windows. These profiles therefore include statistically sampled allocations that were collected, rather than describing only objects retained at stop. Estimates are not exact allocation byte counts.

Initial coverage was six lanes × 1,000/5,000 rows × two sampler types × twenty validated responses. Sparse CPU windows were retained and extended separately. The final collection has 34 profiles, 1,980 profiled complete responses and 340 warmup responses, with no failed/cancelled requests. All HTML responses were checked for completion, token, every row identity and every field value; RPC responses checked the service-side consumption oracle and request token. CPU windows include inspector administration, waiting for the client to validate/admit the next request, native work and background GC. Their wall-sampled intervals are not ranked active CPU timings.

The [machine-readable summary](direct-ssr-profile-summary.json) preserves exact raw hashes, window counter deltas, source hashes, URL groups, self function frames and zero-based definition line/column coordinates. The exact minified module was copied alongside raw profiles so its function coordinates remain interpretable. Raw CPU/heap files and the initial driver snapshot are retained locally under `.artifacts/ssr-bench/direct-profiles-b710b72/`; extensions retain their own driver summaries in sibling artifact directories. The postprocessor verifies every raw hash, byte length, compiled identity and self-attribution total before producing the summary.

Extended 1,000-row full-render CPU windows contain 270 non-idle samples for compiled output, 170 for hand, 188 for eager direct and 178 for incremental direct. These counts include GC/native/unattributed work and are not per-function CPU totals. The compiled window has 30 self samples in minified `C` at column 440, 23 in admission `y` at column 3888, 21 in dispatch `k` at column 4606, and 47 GC samples. The eager prototype has 19 samples in `ordinaryScalar`, ten in `scalar` and 27 in `escapeText`; incremental has 15 in `ordinaryScalar`, eight in `validate` and 35 in `escapeText`. These are exploratory observations from one profiled window, not precise percentages or confidence estimates.

Sampled allocation estimates per complete full-request response:

| Rows | Compiled | Existing hand | Direct eager | Direct incremental |
| ---: | ---: | ---: | ---: | ---: |
| 1,000 | 6.31 MiB | 4.07 MiB | 5.29 MiB | 5.07 MiB |
| 5,000 | 29.87 MiB | 19.71 MiB | 26.09 MiB | 25.88 MiB |

At 5,000 rows the compiled allocator sample attributes approximately 290.8 million estimated bytes over twenty responses to minified `Y` at column 4661. The preserved source identifies this as the compiled region traversal/string concatenation function. Row construction `xt` at column 8384 also appears. This is allocation-site evidence, not proof that all GC work originates there or that changing it alone produces a particular CPU saving.

Both direct modes allocate substantial descriptor objects during diagnostic validation: `getOwnPropertyDescriptor` receives approximately 126.0/126.7 million estimated bytes over twenty eager/incremental responses. Their `rowHTML` frames also account for large string-construction samples. The eager capture callback is visible at prototype line 51. This supports investigating validation/capture overhead before treating the handwritten prototype as the best achievable generated output; it does not justify bypassing validation in arbitrary JavaScript programs.

The gRPC-only control is deliberately more than decoding: its explicit field validation/checksum dominates several CPU samples and allocation sites. For example, the extended 5,000-row RPC profile has 122 `consumePage` self samples and 75 `consume` samples, alongside decoder/conversion/GC work. Its allocation estimate is about 7.10 MiB per response; the transport control is about 0.28 MiB. These separately measured controls cannot be added/subtracted to establish a renderer cost or a proven .NET feasibility floor.

The next gate is a protocol/eligibility decision that preserves observable eager evaluation, coercion, async admission, ownership and acknowledgment ordering. No general direct compiler backend is justified solely by this ordinary-data prototype. Longer matched decision runs, generic/mixed equivalence and retained heap under controlled slow-client/concurrent load remain outstanding; Tasks 1–2 are not marked complete.

Profiling commands, after preserving the baseline and correctness checks:

```sh
# Run profile-server.mjs in the isolated baseline-image container with read-only
# experiment/emitter mounts, PORT=8080 and PROFILE_ADMIN_PORT=8082.
node apps/ssr-bench/experiments/direct/profile.mjs --iterations 20 --warmup 10
node apps/ssr-bench/experiments/direct/profile.mjs --kinds cpu --rows 1000 --iterations 100 --warmup 10 --out .artifacts/ssr-bench/direct-profiles-extended-1k
node apps/ssr-bench/experiments/direct/profile-postprocess.mjs .artifacts/ssr-bench/direct-profiles-b710b72/raw docs/benchmarks/direct-ssr/direct-ssr-profile-summary.json
node --test apps/ssr-bench/experiments/direct/profile-support.test.mjs apps/ssr-bench/experiments/direct/profile-postprocess.test.mjs
```

Profile coordinates and source fingerprints describe the archived pre-cancellation-repair prototype (removed from the tree in `db7a4667`: `git show db7a4667^:apps/ssr-bench/experiments/direct/snapshots/prototype-measured-before-ack-fix.txt`), SHA-256 `b282af2b…`. Current prototype lines have changed after a correctness-only cancellation repair; raw profile JSONs and attribution summaries remain unchanged. No post-repair profile or performance claim is made.
