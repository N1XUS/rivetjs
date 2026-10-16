# SSR foundation evidence — 2026-10-02

.NET Razor leads CPU efficiency in these fixtures and leads throughput in the unsaturated structured-page profiles. Rivet does not yet beat .NET across the requested metrics. Rivet's experimental emitter uses less observed frontend memory in the large-page grid and beats the pinned Solid/Qwik adapters in those fixtures. These are short exploratory measurements of one implementation and machine, not universal framework rankings.

At 1,000 rows and concurrency 1, the three-trial medians are 219.1 pages/s and 1.89 CPU ms/page for Razor, versus 176.9 pages/s and 4.42 CPU ms/page for Rivet. Maximum sampled frontend working sets across those trials are 87.3 MiB and 73.1 MiB respectively. Neither profile has generator/backend warnings. The CPU measure covers the entire frontend container, including HTTP, gRPC client, protobuf handling, and rendering.

## Scope and measurement limits

All pages make one real gRPC request to the same deterministic ASP.NET service. Native gRPC channels are reused, per-request logging is off, and final pages/data are uncached. The structured fixture has 40 ordinary HTML elements and ten dynamic values per row. Every response is checked for row identities, every field value, request token, requested article sections, status 200, and complete HTML. Competitors retain their native production metadata; Rivet currently has no interactive/resumable output or JSX compiler. This is a static SSR baseline, not interactive equivalence.

The host is macOS 26.6.2 arm64 with 14 host CPUs. Docker Desktop 29.1.2 uses a Linux arm64 VM with 10 CPUs and 16,748,421,120 bytes of memory. Every frontend has the same 1 CPU / 512 MiB limit; the backend has 2 CPUs / 1 GiB and the Python generator 2 CPUs / 512 MiB. Node is 24.14.1; Solid is 2.0.0-rc.13, Qwik core is 2.0.0-rc.0, and ASP.NET runtime is 10.0.12. Exact image IDs, compiled artifact hashes, versions, options, per-trial counters, and warnings are retained in [the committed summary](ssr-foundation-summary.json).

Trials use only three seconds of measured load and one second of warmup, with three rotated repeats, except the single fixed-arrival diagnostic with no warmup. This is deliberately exploratory evidence. Variation is substantial: Rivet's 100-row concurrency-1 grid repeats span roughly 403–1,531 pages/s. Longer warmup/trials and independent generator capacity checks are needed for release claims. Throughput includes drain time; failures never count as successes. CPU includes unsuccessful work but is divided by successful responses. Phase times are wall time and include stream waiting; they are not isolated renderer CPU.

Python response validation consumes generator CPU. A warning flags possible GIL limits above 0.8 CPU, backend limits above 1.6 CPUs, or missed fixed-arrival starts. Warned throughput cannot establish renderer capacity or a winner. Memory is sampled container working set after subtracting inactive file pages, not RSS, heap allocation, or proof of no leaks. Other Docker workloads were present; VM/host contention is a further uncontrolled factor.

## Structured pages: 72 trials

Medians summarize three repeats; memory is the highest observed working-set sample across the repeats. Full per-trial latency, HTML bytes, TTFB, CPU throttling, phase timings, and participant state are retained in JSON/HTML reports. In particular, Rivet's small apparent high-concurrency throughput wins over Razor occur in generator-warned cases and cannot establish a capacity win.

| Rows | Concurrency | Framework | Median pages/s | Median CPU ms/page | Maximum working MiB | Failures | Warned trials |
|---:|---:|---|---:|---:|---:|---:|---:|
| 100 | 1 | dotnet | 1442.8 | 0.38 | 87.2 | 0 | 0/3 |
| 100 | 1 | qwik | 74.3 | 13.43 | 84.3 | 0 | 0/3 |
| 100 | 1 | rivet | 439.2 | 1.37 | 60.3 | 0 | 0/3 |
| 100 | 1 | solid | 1092.1 | 0.90 | 93.0 | 0 | 0/3 |
| 100 | 10 | dotnet | 1745.6 | 0.34 | 87.8 | 0 | 3/3 |
| 100 | 10 | qwik | 74.7 | 13.39 | 158.1 | 0 | 0/3 |
| 100 | 10 | rivet | 1712.2 | 0.54 | 67.0 | 0 | 2/3 |
| 100 | 10 | solid | 1110.1 | 0.90 | 125.7 | 0 | 0/3 |
| 100 | 100 | dotnet | 1942.0 | 0.39 | 88.7 | 0 | 3/3 |
| 100 | 100 | qwik | 70.8 | 14.17 | 159.0 | 0 | 0/3 |
| 100 | 100 | rivet | 1954.6 | 0.50 | 73.4 | 0 | 3/3 |
| 100 | 100 | solid | 1192.5 | 0.85 | 147.2 | 0 | 0/3 |
| 1000 | 1 | dotnet | 219.1 | 1.89 | 87.3 | 0 | 0/3 |
| 1000 | 1 | qwik | 6.2 | 164.21 | 163.7 | 0 | 0/3 |
| 1000 | 1 | rivet | 176.9 | 4.42 | 73.1 | 0 | 0/3 |
| 1000 | 1 | solid | 90.8 | 10.99 | 149.6 | 0 | 0/3 |
| 1000 | 10 | dotnet | 190.2 | 2.30 | 98.6 | 0 | 3/3 |
| 1000 | 10 | qwik | 6.1 | 165.01 | 164.0 | 0 | 0/3 |
| 1000 | 10 | rivet | 202.5 | 3.96 | 75.9 | 0 | 3/3 |
| 1000 | 10 | solid | 124.4 | 8.16 | 158.8 | 0 | 0/3 |
| 1000 | 100 | dotnet | 229.5 | 2.15 | 268.4 | 0 | 3/3 |
| 1000 | 100 | qwik | 6.4 | 157.83 | 165.5 | 69 | 3/3 |
| 1000 | 100 | rivet | 235.9 | 3.50 | 108.3 | 0 | 3/3 |
| 1000 | 100 | solid | 136.3 | 7.46 | 156.0 | 0 | 0/3 |

Qwik timed out 69 requests in the 1,000-row concurrency-100 grid (21/23/25 by repeat). No participant was OOM-killed. These overload failures belong in the report, rather than being excluded to create a favorable ranking. They describe this pinned adapter and fixture.

## Article parsing: 36 trials

The article path measures gRPC → Markdown parser → SSR. JavaScript uses Marked; .NET uses Markdig, so this compares the entire pipeline and different parsers, rather than the template engine alone.

| Rows | Concurrency | Framework | Median pages/s | Median CPU ms/page | Maximum working MiB | Failures | Warned trials |
|---:|---:|---|---:|---:|---:|---:|---:|
| 0 | 1 | dotnet | 2971.4 | 0.26 | 91.9 | 0 | 0/3 |
| 0 | 1 | qwik | 1198.8 | 0.83 | 67.3 | 0 | 0/3 |
| 0 | 1 | rivet | 1729.3 | 0.51 | 88.9 | 0 | 0/3 |
| 0 | 1 | solid | 1246.0 | 0.80 | 148.2 | 0 | 0/3 |
| 0 | 10 | dotnet | 6679.8 | 0.15 | 93.2 | 0 | 3/3 |
| 0 | 10 | qwik | 1430.0 | 0.70 | 72.4 | 0 | 0/3 |
| 0 | 10 | rivet | 2116.2 | 0.47 | 89.7 | 0 | 0/3 |
| 0 | 10 | solid | 1345.1 | 0.74 | 148.6 | 0 | 0/3 |
| 0 | 100 | dotnet | 6903.0 | 0.15 | 98.8 | 0 | 3/3 |
| 0 | 100 | qwik | 1458.3 | 0.69 | 90.7 | 0 | 0/3 |
| 0 | 100 | rivet | 1936.7 | 0.52 | 90.0 | 0 | 0/3 |
| 0 | 100 | solid | 1350.9 | 0.74 | 149.6 | 0 | 0/3 |

## Writer comparison: 12 trials

At 1,000 rows and concurrency 100, streaming has median 241.2 successful pages/s versus 277.0 for the string variant, with median mean TTFB 49.6 ms versus 333.2 ms. The stream trials have generator warnings; completion throughput cannot establish their capacity. CPU per successful page is about 3.40 ms versus 3.60 ms, and peak working memory is 118.6 MiB versus 110.7 MiB. Streaming does not universally use less memory. The string variant also performs better in completion throughput at concurrency 10, while streaming delivers the first bytes earlier.

Keep streaming as the current default because its first-byte behavior is better in this comparison, while retaining the string variant for measurement. Bounded buffers, cancellation, and backpressure remain required for both. This is a workload-specific choice, not a general proof that one writer wins.

## Fixed-arrival diagnostic: 4 trials

At 50 scheduled requests/s, 1,000 rows, and concurrency cap 100, Rivet, Solid, and Razor complete about 50.2 pages/s with no failures and maximum admission delay below 5 ms. Qwik completes about 6.1 pages/s, times out 36 requests, and reaches about 5.14 seconds admission delay. This single short diagnostic exposes overload; it is not a repeated latency-at-capacity study.

Across all 124 measured trials, Qwik accounts for all 105 failed responses. The grid and fixed-arrival commands exit 1 intentionally when failures are measured; article and writer commands exit 0. No OOM is recorded. The benchmark records failures; these exits do not indicate the unit/integration tests failed.

## Reproduce and inspect

From the repository root, build once outside measurement intervals, then run:

```sh
npm ci
npm run build
npm test
npm run bench:ssr -- --rows=100,1000 --concurrency=1,10,100 --duration=3 --warmup=1 --repeats=3
npm run bench:ssr -- --article --rows=0 --concurrency=1,10,100 --duration=3 --warmup=1 --repeats=3 --skip-build
npm run bench:ssr -- --frameworks=rivet,rivet-string --rows=1000 --concurrency=10,100 --duration=3 --warmup=1 --repeats=3 --skip-build
npm run bench:ssr -- --rows=1000 --concurrency=100 --rate=50 --duration=3 --warmup=0 --repeats=1 --skip-build
npm run bench:ssr:report
```

The report is served at [localhost:18120](http://127.0.0.1:18120/report.html). Each invocation preserves its own directory under `.artifacts/ssr-bench/runs/`; raw responses and sampling arrays are ignored by Git but retained locally. The committed summary has the SHA-256 of each full results.json and all 124 compact trial records. Re-running creates new evidence instead of overwriting this baseline. [Benchmark instructions](../../apps/ssr-bench/README.md) describe defaults and longer exploratory profiles.

The retained run IDs are:

- Grid: `20261002T140022.147556Z-79898925`
- Article: `20261002T140956.721302Z-0145b5dc`
- Writers: `20261002T141420.938867Z-73a035f6`
- Fixed arrival: `20261002T141604.167435Z-411e6531`

## Verification and next work

Clean npm install and uncached Nx tests pass: seven emitter tests, four adapter/REST tests, and eleven Python tests. Actual Docker gRPC/HTTP, browser REST/HTML, cancellation, slow-client recovery, and repeated-load tests pass another eighteen Node checks. Total: 29 Node + 11 Python = 40 checks. Both native .NET projects build, and the final locked container rebuild succeeds. These tests cover this server foundation; client signals, routing disposal, and resumability are future work.

The next performance investigation should separate gRPC/protobuf, Markdown parsing, and pure emission/escaping, then test a Rust renderer against the current emitter. A Rust compiler by itself changes build cost, not the language of generated SSR execution. Arbitrary JavaScript server logic must retain its semantics; any native boundary must count data conversion/copying, cancellation, and streaming costs. See [implementation notes](../design/ssr-foundation-implementation-notes.md) for decisions, review findings, and remaining scope.
