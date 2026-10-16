# Direct SSR diagnostic baseline

> Archived: the `apps/ssr-bench/experiments/` sources, probes and snapshots referenced here were removed after commit `876929e`; run commands and links below resolve at that commit (`git show 876929e:<path>`).


Tasks 1–2 of the [direct-emission plan](../../design/plans/2026-10-02-rivet-direct-ssr-optimisation.md) are in progress. These controls do not constitute a new ASP.NET comparison or a compiler optimisation.

The last measured batched image is preserved as `rivet-ssr-bench-node:e9aa38b-baseline`, image `sha256:7925f682857df6d9dc979311ac8a6f30a360f5973ede9c99ad9463e2f171d03c`. Its compiled module SHA-256 is `c4e02c45baae89244e04687b476874532535b1455c055ebbafd8b246160ba97f`, 9,196 bytes. The older `rivet-ssr-bench-node:b01eba3-baseline` remains image `sha256:1a6ae220bb5653b26d234de80899a5d5dd796b3ddf45b0abf5b2fc847707ada0`; neither identity may be retagged to new source.

Current source baseline is `b710b72`, incorporating the unowned SSR traversal adjustment and browser scheduler fix. It is preserved as `rivet-ssr-bench-node:b710b72-baseline`, image `sha256:c933975b67161d431a3bfd974c4635c97f3de6e6b4bbbbab3c5b5b05f5e59310`. The image's actual SSR artifact is 9,242 bytes, SHA-256 `709d044cb4e4d6abb505e294387c0e0a50fdb5b45b6679051605669eb8459c33`, gzip 3,780 and Brotli 3,297 bytes. Its Rust artifact remains 395,544 bytes, SHA-256 `01f7abcbb247f4a54806d61e5f091aa1dca28d65f344ec4c25647068b5a60e5a`.

The existing host artifact used by pure diagnostics is also 9,242 bytes but has a different SHA-256, `df1260bdf8642d3202b83ec10f5cb72c0b1c36f7043d462c29c89b7174493e5f`. It is recorded independently; matching byte length does not establish identical code. Quota-matched decision measurements and allocation profiles are still required before Task 1 is complete.

The independent harness lives in `apps/ssr-bench/experiments/direct/`; it does not change the competitive benchmark lanes:

- `pure.mjs` uses frozen deterministic data matching the backend's title, row identities and ten integer fields. An accepting discard sink counts every emitted UTF-16 unit, physical sink write, and chunk endpoint. Before timing it verifies complete bodies, SHA-256, UTF-8 size, and ten fields per row against the existing hand emitter. No RPC/HTTP cost is included.
- `controls.mjs /transport` replays compiled output prepared at startup, including its original chunk boundaries. The body token is fixed to `prepared-control`; the requested token appears only in `X-Control-Request-Token`. This is explicitly synthetic prepared-body reuse, never a competitive rendering lane.
- `/rpc` makes a real service call with the shared gRPC client, 15-second deadline, request-owned cancellation, and no article/Markdown work. Every row identity and all ten values are checked and consumed into a checksum before returning small JSON.
- `/full?lane=compiled|hand|direct-eager|direct-incremental` performs the same gRPC call, then renders a complete structured page without final-page caching. Diagnostic counters expose actual response writes/bytes, backpressure/drain counts, and time from HTTP callback to first actual `response.write`. RPC/render counters are wall intervals; they must not be added to CPU or subtracted to infer render CPU.

Run the pure diagnostic after building and fingerprinting the desired adapter, with no competing work:

```sh
node --expose-gc apps/ssr-bench/experiments/direct/pure.mjs --rows 100,1000,5000 --iterations 100 --repeats 5 --warmup 20 --out .artifacts/ssr-bench/direct-pure
node --test apps/ssr-bench/experiments/direct/prototype.test.mjs apps/ssr-bench/experiments/direct/controls.test.mjs
GRPC_URL=127.0.0.1:18100 PORT=18109 node apps/ssr-bench/experiments/direct/controls.mjs
```

HTTP correctness with an injected service and live Docker/gRPC diagnostics are verified. The live run used the exact current-source image, read-only experiment/emitter source mounts, one CPU/512 MiB frontend and the shared two CPU/1 GiB backend. The host Node driver had no CPU/memory quota. Source fingerprints, image/resource identities and driver environment are recorded in [the provenance JSON](direct-ssr-diagnostic-provenance.json).

The [live HTTP diagnostic](direct-ssr-http-diagnostic.json) contains 90 rotated trials: six controls × three sizes × five repeats, ten measured and three warmup responses per trial. All 900 measured and 270 warmup responses completed and passed the full fixture oracle; there were no failed controls or OOM events. These small, sequential diagnostics are not the planned 10-second warmup/30-second decision experiment, and the driver performs validation between admissions. CPU deltas include metrics requests and background GC; phase intervals overlap.

At 5,000 rows, median frontend process CPU per measured response was 3.262 ms for prepared transport, 15.132 ms for gRPC decode plus explicit field validation/checksum, 29.791 ms for full compiled rendering, 24.825 ms for full hand rendering, 26.814 ms for eager direct rendering and 27.670 ms for incremental direct rendering. The gRPC control includes extra consumption work and cannot be subtracted from full CPU to infer renderer cost, nor compared to another runtime's total CPU as a proven floor.

Twenty slow-client cycles paused delivery for 100 ms, then closed the client. Nineteen reached server cancellation; one incremental response completed before cancellation reached the server. No server failures occurred. Every cycle exercised backpressure; recovery RSS was approximately 124.9–126.4 MiB in the already-warmed shared diagnostic process. This is sampled RSS without forced GC, includes synthetic prepared-body caches, and does not establish retained heap, bounded memory at arbitrary concurrency, or absence of leaks.

The isolated container was removed after evidence capture. Separate [CPU/allocation profiles](direct-ssr-profiles.md) are now recorded with raw hashes and exact source positions. Repeated-load retained heap and a matched Razor decision experiment remain pending. Host pure-render process CPU is an informative control, not a .NET comparison. Profiler runs must be separate from competitive timings.
