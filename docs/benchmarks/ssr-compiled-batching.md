# Compiled SSR output batching

Server JSX now lowers to immutable compiler-owned regions using `compiledTemplate()`. Adjacent trusted fragments and primitive child values share output writes. Ordinary public `template()` regions retain their existing interleaved writes and mutation behavior. Browser compilation remains unchanged.

Every object or function child is a boundary, including attributes, promises, arrays, scopes and omitted events. Buffered output flushes and its writer acknowledgment completes before visiting that child. Already-formed asynchronous values are still admitted before rendering, so later rejections are observed even if an earlier write fails. Resumed output and deferred work restore the logical provider owner; abort and failure finalize request scopes.

Compiler-owned fragments, slot arrays and records are frozen. They cannot be changed by a writer during a pending acknowledgment. Referenced child objects remain live: attribute values still coerce exactly once at their ordered rendering position, with the existing URL and escaping rules.

Accumulation flushes after a part reaches 16,384 UTF-16 code units. This is a threshold between atomic parts, not a strict byte limit: one authored fragment or escaped scalar may exceed it. The caller's writer controls transport buffering and backpressure. The renderer does not buffer a whole response merely because the response contains many rows.

The benchmark's typical row now reaches the runtime writer three times (prefix, dynamic attribute, remaining scalar fields) instead of 23. This count describes the lowering, not network packets or a guaranteed speed ratio.

## Diagnostic measurement

Three fresh-process repeats alternate unbatched/batched order in the same Docker Node image with 1 CPU/512 MiB. Each warms up 200 renders and measures 2,000 renders of the same 1,000-row ASCII fixture, writing to an accepting discard sink. No tests or builds ran during these probes.

| Variant | Median process CPU ms / 2,000 renders |
|---|---:|
| Direct traversal, unbatched | 4628.037 |
| Compiled scalar batching | 3925.622 |

This is about 15% less diagnostic CPU. All six probes produced identical complete-page hashes and wrote identical lengths. These short repeats do not establish statistical significance or an HTTP/.NET improvement. [Diagnostic evidence](ssr-compiled-batching-diagnostic.json) contains the exact probe source, all six measurements, artifact hashes and controls.

The server adapter grows from 8,452 raw / 3,542 gzip bytes to 9,196 / 3,768. These are server artifacts, not browser transfer sizes. The last end-to-end result remains the [large-page .NET comparison](optimized-ssr-comparison.md) until the rebuilt Docker comparison completes.

Verification covers scalar batching, every generic-template suspension position, unchanged public-template writes, deferred setup after acknowledgment, owned async continuations, abort cleanup, unsafe attribute coercion timing and large-region threshold flushing. The fresh full workspace checks pass six projects and two dependent builds. Independent focused review passes 47 tests with no actionable findings.
