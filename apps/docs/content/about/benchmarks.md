---
title: Benchmarks
description: What Rivet's server and browser benchmarks measured, where Rivet wins, ties and loses, the numbers as reported, and their limits.
template: page
related: [about/roadmap, guides/performance/measuring]
---

Rivet's goal is to render pages on the server faster than ASP.NET Razor, with less CPU and memory, and to beat Solid, React and Qwik in the browser. The server and local keyed-table charts below use the 2026-10-23 runs. The newer server comparison with React is linked under [Runs](#runs). The separate browser-mount and resume results remain dated 2026-10-21 and 2026-10-20; those suites were not rerun in this update:

- **Static pages** use less CPU than Razor and static Solid in every measured integer-page case, including the smallest page one request at a time.
- **Text-heavy pages** (1,000 rows of short strings, the case that favours Razor) are now a win too: less CPU, more pages per second and a faster median response than Razor. This run measured them at one request at a time only.
- **Interactive (resumable) pages** use less CPU than the matching interactive Solid fixture in every measured case. Plain hydratable Solid 1.9 does less work: at 1,000 rows and one request at a time it is level with Rivet, while at 5,000 rows or 1,000 rows under ten concurrent requests Rivet uses less CPU. Plain Solid 1.9 still uses less CPU on the small page under load and on the text-grid fixture. Memory also has remaining losses, shown below.
- **In the browser**, Rivet updates 1,000 rows faster than Solid and React and keeps less memory. Mounting 1,000 and 5,000 rows is level with Solid 1.9 and Solid 2 and faster than React.
- **After resuming**, a click paints as fast as Qwik and faster than hydrated Solid, and navigation is faster than Solid and level with Qwik. Solid's handlers change the DOM sooner after a click or a filter input, and plain Solid 1.9 downloads less JavaScript before the first input.
- **Local keyed tables** stay close to vanilla JavaScript on most operations, with more relative overhead for selection and swapping. Rivet uses more browser memory than vanilla. Published framework comparisons are not comparable here because the local and reference Chrome major versions differ.

This page explains what was measured. Each chart reads its numbers from the report it names: the [server report](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-23-ssr-comparison.md), [local keyed-table report](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-23-krausest.md), [earlier resume report](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-19-fair-comparison.md), or [browser mount report](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-21-dom-mount-2.md). The reports retain the conditions, trial ranges and remaining losses.

All numbers come from short runs on one machine (an Apple M4 Pro Mac, Docker Linux ARM64 for the servers). Ordinary desktop applications remained active during the new runs; no benchmark builds or tests were started during their timed phases. Earlier mount and resume runs shared the host with other test suites. Each chart names its date and conditions. Treat small gaps as noise: the server and earlier browser comparisons require at least a three-percent median gap and non-overlapping trial ranges for a win or loss. The local keyed-table charts show the measured ranges without ranking published frameworks. These are exploratory numbers for one implementation.

## Latest results

Each chart compares lanes of one class: pages that do the same work. Every chart has a table with the same numbers for screen readers, and keyboard users can step through the values with the arrow keys.

### Static pages

A static page sends HTML only, with no client state. Rivet's compiled renderer against Razor and Solid's `renderToString`:

::chart{id=ssr-static-headline}

::chart{id=ssr-static-cpu}

A text grid is the case that favours Razor: every one of the 10 fields per row is a short string, and a fifth of them contain characters that must be escaped. The earlier run (2026-10-09) found Razor's median response faster at ten concurrent requests; this run measured one request at a time, where Rivet wins on CPU, throughput and median response:

::chart{id=ssr-grid-cpu}

### Interactive pages

`rivet-resume` renders a page the browser can resume: a click handler and a reactive attribute per row, links, nested layout state and page data. "Solid 1.9 interactive" does the same work with hydration. The plain hydratable Solid lanes render the same rows without handlers, links or page data, so they do less work. At 1,000 rows and one request at a time, Rivet uses less CPU than the matching interactive fixture and is level with plain Solid 1.9. At 5,000 rows it uses less CPU than both:

::chart{id=ssr-resumable-cpu-1000}

::chart{id=ssr-resumable-cpu-5000}

A small page under load remains a loss against the less demanding plain Solid fixture. At 100 rows and ten concurrent requests, plain hydratable Solid 1.9 needs less CPU per page than Rivet's interactive page; `rivet-router`, the page without row handlers, is level with plain Solid. Rivet still needs less CPU than the matching interactive Solid fixture. Plain Solid 1.9 also needs less CPU than Rivet's interactive page on the text-grid case; the full report shows that loss:

::chart{id=ssr-resumable-cpu-100-c10}

Peak memory is another tradeoff. At 100 rows and one request at a time, interactive Rivet peaks higher than both Solid 1.9 lanes and is level with Solid 2. At 1,000 rows it is below interactive Solid 1.9, above plain Solid 1.9, and level with Solid 2. Each row/concurrency batch prewarmed at its own row count in this run. The earlier multi-row run prewarmed on its largest page, so its smaller-page memory values are not directly comparable with these. Peak working set is not a leak test:

::chart{id=ssr-resumable-memory}

The same 1,000-row interactive page next to Qwik, which also resumes instead of hydrating. Every request renders the page (dynamic rendering, no cache):

::chart{id=ssr-dynamic-cpu-1000}

### Resuming in the browser

The time from an input to the painted update on a throttled device (Slow 4G and a four times slower CPU). A mouse click paints level with Qwik and faster than hydrated Solid; a keyboard click, a tap and a filter are level with Solid. Navigation is faster than Solid and level with Qwik:

::chart{id=resume-input-paint}

The first change to the DOM comes later than Solid's on a mouse click and on filter: Solid's hydrated handlers are attached already, while a resumed page first starts the part of its runtime that runs the handler. The painted update, which is what the user sees, is level or faster (above). Scroll then click shows the same pattern; one of its Rivet trials took far longer than the rest, so it is in the report and not in this chart:

::chart{id=resume-first-change}

Before the first input, Rivet's page downloads more JavaScript than both Solid lanes, less than both Qwik lanes:

::chart{id=resume-js-before-input}

### Building the page in the browser

Client-side mount and updates, with every framework measured in the same interleaved runs. Rivet updates 1,000 rows faster than every lane. Mounting 1,000 rows, Rivet and both Solid versions are level:

::chart{id=dom-mount-1000}

::chart{id=dom-update-1000}

Mounting 5,000 rows is level too. An earlier protocol forced a garbage collection right before the timed mount; when V8 then finished its next collection depended on the page's earlier tasks, which put Solid 1.9 ahead at 5,000 rows ([2026-10-20 mount report](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-20-dom-mount.md)). The benchmark now runs one untimed mount after that collection, and every framework was measured again under it ([2026-10-21 mount report](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-21-dom-mount-2.md)):

::chart{id=dom-mount-5000}

The DOM benchmark's runtime bundle is also larger than Solid 1.9's (gzip), and smaller than Solid 2's and React's. The [scoreboard](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/perf-scoreboard.md) lists the sizes.

### js-framework-benchmark

The new local run rebuilds Rivet and vanilla JavaScript and interleaves them through the [js-framework-benchmark](https://github.com/krausest/js-framework-benchmark) scenarios. The charts show the standard operations starting with a 1,000-row table and the ready/create/clear memory cases. The full report also contains 10,000-row creation, an extra append stress case, memory at 10,000 rows, startup and bundle sizes:

::chart{id=krausest-cpu}

::chart{id=krausest-memory}

The local browser was Chrome 155; the pinned published framework results were measured in Chrome 154. Those framework comparisons are **not comparable** under the docs' browser-major guard. The charts therefore show only the fresh local Rivet/vanilla data, without turning the published ratios into a framework ranking. The [full local report](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-23-krausest.md) records both exact browser versions; the older [scoreboard](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/perf-scoreboard.md) retains its own date and provenance.

## What the server benchmark measures

The server benchmark (`apps/ssr-bench`) renders the same page in each framework:

- Each request fetches data from the same gRPC service, then renders a list page. The page has a number of rows (100, 1,000 or 5,000), each with about 40 HTML elements.
- Every response is checked for status, framing, body length and completion. Strict validation checks every row and field on the first two responses per connection, every thirty-second response, and whenever the body length or tail changes.
- Every frontend container gets the same limit: 1 CPU and 512 MiB of memory.
- Nothing is cached between requests.
- Every Node lane (Rivet, Solid, Qwik and React) runs on the same Node 26 image with the same gRPC data client; Razor runs on .NET 10.

The reports use these measures:

| Measure | Meaning |
| --- | --- |
| Valid pages/s | Correct responses per second. Higher is better. |
| CPU ms/page | CPU time of the whole frontend container (HTTP, gRPC, rendering) per correct page. Lower is better. |
| p50 / p99 complete ms | Time until the full response arrived, for the median and the slowest 1% of requests. |
| Mean TTFB ms | Average time to the first byte of the response. |
| Peak MiB | Highest memory use seen in the container. Not a leak test. |

"Concurrency 1" means one request at a time. That shows the cost of one page, not the maximum a server can handle.

## Runs

| Report | What it compared |
| --- | --- |
| [SSR comparison with React 2026-10-27](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-27-ssr-comparison-react.md) | The 2026-10-23 matrix again with two React 19.3 lanes added: a static page and a hydratable page that does the same per-row work. It also includes browser mount and update at 100 and 1,000 rows. The host was busier than on 2026-10-23, so the charts on this page keep the 2026-10-23 numbers. |
| [Scheduler 2026-10-23](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-23-scheduler.md) | Component layout, complete server rendering, cold input, drag and integration checks. Pure layout meets its target; full-week rendering and historical cold-download budgets remain unmet. |
| [SSR comparison 2026-10-23](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-23-ssr-comparison.md) | The ten-lane Docker matrix used by these charts: integer pages at concurrency 1 and 10, plus the text grid at concurrency 1. The server charts and homepage server numbers read it. |
| [Krausest local run 2026-10-23](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-23-krausest.md) | Fresh local Rivet/vanilla CPU, memory, startup and size measurements. Published framework comparisons are not comparable because Chrome major versions differ. The keyed-table charts read this run. |
| [Fair comparison 2026-10-19](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-19-fair-comparison.md) | The earlier server comparison and the resume run in Chrome 155, with the [scoreboard](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/perf-scoreboard.md). The resume charts still read it; its server data is superseded by the 2026-10-23 run. |
| [DOM mount 2026-10-21](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-21-dom-mount-2.md) | The browser benchmark's mount protocol fix and every browser lane measured again under it, with how much memory each framework allocates per row. The browser charts above read it. |
| [DOM mount 2026-10-20](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-20-dom-mount.md) | Every browser lane re-measured interleaved, plus the attribution of the 5,000-row mount gap to the benchmark's forced garbage collection. Superseded by the 2026-10-21 report. |
| [Fair comparison 2026-10-09](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-09-fair-comparison.md) | The previous run of every lane, with the text grid at concurrency 10 and a 1,000-row browser re-measure. Superseded by the 2026-10-19 report. |
| [Fair comparison 2026-10-06](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-06-fair-comparison.md) | The first like-for-like run of every lane (static and resumable classes, Bun and Deno, escaping, default GC). Superseded by the 2026-10-09 report. |
| [Large DOM comparison](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/large-dom-comparison.md) | An early browser run with 5,000 rows (285,001 elements). Rivet mounted in 728.9 ms against 85.1 ms for Solid. Run on 2026-10-02, before the DOM v2 lowering. |
| [Batched SSR comparison](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/batched-ssr-comparison.md) | A batched Rivet renderer against .NET. At 1,000 rows Rivet used 4.36× .NET CPU per page. |
| [Optimized SSR comparison](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/optimized-ssr-comparison.md) | A large-page optimisation step. At 5,000 rows Rivet still used 2.5× .NET CPU per page. |
| [Compiled SSR comparison](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/compiled-ssr-comparison.md) | The compiled JSX runtime and a Rust worker against .NET. .NET led throughput, CPU and latency; Rivet used less memory. |
| [SSR foundation results](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/ssr-foundation-results.md) | First baseline, before the JSX compiler: Razor, Solid, Qwik and an early Rivet emitter. At 1,000 rows and concurrency 1: 219.1 pages/s and 1.89 CPU ms/page for Razor, versus 176.9 pages/s and 4.42 CPU ms/page for Rivet. |

## Run them yourself

```bash
npm ci
npm run build
npm run bench:ssr -- --quick
npm run bench:ssr:report
```

This needs Node 24+, Python 3.12+ and Docker. The browser benchmarks are `node apps/dom-bench/run.ts` and `node apps/resume-bench/run.ts --build`. See the [benchmark instructions](https://github.com/N1XUS/rivetjs/blob/main/apps/ssr-bench/README.md).
