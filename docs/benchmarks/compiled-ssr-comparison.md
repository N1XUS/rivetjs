# Compiled JSX and native-worker SSR comparison

.NET still leads the concurrency-1 cases with no generator/backend warnings in throughput, CPU per valid page and complete-response latency. The Node lanes use less observed peak working memory. The current compiled JSX runtime and Node/Rust worker do not meet the goal of beating .NET across all metrics.

These are static SSR fixture controls. The Rust worker includes Node HTTP/gRPC, Unicode normalization, JSON, pipes, framing and fully buffered output; it does not measure a Rust-owned server or generic native JSX. The hand emitter is a lower-overhead rendering control. Browser reactivity, resumability and Lighthouse are separate measurements.

## 1,000-row comparison at concurrency 1

Each entry is the median across four rotated repeats. Latency entries are medians of per-trial percentiles, not pooled request percentiles. Peak memory is observed container working set, not retained heap or proof against leaks.

| Renderer | Valid responses/s | CPU ms/page | p50 complete ms | p99 complete ms | Peak MiB |
|---|---:|---:|---:|---:|---:|
| rivet | 221.1 | 3.914 | 2.395 | 8.860 | 69.79 |
| rivet-compiled | 118.0 | 8.420 | 5.100 | 29.647 | 66.29 |
| rivet-native-worker | 164.6 | 5.996 | 3.152 | 28.450 | 72.86 |
| dotnet | 314.5 | 1.450 | 1.230 | 2.577 | 80.43 |

Compiled JSX takes about 5.8× .NET CPU per page in these matched repeats; the native worker takes about 4.1×. At 100 rows, the corresponding ratios are about 2.4× and 2.1×. The memory saving is useful, but it does not compensate for the CPU and latency losses.

The compiled lane reports mean render wall time of 5.442 ms/page at 1,000 rows/concurrency 1, versus 1.916 ms for the hand emitter and 0.880 ms for .NET. These phases include writer waits. They identify compiled traversal/emission as an optimization target, rather than proving an isolated CPU profile.

## Native crossing costs

Mean wall milliseconds per completed page, averaged across four repeats. IPC includes Rust parsing/rendering, pipe copies and Node framing; stdin overlaps IPC, so the phases must not be summed.

| Rows / concurrency | Normalize | JSON | UTF-8 encode | Queue | IPC | HTTP write |
|---|---:|---:|---:|---:|---:|---:|
| 100 / 1 | 0.052 | 0.015 | 0.003 | 0.001 | 0.138 | 0.021 |
| 100 / 10 | 0.089 | 0.027 | 0.003 | 0.710 | 0.450 | 0.032 |
| 1000 / 1 | 0.941 | 0.174 | 0.098 | 0.003 | 1.459 | 0.112 |
| 1000 / 10 | 2.337 | 0.357 | 0.171 | 40.592 | 6.096 | 0.180 |

At 1,000 rows/concurrency 10, queueing contributes 40.592 ms/page of the 49.784 ms mean native render phase. The native worker serializes jobs and buffers complete output. Mean first-byte time is 58.361 ms native, 54.860 ms compiled and 2.868 ms .NET; the .NET case carries a generator warning. This is evidence against using the current worker crossing as the default framework backend.

## Protocol and limitations

- Run `20261002T154711.483735Z-ebea0c97`, measured commit `b01eba3`.
- Four renderers × 100/1,000 rows × concurrency 1/10 × four balanced rotated repeats: 64 measured trials and 64 warmups. Each trial uses 3 seconds warmup and 10 seconds measured admission.
- Equal frontend quotas: 1 CPU and 512 MiB. Shared backend: 2 CPU/1 GiB. Python generator: 2 CPU/512 MiB. Docker Desktop Linux ARM64 on Apple M4 Pro; full environment and image hashes are in the summary.
- 578,981 measured attempts; zero invalid/failed responses, sampling errors or OOMs. All 128 raw warmup/trial files are retained and hashed.
- All 16 hand-emitter/.NET concurrency-10 cases warn that Python generator CPU may limit throughput. No concurrency-1, compiled or native-worker case has a generator warning, and the backend does not reach its warning threshold. The compiled 1,000-row/concurrency-1 frontend uses about 99% of its one-CPU quota; absence of a generator warning does not mean the frontend is unsaturated. Concurrency-10 throughput cannot establish maximum frontend capacity or an unrestricted ranking.
- Builds and correctness tests completed before timing. Other comparison frontends were stopped. No failed trials were discarded or retried. No final response/data caching.
- Longer repeated trials improve on the earlier short baseline, but this is one fixture/machine. The observed memory peaks do not establish long-term retained-memory behavior.

The compiled adapter bundle is 6,659 raw bytes / 2,934 gzip bytes. The native adapter is 5,628 / 2,234 plus a 395,544-byte Linux ARM64 binary. These are server adapter/render artifacts; common HTTP/gRPC dependencies and browser application bundles are separate. They are not client transfer sizes.

## Reproduce and inspect

```sh
npm run bench:ssr -- --frameworks rivet,rivet-compiled,rivet-native-worker,dotnet --rows 100,1000 --concurrency 1,10 --warmup 3 --duration 10 --repeats 4 --out .artifacts/ssr-bench/task7-comparison
npm run bench:ssr:report
```

With the loopback report server running, open [the comparison index](http://127.0.0.1:18120/task7-comparison/report.html). Complete JSON, per-request data and individual reports are under `.artifacts/ssr-bench/task7-comparison/runs/20261002T154711.483735Z-ebea0c97/`. [Committed summary](compiled-ssr-comparison-summary.json) preserves group means/medians/ranges, paired ratios, per-case failures/counters and artifact hashes; original retained results remain unchanged.

Next measurement work: reduce compiled SSR traversal and allocation overhead, calibrate a generator that can keep up at higher concurrency, and compare pure native emission with a native-owned server before drawing conclusions about Rust. Async/router/lazy/client-only features continue separately; these static fixture results do not validate those features.
