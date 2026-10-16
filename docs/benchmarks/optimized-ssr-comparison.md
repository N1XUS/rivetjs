# Large-page compiled SSR comparison

The current compiled Rivet image reduces CPU per page by about 12% at 5,000 rows compared with the pinned earlier image. It still consumes 2.5× .NET CPU per page and takes about twice as long for a median complete response. The goal of beating .NET across metrics is not met.

## Results

Each value is the median across three rotated repeats. Latencies are medians of per-trial percentiles, not pooled percentiles. Peak memory is sampled container working set, not retained heap.

| Rows | Renderer | Valid responses/s | CPU ms/page | p50 complete ms | p99 complete ms | Peak MiB | Render wall ms/page |
|---:|---|---:|---:|---:|---:|---:|---:|
| 1000 | Earlier compiled Rivet | 107.250 | 9.252 | 5.581 | 29.284 | 46.668 | 5.709 |
| 1000 | Current compiled Rivet | 112.056 | 8.893 | 5.242 | 29.472 | 43.652 | 5.381 |
| 1000 | .NET | 297.747 | 1.626 | 1.381 | 2.821 | 78.473 | 0.940 |
| 5000 | Earlier compiled Rivet | 28.247 | 33.399 | 25.411 | 36.018 | 93.945 | 21.776 |
| 5000 | Current compiled Rivet | 31.505 | 29.499 | 22.062 | 27.929 | 89.918 | 18.088 |
| 5000 | .NET | 46.855 | 11.776 | 10.823 | 19.818 | 96.211 | 8.985 |

At 1,000 rows, the CPU reduction versus the earlier image is about 4%; current Rivet still uses 5.5× .NET CPU. At 5,000 rows, throughput improves about 12% and median response latency falls about 13%. These ratios compare group medians; the summary also preserves paired-repeat ratios and ranges. Three short repeats do not establish statistical significance.

Current Rivet uses roughly 44% less observed peak working memory than .NET at 1,000 rows, and 7% less at 5,000. Render counters include writer waits and are wall time, not isolated rendering CPU. The 1,000-row Rivet lanes consume about 96% of the frontend quota over the resource sampling window; no generator warning does not mean an unsaturated frontend.

## Protocol and provenance

- Run `20261002T172328.592230Z-49a9c635`: 18 measured trials and 18 warmups; 18,696 measured valid responses and 5,553 warmup valid responses. Zero recorded failures, sampling errors, warnings or OOM states.
- Three lanes × 1,000/5,000 rows × concurrency 1 × three rotated repeats. Each trial uses 3 seconds warmup and 10 seconds measured admission. This closed-loop workload does not establish maximum capacity.
- Equal frontends: 1 CPU/512 MiB. Shared dummy gRPC backend: 2 CPU/1 GiB. Python generator: 2 CPU/512 MiB. Docker Linux ARM64 on Apple M4 Pro. Builds and correctness checks completed before timing; no builds or tests ran during timing.
- Current framework source: `7602280`; benchmark controls: `dd9c767`; earlier framework source: `b01eba3`. The pinned earlier image and current image both ran in this same comparison, avoiding a comparison of separate historical runs.
- 5,000 rows contain approximately 200,000 native HTML elements and produce about 3.49 MB of HTML. Current Rivet responses are 14 bytes longer than .NET due to static output differences. The first earlier/current 5,000-row pair also differs by one byte because its trial tokens change from one to two digits. All rows and fields passed the harness validator; bodies are not retained for a second offline parse.
- CPU/page uses whole-container cumulative CPU over the resource sampling window divided by validated completions. Sampling windows are around 10.35 seconds and include startup/drain outside the approximately 10-second load interval. Quota percentages using these two denominators are recorded separately.
- All 36 raw warmup/trial files are retained locally with SHA-256 hashes in the committed summary, along with results fingerprint, exact image IDs, per-case counters, ranges and paired ratios. No failed trials were discarded or retried. No final response/data caching.

The compiled server adapter grew from 6,659 to 8,318 raw bytes, and from 2,934 to 3,530 gzip bytes, while async/router support was added. These sizes exclude common HTTP/gRPC dependencies and are not browser transfer sizes. This comparison measures the combined current implementation, not an isolated escaping optimization.

## Reproduce and inspect

Retain the earlier image under `rivet-ssr-bench-node:b01eba3-baseline` and build the current image before the timed command. The harness checks the earlier image ID and `--skip-build` prohibits implicit builds during startup.

```sh
npm run bench:ssr -- --frameworks rivet-compiled-baseline,rivet-compiled,dotnet --rows 1000,5000 --concurrency 1 --warmup 3 --duration 10 --repeats 3 --skip-build --out .artifacts/ssr-bench/task7-optimized
npm run bench:ssr:report
```

Open [the local report](http://127.0.0.1:18120/task7-optimized/report.html) while the report server runs. [Committed evidence](optimized-ssr-comparison-summary.json) contains the aggregate and raw fingerprints. [The previous four-renderer comparison](compiled-ssr-comparison.md) remains separate.

Next optimization work targets compiled template allocation, traversal and output emission. Larger interactive browser workloads, update CPU and retained-memory behavior require their own measurements. Small demonstration-page Lighthouse scores are not evidence for these performance goals.
