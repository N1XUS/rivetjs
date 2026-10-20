---
title: Benchmarks
description: What Rivet's server and browser benchmarks measured, where Rivet wins, ties and loses, the numbers as reported, and their limits.
template: page
related: [about/roadmap, guides/performance/measuring]
---

Rivet's goal is to render pages on the server faster than ASP.NET Razor, with less CPU and memory, and to beat Solid, React and Qwik in the browser. The latest runs (server 2026-10-19, browser 2026-10-20) show where that holds and where it does not:

- **Static pages** use less CPU than Razor and Solid at 1,000 and 5,000 rows, and at 100 rows under ten concurrent requests. On the smallest page one request at a time the trial ranges overlap, so the report counts it as level.
- **Text-heavy pages** (1,000 rows of short strings, the case that favours Razor) are now a win too: less CPU, more pages per second and a faster median response than Razor. This run measured them at one request at a time only.
- **Interactive (resumable) pages**, one request at a time, use less CPU than every Solid and Qwik lane at 1,000 and 5,000 rows, including plain hydratable Solid 1.9, which renders the rows without handlers, links or page data; at 1,000 rows under ten concurrent requests they are level with it. Two losses remain: on a 100-row page under ten concurrent requests plain hydratable Solid 1.9 needs less CPU, and the server process of an interactive page uses more memory than every Solid lane at 100 rows.
- **In the browser**, Rivet updates 1,000 rows faster than Solid and React. Mounting 1,000 rows is level with Solid; mounting 5,000 rows, Solid 1.9 is faster under this benchmark's protocol.
- **After resuming**, a click paints as fast as Qwik and faster than hydrated Solid, and navigation is faster than Solid and level with Qwik. Solid's handlers change the DOM sooner after a click or a filter input, and plain Solid 1.9 downloads less JavaScript before the first input.

This page explains what was measured. Each chart reads its numbers from the report it names (the [server and resume report](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-19-fair-comparison.md) or the [browser mount report](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-20-dom-mount.md)) and links to it; the reports also list every loss.

All numbers come from short runs on one machine (an Apple M4 Pro Mac, Docker Linux ARM64 for the servers). The host was not quiet during any of the runs: an IDE, a virtual machine and other test suites ran alongside, and each chart's caption gives the load. Treat small gaps as noise. The reports call a result a win or a loss only when the medians differ by at least three percent and the trial ranges do not overlap; everything else is level. These are exploratory numbers for one implementation, not a ranking of frameworks.

## Latest results

Each chart compares lanes of one class: pages that do the same work. Every chart has a table with the same numbers for screen readers, and keyboard users can step through the values with the arrow keys.

### Static pages

A static page sends HTML only, with no client state. Rivet's compiled renderer against Razor and Solid's `renderToString`:

::chart{id=ssr-static-headline}

::chart{id=ssr-static-cpu}

A text grid is the case that favours Razor: every one of the 10 fields per row is a short string, and a fifth of them contain characters that must be escaped. The earlier run (2026-10-09) found Razor's median response faster at ten concurrent requests; this run measured one request at a time, where Rivet wins on CPU, throughput and median response:

::chart{id=ssr-grid-cpu}

### Interactive pages

`rivet-resume` renders a page the browser can resume: a click handler and a reactive attribute per row, links, nested layout state and page data. "Solid 1.9 interactive" does the same work with hydration. The plain hydratable Solid lanes render the same rows without handlers, links or page data, so they do less work. At 1,000 and 5,000 rows, one request at a time, Rivet still uses less CPU than all of them:

::chart{id=ssr-resumable-cpu-1000}

::chart{id=ssr-resumable-cpu-5000}

The loss that remains is a small page under load. At 100 rows and ten concurrent requests, plain hydratable Solid 1.9 needs less CPU per page than Rivet's interactive page. `rivet-router`, the same page without handlers, needs less than Solid, so the cost is the per-row handler and the resume data written for it. A cheaper state encoder landed after this run; its Docker re-measure ran on a busy host, was inconclusive and is still open:

::chart{id=ssr-resumable-cpu-100-c10}

Memory is the other loss. The server process of an interactive Rivet page peaks higher than every Solid lane at 100 rows; at 1,000 rows it is below Solid 1.9 interactive and above the plain hydratable lanes. The report traces it to fixed costs (the router and resume runtime code, the row emitter's buffer) and to the benchmark measuring the 100-row page right after warming up on the largest one; nothing Rivet keeps grows with requests:

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

Client-side mount and updates, with every framework measured in the same interleaved run. Rivet updates 1,000 rows faster than every lane. Mounting 1,000 rows, Rivet and both Solid versions are level:

::chart{id=dom-mount-1000}

::chart{id=dom-update-1000}

Mounting 5,000 rows, Solid 1.9 is faster. The [mount report](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-20-dom-mount.md) traced it to the benchmark protocol rather than the per-field cost: the protocol forces a garbage collection right before the timed mount, and when V8 then finishes its next collection depends on the page's earlier tasks. Without the forced collection, or with incremental marking off, Rivet mounts 5,000 rows faster. A protocol change has been proposed; it needs every framework measured again:

::chart{id=dom-mount-5000}

The DOM benchmark's runtime bundle is also larger than Solid 1.9's (gzip), and smaller than Solid 2's and React's. The [scoreboard](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/perf-scoreboard.md) lists the sizes.

### js-framework-benchmark

The scoreboard also runs the [js-framework-benchmark](https://github.com/krausest/js-framework-benchmark) scenarios locally and compares Rivet's ratio to vanilla JavaScript with the published ratios of other frameworks. In this run every one of those rows is reported as not comparable: the published numbers come from Chrome 154 and this machine ran Chrome 155. The local Rivet-to-vanilla ratios are still listed in the [scoreboard](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/perf-scoreboard.md).

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

## Runs

| Report | What it compared |
| --- | --- |
| [Fair comparison 2026-10-19](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-19-fair-comparison.md) | The latest server and resume run of every lane (static and resumable classes, text grid at concurrency 1, resume in Chrome 155), with the [scoreboard](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/perf-scoreboard.md) of the same day. The charts above read it. |
| [DOM mount 2026-10-20](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-20-dom-mount.md) | Every browser lane re-measured interleaved, plus the attribution of the 5,000-row mount gap to the benchmark's forced garbage collection. The browser charts above read it. |
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
