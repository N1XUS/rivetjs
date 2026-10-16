---
title: Benchmarks
description: What Rivet's server and browser benchmarks measured, where Rivet wins, ties and loses, the numbers as reported, and their limits.
template: page
related: [about/roadmap, guides/performance/measuring]
---

Rivet's goal is to render pages on the server faster than ASP.NET Razor, with less CPU and memory, and to beat Solid, React and Qwik in the browser. The latest runs (2026-10-09) show where that holds and where it does not:

- Static pages use less CPU than Razor and Solid at every page size measured: 3.59× less than Razor at 1,000 rows.
- On a text-heavy page (1,000 rows of short strings), Rivet uses about half of Razor's CPU at concurrency 1. At concurrency 10 the CPU is level, and Razor's median response is faster (19.6 against 24.0 ms).
- Interactive (resumable) pages use 2.1× less CPU than Solid doing the same work at 1,000 rows. Plain hydratable Solid 1.9, which renders the rows without handlers, links or page data, still uses less CPU than Rivet at 1,000 rows (1.74 against 3.04 ms). Interactive pages also use more memory than every Solid lane.
- In the browser, Rivet mounts and updates 1,000 rows faster than Solid and React. After resuming, a click is level with Qwik, and navigation is faster than Qwik and Solid. Solid is faster on the filter scenario in this run.

This page explains what was measured. Each chart reads its numbers from the [full report](https://github.com/rivetjs/rivet/blob/main/docs/benchmarks/2026-10-09-fair-comparison.md) in the repository and links to it; the report also lists every loss.

All numbers come from short runs on one machine (an Apple M4 Pro Mac, Docker Linux ARM64). Other jobs were running on the host during the runs (1-minute load average 5 to 27), so treat small gaps as noise. They are exploratory evidence for one implementation, not a ranking of frameworks.

## Latest results

Each chart compares lanes of one class: pages that do the same work. Every chart has a table with the same numbers for screen readers, and keyboard users can step through the values with the arrow keys.

### Static pages

A static page sends HTML only, with no client state. Rivet's compiled renderer against Razor and Solid's `renderToString`:

::chart{id=ssr-static-headline}

::chart{id=ssr-static-cpu}

A text grid is the case that favours Razor: every one of the 10 fields per row is a short string, and 20% of them contain characters that must be escaped. Rivet still uses less CPU at concurrency 1; at concurrency 10 the two are level:

::chart{id=ssr-grid-cpu}

### Interactive pages

`rivet-resume` renders a page the browser can resume: a click handler and a reactive attribute per row, links, nested layout state and page data. "Solid 1.9 interactive" does the same work with hydration. The plain hydratable Solid lanes render the same rows without handlers, links or page data, so they do less work. Solid 1 hydratable still uses less CPU than Rivet at 1,000 rows and is level at 5,000:

::chart{id=ssr-resumable-cpu-1000}

::chart{id=ssr-resumable-cpu-5000}

The same 1,000-row interactive page next to Qwik, which also resumes instead of hydrating. Every request renders the page (dynamic rendering, no cache):

::chart{id=ssr-dynamic-cpu-1000}

### Resuming in the browser

The time from an input to the painted update on a throttled device (Slow 4G and 4× CPU). Rivet and Qwik are level on a mouse click, and Rivet and Solid are level on a keyboard click and a tap. Rivet navigates faster than every other lane. On filter, Solid's median is lower than Rivet's; the runs overlap, so the report calls it a tie:

::chart{id=resume-input-paint}

### Building the page in the browser

Client-side mount and updates of 1,000 rows. Rivet is ahead of every lane; the gap to Solid 1.9 on mount is small:

::chart{id=dom-mount-1000}

::chart{id=dom-update-1000}

The 5,000-row browser case was not re-measured in this run: its Chromium process tree goes past the 3 GB memory cap of the benchmark machine.

## What the server benchmark measures

The server benchmark (`apps/ssr-bench`) renders the same page in each framework:

- Each request fetches data from the same gRPC service, then renders a list page. The page has a number of rows (100, 1,000 or 5,000), each with about 40 HTML elements.
- Every response is checked: all rows, all field values, status 200, complete HTML.
- Every frontend container gets the same limit: 1 CPU and 512 MiB of memory.
- Nothing is cached between requests.
- Every Node lane runs on the same Node 26 image with the same gRPC data client; Razor runs on .NET 10.

The reports use these measures:

| Measure | Meaning |
| --- | --- |
| Valid pages/s | Correct responses per second. Higher is better. |
| CPU ms/page | CPU time of the whole frontend container (HTTP, gRPC, rendering) per correct page. Lower is better. |
| p50 / p99 complete ms | Time until the full response arrived, for the median and the slowest 1% of requests. |
| Mean TTFB ms | Average time to the first byte of the response. |
| Peak MiB | Highest memory use seen in the container. Not a leak test. |

"Concurrency 1" means one request at a time. That shows the cost of one page, not the maximum a server can handle.

## Earlier reports

| Report | What it compared |
| --- | --- |
| [SSR foundation results](https://github.com/rivetjs/rivet/blob/main/docs/benchmarks/ssr-foundation-results.md) | First baseline, before the JSX compiler: Razor, Solid, Qwik and an early Rivet emitter. At 1,000 rows and concurrency 1: 219.1 pages/s and 1.89 CPU ms/page for Razor, versus 176.9 pages/s and 4.42 CPU ms/page for Rivet. |
| [Compiled SSR comparison](https://github.com/rivetjs/rivet/blob/main/docs/benchmarks/compiled-ssr-comparison.md) | The compiled JSX runtime and a Rust worker against .NET. .NET led throughput, CPU and latency; Rivet used less memory. |
| [Optimized SSR comparison](https://github.com/rivetjs/rivet/blob/main/docs/benchmarks/optimized-ssr-comparison.md) | A large-page optimisation step. At 5,000 rows Rivet still used 2.5× .NET CPU per page. |
| [Batched SSR comparison](https://github.com/rivetjs/rivet/blob/main/docs/benchmarks/batched-ssr-comparison.md) | A batched Rivet renderer against .NET. At 1,000 rows Rivet used 4.36× .NET CPU per page. |
| [Fair comparison 2026-10-06](https://github.com/rivetjs/rivet/blob/main/docs/benchmarks/2026-10-06-fair-comparison.md) | The first like-for-like run of every lane (static and resumable classes, Bun and Deno, escaping, default GC). Superseded by the 2026-10-09 report. |
| [Large DOM comparison](https://github.com/rivetjs/rivet/blob/main/docs/benchmarks/large-dom-comparison.md) | An early browser run with 5,000 rows (285,001 elements). Rivet mounted in 728.9 ms against 85.1 ms for Solid. Run on 2026-10-02, before the DOM v2 lowering. |

## Run them yourself

```bash
npm ci
npm run build
npm run bench:ssr -- --quick
npm run bench:ssr:report
```

This needs Node 24+, Python 3.12+ and Docker. The browser benchmarks are `node apps/dom-bench/run.ts` and `node apps/resume-bench/run.ts --build`. See the [benchmark instructions](https://github.com/rivetjs/rivet/blob/main/apps/ssr-bench/README.md).
