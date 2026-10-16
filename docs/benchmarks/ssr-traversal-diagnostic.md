# SSR traversal diagnostic

The server renderer now traverses arrays and template regions directly, avoiding a callback allocation for each region. Counts remain captured on entry, later values are read when visited, and async continuations restore the same logical owner. Promise admission, writer backpressure and cancellation remain unchanged.

A diagnostic probe compared the previous production adapter with a freshly bundled adapter in the same Docker image. Each fresh process warms up 200 renders and measures 2,000 renders of the same 1,000-row ASCII page, writing to an accepting discard sink. There is no HTTP, gRPC or backpressure. Three repeats alternate participant order; these short diagnostic runs do not establish statistical significance or application capacity.

| Variant | Median process CPU ms / 2,000 renders | Median wall ms / 2,000 renders |
|---|---:|---:|
| Previous traversal | 5074.001 | 5062.627 |
| Direct traversal | 4721.013 | 4730.202 |

The diagnostic CPU reduction is about 7%. All six runs wrote identical lengths and produced the same complete-page SHA-256. The specialized adapter is 8,452 raw bytes / 3,542 gzip bytes, versus 8,318 / 3,530 in the previous build. These are server artifacts, not browser transfer sizes. The profiler also identified escaping and garbage collection as remaining costs.

[Evidence](ssr-traversal-diagnostic.json) preserves all six measurements, the exact probe source, artifact fingerprints, Docker controls and retained profile fingerprints. The specialized artifact was mounted over the original image module during diagnostics; the production benchmark image has not yet been rebuilt for this change.

Focused checks exercise every alternating template suspension position and mutation during suspension. The fresh full workspace suite passes all six projects and two dependent builds, including async/context/backpressure/cancellation and actual compiler/browser cases. Independent review found no semantic issues.

This diagnostic does not change the [last measured .NET comparison](optimized-ssr-comparison.md). An end-to-end Docker comparison is still required before claiming an application performance gain.
