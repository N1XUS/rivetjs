# Batched compiled SSR comparison

The current compiled Rivet build improves on the pinned earlier build but still misses the .NET CPU and complete-response goals. At 5,000 rows, the median paired repeat uses 20.6% less CPU, takes 33.2% less time for a median complete response, and serves 30.8% more valid pages per second. Mean time to first byte is 8.8% higher than the earlier build.

## Results

Table entries are medians across three rotated repeats; latency entries are medians of per-trial percentiles or means, not pooled request percentiles. Peak memory is sampled container working set, not retained heap or a leak proof.

| Rows | Renderer | Valid pages/s | CPU ms/page | p50 complete ms | p99 complete ms | Mean TTFB ms | Peak MiB |
|---:|---|---:|---:|---:|---:|---:|---:|
| 1000 | Pinned earlier Rivet | 110.845 | 8.982 | 5.246 | 29.842 | 3.030 | 50.496 |
| 1000 | Current batched Rivet | 147.455 | 6.734 | 3.874 | 22.472 | 2.850 | 46.934 |
| 1000 | .NET | 306.843 | 1.596 | 1.321 | 2.676 | 1.099 | 76.277 |
| 5000 | Pinned earlier Rivet | 28.552 | 32.472 | 25.194 | 32.148 | 7.379 | 93.543 |
| 5000 | Current batched Rivet | 37.522 | 25.780 | 16.834 | 23.582 | 7.990 | 93.086 |
| 5000 | .NET | 50.004 | 13.405 | 9.836 | 17.767 | 8.954 | 97.992 |

Ratios below are medians of same-repeat paired ratios, which can differ from ratios of the table’s separate group medians:

- At 1,000 rows, current Rivet uses 24.4% less CPU than the earlier build. It still uses 4.36× .NET CPU per valid page and takes 2.97× as long for a median complete response.
- At 5,000 rows, current Rivet still uses 1.94× .NET CPU and takes 1.71× as long for a median complete response. Mean TTFB is about 11.5% lower than .NET, while throughput remains lower.
- At 5,000 rows, median observed peak memory is 93.09 MiB for current Rivet versus 97.99 MiB for .NET. The memory difference is about 5%, and does not establish long-term memory behavior.

The 5,000-row median render wall-time counter is 13.653 ms/page for current Rivet, versus 22.043 for the earlier build and 8.466 for .NET. These counters include writer waits and are not pure rendering CPU. CPU/page measures the whole frontend container, including transport and setup. The remaining gap needs profiling across those phases.

## Protocol and provenance

- Run `20261002T180117.802172Z-b8c7392b`; current source `e9aa38b`, pinned earlier source `b01eba3`. This measures all intervening changes, including direct traversal, escaping and async support, not isolated batching causality.
- 18 measured trials and 18 warmups: three lanes × 1,000/5,000 rows × concurrency 1 × three rotated repeats. Each trial uses 3 seconds warmup and 10 seconds measured admission.
- 20,329 measured and 5,782 warmup valid responses. Zero recorded failures, sampling errors, warnings or OOM states. All 36 raw files and source results are fingerprinted in the summary.
- Equal frontends: 1 CPU/512 MiB. Shared dummy gRPC backend: 2 CPU/1 GiB. Python generator: 2 CPU/512 MiB. Docker Linux ARM64 on Apple M4 Pro. No builds or correctness tests ran during timing.
- The 5,000-row response has about 200,000 native HTML elements and 3.49 MB of HTML. Current Rivet bodies differ from .NET by 14 bytes of static output. One earlier/current pair differs by one byte due to one-digit versus two-digit trial tokens. Rows and fields passed the harness validator; bodies are not retained for a second offline parse.
- CPU/page is cumulative whole-container CPU over the resource sampling window divided by validated completions. Sampling includes startup/drain beyond the load interval; sample-window and load-duration quota percentages are recorded separately. The 1,000-row Rivet lanes use about 96% of their frontend CPU quota over the sampling window.
- Closed-loop concurrency one is not maximum-capacity evidence. Three short repeats do not establish statistical significance. These results do not measure interactive browser updates, retained-memory leaks or Lighthouse. No failed trials were discarded or retried. No final response/data caching.

The batched server adapter is 9,196 raw / 3,768 gzip / 3,287 Brotli bytes, versus the pinned earlier adapter’s 6,659 / 2,934 / 2,499. Common HTTP/gRPC dependencies and browser application bundles are excluded. The isolated emission [batching diagnostic](ssr-compiled-batching.md) compares against the immediately preceding direct-traversal implementation separately.

## Reproduce and inspect

Build the current image and retain the pinned earlier image before timing; `--skip-build` prevents implicit startup builds and the harness verifies the pinned earlier image ID.

```sh
npm run bench:ssr -- --frameworks rivet-compiled-baseline,rivet-compiled,dotnet --rows 1000,5000 --concurrency 1 --warmup 3 --duration 10 --repeats 3 --skip-build --out .artifacts/ssr-bench/task7-batched
npm run bench:ssr:report
```

Open [the local report](http://127.0.0.1:18120/task7-batched/report.html) while the report server runs. [Committed evidence](batched-ssr-comparison-summary.json) preserves exact images, artifacts, all repeat values, ranges, paired ratios, counters and raw fingerprints. [The previous large-page run](optimized-ssr-comparison.md) remains separate; it is not a matched measurement of this optimization.

Next work targets the remaining eager setup/allocation and rendering costs, including the time-to-first-byte regression. Native server hosting needs a separate control to distinguish rendering gains from transport/runtime gains. Browser performance and true resumability remain independent unfinished work.
