# Full-request SSR profile

The current `e9aa38b` production Docker image was profiled through its HTTP endpoint, including dummy gRPC calls, decoding, page setup, rendering and writes. A temporary diagnostic server used 1 CPU/512 MiB. After 20 warmups per size, 500 sequential 1,000-row requests and 200 sequential 5,000-row requests passed field-count, token and completion checks. Recorded counters show zero failed or cancelled requests. The diagnostic server was removed after capture.

Inspector sampling overhead and short warmups change execution costs. These profiles are for choosing optimization work; they are not throughput rankings or replacements for the [controlled comparison](batched-ssr-comparison.md).

| Profile | Samples | Idle samples | GC samples | Compiled module self samples |
|---|---:|---:|---:|---:|
| 1,000 rows | 2160 | 709 | 326 | 693 |
| 5,000 rows | 2751 | 638 | 478 | 1122 |

URL-based categories cannot assign every frame: native calls and generated protobuf decoders can have empty URLs. The counts are sampled locations, not measured CPU milliseconds. Garbage collection is prominent, and compiled traversal, scalar conversion and escaping appear repeatedly among the active self frames.

One concrete allocation remains in batched traversal: `compiledSequence` constructs a wrapper callback for `within(owner, callback)` even when `owner` is null. The null-owner path now invokes the loop directly without creating that callback. Owned paths must still restore context after every suspension; existing provider/writer/abort tests cover that invariant. This change does not remove eager page construction or prove that the first-byte regression is fixed.

[Evidence](ssr-request-profile-summary.json) preserves both profile fingerprints, all request/control counters, sample categories, top frames, exact capture scripts and artifact/image identity. Raw profiles remain under `.artifacts/ssr-bench/task7-request-profile/`. Further allocation profiling is needed to attribute GC to specific object types; self samples alone do not prove which allocations caused a collection.

## Unowned traversal diagnostic

Four balanced-order fresh-process repeats compare the previous batched adapter with the direct unowned path, using the same 1 CPU/512 MiB image and accepting discard sink. Each probe warms up 200 renders and measures 2,000 renders of a 1,000-row ASCII fixture. Median process CPU is 3,897.380 ms before and 3,782.154 ms after, about 3% lower. One of four paired repeats is slower; short probes do not establish statistical significance. All eight outputs have identical complete-page hashes and lengths.

[Probe evidence](ssr-unowned-traversal-diagnostic.json) preserves all records, source and artifact fingerprints. The direct adapter is 9,242 raw / 3,778 gzip bytes versus 9,196 / 3,768 previously. These are server artifacts, not browser transfer sizes. No end-to-end .NET improvement or first-byte fix is claimed. The reviewed change passes 47 focused tests and fresh full workspace checks across six projects and two dependent builds.
