# Idle post-GC retention diagnostic

> Archived: the `apps/ssr-bench/experiments/` sources, probes and snapshots referenced here were removed after commit `876929e`; run commands and links below resolve at that commit (`git show 876929e:<path>`).


This separate Task 2 experiment checks whether memory remains after repeated complete responses and slow-client aborts. It does not rank throughput, CPU or request latency. The server requires `node --expose-gc`; no profiler runs alongside this diagnostic.

`retained-server.mjs` provides `/full` for the six compiled, hand, validated eager/incremental and trusted eager/incremental lanes. Its separate admin port exposes `/health`, `/state` and `/checkpoint`. Checkpoints require zero active requests, lock new admissions, allow an event-loop turn, collect twice with intervening turns, and report idle `heapUsed`, `external`, `arrayBuffers` and RSS. Checkpoint administration allocations are included. Maximum active count is cumulative across the process, explicitly labelled.

The driver preserves the startup checkpoint, each case's pre-warm state and warmed baseline, every wave's request outcomes and terminal counters, every cycle's post-GC checkpoint, and each phase's descriptive least-squares slope, peak and final delta. It never saves response bodies. Warm requests explicitly exercise modules, the gRPC channel and writer/allocator paths; there is no prepared HTML cache in this server. Sequential cases share one process, so previous workloads influence later baselines. Complete and abort waves alternate, so phase slopes are descriptive and cannot isolate causality.

Complete responses validate their unique wave token, every row identity, all ten fields and the final completion marker. Paused-abort responses deliberately have no complete-body oracle: their clients pause after headers, wait a declared interval and close. Exact server counters distinguish cancellation from a response that completed before the abort. Every wave uses batches no larger than the declared concurrency. Each batch waits for exact admission and terminal counter deltas plus zero active server requests before the next batch starts; destroying a client therefore cannot release a server slot prematurely. Every batch also verifies that the cumulative server `maxActive` never exceeds the declared bound. Batch outcomes, before/settled counters and observed process maximum are saved, including a failed batch. Every wave must have exactly one terminal result per admitted request, no failures and zero active requests before a checkpoint. Failures retain prior evidence and the unfinished case. Driver validation stays outside the frontend process, but the host driver has no CPU/memory quota.

Default bounds are 1,000/5,000 rows, six lanes, concurrency four, eight warm requests per case, five cycles of twenty-four complete plus eight abort requests, a 100 ms slow-client pause and 100 ms idle interval. Admission/settlement timeouts are twenty seconds. Fetch uses its warmed pool for complete requests; slow clients use separate unpooled sockets. Tests use a small injected service and a labelled GC correctness hook, never substituting their memory samples for real GC evidence.

Post-GC JS heap growth and native RSS are reported separately. RSS can stay high because allocators retain freed arenas or sockets/native buffers remain warm. `external` and `arrayBuffers` are distinct process counters and may overlap. A bounded repeated-load result cannot prove the absence of every leak or general concurrency limits.

The planned Docker run must use the exact immutable image `sha256:c933975b67161d431a3bfd974c4635c97f3de6e6b4bbbbab3c5b5b05f5e59310`, a separate one-CPU/512 MiB frontend and the existing two-CPU/1 GiB backend. Mount only current `experiments/direct` and `libs/server-emitter` read-only; the production image/tag/containers stay untouched. Set `RETAINED_IMAGE_ID` to that exact image identity. Capture Docker inspect identities/quotas/OOM state alongside result JSON. The server records actual compiled artifact and source hashes. The recorded run used an exclusive quiet window with no other builds, tests, profiles or load. Backend HTTP already occupied host port 18110, so the diagnostic admin used host 18111; the backend stayed unchanged.

Example commands inside the isolated container and from the host driver:

```sh
node --expose-gc apps/ssr-bench/experiments/direct/retained-server.mjs
node apps/ssr-bench/experiments/direct/retained-probe.mjs --url http://127.0.0.1:18109 --admin http://127.0.0.1:18111 --out .artifacts/ssr-bench/direct-retained-diagnostic
```

Six focused preparation tests cover the full oracle, counter settlement, bounded wave isolation, descriptive summary calculations admin rejection while a request is active, and delayed server cancellation with a strict batch barrier. The delayed-cleanup regression first demonstrated a peak of nine server requests under a declared bound of three; the repaired batching holds it to three. A loopback server regression also verifies six client aborts with delayed server cleanup never exceed two server requests. The actual Docker run is recorded below.

## Recorded bounded run

[Full cycle/batch evidence](direct-ssr-retained-diagnostic.json) and [resource/source provenance](direct-ssr-retained-provenance.json) preserve all 1,920 measured and 96 warm request outcomes. All 504 batch barriers passed exact terminal/admission checks with zero active requests; cumulative frontend maximum active requests was four. There were no failed requests or frontend/backend OOM events. The isolated container was removed after saving before/after inspect records and exact source copies locally. Both the immutable image and actual 9,242-byte compiled artifact `709d044c…` were verified.

Every one of the 240 paused-client requests at 1,000 rows finished server-side before the attempted abort. At 5,000 rows, 219 of 240 paused clients reached server cancellation; 21 completed before cancellation. Complete waves and warmup requests delivered 1,536 fully validated bodies. The additional 261 server-completed paused-client responses deliberately do not have a complete-body oracle. These distinctions are visible in counters rather than reported as successful cancellations.

Startup idle post-GC memory was about 9.95 MiB JS heap and 69.47 MiB RSS. After the warmed repeated workloads, JS heap remained near 10–11 MiB; the highest idle heap checkpoint across all cases was about 11.46 MiB. The largest idle RSS checkpoint was about 138.14 MiB. Native allocator/socket warming can account for RSS staying high despite collected JS objects; this experiment does not attribute its cause.

At 5,000 rows, the last checkpoint after each abort wave gave these descriptive values. Each baseline belongs to that lane's warmed case in the shared process; previous cases and alternating complete/abort workloads influence it. Slopes use the five abort-phase checkpoints, not independent process repetitions.

| Lane | Post-GC heap change from warmed baseline | Heap slope per cycle | Largest idle RSS | Server cancellations / 40 attempts |
| --- | ---: | ---: | ---: | ---: |
| Compiled | +146.1 KiB | +9.4 KiB | 134.9 MiB | 38 |
| Hand | +12.9 KiB | −0.8 KiB | 136.6 MiB | 35 |
| Validated eager | +0.2 KiB | −0.1 KiB | 137.6 MiB | 37 |
| Validated incremental | −0.6 KiB | −2.3 KiB | 137.9 MiB | 37 |
| Trusted eager | −26.1 KiB | +2.5 KiB | 137.6 MiB | 37 |
| Trusted incremental | −6.9 KiB | −1.3 KiB | 137.6 MiB | 35 |

The complete-phase checkpoints and full external/buffer counters remain in the JSON. Across 5,000-row abort-phase samples, external memory peaked around 3.54 MiB and array buffers around 0.034 MiB. Small positive/negative changes and slopes in this short sequential run do not establish leak freedom or a framework ranking. It exercises repeated completion/cancellation at a verified server concurrency of four; larger concurrency, longer duration and broader generic/mixed semantics remain open Task 2 gates.
